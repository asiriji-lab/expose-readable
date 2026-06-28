import logging
import os
import tempfile

import fitz  # PyMuPDF

# TODO: Install Tesseract OCR with Thai language pack:
#       Ubuntu/Debian: sudo apt-get install tesseract-ocr tesseract-ocr-tha
#       macOS: brew install tesseract tesseract-lang
#       Windows: https://github.com/UB-Mannheim/tesseract/wiki
try:
    import pytesseract
    from PIL import Image
    _TESSERACT_AVAILABLE = True
except ImportError:
    _TESSERACT_AVAILABLE = False

from shared.s3_client import download_to_temp

logger = logging.getLogger(__name__)

# Pages with fewer avg chars than this threshold trigger Tesseract fallback
_MIN_CHARS_PER_PAGE = 50


def download_from_s3(s3_url: str) -> str:
    """
    Download PDF from S3 to a local temp file and return the local path.

    Demo mode: if s3_url is a local file path (not starting with 's3://'),
    returns it as-is so developers can test without AWS credentials.

    Args:
        s3_url: s3://bucket/case_id/lease.pdf or local path for demo.

    Returns:
        Absolute path to a local PDF file.
    """
    return download_to_temp(s3_url)


def extract_text_pymupdf(pdf_path: str) -> tuple[str, float]:
    """
    Extract text from a PDF using PyMuPDF (fitz).

    Confidence is estimated from character density: pages with very little
    text suggest the PDF is scanned and OCR will be needed instead.

    Args:
        pdf_path: Local path to the PDF file.

    Returns:
        Tuple of (full_text, confidence) where confidence is in [0.0, 1.0].
    """
    doc = fitz.open(pdf_path)
    pages_text: list[str] = []
    for page in doc:
        pages_text.append(page.get_text())
    doc.close()

    full_text = "\n".join(pages_text)
    page_count = max(len(pages_text), 1)
    total_chars = len(full_text.strip())
    confidence = min(1.0, total_chars / (page_count * 300))
    return full_text, confidence


def extract_text_tesseract(pdf_path: str) -> tuple[str, float]:
    """
    Extract text from a scanned PDF by rasterising each page at 300 DPI
    and running Tesseract OCR with Thai+English language model.

    Args:
        pdf_path: Local path to the PDF file.

    Returns:
        Tuple of (full_text, confidence) where confidence is fixed at 0.72
        (empirical estimate for Tesseract on Thai documents).

    Raises:
        RuntimeError: If pytesseract or Pillow is not installed.
    """
    if not _TESSERACT_AVAILABLE:
        raise RuntimeError(
            "pytesseract and Pillow are required for OCR fallback. "
            "Install them with: pip install pytesseract Pillow\n"
            "Also install Tesseract with Thai language pack."
        )

    doc = fitz.open(pdf_path)
    pages_text: list[str] = []
    for page in doc:
        # Render at 300 DPI for good OCR quality
        mat = fitz.Matrix(300 / 72, 300 / 72)
        pix = page.get_pixmap(matrix=mat)
        # Convert pixmap bytes → PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        text = pytesseract.image_to_string(img, lang="tha+eng")
        pages_text.append(text)
    doc.close()

    return "\n".join(pages_text), 0.72


def extract_lease_text(pdf_path: str) -> tuple[str, bool, float]:
    """
    Extract text from a lease PDF, falling back to Tesseract OCR when the
    digital text layer is too sparse (scanned document).

    Strategy:
        1. Try PyMuPDF (fast, exact).
        2. If average chars per page < 50, fall back to Tesseract.

    Args:
        pdf_path: Local path to the PDF file.

    Returns:
        Tuple of (extracted_text, ocr_used, confidence).
    """
    text, confidence = extract_text_pymupdf(pdf_path)

    doc = fitz.open(pdf_path)
    page_count = max(doc.page_count, 1)
    doc.close()

    avg_chars = len(text.strip()) / page_count
    if avg_chars < _MIN_CHARS_PER_PAGE:
        logger.info(
            "PyMuPDF yielded only %.0f avg chars/page — falling back to Tesseract OCR",
            avg_chars,
        )
        text, confidence = extract_text_tesseract(pdf_path)
        return text, True, confidence

    logger.info("PyMuPDF extraction succeeded (avg %.0f chars/page, confidence %.2f)", avg_chars, confidence)
    return text, False, confidence

import io
import logging
import os
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

logger = logging.getLogger(__name__)

# TODO: Download Sarabun font from https://fonts.google.com/specimen/Sarabun
#       Place the following files in agent04_doc_generator/fonts/:
#           Sarabun-Regular.ttf
#           Sarabun-Bold.ttf
#       Without these files the renderer will fall back to Helvetica (no Thai support).
_FONTS_DIR = Path(__file__).parent / "fonts"
_FONT_REGULAR = _FONTS_DIR / "Sarabun-Regular.ttf"
_FONT_BOLD = _FONTS_DIR / "Sarabun-Bold.ttf"

_MARGIN = 2.5 * cm
_PAGE_WIDTH, _PAGE_HEIGHT = A4
_BODY_WIDTH = _PAGE_WIDTH - 2 * _MARGIN

_TITLE_SIZE = 16
_HEADER_SIZE = 13
_BODY_SIZE = 11
_FOOTER_SIZE = 9
_LINE_HEIGHT = 16


def _register_fonts() -> tuple[str, str]:
    """
    Register Sarabun TrueType fonts with ReportLab.

    Returns:
        Tuple of (regular_font_name, bold_font_name) to use in drawing calls.
        Falls back to Helvetica names if font files are missing.
    """
    if _FONT_REGULAR.exists() and _FONT_BOLD.exists():
        pdfmetrics.registerFont(TTFont("Sarabun", str(_FONT_REGULAR)))
        pdfmetrics.registerFont(TTFont("Sarabun-Bold", str(_FONT_BOLD)))
        logger.info("Sarabun fonts registered")
        return "Sarabun", "Sarabun-Bold"
    logger.warning(
        "Sarabun font files not found in %s — falling back to Helvetica (Thai may not render). "
        "Download from https://fonts.google.com/specimen/Sarabun and place .ttf files in fonts/",
        _FONTS_DIR,
    )
    return "Helvetica", "Helvetica-Bold"


def _draw_wrapped_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    font: str,
    size: int,
    max_width: float,
) -> float:
    """
    Draw text with word wrapping. Returns the y position after drawing.

    Args:
        c: ReportLab Canvas.
        text: Text to draw (may contain newlines).
        x: Left margin x coordinate.
        y: Starting y coordinate (top of text).
        font: Font name.
        size: Font size in points.
        max_width: Maximum line width.

    Returns:
        y coordinate after the last line drawn.
    """
    c.setFont(font, size)
    for paragraph in text.split("\n"):
        words = paragraph.split(" ")
        line = ""
        for word in words:
            test_line = f"{line} {word}".strip()
            if c.stringWidth(test_line, font, size) <= max_width:
                line = test_line
            else:
                if line:
                    c.drawString(x, y, line)
                    y -= _LINE_HEIGHT
                line = word
        if line:
            c.drawString(x, y, line)
            y -= _LINE_HEIGHT
    return y


def render_to_pdf(sections: dict, doc_type: str, case_id: str) -> tuple[bytes, int]:
    """
    Render filled document sections to PDF bytes using ReportLab with Sarabun Thai font.

    Page setup:
        - Size: A4
        - Margins: 2.5 cm all sides
        - Title: Sarabun-Bold 16 pt centered
        - Section headers: Sarabun-Bold 13 pt
        - Body: Sarabun-Regular 11 pt
        - Line height: 16 pt
        - Page numbers: bottom center, Sarabun-Regular 9 pt

    Args:
        sections: Dict of {section_key: filled_Thai_text}.
        doc_type: Document type string used as the PDF title.
        case_id: Case identifier shown in the document header.

    Returns:
        Tuple of (pdf_bytes, page_count).
    """
    font_regular, font_bold = _register_fonts()

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    doc_titles = {
        "ocpb_complaint": "หนังสือร้องเรียนต่อ สคบ.",
        "demand_letter": "หนังสือเรียกร้องคืนเงินประกัน",
        "evidence_summary": "สรุปหลักฐานและผลการวินิจฉัย",
    }
    title = doc_titles.get(doc_type, doc_type)
    page_count = 0

    def _new_page() -> float:
        nonlocal page_count
        if page_count > 0:
            c.showPage()
        page_count += 1
        y = _PAGE_HEIGHT - _MARGIN

        # Title
        c.setFont(font_bold, _TITLE_SIZE)
        c.drawCentredString(_PAGE_WIDTH / 2, y, title)
        y -= _LINE_HEIGHT * 2

        # Case ID sub-header
        c.setFont(font_regular, _BODY_SIZE)
        c.drawCentredString(_PAGE_WIDTH / 2, y, f"หมายเลขคดี: {case_id}")
        y -= _LINE_HEIGHT * 2
        return y

    y = _new_page()

    for section_key, text in sections.items():
        # Section header
        if y < _MARGIN + _LINE_HEIGHT * 3:
            _draw_page_number(c, font_regular, page_count)
            y = _new_page()

        c.setFont(font_bold, _HEADER_SIZE)
        c.drawString(_MARGIN, y, section_key.replace("_", " ").title())
        y -= _LINE_HEIGHT

        # Section body
        y = _draw_wrapped_text(
            c, text, _MARGIN, y, font_regular, _BODY_SIZE, _BODY_WIDTH
        )
        y -= _LINE_HEIGHT  # spacing between sections

        if y < _MARGIN + _LINE_HEIGHT * 2:
            _draw_page_number(c, font_regular, page_count)
            y = _new_page()

    _draw_page_number(c, font_regular, page_count)
    c.save()

    return buffer.getvalue(), page_count


def _draw_page_number(c: canvas.Canvas, font: str, page_num: int) -> None:
    """Draw page number at the bottom centre of the current page."""
    c.setFont(font, _FOOTER_SIZE)
    c.drawCentredString(_PAGE_WIDTH / 2, _MARGIN / 2, f"หน้า {page_num}")

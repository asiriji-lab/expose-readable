# Downloads and extracts text from the OCPB 2025 rental deposit notification PDF

import os
import re
import requests
import pdfplumber

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "corpus", "raw")
PDF_PATH = os.path.join(OUTPUT_DIR, "ocpb_2025.pdf")
TXT_PATH = os.path.join(OUTPUT_DIR, "ocpb_2025.txt")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

# Known Royal Gazette URLs for the OCPB rental notification
# (ประกาศคณะกรรมการว่าด้วยสัญญา เรื่อง ให้ธุรกิจการให้เช่าอาคาร...
#  effective 4 September 2025 / 2568 BE)
CANDIDATE_URLS = [
    (
        "https://ratchakitcha.soc.go.th/documents/21100182.pdf"
    ),
    (
        "https://ratchakitcha.soc.go.th/documents/21100183.pdf"
    ),
]

SEARCH_URL = (
    "https://ratchakitcha.soc.go.th/search?"
    "query=%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B2%E0%B8%A8"
    "%E0%B8%84%E0%B8%93%E0%B8%B0%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1"
    "%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A7%E0%B9%88%E0%B8%B2%E0%B8%94"
    "%E0%B9%89%E0%B8%A7%E0%B8%A2%E0%B8%AA%E0%B8%B1%E0%B8%8D%E0%B8%8D"
    "%E0%B8%B2+%E0%B9%83%E0%B8%AB%E0%B9%89%E0%B9%80%E0%B8%8A%E0%B9%88"
    "%E0%B8%B2"
)


def try_download(url: str) -> bool:
    """Attempt to download PDF from url, return True on success."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30, stream=True)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and not url.endswith(".pdf"):
            return False
        with open(PDF_PATH, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"  [WARN] Download failed for {url}: {e}")
        return False


def search_for_pdf() -> str | None:
    """
    Search ratchakitcha.soc.go.th for the notification and try to
    extract a direct PDF link.
    """
    try:
        resp = requests.get(SEARCH_URL, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        # Look for PDF links in the page
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text()
            if (
                "pdf" in href.lower()
                and ("สัญญา" in text or "เช่า" in text or "2568" in text)
            ):
                if href.startswith("http"):
                    return href
                return "https://ratchakitcha.soc.go.th" + href
    except Exception as e:
        print(f"  [WARN] Search failed: {e}")
    return None


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF using pdfplumber."""
    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        print(f"  Extracting text from {total} pages …")
        for i, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            pages_text.append(text)
    print(f"  Extracted {total} pages.")
    return "\n".join(pages_text)


def manual_instructions():
    print(
        "\n[MANUAL ACTION REQUIRED]\n"
        "Automated download of the OCPB 2025 rental notification PDF failed.\n\n"
        "Please follow these steps:\n"
        "1. Open https://ratchakitcha.soc.go.th in your browser.\n"
        "2. Search for:\n"
        "   ประกาศคณะกรรมการว่าด้วยสัญญา เรื่อง ให้ธุรกิจการให้เช่าอาคาร\n"
        "3. Find the notification dated around September 4, 2025 (2568 BE).\n"
        "4. Download the PDF.\n"
        "5. Save it as:\n"
        f"   {PDF_PATH}\n"
        "6. Re-run this script:  python scraper/scrape_ocpb.py\n"
    )


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Skip download if PDF already exists
    if not os.path.exists(PDF_PATH):
        print("Searching for OCPB 2025 PDF on ratchakitcha.soc.go.th …")

        # Try search first
        found_url = search_for_pdf()
        if found_url:
            print(f"  Found URL: {found_url}")
            CANDIDATE_URLS.insert(0, found_url)

        downloaded = False
        for url in CANDIDATE_URLS:
            print(f"  Trying: {url}")
            if try_download(url):
                print(f"  [OK] Downloaded PDF → {PDF_PATH}")
                downloaded = True
                break

        if not downloaded:
            manual_instructions()
            return
    else:
        print(f"PDF already exists at {PDF_PATH}, skipping download.")

    # Extract text
    print("Extracting text from PDF …")
    text = extract_text_from_pdf(PDF_PATH)

    with open(TXT_PATH, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Saved extracted text → {TXT_PATH}")


if __name__ == "__main__":
    main()

# Scrapes Thai Civil and Commercial Code sections 537-571 from krisdika.go.th

import os
import re
import time
import requests
from bs4 import BeautifulSoup

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "corpus", "raw")

# krisdika.go.th serves the CCC via a search/browse interface.
# Book 3 Title 6 (Hire of Property) covers มาตรา 537-571.
# We try a direct text search endpoint first; if that fails we
# fall back to scraping the full Title 6 page and splitting on
# มาตรา markers.

SEARCH_URL = "https://www.krisdika.go.th/law/text/lawlist3"
TITLE6_URL = "https://www.krisdika.go.th/wps/wcm/connect/krisdika_lib/library/lawlibrary/civil+and+commercial+code/book3/title6"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

SECTIONS = range(537, 572)


def clean_text(raw: str) -> str:
    """Strip excess whitespace from extracted text."""
    lines = [l.strip() for l in raw.splitlines()]
    lines = [l for l in lines if l]
    return "\n".join(lines)


def try_fetch_page(url: str, timeout: int = 15) -> requests.Response | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        return resp
    except Exception as e:
        print(f"  [WARN] fetch failed for {url}: {e}")
        return None


def split_by_matra(full_text: str) -> dict[int, str]:
    """
    Split a block of Thai legal text into a dict keyed by section number.
    Splits on the pattern มาตรา <digits>.
    """
    pattern = r"(มาตรา\s+\d+)"
    parts = re.split(pattern, full_text)
    sections: dict[int, str] = {}
    i = 1
    while i < len(parts) - 1:
        header = parts[i].strip()
        body = parts[i + 1].strip() if i + 1 < len(parts) else ""
        m = re.search(r"\d+", header)
        if m:
            num = int(m.group())
            if 537 <= num <= 571:
                sections[num] = f"{header}\n{body}"
        i += 2
    return sections


def scrape_via_full_page() -> dict[int, str]:
    """Attempt to fetch the full Title 6 page and extract all sections."""
    print("Attempting full-page scrape from krisdika.go.th …")
    resp = try_fetch_page(TITLE6_URL)
    if resp is None:
        return {}
    soup = BeautifulSoup(resp.text, "lxml")
    # Remove nav/header/footer noise
    for tag in soup(["nav", "header", "footer", "script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    return split_by_matra(text)


def scrape_via_search() -> dict[int, str]:
    """
    Attempt to find individual section pages through krisdika search,
    then fetch and parse each one.
    """
    print("Attempting per-section search on krisdika.go.th …")
    results: dict[int, str] = {}
    for sec in SECTIONS:
        query_url = (
            f"https://www.krisdika.go.th/lawSearch?query=มาตรา+{sec}"
            f"&lawCode=p1&lang=th"
        )
        resp = try_fetch_page(query_url)
        if resp is None:
            continue
        soup = BeautifulSoup(resp.text, "lxml")
        # Look for a link that contains the section number
        link = None
        for a in soup.find_all("a", href=True):
            if str(sec) in a.get_text():
                link = a["href"]
                break
        if not link:
            continue
        if not link.startswith("http"):
            link = "https://www.krisdika.go.th" + link
        detail = try_fetch_page(link)
        if detail is None:
            continue
        dsoup = BeautifulSoup(detail.text, "lxml")
        for tag in dsoup(["nav", "header", "footer", "script", "style"]):
            tag.decompose()
        text = dsoup.get_text(separator="\n")
        parts = split_by_matra(text)
        if sec in parts:
            results[sec] = parts[sec]
            print(f"  [OK] มาตรา {sec}")
        time.sleep(0.5)
    return results


def save_sections(sections: dict[int, str]) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for num, text in sections.items():
        path = os.path.join(OUTPUT_DIR, f"ccc_{num}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(clean_text(text))
        print(f"  Saved corpus/raw/ccc_{num}.txt")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Strategy 1: try per-section search
    sections = scrape_via_search()

    # Strategy 2: if we got fewer than half the sections, fall back
    if len(sections) < len(SECTIONS) // 2:
        print(
            f"Per-section search yielded only {len(sections)} sections. "
            "Falling back to full-page scrape …"
        )
        sections = scrape_via_full_page()

    if not sections:
        print(
            "\n[MANUAL ACTION REQUIRED]\n"
            "Automated scraping of krisdika.go.th failed.\n"
            "Please do the following manually:\n"
            "1. Visit https://www.krisdika.go.th and search for\n"
            "   'ประมวลกฎหมายแพ่งและพาณิชย์ มาตรา 537-571'\n"
            "2. For each section มาตรา 537 through 571, copy the Thai\n"
            "   legal text and save it as corpus/raw/ccc_NNN.txt\n"
            "   (e.g. corpus/raw/ccc_537.txt, corpus/raw/ccc_538.txt)\n"
            "3. Each file should contain: มาตรา NNN followed by the text.\n"
        )
        return

    save_sections(sections)
    missing = [s for s in SECTIONS if s not in sections]
    if missing:
        print(f"\n[WARN] Sections not retrieved: {missing}")
        print("You can add them manually as corpus/raw/ccc_NNN.txt")
    else:
        print(f"\nDone. Saved {len(sections)} sections.")


if __name__ == "__main__":
    main()

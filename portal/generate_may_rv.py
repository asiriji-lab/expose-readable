"""
generate_may_rv.py
Generates all May 2026 Receipt Voucher PDFs and merges them
into portal/output/may_rv.pdf

Usage:
  python generate_may_rv.py
"""

import os
import sys
import argparse

# ── Windows GTK DLL bootstrap ────────────────────────────────────────────────
if os.name == "nt":
    _gtk_path = os.environ.get("GTK_DLL_PATH") or next(
        (p for p in [
            r"C:\Program Files\GTK3-Runtime Win64\bin",
            r"C:\Program Files\GTK3-Runtime\bin",
            r"C:\Program Files\Gtk-Runtime\bin",
            r"C:\gtk\bin",
            r"C:\msys64\mingw64\bin",
        ] if os.path.isdir(p)),
        None,
    )
    if _gtk_path:
        os.add_dll_directory(_gtk_path)
        os.environ["PATH"] = _gtk_path + os.pathsep + os.environ.get("PATH", "")
    del _gtk_path

import json
import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from pypdf import PdfWriter, PdfReader

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR      = os.path.dirname(BASE_DIR)
DATA_DIR         = os.path.join(PROJECT_DIR, "data")
DOC_TEMPLATE_DIR = os.path.join(PROJECT_DIR, "templates")
OUTPUT_DIR       = os.path.join(BASE_DIR, "output")
PROFILE_PATH     = os.path.join(BASE_DIR, "profile.json")

for d in ["EXP", "INC", "TAX_RECEIPTS", "html"]:
    os.makedirs(os.path.join(OUTPUT_DIR, d), exist_ok=True)

doc_env = Environment(loader=FileSystemLoader(DOC_TEMPLATE_DIR))

# ── Helpers ──────────────────────────────────────────────────────────────────
def normalize_columns(df):
    df.columns = (
        df.columns.astype(str)
        .str.replace(" ", " ", regex=False)
        .str.replace("\n", " ", regex=False)
        .str.strip()
    )
    return df


def parse_money(x) -> Decimal:
    if pd.isna(x):
        return Decimal("0.00")
    s = str(x).replace("฿", "").replace(",", "").strip()
    if s == "" or s == "-":
        return Decimal("0.00")
    return Decimal(s).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def fmt_date(x):
    for f in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(x).strip(), f).strftime("%d/%m/%Y")
        except ValueError:
            pass
    return str(x)


THAI_NUM  = ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"]
THAI_UNIT = ["","สิบ","ร้อย","พัน","หมื่น","แสน","ล้าน"]

def thai_baht_text(amount: Decimal) -> str:
    if amount == 0:
        return "ศูนย์บาทถ้วน"
    n = int(amount)
    def read(num):
        res = ""
        digits = list(map(int, str(num)))
        for i, d in enumerate(digits):
            pos = len(digits) - i - 1
            if d == 0:
                continue
            if pos == 1 and d == 1:
                res += "สิบ"
            elif pos == 1 and d == 2:
                res += "ยี่สิบ"
            elif pos == 0 and d == 1 and res != "":
                res += "เอ็ด"
            else:
                res += THAI_NUM[d] + THAI_UNIT[pos]
        return res
    return read(n) + "บาทถ้วน"


def get_signature_path():
    for name in ("Cfosign.jpg", "Cfosign.png", "cfosign.jpg", "cfosign.png"):
        if os.path.exists(os.path.join(DOC_TEMPLATE_DIR, name)):
            return name
        portal_path = os.path.join(BASE_DIR, "templates", name)
        if os.path.exists(portal_path):
            return f"file://{portal_path}"
    return None


def load_sonar_raw():
    df = normalize_columns(
        pd.read_csv(os.path.join(DATA_DIR, "sonarinfo_2026.tsv"), sep="\t", dtype=str)
    )
    row = df.iloc[0]
    return {
        "company": str(row.get("Company Name", "")).strip(),
        "address":  str(row.get("Address", "")).strip(),
        "tax_id":   str(row.get("Tax ID", "")).strip(),
        "bank":     str(row.get("Bank Account Info", "")).strip(),
    }


def load_profile():
    raw = load_sonar_raw()
    defaults = {
        "company_th": raw["company"],
        "company_en": "SONAR AI COMPANY LIMITED",
        "address":    raw["address"],
        "tax_id":     raw["tax_id"],
        "bank":       raw["bank"],
        "phone":      "0864923997",
        "email":      "contact@sonaraudiobooks.com",
    }
    if os.path.exists(PROFILE_PATH):
        with open(PROFILE_PATH, "r", encoding="utf-8") as f:
            overrides = json.load(f)
        for key, value in overrides.items():
            if value:
                defaults[key] = value
    return defaults


def profile_to_sonar(profile):
    return {
        "company": profile["company_th"],
        "address": profile["address"],
        "tax_id":  profile["tax_id"],
        "bank":    profile["bank"],
    }


def load_clients():
    df = normalize_columns(
        pd.read_csv(os.path.join(DATA_DIR, "clientinfo_2026.tsv"), sep="\t", dtype=str)
    )
    clients = {}
    for _, r in df.iterrows():
        key = str(r.get("Info", "")).strip().upper()
        clients[key] = {
            "name":    str(r.get("Company Name", "")).strip(),
            "address": str(r.get("Address", "")).strip(),
            "tax_id":  str(r.get("Tax ID", "")).strip(),
        }
    return clients


def load_income():
    df = normalize_columns(
        pd.read_csv(
            os.path.join(DATA_DIR, "income_2026 2.tsv"),
            sep="\t", dtype=str, engine="python", on_bad_lines="warn"
        )
    )
    if "Withholding Tax" in df.columns:
        df = df.rename(columns={"Withholding Tax": "Tax"})
    df = df[df["ID"].str.match(r"INC20\d{6}-\d{3}", na=False)]
    return df


def generate_receipt_voucher(row_data, sonar, clients):
    gross = parse_money(row_data["gross"])
    tax   = parse_money(row_data["withholding"])
    net   = parse_money(row_data["net"])

    payer_key      = row_data.get("payer", "").strip().upper()
    official_client = clients.get(payer_key, {}).get("name", payer_key)

    auto_sign = net < Decimal("10000")
    sig = get_signature_path() if (auto_sign or row_data.get("include_signature")) else None

    ctx = {
        "logo":            "logo.png",
        "company":         sonar["company"].upper(),
        "rv_no":           "RV" + row_data["id"][3:],
        "date":            row_data["date"],
        "received_from":   row_data.get("received_from", official_client),
        "payment_method":  row_data["payment_method"],
        "bank":            sonar["bank"],
        "doc_no":          row_data["id"],
        "description":     row_data["description"],
        "gross":           f"{gross:,.2f}",
        "withholding":     f"{tax:,.2f}",
        "net":             f"{net:,.2f}",
        "amount_text":     thai_baht_text(net),
        "notes":           row_data.get("notes", ""),
        "signature_img":   sig,
    }

    html_str = doc_env.get_template("receipt_voucher.html").render(ctx)
    out_path = os.path.join(OUTPUT_DIR, "INC", f"{ctx['rv_no']}.pdf")
    HTML(string=html_str, base_url=DOC_TEMPLATE_DIR).write_pdf(out_path)
    return out_path, ctx["rv_no"]


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    profile  = load_profile()
    sonar    = profile_to_sonar(profile)
    clients  = load_clients()
    income   = load_income()

    # Filter May 2026
    may_rows = []
    for _, r in income.iterrows():
        date_str = str(r.get("Date", "")).strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(date_str, fmt)
                if dt.month == 5 and dt.year == 2026:
                    may_rows.append(r)
                break
            except ValueError:
                pass

    if not may_rows:
        print("No May 2026 income records found.")
        sys.exit(1)

    print(f"Found {len(may_rows)} May 2026 income records. Generating PDFs...\n")

    pdf_paths = []
    for r in may_rows:
        rec_id = str(r["ID"]).strip()
        gross  = parse_money(r["Gross Amount"])
        tax    = parse_money(r.get("Tax", "0"))
        net    = parse_money(r["Amount Net (THB)"])
        payer  = str(r.get("Payer", "")).strip()
        payer_key = payer.upper()
        received_from = clients.get(payer_key, {}).get("name", payer)

        row_data = {
            "id":              rec_id,
            "date":            fmt_date(r["Date"]),
            "payer":           payer,
            "received_from":   received_from,
            "payment_method":  str(r.get("Payment Method", "")).strip(),
            "description":     str(r.get("Description", "")).strip(),
            "gross":           f"{gross:,.2f}",
            "withholding":     f"{tax:,.2f}",
            "net":             f"{net:,.2f}",
            "notes":           str(r.get("Notes", "")).strip() if "Notes" in r.index else "",
            "include_signature": False,
        }

        try:
            path, rv_no = generate_receipt_voucher(row_data, sonar, clients)
            pdf_paths.append(path)
            print(f"  OK  {rv_no}  -  {payer:<40}  {row_data['net']}")
        except Exception as e:
            print(f"  ERR {rec_id}  ERROR: {e}")

    if not pdf_paths:
        print("\nNo PDFs generated.")
        sys.exit(1)

    # Merge all into may_rv.pdf
    merged_path = os.path.join(OUTPUT_DIR, "may_rv.pdf")
    writer = PdfWriter()
    for p in pdf_paths:
        reader = PdfReader(p)
        for page in reader.pages:
            writer.add_page(page)

    with open(merged_path, "wb") as f:
        writer.write(f)

    print(f"\nDone. Merged {len(pdf_paths)} RVs -> {merged_path}")


if __name__ == "__main__":
    main()

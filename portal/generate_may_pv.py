"""
generate_may_pv.py
Generates all May 2026 Payment Voucher PDFs and merges them
into portal/output/may_pv.pdf

Usage:
  python generate_may_pv.py                        # all May records
  python generate_may_pv.py --from-id EXP20260524-024  # from that ID to end
"""

import os
import sys
import argparse

# ── Windows GTK DLL bootstrap (same as app.py) ──────────────────────────────
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
    del _gtk_path

import json
import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from pypdf import PdfWriter, PdfReader

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR     = os.path.dirname(BASE_DIR)
DATA_DIR        = os.path.join(PROJECT_DIR, "data")
DOC_TEMPLATE_DIR = os.path.join(PROJECT_DIR, "templates")
OUTPUT_DIR      = os.path.join(BASE_DIR, "output")
PROFILE_PATH    = os.path.join(BASE_DIR, "profile.json")

for d in ["EXP", "INC", "TAX_RECEIPTS", "html"]:
    os.makedirs(os.path.join(OUTPUT_DIR, d), exist_ok=True)

doc_env = Environment(loader=FileSystemLoader(DOC_TEMPLATE_DIR))

# ── Helpers (mirrored from app.py) ───────────────────────────────────────────
def normalize_columns(df):
    df.columns = (
        df.columns.astype(str)
        .str.replace(" ", " ", regex=False)
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


def format_tax_id(tax_id):
    clean = str(tax_id).replace("-", "").strip()
    if len(clean) == 13:
        return f"{clean[0]}-{clean[1:5]}-{clean[5:10]}-{clean[10:12]}-{clean[12]}"
    return tax_id


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


def load_expenses():
    df = normalize_columns(
        pd.read_csv(
            os.path.join(DATA_DIR, "expense_2026.tsv"),
            sep="\t", dtype=str, engine="python", on_bad_lines="warn"
        )
    )
    df = df.rename(columns={"Withholding Tax": "Tax"})
    df = df[df["ID"].str.match(r"EXP20\d{6}-\d{3}", na=False)]
    return df


def generate_payment_voucher(row_data, sonar):
    gross = parse_money(row_data["gross"])
    wht   = parse_money(row_data["withholding"])
    net   = parse_money(row_data["net"])

    auto_sign = net < Decimal("10000")
    sig = get_signature_path() if (auto_sign or row_data.get("include_signature")) else None

    ctx = {
        "logo":            "logo.png",
        "company":         sonar["company"].upper(),
        "pv_no":           "PV" + row_data["id"][3:],
        "date":            row_data["date"],
        "paid_to":         row_data["paid_to"].upper(),
        "department":      row_data["department"],
        "payment_method":  row_data["payment_method"],
        "bank":            sonar["bank"],
        "doc_no":          row_data["id"],
        "description":     row_data["description"],
        "gross":           f"{gross:,.2f}",
        "gross_amount":    float(gross),   # numeric, used in template comparison
        "withholding":     f"{wht:,.2f}",
        "net":             f"{net:,.2f}",
        "amount_text":     thai_baht_text(net),
        "notes":           row_data.get("notes", ""),
        "signature_img":   sig,
    }

    html_str = doc_env.get_template("payment_voucher.html").render(ctx)
    out_path = os.path.join(OUTPUT_DIR, "EXP", f"{ctx['pv_no']}.pdf")
    HTML(string=html_str, base_url=DOC_TEMPLATE_DIR).write_pdf(out_path)
    return out_path, ctx["pv_no"]


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-id", default=None, help="Start generating from this expense ID (inclusive)")
    args = parser.parse_args()

    profile  = load_profile()
    sonar    = profile_to_sonar(profile)
    expenses = load_expenses()

    # Filter May 2026
    may_rows = []
    reached_start = args.from_id is None
    for _, r in expenses.iterrows():
        rec_id = str(r.get("ID", "")).strip()
        if not reached_start:
            if rec_id == args.from_id:
                reached_start = True
            else:
                continue
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
        print("No May 2026 expense records found.")
        sys.exit(1)

    print(f"Found {len(may_rows)} May 2026 expense records. Generating PDFs...\n")

    pdf_paths = []
    for r in may_rows:
        rec_id = str(r["ID"]).strip()
        gross  = parse_money(r["Gross Amount"])
        wht    = parse_money(r["Tax"])
        net    = parse_money(r["Amount Net (THB)"])

        row_data = {
            "id":             rec_id,
            "date":           fmt_date(r["Date"]),
            "paid_to":        str(r.get("Vendor / Payee", "")).strip(),
            "department":     str(r.get("Department / Project", "")).strip(),
            "payment_method": str(r.get("Payment Method", "")).strip(),
            "description":    str(r.get("Description", "")).strip(),
            "gross":          f"{gross:,.2f}",
            "withholding":    f"{wht:,.2f}",
            "net":            f"{net:,.2f}",
            "notes":          "",
            "include_signature": False,
        }

        try:
            path, pv_no = generate_payment_voucher(row_data, sonar)
            pdf_paths.append(path)
            print(f"  OK  {pv_no}  -  {row_data['paid_to'][:40]:<40}  {row_data['net']}")
        except Exception as e:
            print(f"  ERR {rec_id}  ERROR: {e}")

    if not pdf_paths:
        print("\nNo PDFs generated.")
        sys.exit(1)

    # Merge all into may_pv.pdf
    merged_path = os.path.join(OUTPUT_DIR, "may_pv.pdf")
    writer = PdfWriter()
    for p in pdf_paths:
        reader = PdfReader(p)
        for page in reader.pages:
            writer.add_page(page)

    with open(merged_path, "wb") as f:
        writer.write(f)

    print(f"\nDone. Merged {len(pdf_paths)} PVs -> {merged_path}")


if __name__ == "__main__":
    main()

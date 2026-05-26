#!/usr/bin/env python3
"""
generate_wht.py — Thai Withholding Tax Certificate Generator

Reads expense TSV for a given month, finds all rows with non-zero withholding
tax, and produces a new .xlsx workbook where each sheet is one filled-in
certificate (หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ).

Usage:
    python generate_wht.py 03/2026
    python generate_wht.py            # prompts for month
"""

import os
import sys
import json
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

import pandas as pd
from openpyxl import load_workbook

# ======================================================
# PATHS
# ======================================================
BASE_DIR = os.getcwd()
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMPLATE_XLSX = os.path.join(BASE_DIR, "templates", "Sonar AI-50 ทวิ.xlsx")
PAYEE_JSON = os.path.join(DATA_DIR, "payeeinfo.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "output", "WHT")

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ======================================================
# HELPERS
# ======================================================
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


def parse_date(x) -> datetime:
    """Parse DD/MM/YYYY or YYYY-MM-DD → datetime."""
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(x).strip(), fmt)
        except ValueError:
            pass
    raise ValueError(f"Unrecognised date format: {x!r}")


def fmt_date_buddhist(x) -> str:
    """DD/MM/YYYY in Thai Buddhist calendar (e.g. 10/03/2569)."""
    dt = parse_date(x)
    return dt.strftime(f"%d/%m/{dt.year + 543}")


def get_input(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip()
    return val if val else default


def sanitize_sheet_name(name: str) -> str:
    """Remove characters Excel forbids in sheet names; cap at 31 chars."""
    for ch in r"\/?*[]":
        name = name.replace(ch, "")
    return name[:31]


# ======================================================
# MONTH INPUT
# ======================================================
def get_target_month() -> tuple[int, int]:
    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        raw = get_input("Month to process (MM/YYYY)", datetime.now().strftime("%m/%Y"))
    try:
        dt = datetime.strptime(raw.strip(), "%m/%Y")
        return dt.month, dt.year
    except ValueError:
        print(f"Invalid format '{raw}'. Use MM/YYYY e.g. 03/2026")
        sys.exit(1)


# ======================================================
# PAYEE LOOKUP DATABASE
# ======================================================
def load_payees() -> dict:
    if os.path.exists(PAYEE_JSON):
        with open(PAYEE_JSON, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_payees(payees: dict):
    with open(PAYEE_JSON, "w", encoding="utf-8") as f:
        json.dump(payees, f, ensure_ascii=False, indent=2)


def resolve_payee(vendor: str, payees: dict) -> dict:
    """
    Look up Thai info for an English vendor name.
    If not found, prompt the user and persist the result.
    """
    key = vendor.strip()

    # Exact match
    if key in payees:
        return payees[key]

    # Case-insensitive fallback
    lower_map = {k.lower(): k for k in payees}
    if key.lower() in lower_map:
        return payees[lower_map[key.lower()]]

    # Not found — prompt user
    print(f"\n  New payee: '{vendor}'")
    print("  Enter Thai certificate info (will be saved for future use):")
    thai_name  = get_input("  ชื่อ (Thai name)")
    tax_id     = get_input("  เลขประจำตัวผู้เสียภาษีอากร (13-digit Tax ID)")
    address    = get_input("  ที่อยู่ (Address)")
    short_name = get_input("  ชื่อย่อ (Short name for sheet tab, e.g. ชยันต์)")

    info = {
        "thai_name":  thai_name,
        "tax_id":     tax_id,
        "address":    address,
        "short_name": short_name,
    }
    payees[key] = info
    save_payees(payees)
    print(f"  Saved to {PAYEE_JSON}\n")
    return info


# ======================================================
# MAIN
# ======================================================
def main():
    month, year = get_target_month()

    # Buddhist year YYMM prefix — last 2 digits of Buddhist year + 2-digit month
    yymm = f"{str(year + 543)[-2:]}{month:02d}"

    print(f"\nGenerating WHT certificates for {month:02d}/{year}  (Buddhist prefix: {yymm})")
    print("=" * 65)

    # Load and filter expenses
    tsv_path = os.path.join(DATA_DIR, f"expense_{year}.tsv")
    if not os.path.exists(tsv_path):
        print(f"Expense file not found: {tsv_path}")
        sys.exit(1)

    expense_df = normalize_columns(
        pd.read_csv(tsv_path, sep="\t", dtype=str, on_bad_lines="warn")
    )
    expense_df = expense_df[
        expense_df["ID"].str.match(r"EXP20\d{6}-\d{3}", na=False)
    ]

    def in_target_month(date_str):
        try:
            dt = parse_date(date_str)
            return dt.month == month and dt.year == year
        except ValueError:
            return False

    mask = (
        expense_df["Date"].apply(in_target_month)
        & expense_df["Withholding Tax"].apply(lambda x: parse_money(x) > 0)
    )
    filtered = expense_df[mask].copy()

    # Sort by date ascending, preserving original TSV order for same-date ties
    filtered["_dt"] = filtered["Date"].apply(parse_date)
    filtered = filtered.sort_values("_dt", kind="stable").reset_index(drop=True)

    if filtered.empty:
        print(f"No expenses with withholding tax found for {month:02d}/{year}.")
        return

    print(f"Found {len(filtered)} expense(s) with withholding tax.\n")

    # Resolve all payee info upfront (interactive prompts happen here)
    payees = load_payees()
    resolved = [
        resolve_payee(str(row["Vendor / Payee"]).strip(), payees)
        for _, row in filtered.iterrows()
    ]

    # Load Excel template workbook
    if not os.path.exists(TEMPLATE_XLSX):
        print(f"Template not found: {TEMPLATE_XLSX}")
        sys.exit(1)

    print(f"Loading template: {os.path.basename(TEMPLATE_XLSX)}")
    wb = load_workbook(TEMPLATE_XLSX)
    original_sheets = wb.sheetnames[:]
    template_ws = wb[original_sheets[0]]  # use first sheet as structural template

    # Build one sheet per certificate.
    # Use temp names first so they never clash with original sheet names that
    # are still in the workbook at this point.
    print("Building certificates...\n")
    new_sheets = []   # list of (ws, final_title, log_line)
    for i, (_, row) in enumerate(filtered.iterrows()):
        cert_num = f"{yymm}-{i + 1:03d}"
        vendor   = str(row["Vendor / Payee"]).strip()
        info     = resolved[i]
        gross    = parse_money(row["Gross Amount"])
        date_bud = fmt_date_buddhist(row["Date"])

        ws = wb.copy_worksheet(template_ws)
        ws.title = f"_wht_{i + 1:03d}_"   # safe temp name — no collision risk

        # Fill Version-1 data entry cells only.
        # Formulas in versions 2-4 (=$Q3, =$C12, etc.) auto-propagate.
        ws["Q3"]  = cert_num
        ws["C12"] = info["thai_name"]
        ws["P12"] = info["tax_id"]
        ws["C14"] = info["address"]
        ws["M45"] = date_bud        # text string DD/MM/YYYY Buddhist
        ws["O45"] = float(gross)    # Q45 formula (=ROUND(O45*3%,2)) auto-calculates
        ws.print_area = "A1:BV64"

        final_title = sanitize_sheet_name(f"{cert_num}-{info['short_name']}")
        new_sheets.append((ws, final_title))

        print(f"  [{cert_num}]  {vendor}")
        print(f"           → {info['thai_name']}  |  {date_bud}  |  ฿{gross:,.2f}")

    # Remove original sheets, then rename new ones to final titles
    for name in original_sheets:
        del wb[name]
    for ws, final_title in new_sheets:
        ws.title = final_title

    # Save output workbook
    out_path = os.path.join(OUTPUT_DIR, f"WHT_{yymm}.xlsx")
    wb.save(out_path)

    # Summary
    print("\n" + "=" * 65)
    print(f"✅  {len(filtered)} certificate(s) generated")
    print(f"📁  {out_path}")
    print("=" * 65)

    header = f"{'Cert':12}  {'Payee (EN)':<30}  {'Thai Name':<22}  {'Date':10}  {'Gross':>10}  {'WHT':>8}"
    print(f"\n{header}")
    print("-" * len(header))
    for i, (_, row) in enumerate(filtered.iterrows()):
        cert_num = f"{yymm}-{i + 1:03d}"
        vendor   = str(row["Vendor / Payee"]).strip()
        info     = resolved[i]
        gross    = parse_money(row["Gross Amount"])
        wht      = parse_money(row["Withholding Tax"])
        date_bud = fmt_date_buddhist(row["Date"])
        print(
            f"{cert_num:12}  {vendor[:29]:<30}  {info['thai_name'][:21]:<22}  "
            f"{date_bud:10}  {float(gross):>10,.2f}  {float(wht):>8,.2f}"
        )
    print()


if __name__ == "__main__":
    main()

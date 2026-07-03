import os

# ── Windows: WeasyPrint / GTK DLL bootstrap ────────────────────────────────
# Python 3.8+ no longer searches PATH for DLLs — the GTK bin directory must
# be registered explicitly via os.add_dll_directory() before weasyprint loads.
#
# To override the auto-detected path, set the GTK_DLL_PATH environment variable:
#   $env:GTK_DLL_PATH = "C:\my\custom\gtk\bin"   (PowerShell)
#   set GTK_DLL_PATH=C:\my\custom\gtk\bin         (cmd)
#
# Recommended GTK3 source for Windows (Pango 1.44+ required by WeasyPrint 53+):
#   https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
if os.name == "nt":
    _gtk_path = os.environ.get("GTK_DLL_PATH") or next(
        (p for p in [
            r"C:\Program Files\GTK3-Runtime Win64\bin",   # tschoonj installer (recommended)
            r"C:\Program Files\GTK3-Runtime\bin",
            r"C:\Program Files\Gtk-Runtime\bin",          # GtkD / winget package
            r"C:\gtk\bin",                                # manual / custom install
            r"C:\msys64\mingw64\bin",                     # MSYS2
        ] if os.path.isdir(p)),
        None,
    )
    if _gtk_path:
        os.add_dll_directory(_gtk_path)
    del _gtk_path

import json
import re
import glob
import shutil
import csv
import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from flask import (
    Flask, render_template, request, redirect, url_for,
    send_file, flash,
)
from werkzeug.utils import secure_filename
from pypdf import PdfWriter, PdfReader
from PIL import Image
import zipfile
import io

from generate_may_pv import generate_payment_voucher as generate_payment_voucher_pv

# ======================================================
# APP SETUP
# ======================================================
app = Flask(__name__)
app.secret_key = "sonar-accounting-portal-2026"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(PROJECT_DIR, "data")
DOC_TEMPLATE_DIR = os.path.join(PROJECT_DIR, "templates")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
PROFILE_PATH = os.path.join(BASE_DIR, "profile.json")
ASSEMBLY_DIR = os.path.join(OUTPUT_DIR, "ASSEMBLY")
EX_DATA_DIR = os.path.join(PROJECT_DIR, "ex_data")
WHT_DIR = os.path.join(PROJECT_DIR, "output", "WHT")
ASSEMBLY_TAGS = {"slip", "receipt", "wht", "other"}

for d in ["EXP", "INC", "TAX_RECEIPTS", "html"]:
    os.makedirs(os.path.join(OUTPUT_DIR, d), exist_ok=True)

doc_env = Environment(loader=FileSystemLoader(DOC_TEMPLATE_DIR))

# ======================================================
# HELPERS
# ======================================================
def normalize_columns(df):
    df.columns = (
        df.columns.astype(str)
        .str.replace("\u00a0", " ", regex=False)
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


def fmt_date_thai_short(x):
    for f in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(str(x).strip(), f)
            thai_year = (dt.year + 543) % 100
            return dt.strftime(f"%d/%m/{thai_year:02d}")
        except ValueError:
            pass
    return str(x)


def fmt_date_thai_full(x):
    for f in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(str(x).strip(), f)
            thai_year = dt.year + 543
            return dt.strftime(f"%d/%m/{thai_year}")
        except ValueError:
            pass
    return str(x)


def format_tax_id(tax_id):
    clean = str(tax_id).replace("-", "").strip()
    if len(clean) == 13:
        return f"{clean[0]}-{clean[1:5]}-{clean[5:10]}-{clean[10:12]}-{clean[12]}"
    return tax_id


def get_signature_path():
    for name in ("Cfosign.jpg", "Cfosign.png", "cfosign.jpg", "cfosign.png"):
        # Check project-level templates directory
        if os.path.exists(os.path.join(DOC_TEMPLATE_DIR, name)):
            return name
        # Check portal's own templates directory (Flask static templates)
        portal_path = os.path.join(BASE_DIR, "templates", name)
        if os.path.exists(portal_path):
            return f"file://{portal_path}"
    return None


# ======================================================
# THAI BAHT TEXT
# ======================================================
THAI_NUM = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
THAI_UNIT = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"]

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


# ======================================================
# PROFILE SYSTEM
# ======================================================
def load_sonar_raw():
    df = normalize_columns(
        pd.read_csv(os.path.join(DATA_DIR, "sonarinfo_2026.tsv"), sep="\t", dtype=str)
    )
    row = df.iloc[0]
    return {
        "company": str(row.get("Company Name", "")).strip(),
        "address": str(row.get("Address", "")).strip(),
        "tax_id": str(row.get("Tax ID", "")).strip(),
        "bank": str(row.get("Bank Account Info", "")).strip(),
    }


def load_profile():
    raw = load_sonar_raw()
    defaults = {
        "company_th": raw["company"],
        "company_en": "SONAR AI COMPANY LIMITED",
        "address": raw["address"],
        "tax_id": raw["tax_id"],
        "bank": raw["bank"],
        "phone": "0864923997",
        "email": "contact@sonaraudiobooks.com",
    }
    if os.path.exists(PROFILE_PATH):
        with open(PROFILE_PATH, "r", encoding="utf-8") as f:
            overrides = json.load(f)
        for key, value in overrides.items():
            if value:
                defaults[key] = value
    return defaults


def save_profile(data):
    with open(PROFILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def profile_to_sonar(profile):
    return {
        "company": profile["company_th"],
        "address": profile["address"],
        "tax_id": profile["tax_id"],
        "bank": profile["bank"],
    }


# ======================================================
# DATA LOADING
# ======================================================
def load_clients():
    df = normalize_columns(
        pd.read_csv(os.path.join(DATA_DIR, "clientinfo_2026.tsv"), sep="\t", dtype=str)
    )
    clients = {}
    for _, r in df.iterrows():
        key = str(r.get("Info", "")).strip().upper()
        clients[key] = {
            "name": str(r.get("Company Name", "")).strip(),
            "address": str(r.get("Address", "")).strip(),
            "tax_id": str(r.get("Tax ID", "")).strip(),
        }
    return clients


def load_expenses():
    df = normalize_columns(
        pd.read_csv(os.path.join(DATA_DIR, "expense_2026.tsv"), sep="\t", dtype=str,
                    engine="python", on_bad_lines="warn")
    )
    df = df.rename(columns={"Withholding Tax": "Tax"})
    df = df[df["ID"].str.match(r"EXP20\d{6}-\d{3}", na=False)]
    return df


def load_income():
    df = normalize_columns(
        pd.read_csv(
            os.path.join(DATA_DIR, "income_2026 2.tsv"),
            sep="\t", dtype=str, engine="python", on_bad_lines="warn"
        )
    )
    df.columns = df.columns.str.strip()
    if "Withholding Tax" in df.columns:
        df = df.rename(columns={"Withholding Tax": "Tax"})
    df = df[df["ID"].str.match(r"INC20\d{6}-\d{3}", na=False)]
    return df


# ======================================================
# ASSEMBLY WORKSPACE
# ======================================================
def is_valid_month(s):
    try:
        datetime.strptime(s, "%Y-%m")
        return True
    except (ValueError, TypeError):
        return False


def month_expenses(year, month):
    """Expense rows (pandas Series) whose Date falls in year/month."""
    df = load_expenses()
    rows = []
    for _, r in df.iterrows():
        date_str = str(r.get("Date", "")).strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(date_str, fmt)
                if dt.year == year and dt.month == month:
                    rows.append(r)
                break
            except ValueError:
                pass
    return rows


def load_skip_vendors():
    """Vendor names (lowercased) marked skip:true in payeeinfo.json — mirrors generate_wht.py."""
    path = os.path.join(DATA_DIR, "payeeinfo.json")
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        payees = json.load(f)
    return {k.strip().lower() for k, v in payees.items() if v.get("skip")}


def buddhist_yymm(year, month):
    return f"{(year + 543) % 100:02d}{month:02d}"


def wht_workbook_path(year, month):
    return os.path.join(WHT_DIR, f"WHT_{buddhist_yymm(year, month)}.xlsx")


def pv_pdf_path(exp_id):
    return os.path.join(OUTPUT_DIR, "EXP", f"PV{exp_id[3:]}.pdf")


def assembly_month_dir(month):
    return os.path.join(ASSEMBLY_DIR, month)


def assembly_files_dir(month):
    return os.path.join(assembly_month_dir(month), "files")


def assembly_bundle_dir(month):
    return os.path.join(assembly_month_dir(month), "bundle")


def assembly_manifest_path(month):
    return os.path.join(assembly_month_dir(month), "manifest.json")


def find_canonical(files_dir, exp_id, tag):
    matches = glob.glob(os.path.join(files_dir, f"{exp_id}_{tag}.*"))
    return matches[0] if matches else None


def derive_manifest(month):
    """Recompute doc presence from disk + ledger (never trust stale manifest for presence).
    Persists the recomputed snapshot, carrying forward done_overrides + salary_xlsxfile."""
    year, mon = map(int, month.split("-"))
    rows = month_expenses(year, mon)
    skip_vendors = load_skip_vendors()

    files_dir = assembly_files_dir(month)
    os.makedirs(files_dir, exist_ok=True)
    manifest_path = assembly_manifest_path(month)

    old = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, encoding="utf-8") as f:
                old = json.load(f)
        except (json.JSONDecodeError, OSError):
            old = {}
    done_overrides = old.get("done_overrides", {})
    salary_xlsxfile = old.get("salary_xlsxfile")
    if salary_xlsxfile and not os.path.exists(os.path.join(files_dir, salary_xlsxfile)):
        salary_xlsxfile = None

    wht_wb_path = wht_workbook_path(year, mon)
    wht_wb_exists = os.path.exists(wht_wb_path)

    expenses = []
    for r in rows:
        exp_id = str(r["ID"]).strip()
        vendor = str(r.get("Vendor / Payee", "")).strip()
        wht_amt = parse_money(r.get("Tax", "0"))
        needs_wht = wht_amt > 0 and vendor.lower() not in skip_vendors
        section = "with_wht" if needs_wht else "no_wht"

        pv_file = pv_pdf_path(exp_id)
        pv_present = os.path.exists(pv_file)
        slip_file = find_canonical(files_dir, exp_id, "slip")
        receipt_file = find_canonical(files_dir, exp_id, "receipt")

        docs = {
            "pv": {"status": "generated" if pv_present else "missing",
                   "file": os.path.basename(pv_file) if pv_present else None},
            "slip": {"status": "uploaded" if slip_file else "missing",
                      "file": os.path.basename(slip_file) if slip_file else None},
            "receipt": {"status": "uploaded" if receipt_file else "missing",
                         "file": os.path.basename(receipt_file) if receipt_file else None},
        }
        if needs_wht:
            wht_file = find_canonical(files_dir, exp_id, "wht")
            wht_present = wht_wb_exists or bool(wht_file)
            docs["wht"] = {"status": "present" if wht_present else "missing",
                            "file": os.path.basename(wht_file) if wht_file else None}

        required_ok = (
            pv_present and bool(slip_file) and bool(receipt_file)
            and (not needs_wht or docs["wht"]["status"] == "present")
        )
        done = done_overrides.get(exp_id, required_ok)

        expenses.append({
            "id": exp_id,
            "date": fmt_date(r.get("Date", "")),
            "vendor": vendor,
            "description": str(r.get("Description", "")).strip(),
            "gross": f"{parse_money(r.get('Gross Amount', '0')):,.2f}",
            "wht": f"{wht_amt:,.2f}",
            "net": f"{parse_money(r.get('Amount Net (THB)', '0')):,.2f}",
            "section": section,
            "docs": docs,
            "required_ok": required_ok,
            "done": done,
        })

    manifest_out = {
        "salary_xlsxfile": salary_xlsxfile,
        "done_overrides": done_overrides,
        "expenses": {e["id"]: {"section": e["section"], "done": e["done"], "docs": e["docs"]}
                     for e in expenses},
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_out, f, ensure_ascii=False, indent=2)

    return {
        "expenses": expenses,
        "salary_xlsxfile": salary_xlsxfile,
        "wht_wb_exists": wht_wb_exists,
        "wht_wb_path": wht_wb_path,
    }


def load_kbiz_hints(year, month):
    """Read-only visual hint rows from ex_data/resultFile_*.csv matching the month. No matching/tagging."""
    hints = []
    for csv_path in glob.glob(os.path.join(EX_DATA_DIR, "resultFile_*.csv")):
        try:
            with open(csv_path, encoding="utf-8-sig") as f:
                rows = list(csv.reader(f))
        except OSError:
            continue
        for row in rows:
            if len(row) < 7:
                continue
            try:
                dt = datetime.strptime(row[1].strip(), "%d-%m-%y")
            except ValueError:
                continue
            if dt.year != year or dt.month != month:
                continue
            withdrawal = row[4].strip()
            deposit = row[6].strip()
            if not (withdrawal or deposit):
                continue
            hints.append({
                "date": dt.strftime("%d/%m/%Y"),
                "desc": row[3].strip(),
                "withdrawal": withdrawal,
                "deposit": deposit,
            })
    hints.sort(key=lambda h: h["date"])
    return hints


# ======================================================
# PDF GENERATION
# ======================================================
def generate_payment_voucher(row_data, sonar):
    gross = parse_money(row_data["gross"])
    wht = parse_money(row_data["withholding"])
    net = parse_money(row_data["net"])

    # Auto-sign anything under ฿10,000; also respect manual checkbox for larger amounts
    auto_sign = net < Decimal("10000")
    sig = get_signature_path() if (auto_sign or row_data.get("include_signature")) else None

    ctx = {
        "logo": "logo.png",
        "company": sonar["company"].upper(),
        "pv_no": "PV" + row_data["id"][3:],
        "date": row_data["date"],
        "paid_to": row_data["paid_to"].upper(),
        "department": row_data["department"],
        "payment_method": row_data["payment_method"],
        "bank": sonar["bank"],
        "doc_no": row_data["id"],
        "description": row_data["description"],
        "gross": f"{gross:,.2f}",
        "withholding": f"{wht:,.2f}",
        "net": f"{net:,.2f}",
        "amount_text": thai_baht_text(net),
        "notes": row_data.get("notes", ""),
        "signature_img": sig,
    }

    html = doc_env.get_template("payment_voucher.html").render(ctx)
    out_path = os.path.join(OUTPUT_DIR, "EXP", f"{ctx['pv_no']}.pdf")
    HTML(string=html, base_url=DOC_TEMPLATE_DIR).write_pdf(out_path)
    return out_path, ctx["pv_no"]


def generate_receipt_voucher(row_data, sonar, clients):
    gross = parse_money(row_data["gross"])
    tax = parse_money(row_data["withholding"])
    net = parse_money(row_data["net"])

    payer_key = row_data.get("payer", "").strip().upper()
    official_client = clients.get(payer_key, {}).get("name", payer_key)

    auto_sign = net < Decimal("10000")
    sig = get_signature_path() if (auto_sign or row_data.get("include_signature")) else None

    ctx = {
        "logo": "logo.png",
        "company": sonar["company"].upper(),
        "rv_no": "RV" + row_data["id"][3:],
        "date": row_data["date"],
        "received_from": row_data.get("received_from", official_client),
        "payment_method": row_data["payment_method"],
        "bank": sonar["bank"],
        "doc_no": row_data["id"],
        "description": row_data["description"],
        "gross": f"{gross:,.2f}",
        "withholding": f"{tax:,.2f}",
        "net": f"{net:,.2f}",
        "amount_text": thai_baht_text(net),
        "notes": row_data.get("notes", ""),
        "signature_img": sig,
    }

    html = doc_env.get_template("receipt_voucher.html").render(ctx)
    out_path = os.path.join(OUTPUT_DIR, "INC", f"{ctx['rv_no']}.pdf")
    HTML(string=html, base_url=DOC_TEMPLATE_DIR).write_pdf(out_path)
    return out_path, ctx["rv_no"]


def generate_tax_receipt(row_data, sonar, clients, profile=None):
    gross = parse_money(row_data["gross"])

    payer_key = row_data.get("payer", "").strip().upper()
    buyer = clients.get(payer_key, {})

    seller_tax_formatted = format_tax_id(sonar["tax_id"])
    buyer_tax_formatted = format_tax_id(buyer.get("tax_id", ""))

    sig = None
    if row_data.get("include_signature"):
        sig = get_signature_path()

    ctx = {
        "seller_name_th": sonar["company"],
        "seller_name_en": profile["company_en"] if profile else "SONAR AI COMPANY LIMITED",
        "seller_address": sonar["address"],
        "seller_tax": sonar["tax_id"],
        "seller_tax_formatted": seller_tax_formatted,
        "seller_phone": profile["phone"] if profile else "0864923997",
        "seller_email": profile["email"] if profile else "contact@sonaraudiobooks.com",
        "bank_info": sonar["bank"],
        "buyer_name": row_data.get("buyer_name", buyer.get("name", payer_key)),
        "buyer_address": row_data.get("buyer_address", buyer.get("address", "")),
        "buyer_tax": buyer.get("tax_id", ""),
        "buyer_tax_formatted": buyer_tax_formatted,
        "buyer_branch": row_data.get("buyer_branch", "สำนักงานใหญ่"),
        "buyer_branch_code": row_data.get("buyer_branch_code", ""),
        "receipt_no": row_data["id"],
        "receipt_date": fmt_date_thai_short(row_data["date"]),
        "receipt_date_full": fmt_date_thai_full(row_data["date"]),
        "ref_invoice": row_data.get("ref_invoice", ""),
        "ref_date": fmt_date_thai_short(row_data.get("ref_date", row_data["date"])),
        "description": row_data["description"],
        "qty": 1,
        "unit_price": f"{gross:,.2f}",
        "amount": f"{gross:,.2f}",
        "subtotal": f"{gross:,.2f}",
        "vat": "0.00",
        "vat_rate": "0%",
        "total": f"{gross:,.2f}",
        "amount_text": thai_baht_text(gross),
        "payment_cash": row_data.get("payment_cash", False),
        "payment_transfer": row_data.get("payment_transfer", True),
        "payment_check": row_data.get("payment_check", False),
        "notes": row_data.get("notes", ""),
        "signature_img": sig,
    }

    font_config = FontConfiguration()
    css = CSS(string='@page { size: A4; margin: 1.5cm; }', font_config=font_config)

    html_content = doc_env.get_template("receipt_full.html").render(ctx)

    html_path = os.path.join(OUTPUT_DIR, "html", f"{row_data['id']}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    pdf_path = os.path.join(OUTPUT_DIR, "TAX_RECEIPTS", f"{row_data['id']}.pdf")
    HTML(string=html_content, encoding='utf-8', base_url=DOC_TEMPLATE_DIR).write_pdf(
        pdf_path, stylesheets=[css], font_config=font_config
    )
    return pdf_path, row_data["id"]


# ======================================================
# ROUTES
# ======================================================
@app.route("/")
def index():
    profile = load_profile()
    sonar = profile_to_sonar(profile)
    expenses = load_expenses()
    income = load_income()

    exp_records = []
    for _, r in expenses.iterrows():
        date_str = str(r.get("Date", "")).strip()
        month = ""
        for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                month = str(datetime.strptime(date_str, fmt).month)
                break
            except ValueError:
                pass
        exp_records.append({
            "id": r["ID"],
            "number": str(r.get("Number", "")).strip(),
            "date": date_str,
            "month": month,
            "counterparty": str(r.get("Vendor / Payee", "")).strip(),
            "description": str(r.get("Description", "")).strip(),
            "gross": str(r.get("Gross Amount", "")),
            "tax": str(r.get("Tax", "")),
            "net": str(r.get("Amount Net (THB)", "")),
            "payment_method": str(r.get("Payment Method", "")),
            "department": str(r.get("Department / Project", "")),
        })

    inc_records = []
    for idx, (_, r) in enumerate(income.iterrows(), start=1):
        date_str = str(r.get("Date", "")).strip()
        month = ""
        for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                month = str(datetime.strptime(date_str, fmt).month)
                break
            except ValueError:
                pass
        inc_records.append({
            "id": r["ID"],
            "number": str(idx),
            "date": date_str,
            "month": month,
            "counterparty": str(r.get("Payer", "")).strip(),
            "description": str(r.get("Description", "")).strip(),
            "gross": str(r.get("Gross Amount", "")),
            "tax": str(r.get("Tax", "")),
            "net": str(r.get("Amount Net (THB)", "")),
            "payment_method": str(r.get("Payment Method", "")),
        })

    return render_template(
        "dashboard.html",
        sonar=sonar,
        expenses=exp_records,
        income=inc_records,
    )


@app.route("/edit", methods=["POST"])
def edit_records():
    profile = load_profile()
    sonar = profile_to_sonar(profile)
    clients = load_clients()

    selected_ids = request.form.getlist("selected_ids")
    doc_types = request.form.getlist("doc_types")

    if not selected_ids:
        flash("No records selected!", "error")
        return redirect(url_for("index"))
    if not doc_types:
        flash("No document types selected!", "error")
        return redirect(url_for("index"))

    expenses = load_expenses()
    income = load_income()
    records_to_edit = []

    skipped_ids = []

    for rec_id in selected_ids:
        rec_id = rec_id.strip()
        is_expense = rec_id.startswith("EXP")

        if is_expense:
            match = expenses[expenses["ID"] == rec_id]
            if match.empty:
                skipped_ids.append(rec_id)
                continue
            r = match.iloc[0]
            gross = parse_money(r["Gross Amount"])
            wht = parse_money(r["Tax"])
            net = parse_money(r["Amount Net (THB)"])
            rec = {
                "id": rec_id,
                "type": "EXP",
                "date": fmt_date(r["Date"]),
                "paid_to": str(r.get("Vendor / Payee", "")).strip(),
                "department": str(r.get("Department / Project", "")).strip(),
                "payment_method": str(r.get("Payment Method", "")).strip(),
                "description": str(r.get("Description", "")).strip(),
                "gross": f"{gross:,.2f}",
                "withholding": f"{wht:,.2f}",
                "net": f"{net:,.2f}",
                "notes": "",
                "doc_types": [dt for dt in doc_types if dt == "pv"],
            }
            if rec["doc_types"]:
                records_to_edit.append(rec)
        else:
            match = income[income["ID"] == rec_id]
            if match.empty:
                skipped_ids.append(rec_id)
                continue
            r = match.iloc[0]
            gross = parse_money(r["Gross Amount"])
            tax = parse_money(r["Tax"])
            net = parse_money(r["Amount Net (THB)"])

            payer_key = str(r.get("Payer", "")).strip().upper()
            buyer = clients.get(payer_key, {})
            applicable_types = [dt for dt in doc_types if dt in ("rv", "tax_receipt")]

            rec = {
                "id": rec_id,
                "type": "INC",
                "date": str(r["Date"]).strip(),
                "date_display": fmt_date(r["Date"]),
                "payer": str(r.get("Payer", "")).strip(),
                "received_from": buyer.get("name", payer_key),
                "payment_method": str(r.get("Payment Method", "")).strip(),
                "description": str(r.get("Description", "")).strip(),
                "gross": f"{gross:,.2f}",
                "withholding": f"{tax:,.2f}",
                "net": f"{net:,.2f}",
                "buyer_name": buyer.get("name", payer_key),
                "buyer_address": buyer.get("address", ""),
                "buyer_tax": buyer.get("tax_id", ""),
                "ref_invoice": "",
                "ref_date": str(r["Date"]).strip(),
                "notes": "",
                "doc_types": applicable_types,
            }
            if rec["doc_types"]:
                records_to_edit.append(rec)

    if not records_to_edit:
        flash("No matching records for the selected document types.", "error")
        return redirect(url_for("index"))

    flash(
        f"Received {len(selected_ids)} selected IDs → matched {len(records_to_edit)} records."
        + (f" ({len(skipped_ids)} IDs not found: {', '.join(skipped_ids[:5])}{'...' if len(skipped_ids) > 5 else ''})" if skipped_ids else ""),
        "info"
    )

    return render_template(
        "edit.html",
        records=records_to_edit,
        sonar=sonar,
        doc_types=doc_types,
        signature_available=get_signature_path() is not None,
    )


@app.route("/generate", methods=["POST"])
def generate():
    profile = load_profile()
    sonar = profile_to_sonar(profile)
    clients = load_clients()

    form = request.form
    record_count = int(form.get("record_count", 0))
    generated = []

    for i in range(record_count):
        prefix = f"rec_{i}_"
        rec_id = form.get(f"{prefix}id", "")
        rec_type = form.get(f"{prefix}type", "")
        doc_types = form.getlist(f"{prefix}doc_types")

        if rec_type == "EXP":
            row_data = {
                "id": rec_id,
                "date": form.get(f"{prefix}date", ""),
                "paid_to": form.get(f"{prefix}paid_to", ""),
                "department": form.get(f"{prefix}department", ""),
                "payment_method": form.get(f"{prefix}payment_method", ""),
                "description": form.get(f"{prefix}description", ""),
                "gross": form.get(f"{prefix}gross", "0.00"),
                "withholding": form.get(f"{prefix}withholding", "0.00"),
                "net": form.get(f"{prefix}net", "0.00"),
                "notes": form.get(f"{prefix}notes", ""),
                "include_signature": form.get(f"{prefix}include_signature") == "on",
            }
            if "pv" in doc_types:
                try:
                    path, name = generate_payment_voucher(row_data, sonar)
                    generated.append({"name": name, "path": path, "type": "Payment Voucher", "id": rec_id})
                except Exception as e:
                    generated.append({"name": rec_id, "path": None, "type": "Payment Voucher", "id": rec_id, "error": str(e)})

        elif rec_type == "INC":
            row_data = {
                "id": rec_id,
                "date": form.get(f"{prefix}date", ""),
                "payer": form.get(f"{prefix}payer", ""),
                "received_from": form.get(f"{prefix}received_from", ""),
                "payment_method": form.get(f"{prefix}payment_method", ""),
                "description": form.get(f"{prefix}description", ""),
                "gross": form.get(f"{prefix}gross", "0.00"),
                "withholding": form.get(f"{prefix}withholding", "0.00"),
                "net": form.get(f"{prefix}net", "0.00"),
                "buyer_name": form.get(f"{prefix}buyer_name", ""),
                "buyer_address": form.get(f"{prefix}buyer_address", ""),
                "buyer_branch": form.get(f"{prefix}buyer_branch", "สำนักงานใหญ่"),
                "buyer_branch_code": form.get(f"{prefix}buyer_branch_code", ""),
                "ref_invoice": form.get(f"{prefix}ref_invoice", ""),
                "ref_date": form.get(f"{prefix}ref_date", ""),
                "payment_cash": form.get(f"{prefix}payment_cash") == "on",
                "payment_transfer": form.get(f"{prefix}payment_transfer") == "on",
                "payment_check": form.get(f"{prefix}payment_check") == "on",
                "notes": form.get(f"{prefix}notes", ""),
                "include_signature": form.get(f"{prefix}include_signature") == "on",
            }

            if "rv" in doc_types:
                try:
                    path, name = generate_receipt_voucher(row_data, sonar, clients)
                    generated.append({"name": name, "path": path, "type": "Receipt Voucher", "id": rec_id})
                except Exception as e:
                    generated.append({"name": rec_id, "path": None, "type": "Receipt Voucher", "id": rec_id, "error": str(e)})

            if "tax_receipt" in doc_types:
                try:
                    path, name = generate_tax_receipt(row_data, sonar, clients, profile=profile)
                    generated.append({"name": name, "path": path, "type": "Tax Receipt", "id": rec_id})
                except Exception as e:
                    generated.append({"name": rec_id, "path": None, "type": "Tax Receipt", "id": rec_id, "error": str(e)})

    return render_template("results.html", generated=generated)


@app.route("/settings")
def settings_page():
    profile = load_profile()
    return render_template("settings.html", profile=profile)


@app.route("/settings/save", methods=["POST"])
def save_settings():
    data = {
        "company_th": request.form.get("company_th", "").strip(),
        "company_en": request.form.get("company_en", "").strip(),
        "address": request.form.get("address", "").strip(),
        "tax_id": request.form.get("tax_id", "").strip(),
        "bank": request.form.get("bank", "").strip(),
        "phone": request.form.get("phone", "").strip(),
        "email": request.form.get("email", "").strip(),
    }
    save_profile(data)
    flash("Profile saved successfully.", "success")
    return redirect(url_for("settings_page"))


@app.route("/settings/reset", methods=["POST"])
def reset_settings():
    if os.path.exists(PROFILE_PATH):
        os.remove(PROFILE_PATH)
    flash("Profile reset to defaults.", "success")
    return redirect(url_for("settings_page"))


@app.route("/download/<path:filename>")
def download(filename):
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath):
        return send_file(filepath, as_attachment=True)
    flash("File not found.", "error")
    return redirect(url_for("index"))


@app.route("/download_all", methods=["POST"])
def download_all():
    files = request.form.getlist("files")
    if not files:
        flash("No files to download.", "error")
        return redirect(url_for("index"))

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            full = os.path.join(OUTPUT_DIR, f)
            if os.path.exists(full):
                zf.write(full, os.path.basename(full))
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name="accounting_docs.zip")


@app.route("/preview/<path:filename>")
def preview(filename):
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath):
        return send_file(filepath, mimetype="application/pdf")
    return "File not found", 404


# ======================================================
# ASSEMBLY ROUTES
# ======================================================
@app.route("/assembly")
def assembly_view():
    month = request.args.get("month", "").strip()
    if not is_valid_month(month):
        month = datetime.now().strftime("%Y-%m")
    year, mon = map(int, month.split("-"))

    manifest = derive_manifest(month)
    expenses = manifest["expenses"]
    total = len(expenses)
    done_count = sum(1 for e in expenses if e["done"])
    zip_path = os.path.join(assembly_month_dir(month), "bundle.zip")

    return render_template(
        "assembly.html",
        sonar=profile_to_sonar(load_profile()),
        month=month,
        no_wht=[e for e in expenses if e["section"] == "no_wht"],
        with_wht=[e for e in expenses if e["section"] == "with_wht"],
        total=total,
        done_count=done_count,
        wht_wb_exists=manifest["wht_wb_exists"],
        wht_wb_name=os.path.basename(manifest["wht_wb_path"]),
        salary_xlsxfile=manifest["salary_xlsxfile"],
        kbiz_hints=load_kbiz_hints(year, mon),
        zip_exists=os.path.exists(zip_path),
        zip_download=f"ASSEMBLY/{month}/bundle.zip",
    )


@app.route("/assembly/generate-pv", methods=["POST"])
def assembly_generate_pv():
    month = request.form.get("month", "").strip()
    if not is_valid_month(month):
        flash("Invalid month.", "error")
        return redirect(url_for("index"))
    year, mon = map(int, month.split("-"))

    profile = load_profile()
    sonar = profile_to_sonar(profile)
    ok, errors = 0, []
    for r in month_expenses(year, mon):
        exp_id = str(r["ID"]).strip()
        row_data = {
            "id": exp_id,
            "date": fmt_date(r.get("Date", "")),
            "paid_to": str(r.get("Vendor / Payee", "")).strip(),
            "department": str(r.get("Department / Project", "")).strip(),
            "payment_method": str(r.get("Payment Method", "")).strip(),
            "description": str(r.get("Description", "")).strip(),
            "gross": f"{parse_money(r.get('Gross Amount', '0')):,.2f}",
            "withholding": f"{parse_money(r.get('Tax', '0')):,.2f}",
            "net": f"{parse_money(r.get('Amount Net (THB)', '0')):,.2f}",
            "notes": "",
            "include_signature": False,
        }
        try:
            generate_payment_voucher_pv(row_data, sonar)
            ok += 1
        except Exception as e:
            errors.append(f"{exp_id}: {e}")

    derive_manifest(month)
    msg = f"Generated {ok} PV(s)."
    if errors:
        msg += f" {len(errors)} failed: " + "; ".join(errors[:3])
    flash(msg, "error" if errors else "success")
    return redirect(url_for("assembly_view", month=month))


@app.route("/assembly/upload", methods=["POST"])
def assembly_upload():
    month = request.form.get("month", "").strip()
    exp_id = request.form.get("exp_id", "").strip()
    tag = request.form.get("tag", "").strip()
    file = request.files.get("file")

    if not is_valid_month(month):
        flash("Invalid month.", "error")
        return redirect(url_for("index"))
    year, mon = map(int, month.split("-"))
    valid_ids = {str(r["ID"]).strip() for r in month_expenses(year, mon)}
    if exp_id not in valid_ids:
        flash(f"Unknown expense ID for {month}: {exp_id}", "error")
        return redirect(url_for("assembly_view", month=month))
    if tag not in ASSEMBLY_TAGS:
        flash(f"Invalid tag: {tag}", "error")
        return redirect(url_for("assembly_view", month=month))
    if not file or not file.filename:
        flash("No file selected.", "error")
        return redirect(url_for("assembly_view", month=month))

    ext = os.path.splitext(secure_filename(file.filename))[1].lower()
    if not ext:
        flash("File has no extension.", "error")
        return redirect(url_for("assembly_view", month=month))

    files_dir = assembly_files_dir(month)
    os.makedirs(files_dir, exist_ok=True)
    for stale in glob.glob(os.path.join(files_dir, f"{exp_id}_{tag}.*")):
        os.remove(stale)
    file.save(os.path.join(files_dir, f"{exp_id}_{tag}{ext}"))

    derive_manifest(month)
    flash(f"Uploaded {tag} for {exp_id}.", "success")
    return redirect(url_for("assembly_view", month=month))


@app.route("/assembly/upload-salary", methods=["POST"])
def assembly_upload_salary():
    month = request.form.get("month", "").strip()
    if not is_valid_month(month):
        flash("Invalid month.", "error")
        return redirect(url_for("index"))
    file = request.files.get("file")
    if not file or not file.filename:
        flash("No file selected.", "error")
        return redirect(url_for("assembly_view", month=month))

    ext = os.path.splitext(secure_filename(file.filename))[1].lower() or ".xlsx"
    files_dir = assembly_files_dir(month)
    os.makedirs(files_dir, exist_ok=True)
    for stale in glob.glob(os.path.join(files_dir, "salary_register.*")):
        os.remove(stale)
    dest_name = f"salary_register{ext}"
    file.save(os.path.join(files_dir, dest_name))

    derive_manifest(month)
    with open(assembly_manifest_path(month), encoding="utf-8") as f:
        data = json.load(f)
    data["salary_xlsxfile"] = dest_name
    with open(assembly_manifest_path(month), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    derive_manifest(month)

    flash("Salary register uploaded.", "success")
    return redirect(url_for("assembly_view", month=month))


@app.route("/assembly/done", methods=["POST"])
def assembly_done():
    month = request.form.get("month", "").strip()
    exp_id = request.form.get("exp_id", "").strip()
    if not is_valid_month(month):
        flash("Invalid month.", "error")
        return redirect(url_for("index"))

    current = derive_manifest(month)
    row = next((e for e in current["expenses"] if e["id"] == exp_id), None)
    if row is None:
        flash(f"Unknown expense: {exp_id}", "error")
        return redirect(url_for("assembly_view", month=month))

    manifest_path = assembly_manifest_path(month)
    with open(manifest_path, encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("done_overrides", {})[exp_id] = not row["done"]
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    derive_manifest(month)

    return redirect(url_for("assembly_view", month=month))


@app.route("/assembly/build", methods=["POST"])
def assembly_build():
    month = request.form.get("month", "").strip()
    if not is_valid_month(month):
        flash("Invalid month.", "error")
        return redirect(url_for("index"))

    manifest = derive_manifest(month)
    files_dir = assembly_files_dir(month)
    bundle_dir = assembly_bundle_dir(month)
    shutil.rmtree(bundle_dir, ignore_errors=True)
    no_wht_dir = os.path.join(bundle_dir, "no_wht")
    with_wht_dir = os.path.join(bundle_dir, "with_wht")
    os.makedirs(no_wht_dir, exist_ok=True)
    os.makedirs(with_wht_dir, exist_ok=True)

    IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".tif"}

    def load_part_pages(path):
        ext = os.path.splitext(path)[1].lower()
        if ext == ".pdf":
            reader = PdfReader(path)
            if reader.is_encrypted:
                reader.decrypt("")
            return list(reader.pages)
        if ext in IMAGE_EXTS:
            buf = io.BytesIO()
            Image.open(path).convert("RGB").save(buf, "PDF")
            buf.seek(0)
            return list(PdfReader(buf).pages)
        raise ValueError(f"unsupported file type {ext}")

    failed = []
    section_files = {"no_wht": [], "with_wht": []}

    for e in manifest["expenses"]:
        exp_id = e["id"]
        docs = e["docs"]
        if not (docs["pv"]["status"] == "generated"
                and docs["slip"]["status"] == "uploaded"
                and docs["receipt"]["status"] == "uploaded"):
            failed.append({"exp_id": exp_id, "reason": "missing required document(s)"})
            continue

        parts = [
            ("pv", pv_pdf_path(exp_id)),
            ("slip", os.path.join(files_dir, docs["slip"]["file"])),
            ("receipt", os.path.join(files_dir, docs["receipt"]["file"])),
        ]
        writer = PdfWriter()
        ok = True
        for label, path in parts:
            try:
                for page in load_part_pages(path):
                    writer.add_page(page)
            except Exception as ex:
                failed.append({"exp_id": exp_id, "reason": f"{label}: {ex}"})
                ok = False
                break
        if not ok:
            continue

        section_dir = with_wht_dir if e["section"] == "with_wht" else no_wht_dir
        out_path = os.path.join(section_dir, f"{exp_id}.pdf")
        with open(out_path, "wb") as f:
            writer.write(f)
        section_files[e["section"]].append(out_path)

    for section, _dir in (("no_wht", no_wht_dir), ("with_wht", with_wht_dir)):
        paths = sorted(section_files[section])
        if not paths:
            continue
        writer = PdfWriter()
        for p in paths:
            reader = PdfReader(p)
            for page in reader.pages:
                writer.add_page(page)
        with open(os.path.join(bundle_dir, f"{section}.pdf"), "wb") as f:
            writer.write(f)

    wht_src = manifest["wht_wb_path"]
    if manifest["wht_wb_exists"]:
        shutil.copy2(wht_src, os.path.join(bundle_dir, os.path.basename(wht_src)))
    else:
        failed.append({"exp_id": "-", "reason": f"WHT workbook missing: {os.path.basename(wht_src)} (run generate_wht.py)"})

    if manifest["salary_xlsxfile"]:
        src = os.path.join(files_dir, manifest["salary_xlsxfile"])
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(bundle_dir, manifest["salary_xlsxfile"]))
        else:
            failed.append({"exp_id": "-", "reason": "salary register file missing on disk"})
    else:
        failed.append({"exp_id": "-", "reason": "salary register not uploaded for this month"})

    zip_path = os.path.join(assembly_month_dir(month), "bundle.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(bundle_dir):
            for fn in files:
                full = os.path.join(root, fn)
                zf.write(full, os.path.relpath(full, bundle_dir))

    if failed:
        preview_txt = "; ".join(f"{x['exp_id']}: {x['reason']}" for x in failed[:5])
        flash(f"Build complete with {len(failed)} issue(s): {preview_txt}", "error")
    else:
        flash("Build complete. All parts merged successfully.", "success")

    return redirect(url_for("assembly_view", month=month))


# ======================================================
# RUN
# ======================================================
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  SONAR ACCOUNTING PORTAL")
    print("  http://127.0.0.1:5050")
    print("=" * 60 + "\n")
    app.run(debug=True, port=5050)

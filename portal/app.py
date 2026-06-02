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
import zipfile
import io

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
# RUN
# ======================================================
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  SONAR ACCOUNTING PORTAL")
    print("  http://127.0.0.1:5050")
    print("=" * 60 + "\n")
    app.run(debug=True, port=5050)

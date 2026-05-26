import os
import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

BASE_DIR = os.getcwd()
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
OUTPUT_HTML_DIR = os.path.join(BASE_DIR, "output", "html")
OUTPUT_PDF_DIR = os.path.join(BASE_DIR, "output", "pdf")

os.makedirs(OUTPUT_HTML_DIR, exist_ok=True)
os.makedirs(OUTPUT_PDF_DIR, exist_ok=True)

env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=True)

def parse_money(x):
    if pd.isna(x):
        return Decimal("0.00")
    s = str(x).replace("฿", "").replace(",", "").strip()
    return Decimal(s).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def fmt_date(x):
    dt = datetime.strptime(str(x), "%Y-%m-%d")
    thai_year = (dt.year + 543) % 100
    return dt.strftime(f"%d/%m/{thai_year:02d}")

def fmt_date_full(x):
    dt = datetime.strptime(str(x), "%Y-%m-%d")
    thai_year = dt.year + 543
    return dt.strftime(f"%d/%m/{thai_year}")

def thai_baht_text(amount: Decimal) -> str:
    nums = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
    units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"]
    n = int(amount)
    if n == 0:
        return "ศูนย์บาทถ้วน"
    result = ""
    digits = list(map(int, str(n)))
    for i, d in enumerate(digits):
        pos = len(digits) - i - 1
        if d == 0:
            continue
        if pos == 1 and d == 1:
            result += "สิบ"
        elif pos == 1 and d == 2:
            result += "ยี่สิบ"
        elif pos == 0 and d == 1 and result != "":
            result += "เอ็ด"
        else:
            result += nums[d] + units[pos]
    return result + "บาทถ้วน"

def format_tax_id(tax_id):
    clean = str(tax_id).replace("-", "").strip()
    if len(clean) == 13:
        return f"{clean[0]}-{clean[1:5]}-{clean[5:10]}-{clean[10:12]}-{clean[12]}"
    return tax_id

sonar = pd.read_csv(os.path.join(DATA_DIR, "sonarinfo_2026.tsv"), sep="\t", encoding="utf-8").iloc[0]

clients_df = pd.read_csv(os.path.join(DATA_DIR, "clientinfo_2026.tsv"), sep="\t", encoding="utf-8")
clients_df.columns = clients_df.columns.str.strip()
clients = {r["Info"].strip().upper(): r for _, r in clients_df.iterrows()}

income_df = pd.read_csv(os.path.join(DATA_DIR, "income_2026 2.tsv"), sep="\t", encoding="utf-8")
income_df.columns = income_df.columns.str.strip()

template = env.get_template("receipt_full.html")
font_config = FontConfiguration()
css = CSS(string='@page { size: A4; margin: 1.5cm; }', font_config=font_config)

SELLER_PHONE = "0864923997"
SELLER_EMAIL = "contact@sonaraudiobooks.com"

# Batch config: (income_id, ref_invoice_no, ref_invoice_date)
BATCH = [
    ("INC20260509-001", "IV20260424-001", "2026-04-24"),
]

for inc_id, ref_invoice, ref_date in BATCH:
    row = income_df[income_df["ID"].str.strip() == inc_id]
    if row.empty:
        print(f"❌ Not found: {inc_id}")
        continue

    r = row.iloc[0]
    gross = parse_money(r["Gross Amount"])
    payer_key = str(r["Payer"]).strip().upper()
    buyer = clients.get(payer_key)
    if buyer is None:
        print(f"❌ Payer '{payer_key}' not found for {inc_id}")
        continue

    ctx = {
        "seller_name_th": sonar["Company Name"],
        "seller_name_en": "SONAR AI COMPANY LIMITED",
        "seller_address": sonar["Address"],
        "seller_tax": sonar["Tax ID"],
        "seller_tax_formatted": format_tax_id(sonar["Tax ID"]),
        "seller_phone": SELLER_PHONE,
        "seller_email": SELLER_EMAIL,
        "bank_info": sonar["Bank Account Info"],
        "buyer_name": buyer["Company Name"],
        "buyer_address": buyer["Address"],
        "buyer_tax": buyer["Tax ID"],
        "buyer_tax_formatted": format_tax_id(buyer["Tax ID"]),
        "buyer_branch": "สำนักงานใหญ่",
        "buyer_branch_code": "",
        "receipt_no": r["ID"],
        "receipt_date": fmt_date(r["Date"]),
        "receipt_date_full": fmt_date_full(r["Date"]),
        "ref_invoice": ref_invoice,
        "ref_date": fmt_date(ref_date),
        "description": r["Description"],
        "qty": 1,
        "unit_price": f"{gross:,.2f}",
        "amount": f"{gross:,.2f}",
        "subtotal": f"{gross:,.2f}",
        "vat": "0.00",
        "vat_rate": "0%",
        "total": f"{gross:,.2f}",
        "amount_text": thai_baht_text(gross),
        "payment_cash": False,
        "payment_transfer": True,
        "payment_check": False,
    }

    html_content = template.render(ctx)

    html_path = os.path.join(OUTPUT_HTML_DIR, f"{r['ID']}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    pdf_path = os.path.join(OUTPUT_PDF_DIR, f"{r['ID']}.pdf")
    HTML(string=html_content, encoding='utf-8').write_pdf(pdf_path, stylesheets=[css], font_config=font_config)

    print(f"✅ {r['ID']}.pdf generated")

print("\nDone!")

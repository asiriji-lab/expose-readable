import os
import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

# ======================================================
# PATHS
# ======================================================
BASE_DIR = os.getcwd()
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
OUTPUT_HTML_DIR = os.path.join(BASE_DIR, "output", "html")
OUTPUT_PDF_DIR = os.path.join(BASE_DIR, "output", "pdf")

os.makedirs(OUTPUT_HTML_DIR, exist_ok=True)
os.makedirs(OUTPUT_PDF_DIR, exist_ok=True)

env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=True
)

# ======================================================
# HELPERS
# ======================================================
def parse_money(x):
    if pd.isna(x):
        return Decimal("0.00")
    s = str(x).replace("฿", "").replace(",", "").strip()
    return Decimal(s).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def fmt_date(x):
    """Format date as DD/MM/YY (Thai Buddhist calendar year)"""
    dt = datetime.strptime(str(x), "%Y-%m-%d")
    # Convert to Buddhist year (add 543)
    thai_year = (dt.year + 543) % 100  # Last 2 digits of Buddhist year
    return dt.strftime(f"%d/%m/{thai_year:02d}")

def fmt_date_full(x):
    """Format date as DD/MM/YYYY (Thai Buddhist calendar year)"""
    dt = datetime.strptime(str(x), "%Y-%m-%d")
    thai_year = dt.year + 543
    return dt.strftime(f"%d/%m/{thai_year}")

def thai_baht_text(amount: Decimal) -> str:
    """Convert number to Thai text"""
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
    """Format tax ID as X-XXXX-XXXXX-XX-X"""
    clean = str(tax_id).replace("-", "").strip()
    if len(clean) == 13:
        return f"{clean[0]}-{clean[1:5]}-{clean[5:10]}-{clean[10:12]}-{clean[12]}"
    return tax_id

def get_user_input_with_default(prompt, default=""):
    """Get user input with a default value"""
    user_input = input(f"{prompt} [{default}]: ").strip()
    return user_input if user_input else default

# ======================================================
# LOAD DATA
# ======================================================
sonar = pd.read_csv(
    os.path.join(DATA_DIR, "sonarinfo_2026.tsv"),
    sep="\t",
    encoding="utf-8"
).iloc[0]

clients_df = pd.read_csv(
    os.path.join(DATA_DIR, "clientinfo_2026.tsv"),
    sep="\t",
    encoding="utf-8"
)
clients_df.columns = clients_df.columns.str.strip()

clients = {
    r["Info"].strip().upper(): r
    for _, r in clients_df.iterrows()
}

income_df = pd.read_csv(
    os.path.join(DATA_DIR, "income_2026 2.tsv"),
    sep="\t",
    encoding="utf-8"
)
income_df.columns = income_df.columns.str.strip()

# ======================================================
# GENERATION
# ======================================================
template = env.get_template("receipt_full.html")

# Font configuration for WeasyPrint
font_config = FontConfiguration()

# CSS for better font rendering
css = CSS(string='''
    @page {
        size: A4;
        margin: 1.5cm;
    }
''', font_config=font_config)

# Constants from sonarinfo_2026.tsv
SELLER_PHONE = "0864923997"  # Add phone if needed
SELLER_EMAIL = "contact@sonaraudiobooks.com"

print("\n" + "="*60)
print("TAX RECEIPT GENERATOR")
print("="*60)

# === NEW FEATURE: Choose all or specific ID ===
process_all = input("Process all receipts (type 'all') or a specific receipt ID? ['all' / specific ID]: ").strip().lower()
target_df = pd.DataFrame()

if process_all == 'all':
    target_df = income_df
    print("\nProcessing all eligible receipts.")
else:
    # Filter for the specific ID
    specific_id_found = False
    for _, r in income_df.iterrows():
        if str(r["ID"]).strip().upper() == process_all.upper() and str(r["ID"]).startswith("INC"):
            target_df = pd.DataFrame([r])
            specific_id_found = True
            print(f"\nProcessing specific receipt: {r['ID']}")
            break
    if not specific_id_found:
        print(f"❌ Error: No eligible receipt found with ID '{process_all}'. Please check the ID and ensure it starts with 'INC'.")
        exit() # Exit if specific ID not found or not eligible

if target_df.empty:
    print("No receipts to process.")
    exit()

for idx, r in target_df.iterrows():

    if not str(r["ID"]).startswith("INC"):
        if process_all == 'all': # Only print this warning if processing all
            print(f"Skipping row {idx} as ID '{r['ID']}' does not start with 'INC'.")
        continue

    print(f"\n📄 Processing Receipt: {r['ID']}")
    print("-" * 60)

    # Get reference invoice info from user
    print("\nPlease provide the following information:")
    ref_invoice = get_user_input_with_default(
        "อ้างถึงใบแจ้งหนี้ (Reference Invoice)",
        r.get("Ref Invoice", "")
    )
    
    ref_invoice_date_input = get_user_input_with_default(
        "วันที่ใบแจ้งหนี้ (Invoice Date, format: YYYY-MM-DD)",
        str(r["Date"])
    )

    gross = parse_money(r["Gross Amount"])

    # ✅ Correct payer mapping (new income format)
    payer_key = str(r["Payer"]).strip().upper()

    buyer = clients.get(payer_key)

    if buyer is None:
        raise ValueError(f"❌ Payer '{payer_key}' not found in clientinfo_2026.tsv")

    # Format tax IDs
    seller_tax_formatted = format_tax_id(sonar["Tax ID"])
    buyer_tax_formatted = format_tax_id(buyer["Tax ID"])

    ctx = {
        # Seller
        "seller_name_th": sonar["Company Name"],
        "seller_name_en": "SONAR AI COMPANY LIMITED",
        "seller_address": sonar["Address"],
        "seller_tax": sonar["Tax ID"],
        "seller_tax_formatted": seller_tax_formatted,
        "seller_phone": SELLER_PHONE,
        "seller_email": SELLER_EMAIL,
        "bank_info": sonar["Bank Account Info"],

        # Buyer
        "buyer_name": buyer["Company Name"],
        "buyer_address": buyer["Address"],
        "buyer_tax": buyer["Tax ID"],
        "buyer_tax_formatted": buyer_tax_formatted,
        "buyer_branch": "สำนักงานใหญ่",  # Head office
        "buyer_branch_code": "",

        # Receipt
        "receipt_no": r["ID"],
        "receipt_date": fmt_date(r["Date"]),
        "receipt_date_full": fmt_date_full(r["Date"]),
        "ref_invoice": ref_invoice,
        "ref_date": fmt_date(ref_invoice_date_input),

        # Item
        "description": r["Description"],
        "qty": 1,
        "unit_price": f"{gross:,.2f}",
        "amount": f"{gross:,.2f}",

        # Totals
        "subtotal": f"{gross:,.2f}",
        "vat": "0.00",
        "vat_rate": "0%",
        "total": f"{gross:,.2f}",
        "amount_text": thai_baht_text(gross),
        
        # Payment method
        "payment_cash": False,
        "payment_transfer": True,
        "payment_check": False,
    }

    html_content = template.render(ctx)

    # Save HTML
    html_path = os.path.join(OUTPUT_HTML_DIR, f"{r['ID']}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # Generate PDF with proper Thai and English font support
    pdf_path = os.path.join(OUTPUT_PDF_DIR, f"{r['ID']}.pdf")
    HTML(string=html_content, encoding='utf-8').write_pdf(
        pdf_path,
        stylesheets=[css],
        font_config=font_config
    )
    
    print(f"✅ Generated: {r['ID']}.html")
    print(f"✅ Generated: {r['ID']}.pdf")

print("\n" + "="*60)
print("✅ All receipts generated successfully!")
print("="*60)
print(f"📁 HTML files: {OUTPUT_HTML_DIR}")
print(f"📁 PDF files:  {OUTPUT_PDF_DIR}")
print("="*60 + "\n")
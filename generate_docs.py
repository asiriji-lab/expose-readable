import os
import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# ======================================================
# PATHS
# ======================================================
BASE_DIR = os.getcwd()
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

for d in ["EXP", "INC"]:
    os.makedirs(os.path.join(OUTPUT_DIR, d), exist_ok=True)

env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

df = pd.read_csv("data/expense_2026.tsv", sep="\t")
df = df.rename(columns={"Withholding Tax": "Tax"})

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
            return datetime.strptime(str(x), f).strftime("%d/%m/%Y")
        except ValueError:
            pass
    return str(x)


# ======================================================
# THAI BAHT TEXT (ACCOUNTING-SAFE)
# ======================================================
THAI_NUM = ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"]
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


def render(template, ctx, out):
    html = env.get_template(template).render(ctx)
    HTML(string=html, base_url=TEMPLATE_DIR).write_pdf(out)


# ======================================================
# LOAD SONAR INFO (SINGLE COMPANY)
# ======================================================
sonar_df = normalize_columns(
    pd.read_csv(os.path.join(DATA_DIR, "sonarinfo_2026.tsv"), sep="\t", dtype=str)
)

sonar_row = sonar_df.iloc[0]
sonar = {
    "company": sonar_row.get("Company Name", ""),
    "address": sonar_row.get("Address", ""),
    "tax_id": sonar_row.get("Tax ID", ""),
    "bank": sonar_row.get("Bank Account Info", ""),
}


# ======================================================
# LOAD CLIENT INFO (OFFICIAL NAMES)
# ======================================================
client_df = normalize_columns(
    pd.read_csv(os.path.join(DATA_DIR, "clientinfo_2026.tsv"), sep="\t", dtype=str)
)

clients = {}
for _, r in client_df.iterrows():
    key = str(r.get("Info", "")).strip().upper()
    name = str(r.get("Company Name", "")).strip()
    if key and name:
        clients[key] = name


# ======================================================
# PAYMENT VOUCHERS (EXPENSE)
# ======================================================
expense_df = normalize_columns(
    pd.read_csv(os.path.join(DATA_DIR, "expense_2026.tsv"), sep="\t", dtype=str)
)

expense_df = expense_df[
    expense_df["ID"].str.match(r"EXP20\d{6}-\d{3}", na=False)
]

for _, r in expense_df.iterrows():
    gross = parse_money(r["Gross Amount"])
    wht   = parse_money(r["Withholding Tax"])
    net   = parse_money(r["Amount Net (THB)"])

    ctx = {
        "logo": "logo.png",
        "company": sonar["company"].upper(),
        "pv_no": "PV" + r["ID"][3:],
        "date": fmt_date(r["Date"]),
        "paid_to": str(r["Vendor / Payee"]).upper(),
        "department": r["Department / Project"],
        "payment_method": r["Payment Method"],
        "bank": sonar["bank"],
        "doc_no": r["ID"],
        "description": r["Description"],
        "notes": str(r["Note"]).strip() if pd.notna(r.get("Note")) else "",
        "gross": f"{gross:,.2f}",
        "withholding": f"{wht:,.2f}",
        "net": f"{net:,.2f}",
        "amount_text": thai_baht_text(net),
        "signature_img": "cfosign.png",
    }

    render(
        "payment_voucher.html",
        ctx,
        os.path.join(OUTPUT_DIR, "EXP", f"{ctx['pv_no']}.pdf"),
    )


# ======================================================
# RECEIPT VOUCHERS (INCOME)
# ======================================================
# ======================================================
# RECEIPT VOUCHERS (INCOME)  - FIXED CLIENT MATCHING
# ======================================================
income_df = normalize_columns(
    pd.read_csv(
        os.path.join(DATA_DIR, "income_2026 2.tsv"),
        sep="\t",
        dtype=str,
        engine="python",
        on_bad_lines="warn",
    )
)
income_df = income_df.rename(columns={"Withholding Tax": "Tax"})

income_df = income_df[
    income_df["ID"].str.match(r"INC20\d{6}-\d{3}", na=False)
]

for _, r in income_df.iterrows():

    gross = parse_money(r["Gross Amount"])
    tax   = parse_money(r["Tax"])
    net   = parse_money(r["Amount Net (THB)"])

    # ✅ CORRECT FIELD (NEW FORMAT)
    payer_key = str(r["Payer"]).strip().upper()

    # ✅ OFFICIAL COMPANY NAME FROM CLIENTINFO
    official_client = clients.get(payer_key, payer_key)

    ctx = {
        "logo": "logo.png",
        "company": sonar["company"].upper(),

        "rv_no": "RV" + r["ID"][3:],
        "date": fmt_date(r["Date"]),

        # ✅ This is now guaranteed correct
        "received_from": official_client,

        "payment_method": r["Payment Method"],
        "bank": sonar["bank"],
        "doc_no": r["ID"],
        "description": r["Description"],

        "gross": f"{gross:,.2f}",
        "withholding": f"{tax:,.2f}",
        "net": f"{net:,.2f}",

        "amount_text": thai_baht_text(net),
    }

    render(
        "receipt_voucher.html",
        ctx,
        os.path.join(OUTPUT_DIR, "INC", f"{ctx['rv_no']}.pdf"),
    )

print("✅ A5 landscape PV & RV generated successfully.")
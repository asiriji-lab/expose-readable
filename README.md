# Sonar AI — Accounting Automation

> **Internal tool** for **บริษัท โซนาร์ เอไอ จำกัด (Sonar AI Company Limited)**
>
> Generates Thai accounting documents — Payment Vouchers, Receipt Vouchers, Tax Receipts, and WHT Certificates — directly from TSV spreadsheet data.

---

## Table of Contents

- [Overview](#overview)
- [Documents Produced](#documents-produced)
- [Quickstart](#quickstart)
- [Installation](#installation)
- [Repo Structure](#repo-structure)
- [Running the Web Portal](#running-the-web-portal)
- [Running CLI Scripts](#running-cli-scripts)
- [Data Files Reference](#data-files-reference)
- [How Auto-Signing Works](#how-auto-signing-works)
- [WHT Payee Database](#wht-payee-database)
- [Missing Files (Templates)](#-missing-files-templates)
- [Troubleshooting](#troubleshooting)

---

## Overview

This repo automates the creation of Thai accounting documents for Sonar AI's internal finance workflow. All documents use:

- **Thai Buddhist calendar** dates (e.g. 2569 instead of 2026)
- **Thai baht text** (e.g. `สามพันบาทถ้วน`) generated programmatically
- Company and client data pulled from TSV files — no hardcoded names or amounts

There are two ways to use it:

| Mode | When to use |
|---|---|
| **Web portal** (`portal/app.py`) | On-demand generation — pick specific records, review/edit, download PDFs |
| **CLI scripts** | Batch generation — run once to produce all documents for a period |

---

## Documents Produced

| Document | Thai Name | Script | Output |
|---|---|---|---|
| Payment Voucher (PV) | ใบสำคัญจ่าย | `generate_docs.py` / portal | `output/EXP/PV*.pdf` |
| Receipt Voucher (RV) | ใบสำคัญรับ | `generate_docs.py` / portal | `output/INC/RV*.pdf` |
| Tax Receipt | ใบเสร็จรับเงิน | `generate_tax_receipts.py` / portal | `output/pdf/` or `portal/output/TAX_RECEIPTS/` |
| WHT Certificate | หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ | `generate_wht.py` | `output/WHT/WHT_YYMM.xlsx` |

---

## Quickstart

```bash
# 1. Clone and enter the project
cd accounting_automation_internal

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux / WSL

# 3. Install dependencies
pip install flask pandas jinja2 weasyprint openpyxl

# 4. Start the web portal
cd portal
python app.py
# Open → http://127.0.0.1:5050
```

> **First time?** You'll also need the template files. See [Missing Files](#-missing-files-templates) below.

---

## Installation

### Python Version

**Python 3.10 or later** is required. The `tuple[int, int]` type hint in `generate_wht.py` uses the built-in generic syntax available from 3.10+.

```bash
python --version   # must be 3.10+
```

### Dependencies

```bash
pip install flask pandas jinja2 weasyprint openpyxl
```

| Package | Purpose |
|---|---|
| `flask` | Web portal (`portal/app.py`) |
| `pandas` | Reading `.tsv` data files |
| `jinja2` | HTML template rendering for PDFs |
| `weasyprint` | Converting HTML → PDF |
| `openpyxl` | Writing WHT certificate `.xlsx` files |

### WeasyPrint on Windows

WeasyPrint requires GTK libraries. Choose one of:

- **Recommended:** Install the [GTK for Windows Runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases) (add to PATH when prompted), then `pip install weasyprint`
- **Alternative:** Use WSL or a Linux environment
- **Official docs:** [WeasyPrint Windows setup](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows)

---

## Repo Structure

```
accounting_automation_internal/
│
├── data/                              ← Input spreadsheets + lookup files
│   ├── sonarinfo_2026.tsv             ← Sonar AI company info (name, address, tax ID, bank)
│   ├── clientinfo_2026.tsv            ← Client/payer lookup (company name, address, tax ID)
│   ├── expense_2026.tsv               ← Expense ledger (EXP IDs, vendor, amounts, WHT)
│   ├── income_2026 2.tsv              ← Income ledger (INC IDs, payer, amounts)
│   └── payeeinfo.json                 ← Persisted Thai info for WHT payees (auto-updated)
│
├── templates/                         ← Jinja2 HTML + Excel templates (⚠️ NOT in git)
│   ├── payment_voucher.html           ← PV document layout
│   ├── receipt_voucher.html           ← RV document layout
│   ├── receipt_full.html              ← Full tax receipt layout
│   ├── Sonar AI-50 ทวิ.xlsx           ← WHT Excel template (มาตรา 50 ทวิ)
│   ├── logo.png                       ← Company logo (referenced in HTML templates)
│   └── Cfosign.jpg / cfosign.png      ← CFO signature (auto-applied to docs < ฿10,000)
│
├── portal/                            ← Flask web portal
│   ├── app.py                         ← Main Flask application (run this)
│   ├── profile.json                   ← Company/signer settings (created on first save)
│   ├── templates/                     ← Flask UI templates (⚠️ NOT in git)
│   │   ├── dashboard.html             ← Main records table
│   │   ├── edit.html                  ← Pre-generation review/edit form
│   │   ├── results.html               ← Download links after generation
│   │   └── settings.html             ← Company profile settings page
│   └── output/                        ← PDFs generated via portal
│       ├── EXP/                       ← Payment Vouchers
│       ├── INC/                       ← Receipt Vouchers
│       ├── TAX_RECEIPTS/              ← Tax Receipts
│       └── html/                      ← HTML intermediates (debug)
│
├── output/                            ← Files generated by CLI scripts
│   ├── EXP/                           ← Payment Vouchers (PV*.pdf)
│   ├── INC/                           ← Receipt Vouchers (RV*.pdf)
│   ├── WHT/                           ← WHT Excel files (WHT_YYMM.xlsx)
│   ├── html/                          ← HTML intermediates
│   └── pdf/                           ← Tax Receipt PDFs
│
├── generate_docs.py                   ← Batch PV + RV generator
├── generate_tax_receipts.py           ← Interactive tax receipt CLI (prompts for invoice ref)
├── generate_receipts_batch.py         ← Automated tax receipt batch (hardcoded IDs)
└── generate_wht.py                    ← WHT certificate Excel generator
```

---

## Running the Web Portal

The portal is the recommended way to generate documents on demand.

```bash
cd accounting_automation_internal/portal
python app.py
```

Then open **http://127.0.0.1:5050** in your browser.

### Portal Workflow

1. **Dashboard** — Loads all expenses and income from `../data/`; displays both tables side by side
2. **Select** — Tick the records you want to process and choose document types (PV / RV / Tax Receipt)
3. **Edit** — Review and adjust details (description, amounts, include signature toggle) before generating
4. **Generate** — Downloads a `.zip` of all PDFs, or individual files via download links
5. **Settings** — Edit company profile at `/settings`; saved to `portal/profile.json`

### Portal Output Paths

| Document type | Output folder |
|---|---|
| Payment Vouchers | `portal/output/EXP/` |
| Receipt Vouchers | `portal/output/INC/` |
| Tax Receipts | `portal/output/TAX_RECEIPTS/` |

---

## Running CLI Scripts

All CLI scripts must be run **from the project root** (`accounting_automation_internal/`):

```bash
cd accounting_automation_internal
```

### Batch-generate all PVs and RVs

Reads all rows from `expense_2026.tsv` and `income_2026 2.tsv` and generates every document.

```bash
python generate_docs.py
# Output → output/EXP/PV*.pdf  and  output/INC/RV*.pdf
```

### Interactive tax receipt generator

Prompts you to select a record and enter an invoice reference number.

```bash
python generate_tax_receipts.py
# Output → output/pdf/
```

### Batch tax receipt (hardcoded IDs)

Generates tax receipts for a fixed list of INC IDs defined inside the script — no prompts.

```bash
python generate_receipts_batch.py
# Output → output/pdf/
```

### WHT certificates

Generates a `.xlsx` workbook with one sheet per payee who had withholding tax in the given month.

```bash
python generate_wht.py 04/2026     # specify month directly
python generate_wht.py             # will prompt: "Month to process (MM/YYYY)"
# Output → output/WHT/WHT_YYMM.xlsx
```

---

## Data Files Reference

All data files live in `data/` and use **tab-separated values (TSV)**.

### `sonarinfo_2026.tsv` — Company info (single row)

| Column | Example |
|---|---|
| `Company Name` | `บริษัท โซนาร์ เอไอ จำกัด` |
| `Address` | `360/83 ลุมพินีทาวน์วิลล์ ...` |
| `Tax ID` | `105568202086` |
| `Bank Account Info` | `219-8-33387-8 (Kbank)` |

### `expense_2026.tsv` — Expense ledger

| Column | Example |
|---|---|
| `ID` | `EXP20260401-001` |
| `Date` | `01/04/2026` |
| `Vendor / Payee` | `John Doe` |
| `Department / Project` | `Operations` |
| `Description` | `Part-time work` |
| `Gross Amount` | `฿3,000.00` |
| `Withholding Tax` | `฿90.00` |
| `Amount Net (THB)` | `฿2,910.00` |
| `Payment Method` | `Transfer` |

### `income_2026 2.tsv` — Income ledger

| Column | Example |
|---|---|
| `ID` | `INC20260501-001` |
| `Date` | `01/05/2026` |
| `Payer` | `CMKL` ← must match `Info` key in `clientinfo_2026.tsv` |
| `Description` | `Consulting services` |
| `Gross Amount` | `฿50,000.00` |
| `Withholding Tax` | `฿1,500.00` |
| `Amount Net (THB)` | `฿48,500.00` |
| `Payment Method` | `Transfer` |

### `clientinfo_2026.tsv` — Client lookup

| Column | Example |
|---|---|
| `Info` | `CMKL` ← key used in income `Payer` column |
| `Company Name` | `CMKL University` |
| `Address` | `123 Bangna-Trad Rd...` |
| `Tax ID` | `0993000123456` |

> The `Payer` value in income records must match an `Info` key in `clientinfo_2026.tsv` (case-insensitive). If no match is found, the raw `Payer` value is used as-is.

### `payeeinfo.json` — WHT payee database

Automatically populated the first time a new vendor is encountered during WHT generation. Stores Thai name, tax ID, address, and a short display name per vendor. You will be prompted to enter these details once; they are persisted for all future runs.

```json
{
  "MR. John Doe": {
    "thai_name": "นาย จอห์น โด",
    "tax_id": "1234567890123",
    "address": "123 ถนนสุขุมวิท กรุงเทพมหานคร",
    "short_name": "จอห์น"
  }
}
```

---

## How Auto-Signing Works

Documents with a **net amount under ฿10,000** are automatically signed with the CFO's signature image.

For amounts **฿10,000 and above**, you must manually tick **"Include Signature"** in the portal's edit form before generating.

The signature file is resolved from the `templates/` directory in this priority order:

1. `Cfosign.jpg`
2. `Cfosign.png`
3. `cfosign.jpg`
4. `cfosign.png`

---

## WHT Payee Database

When running `generate_wht.py`, the script will:

1. Load known payees from `data/payeeinfo.json`
2. For any vendor **not yet in the database**, pause and prompt you for their Thai info:
   - Thai name (ชื่อ)
   - 13-digit Tax ID (เลขประจำตัวผู้เสียภาษีอากร)
   - Address (ที่อยู่)
   - Short name for the Excel sheet tab (e.g. `ชยันต์`)
3. Save the new entry to `payeeinfo.json` automatically

This means you only need to enter each payee's details once.

---

## ⚠️ Missing Files (Templates)

The `templates/` and `portal/templates/` directories are **not committed to this repo**. You need them to run anything. Contact whoever last ran this tool to get:

| File | Required by |
|---|---|
| `templates/payment_voucher.html` | `generate_docs.py`, portal |
| `templates/receipt_voucher.html` | `generate_docs.py`, portal |
| `templates/receipt_full.html` | `generate_tax_receipts.py`, portal |
| `templates/Sonar AI-50 ทวิ.xlsx` | `generate_wht.py` |
| `templates/logo.png` | All PDF documents |
| `templates/Cfosign.jpg` or `.png` | Auto-signing (optional but needed for docs < ฿10k) |
| `portal/templates/dashboard.html` | Portal |
| `portal/templates/edit.html` | Portal |
| `portal/templates/results.html` | Portal |
| `portal/templates/settings.html` | Portal |

> These files are excluded because they contain company branding and signature images.

---

## Troubleshooting

### WeasyPrint fails on Windows

Make sure the [GTK for Windows Runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases) is installed and added to `PATH`. Restart your terminal after installation.

### `ModuleNotFoundError`

Ensure your virtual environment is activated before running any script:

```bash
.venv\Scripts\activate   # Windows
```

Then install missing packages:

```bash
pip install flask pandas jinja2 weasyprint openpyxl
```

### `Template not found` error

The `templates/` directory (or a specific file in it) is missing. See [Missing Files](#-missing-files-templates).

### Income payer shows raw value instead of company name

The `Payer` column in `income_2026 2.tsv` must match an `Info` key in `clientinfo_2026.tsv`. Matching is case-insensitive. Check for typos or add the missing entry to `clientinfo_2026.tsv`.

### WHT script exits with "Expense file not found"

The script looks for `data/expense_{year}.tsv` based on the year you pass (e.g. `04/2026` → `expense_2026.tsv`). Make sure the file exists and the year in the filename matches.

### Port 5050 already in use

```bash
# Change the port in portal/app.py:
app.run(debug=True, port=5051)
```

---

*Internal use only — Sonar AI Company Limited*

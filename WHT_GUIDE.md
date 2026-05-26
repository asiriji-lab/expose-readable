# Withholding Tax Certificate Guide

**For:** CFO | **Last updated:** May 2026

---

## What This Does

Every time Sonar pays a vendor or contractor and **withholds tax** from that payment, Thai law requires Sonar to issue the vendor a signed certificate (หนังสือรับรองการหักภาษี ณ ที่จ่าย — "50 ทวิ form"). This script generates those certificates automatically from the Finance Ledger.

Each certificate shows:

- Sonar's details as the withholding entity
- The vendor's details as the recipient
- The payment date, gross amount paid, and tax withheld (always 3%)

---

## Monthly Workflow

### Step 1 — Export the month's expenses from Google Sheets

1. Open the [Sonar Finance Ledger](https://docs.google.com/spreadsheets/d/1Ky5f5DMWvBMYe3TiQ-d817P_eQ-1yNHkvyGWy-WbMy0)
2. Go to the **Expense** tab for the relevant year
3. File → Download → **Tab Separated Values (.tsv)**
4. Rename the downloaded file to `expense_YYYY.tsv` (e.g. `expense_2026.tsv`)
5. Replace the existing file in the `data/` folder

### Step 2 — Run the script

Open Terminal, navigate to this folder, and run:

```bash
python generate_wht.py 03/2026
```

Replace `03/2026` with the month you are processing (MM/YYYY).

### Step 3 — Fill in missing Thai payee info (if prompted)

The script will pause and ask for Thai details for any **new payee** it has not seen before:

```text
New payee: 'MR. CHAYAN CHAIYANPORN'
Enter Thai certificate info (will be saved for future use):
  ชื่อ (Thai name):
  เลขประจำตัวผู้เสียภาษีอากร (13-digit Tax ID):
  ที่อยู่ (Address):
  ชื่อย่อ (Short name for sheet tab, e.g. ชยันต์):
```

**If you do not know the Thai details → ask the CEO (Phasit) or COO.**
They can look up vendor Thai names and tax IDs from contracts or past invoices.
Once entered, these details are saved permanently and will never be asked again.

### Step 4 — Open and print the output file

The output file is saved to:

```text
output/WHT/WHT_6903.xlsx    ← 6903 = March 2026 (Buddhist calendar)
```

Open the file in Excel. You will see one sheet tab per certificate:

```text
6903-001-คอล โฟร์ แคร์
6903-002-ชยันต์
6903-003-จิรายุ
...
```

To print all certificates at once:

1. Right-click any sheet tab → **Select All Sheets**
2. File → Print
3. Each sheet prints as 1 page containing **4 identical copies** of the certificate
4. Cut and distribute: one copy to the vendor, one copy kept by Sonar for tax filing

---

## How WHT Certificates Match Payment Vouchers

Each WHT certificate corresponds to one line in the Finance Ledger where the **Withholding Tax column is non-zero**.

| Finance Ledger | Payment Voucher | WHT Certificate |
| --- | --- | --- |
| EXP20260310-007 | PV20260310-007.pdf | 6903-001 |
| EXP20260310-008 | PV20260310-008.pdf | 6903-002 |
| EXP20260322-009 | PV20260322-009.pdf | 6903-003 |

**To cross-reference manually:**
The script prints a summary table when it runs. Match rows by: same payee name + same date + same gross amount as shown in the payment voucher.

Expenses with **฿0.00 withholding tax** (e.g. cloud subscriptions, meals, supplies) do **not** require certificates and are skipped automatically.

---

## Buddhist Calendar Reference

Thai tax documents use the Buddhist calendar (Gregorian year + 543).

| Gregorian | Buddhist | File prefix |
| --- | --- | --- |
| January 2026 | 2569 | 6901 |
| February 2026 | 2569 | 6902 |
| March 2026 | 2569 | 6903 |
| December 2026 | 2569 | 6912 |
| January 2027 | 2570 | 7001 |

---

## Payee Database

All Thai payee info is stored in `data/payeeinfo.json`. This file grows over time as new vendors are added. You can open it in any text editor to review or correct entries.

### Pre-loaded payees (no prompts for these)

These payees were extracted from existing manual certificates and are ready to use:

| English name in ledger | Thai name | Months seen |
| --- | --- | --- |
| MS. Pitchanan Leesuksom | นางสาวพิชชานันท์ ลี้สุขสม | Jan, Feb, Mar, Apr |
| MR. CHAYAN CHAIYAPORN / MR. CHAYAN CHAIYANPORN | นาย ชยันต์ ไชยพร | Jan, Feb, Mar, Apr |
| CAL4CARE ( THAILAND ) CO.,LTD. | บริษัท คอล โฟร์ แคร์ (ประเทศไทย) จำกัด | Jan, Feb, Mar, Apr |
| MR CHIRAYU SUKHUM / Mr. Chirayu Sukhum | นาย จิรายุ สุขุม | Jan, Feb, Mar, Apr |
| MS. Chutikarn Kanchanaart | นางสาว ชุติกาญจน์ ครรชนะอรรถ | Jan, Feb |
| MR. PINGPAN KRUTDUMRONGCHAI | นาย พิงพันธุ์ ครุฑดำรงชัย | Mar, Apr |
| ABT AUDITING CO.,LTD. | บริษัท เอบีที ออดิทติ้ง จำกัด | Feb, Apr |
| MR. Atchariyapat Sirijikarnjareon | อัจฉริยะปัถย์ สิริจิรการเจริญ | Apr |
| MR. SITTIPRUK PUTTISARN | นาย สิทธิพฤกษ์ พุทธิสาร | Apr |
| MR. CHAYENCHANADHIP SEVIKUL | ชเยนทร์ชนาธิป เสวิกุล | Apr |

### Payees that will trigger a prompt (first use only)

These appear in the 2026 ledger with WHT but are not yet in the database.
**Ask the CEO or COO for their Thai details before running those months:**

| English name | First appears | Note |
| --- | --- | --- |
| MR. PHASIT THANITKUL | January | CEO — see note on founder salaries below |
| MR. Phasin Noomkan | January | Founding engineer |
| MS. Lalida Krairit | January | COO — see note on founder salaries below |
| Mr. Kasidis Manasurangkul | January | CTO — see note on founder salaries below |
| MR. LUKA CHANAKAN BOND | April | Thai ID missing — script will ask for it |
| I-PRO ACCOUNT | April | Accounting firm |

> **Note on founder salaries:** Phasit, Lalida, Kasidis, and Phasin are co-founders/full-time staff. They typically receive an annual **ภ.ง.ด. 1** form at year-end instead of monthly 50 ทวิ certificates. Check with the CEO whether their salary entries in January actually require 50 ทวิ certificates before running that month.

---

## Contacts for Thai Payee Info

| Need | Ask |
| --- | --- |
| Individual contractor Thai name & ID | CEO — Phasit Thanitkul |
| Company Thai name & Tax ID | COO — check vendor contract or ask CEO |
| Employee Thai name & national ID | HR records |

---

## Troubleshooting

**"Expense file not found"**
→ Make sure the TSV was saved as `data/expense_2026.tsv` (year in filename).

**"No expenses with withholding tax found"**
→ The Withholding Tax column for that month is all ฿0.00. Either no WHT applies, or the data was not yet added to the ledger.

**WHT amount looks wrong in Excel**
→ The WHT cell uses a formula (`=ROUND(amount × 3%, 2)`). Open the file in Excel and press `Ctrl+Alt+F9` to force-recalculate if it shows 0.

**Sheet name has extra characters**
→ Excel limits sheet names to 31 characters. Very long Thai short names are trimmed automatically.

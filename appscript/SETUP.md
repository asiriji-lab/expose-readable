# Apps Script Setup — Schooldoo Validator

## Installing the Validator on Your Google Sheet

> You only need to do this once per Google Sheet.

### Step 1: Open Apps Script
1. Open your Google Sheet
2. Click **Extensions > Apps Script**

### Step 2: Add the script files
You need 3 files total. Apps Script starts with a default `Code.gs` — replace it and add 2 more.

**File 1 — `Code.gs`** (already exists, just replace the content)
1. Click on `Code.gs` in the left sidebar
2. Select all (Ctrl+A) and delete
3. Paste in the contents of `appscript/Code.gs`

**File 2 — `parsers`**
1. Click **+** next to "Files" > **Script**
2. Name it `parsers` (Apps Script adds `.gs` automatically)
3. Paste in the contents of `appscript/parsers.gs`

**File 3 — `validators`**
1. Click **+** next to "Files" > **Script**
2. Name it `validators`
3. Paste in the contents of `appscript/validators.gs`

### Step 3: Save and authorize
1. Save all files (Ctrl+S or the save icon)
2. Reload your Google Sheet
3. A **Schooldoo** menu will appear in the top menu bar
4. The first time you run it, Google will ask you to authorize — click **Review permissions > Allow**

### Step 4: Validate
1. Click **Schooldoo > Validate All Tabs**
2. A "Validation Results" tab will be created with the results
3. Fix any red rows and re-validate until all tabs pass

---

## Re-pasting After Updates

When the validator code is updated (new rules, bug fixes), you need to re-paste the updated files:
1. Go to **Extensions > Apps Script**
2. Replace the content of the changed file(s)
3. Save (Ctrl+S)
4. Reload the sheet and re-run validation — no redeployment needed

---

## Tab Reference

| # | Tab name | Required columns |
|---|----------|-----------------|
| 1 | `period` | คาบ, เวลา |
| 2 | `room` | ห้องทั้งหมด |
| 3 | `teacher` | teacher_id, ชื่อ |
| 4 | `student` | นักเรียน, ชั้น, ห้อง |
| 5 | `preplace` | ชื่อ, คาบ, apply_to |
| 6 | `scout` | _(no required columns — flexible structure)_ |
| 7 | `elective` | รหัสวิชา, ชื่อวิชา (เสรี), ครูผู้สอน, ห้องเรียน |
| 8 | `curriculum` | รหัสวิชา, ครู, คาบ/สัปดาห์ |
| 9 | `constraints` | _(optional tab — skipped if not present)_ |

> Tab names must be **exactly** as shown above (lowercase English). Column names must match exactly including Thai characters.

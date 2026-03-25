# Apps Script Setup — Schooldoo Skeleton Sheets

## One-Time Setup (Template Owner)

### Step 1: Create a new Google Sheet
1. Go to [sheets.new](https://sheets.new)
2. Name it: **"Schooldoo Template"**

### Step 2: Open Apps Script
1. Go to **Extensions > Apps Script**
2. Delete the default `Code.gs` content

### Step 3: Create the script files
Create 3 files (click **+** next to "Files" > Script):

| File | Copy from |
|------|-----------|
| `Code.gs` | `appscript/Code.gs` |
| `parsers` | `appscript/parsers.gs` |
| `validators` | `appscript/validators.gs` |

> When you create a new script file in Apps Script, it automatically adds `.gs`.
> So name them `parsers` and `validators` (without .gs).

### Step 4: Run the skeleton generator
1. Save all files (Ctrl+S)
2. In Apps Script, select `createSkeleton` from the function dropdown (top bar)
3. Click **Run**
4. Authorize when prompted (review permissions > allow)
5. Go back to your Google Sheet — you should see 9 tabs with headers

### Step 5: Share with admins
1. Click **Share** (top right of the Google Sheet)
2. Add admin emails (e.g., `admin1@school.ac.th`)
3. Set permission to **Editor**
4. The Apps Script is bound to the sheet — every admin gets the menu

---

## Per-Semester Usage (Every Admin)

### Step 1: Copy the template
1. Open the template sheet
2. **File > Make a copy**
3. Rename to e.g., "Schedule 2026 Semester 1"

> The copy includes the Apps Script automatically.

### Step 2: Fill in data
Fill in each of the 9 tabs. Leave the header row untouched.

### Step 3: Validate
1. In the sheet menu bar, click **Schooldoo > Validate All Tabs**
2. Check the "Validation Results" tab
3. Fix any errors and re-validate

### Step 4: Connect to the React app
1. Make the sheet viewable: **Share > Anyone with the link > Viewer**
2. Copy the sheet URL
3. Paste it into the Schooldoo app's file input

---

## Tab Reference

| # | Tab | Required Columns |
|---|-----|-----------------|
| 1 | period | คาบ, เวลา |
| 2 | room | ห้องทั้งหมด, หมายเหตุ, ประเภท |
| 3 | teacher | teacher_id, ชื่อ, available_slots, unavailable_slots |
| 4 | student | นักเรียน, ชั้น, ห้อง |
| 5 | preplace | ชื่อ, คาบ, apply_to |
| 6 | scout | _(flexible — group names as headers)_ |
| 7 | elective | รหัสวิชา, ชื่อวิชา (เสรี), ครูผู้สอน, ห้องเรียน |
| 8 | curriculum | รหัสวิชา, subject_name, คาบ/สัปดาห์, ครู, block_pattern, student_class, constraint, room, fixed_period |
| 9 | constraints | slot_name, periods, apply_to |

---

## Updating Validators

When you update the TypeScript validators in `app/(admin)/validators/`, port the changes to the `.gs` files and re-paste into Apps Script. The logic should stay in sync between both places.

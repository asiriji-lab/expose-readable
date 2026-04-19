# Schooldoo — Google Apps Script Setup & Admin Workflow

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  One-time setup:                                                  │
│    1. Create skeleton Google Sheet template                       │
│    2. Deploy Apps Script (validators) into the template           │
│                                                                   │
│  Per-semester admin workflow:                                     │
│    1. Admin clicks "สร้างตารางสอนใหม่" → gets copy of skeleton    │
│    2. Admin uploads their data files in React app                 │
│    3. App validates each tab → shows errors if any                │
│    4. Admin fixes errors, re-uploads until all pass               │
│    5. All tabs pass → generate schedule                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Create the Skeleton Template (One-Time)

### Step 1: Create a new Google Sheet

Go to [sheets.new](https://sheets.new) and name it **"Schooldoo Template"**

### Step 2: Open Apps Script

**Extensions → Apps Script**

### Step 3: Create the script files

Delete the default content in `Code.gs`, then create 3 files total:

| File | Source | How to create |
|------|--------|---------------|
| `Code.gs` | `appscript/Code.gs` | Already exists — paste over it |
| `parsers` | `appscript/parsers.gs` | Click **+** → Script → name it `parsers` |
| `validators` | `appscript/validators.gs` | Click **+** → Script → name it `validators` |

> Don't type `.gs` when naming — it's added automatically.

### Step 4: Generate the skeleton tabs

1. **Save** all files (Ctrl+S)
2. Go back to your **Google Sheet** (not the Apps Script editor)
3. **Reload the page** (F5)
4. Wait for the **Schooldoo** menu to appear in the menu bar
5. Click **Schooldoo → Create Skeleton Tabs**
6. All 9 tabs will be created with correct headers

### Skeleton tabs

| # | Tab | Headers |
|---|-----|---------|
| 1 | period | `period_label`, `period_time` |
| 2 | room | `room_id`, `note`, `tag` |
| 3 | teacher | `teacher_id`, `teacher_name`, `available_slots`, `unavailable_slots`, `constraint` |
| 4 | student | `class_id`, `grade`, `section`, `default_room`, `curriculum` |
| 5 | preplace | `slot_name`, `periods`, `apply_to` |
| 6 | scout | `ลูกเสือม.1`, `ลูกเสือม.2`, `ลูกเสือม.3` |
| 7 | elective | `subject_id`, `subject_name`, `teacher`, `room` |
| 8 | curriculum | `subject_id`, `subject_name`, `periods_per_week`, `teacher`, `block_pattern`, `student_class`, `constraint`, `room`, `fixed_period` |
| 9 | constraints | `slot_name`, `periods`, `apply_to` |

### Step 5: Get the copy link

Copy the template sheet ID from its URL:
`https://docs.google.com/spreadsheets/d/{THIS_PART}/edit`

The copy link is:
`https://docs.google.com/spreadsheets/d/{SHEET_ID}/copy`

This is used in the React app's "สร้างตารางสอนใหม่" button so admins get their own copy with Apps Script baked in.

---

## Part 2: Admin Workflow (Per Semester)

This matches the actual app flow in the React project:

```
/dashboard                    → ScheduleList + CreateScheduleButton
/dashboard/[id]               → Session detail page (the main workflow)
  ├─ SessionInfoCard          → Step 1: Fill session name, semester, year
  ├─ CreateScheduleButton     → Step 2: Copy skeleton Google Sheet
  ├─ File Upload Section      → Step 3: Upload CSV files per tab
  ├─ ValidationSection        → Step 4: Validate all tabs
  ├─ ErrorPanel               → Shows errors per tab (fix & re-upload)
  └─ GenerationStatus         → Step 5: Generate schedule
```

### Step 1: Create new schedule

Admin goes to `/dashboard` and clicks **"สร้างตารางสอนใหม่"** → gets redirected to a new session page (`/dashboard/[id]`).

### Step 2: Fill session info

Admin fills in **session name**, **semester**, and **year** in the `SessionInfoCard`.

### Step 3: Upload data files

Admin uploads their CSV data files in the **file upload section** — one file per tab (9 tabs total). The admin already has their own data; they just upload it here.

### Step 4: Validate

The React app validates each uploaded file automatically:
- **Pass** → tab marked as done, move to next
- **Errors** → errors shown in `ErrorPanel`, admin fixes their file and re-uploads

The same validation rules also exist in the Google Sheet (Apps Script) — admin can optionally pre-check there via **Schooldoo → Validate All Tabs**.

### Step 5: Generate

Once all 9 tabs are uploaded and pass validation → schedule generation starts (`GenerationStatus`).

---

## Part 3: Using Apps Script Validation in Google Sheets (Optional)

Admins can pre-check their data in the Google Sheet before uploading to the React app:

1. Open their copy of the template
2. Paste/import their data into the correct tabs
3. Click **Schooldoo → Validate All Tabs**
4. Check the **"Validation Results"** tab

| Tab | Status | Errors |
|-----|--------|--------|
| teacher | PASSED | |
| room | ERRORS (1) | Row 5, room_id: Duplicate room ID "C101" (also row 3). |
| period | PASSED | |
| ... | | |

This helps catch errors before uploading to the React app.

---

## File Reference

Apps Script source files are version-controlled in the repo:

```
appscript/
  Code.gs        — Menu, skeleton generator, validation runner
  parsers.gs     — Regex helper functions
  validators.gs  — All 9 tab validators
```

When updating validators in the React app (`app/(admin)/validators/`), port the changes to the `.gs` files and re-paste into Apps Script to keep both in sync.

# Schedool — Spreadsheet Validation UX Improvement Plan

## Current Flow

```
User fills data → (no feedback) → Runs "Validate" from menu → Reads Validation Results tab
                                       OR
User fills data → Comes back to web app → Clicks "Check Data" → Gets wall of errors
```

### Root Problem
**Two independent validators + batch-only feedback = users discover all their mistakes at the end.**

---

## Pain Points

| # | Problem | Why It Hurts |
|---|---------|--------------|
| 1 | **Two validation systems, zero sync** — GAS `runValidation()` and web app `useValidation()` are independent | Confusing, wasted effort |
| 2 | **Validation only runs on-demand** — menu click in Sheets, button click in web app | Users fill 8 tabs wrong, only know at the end |
| 3 | **Row-level coloring is too coarse** — `applyHighlights()` paints the whole row red | No idea which *cell* is wrong |
| 4 | **Error messages are buried** — go to a separate "Validation Results" tab | Constant tab-switching to diagnose |
| 5 | **No progress indicator in Sheets** — no sense of which tabs are done vs broken | Anxiety before submitting |
| 6 | **"Check Data" is a cliff** — unvalidated work in Sheets → wall of errors in web app | Discouragement, high cognitive load |
| 7 | **No inline guidance** — headers only, no format hints, no examples | Users guess at formats like `MON_1`, `T001`, etc. |

---

## Improvements

### 🔴 Tier 1 — Quick Wins (GAS only)

#### 1.1 Cell-Level Coloring + Notes
Color only the specific bad cell, and add a hover note with the error message.

```
Before:  [Row 5] ████████████████████████████  ← whole row red
After:   [Row 5] ████ ░░░░ ████ ░░░░ ░░░░       ← only bad cells red
                  ^ note: "ต้องเป็น T### (อย่างน้อย 3 หลัก)"
```

**How:** Change `applyHighlights()` to use `sheet.getRange(row, col).setNote(message)` and color per-column using `errors[e].col`.

---

#### 1.2 Native Data Validation Dropdowns
Add Google Sheets dropdowns via `setDataValidation()` in `generateSkeleton()`.

| Tab | Column | Dropdown Values |
|-----|--------|----------------|
| student | `ชั้น` | ม.1, ม.2, ม.3, ม.4, ม.5, ม.6 |
| preplace | `apply_to` | All, ม.1, ม.2, ม.3, ม.4, ม.5, ม.6 |
| teacher | `ตำแหน่ง` | ครู, อาจารย์พิเศษ, ฯลฯ |

Prevents invalid input at entry time — zero cognitive load.

---

#### 1.3 Example Data Row in Skeleton
When creating a new skeleton, insert a grayed-out example row 2 with real format examples.

```
Row 1 (header):  | teacher_id | ชื่อ   | available_slots |
Row 2 (example): | T001       | สมชาย  | MON_1,TUE_3     |  ← italic, gray, yellow bg
                   ⬆ "ตัวอย่าง — ลบแถวนี้ก่อนส่ง"
```

Shows exact expected format. More useful than any documentation.

---

#### 1.4 onEdit Trigger — Live Per-Cell Validation
Add a lightweight `onEdit(e)` that validates the single cell being edited.

```javascript
function onEdit(e) {
  var sheet = e.range.getSheet();
  var col = e.range.getColumn();
  var val = sanitize(e.value);
  // Only run cheap structural checks (not referential)
  // e.g. if col == teacher_id col → check isValidTeacherId(val)
  //      if wrong → setBackground(red) + setNote(message)
  //      if right → setBackground(null) + clearNote()
}
```

> ⚠️ **Important:** Only validate the edited cell — never run the full suite in `onEdit`. 30-second execution limit applies.

This is the single highest-impact change.

---

### 🟡 Tier 2 — Medium Effort (GAS + coordination)

#### 2.1 Status Dashboard Tab
Auto-update a `_status` tab (or the "Validation Results" tab) after every full validation run:

```
┌──────────────┬──────────┬────────┬──────────┐
│ Tab          │ Status   │ Errors │ Warnings │
├──────────────┼──────────┼────────┼──────────┤
│ period       │ ✅ PASS  │ 0      │ 0        │
│ teacher      │ ❌ FAIL  │ 3      │ 1        │
│ student      │ ⚪ EMPTY │ —      │ —        │
│ curriculum   │ ⚠️ WARN  │ 0      │ 2        │
├──────────────┼──────────┼────────┼──────────┤
│ OVERALL      │ ❌ FAIL  │ 3      │ 3        │
└──────────────┴──────────┴────────┴──────────┘
```

Users see overall readiness without switching tabs.

---

#### 2.2 Conditional Formatting Rules (Burned into Skeleton)
Set regex-based conditional formatting rules via GAS during `generateSkeleton()`.

```javascript
// Example: teacher_id column must match ^[TE]\d{3,}$
var rule = SpreadsheetApp.newConditionalFormatRule()
  .whenFormulaSatisfied('=NOT(REGEXMATCH(A2,"^[TE]\\d{3,}$"))')
  .setBackground('#FFCDD2')
  .setRanges([teacherIdRange])
  .build();
```

Works even without the script running — permanent, zero-latency feedback.

---

#### 2.3 Unified Validation (GAS as Single Source of Truth)
When user clicks "Check Data" in the web app, trigger `runValidation()` via the Apps Script endpoint *first*, then read results. Eliminates the two-validator problem.

```
Web App → POST /api/sheets/appscript → GAS runValidation() → colors cells in sheet
Web App ← reads Validation Results tab ← displays same errors as sheet
```

---

### 🟢 Tier 3 — Premium UX

#### 3.1 Deep Link from Web App Error → Sheet Cell
When the web app shows `Row 5, teacher_id: รหัสซ้ำ`, make it a link:

```
https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}&range=A5
```

One click from error message → exact broken cell. No hunting.

---

#### 3.2 Pre-Submit Checklist Gate
Before "Generate Schedule" is allowed:

```
✅ 8/8 required tabs present
✅ All structural validations pass
✅ All referential validations pass (no missing teacher refs)
⚠️ 2 warnings (non-blocking — proceed with caution)

[View Details]    [🚀 Submit for Generation]
```

---

#### 3.3 Auto-Validate on Tab Switch
Use `onActivate(e)` trigger to validate the tab the user just left.

```javascript
function onActivate(e) {
  var previousSheet = ...; // store in PropertiesService
  // run cheap structural validator on previousSheet
}
```

Natural workflow integration — validates without action from user.

---

## Implementation Priority

| Order | Improvement | Effort | Impact | Status |
|-------|------------|--------|--------|---------| 
| **1** | 1.3 Example rows in skeleton | 30 min | ⭐⭐⭐⭐ | ✅ Done |
| **2** | 1.2 Data validation dropdowns | 1 hr | ⭐⭐⭐⭐ | ✅ Done |
| **3** | 2.2 Conditional formatting rules | 1.5 hr | ⭐⭐⭐⭐ | ✅ Done |
| **4** | 1.1 Cell-level coloring + notes | 2 hr | ⭐⭐⭐⭐⭐ | ✅ Done |
| **5** | 1.4 onEdit live validation | 3 hr | ⭐⭐⭐⭐⭐ | ✅ Done |
| **5a** | Fix: Row 2 overwrite validation | 15 min | ⭐⭐⭐⭐⭐ | ✅ Done |
| **5b** | Fix: Duplicate trigger execution | 10 min | ⭐⭐⭐⭐ | ✅ Done |
| **5c** | Fix: Preserve green row markers | 10 min | ⭐⭐⭐ | ✅ Done |
| **5d** | Fix: Cache teacher names (60s TTL) | 20 min | ⭐⭐⭐ | ✅ Done |
| **5e** | Add: room/elective live validators | 20 min | ⭐⭐⭐ | ✅ Done |
| **5f** | Add: preplace conditional formatting | 15 min | ⭐⭐ | ✅ Done |
| **5g** | Add: Header validation hint notes | 15 min | ⭐⭐⭐ | ✅ Done |
| **5h** | Fix: Example row notes on all cells | 5 min | ⭐⭐ | ✅ Done |
| **5i** | Fix: Guard CF against non-boolean | 5 min | ⭐ | ✅ Done |
| **6** | 2.1 Status dashboard tab | 2 hr | ⭐⭐⭐ | ⬜ Next |
| **7** | 3.1 Deep link to cell (web app) | 1 hr | ⭐⭐⭐ | ⬜ Next |
| **8** | 3.2 Pre-submit gate (web app) | 2 hr | ⭐⭐⭐ | ⬜ Next |
| **9** | 2.3 Unified validation endpoint | 4 hr | ⭐⭐⭐ | ⬜ Later |
| **10** | 3.3 Auto-validate on tab switch | 1 hr | ⭐⭐ | ⬜ Later |

---

## The Core UX Shift

```
❌ Current:   Fill everything blindly → Click Validate → Wall of errors → Fix → Repeat
                                        (BATCH FEEDBACK)

✅ Proposed:  Type in cell → Instantly see if correct → Fix as you go → Submit confidently
                                        (CONTINUOUS FEEDBACK)
```

**Principle: Move validation feedback as close to the point of data entry as possible.**  
Every extra step between error and fix (different tab, different app, button click) is friction that causes abandonment or more mistakes.

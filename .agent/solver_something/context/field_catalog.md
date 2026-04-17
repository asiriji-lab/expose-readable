# ScheDool — Field Catalog (Edge Cases & Semantics)

Documents every column in every raw CSV: what it means, its format, and every edge case the validator must handle.

---

## `period.csv`

| Column | Thai Header | Type | Edge Cases |
| :--- | :--- | :--- | :--- |
| Period Label | `คาบ` | string / number | Can be a number (`1`, `2`) or a string (`Morning Break`, `Afternoon Break`). Both are valid. Do NOT expect only integers. |
| Time | `เวลา` | string | Either `HH.MM-HH.MM` (e.g. `08.05-08.55`) OR a plain number representing duration in minutes (e.g. `10`). Both are valid. |

---

## `room.csv`

| Column | Thai Header | Type | Edge Cases |
| :--- | :--- | :--- | :--- |
| Room ID | `ห้องทั้งหมด` | string | **Required.** Can be alphanumeric (`A316`), hyphenated (`B101-102`), Thai (`งานช่าง`, `นอกสถานที่`). No consistent pattern — cannot use a regex. |
| Note / Alias | `หมายเหตุ` | string | Optional. Used as an **alias** (e.g. `COM1`, `ม.3/1`). A reference to this value in another file is valid. |
| Type / Tag | `ประเภท` | string | Optional. Used as a **category** (e.g. `COM`, `OUT`, `ยิม`). A reference to this value in another file is valid. |

> **Room Resolution Rule (3-way)**: A raw room reference is valid if it matches `ห้องทั้งหมด` OR `หมายเหตุ` OR `ประเภท`. A single tag like `COM` resolves to multiple room IDs — not an error.

---

## `teacher.csv`

| Column | Thai Header | Type | Edge Cases |
| :--- | :--- | :--- | :--- |
| Teacher ID | `teacher_id` | string | Format: `T###` (regular) or `E###` (external). Must be non-empty for data rows. |
| Prefix | `คำนำหน้า` | string | Ignored for validation. `ครู`, `อ.`, `รศ.ดร.`, `T.` etc. |
| First Name | `ชื่อ` | string | **This is the cross-reference key.** Other files reference teachers by first name only. Must be non-empty. |
| Department | `กลุ่มสาระ` | string | Informational only. May include `อาจารย์นอก` for external teachers. |
| Available Slots | `available_slots` | string | Optional. Comma-delimited list of slot ranges: `MON_2-MON_10, TUE_2-TUE_6`. Blank = no restriction. |
| Unavailable Slots | `unavailable_slots` | string | Optional. Same format as available slots. |
| Note | `หมายเหตุ` | string | Informational only. |

> **Structural Rows to Skip**: Any row where `teacher_id` is empty AND `ชื่อ` is a marker like `ครูในโรงเรียน` or `อาจารย์นอก` — these are section headers, not data.

---

## `student.csv`

| Column | Thai Header | Type | Edge Cases |
| :--- | :--- | :--- | :--- |
| Class ID | `นักเรียน` | string | Format: `G/S` (e.g. `1/1`, `4/5`). Grade and section separated by `/`. |
| Grade | `ชั้น` | string | Format: `ม.[1-6]`. |
| Section | `ห้อง` | number (int) | Positive integer. |
| Home Room | `ห้องประจำ` | string | Optional. Must exist in `room.csv` if provided (check `ห้องทั้งหมด` only — not aliases). |
| Curriculum | `หลักสูตร` | string | Optional. Informational (e.g. `วมว`). |

---

## `preplace.csv`

| Column | Thai Header | Type | Edge Cases |
| :--- | :--- | :--- | :--- |
| Slot Name | `ชื่อ` | string | **This is the cross-reference key.** Used as column headers in `elective.csv`. Must be non-empty. |
| Period | `คาบ` | string | Multi-format: `DAY_N` (single), `DAY_N-DAY_M` (range), `Everyday_N` (all days). Comma-delimited for multi-slot. |
| Apply To | `apply_to` | string | `All`, a single grade (`ม.1`), or a comma-delimited list (`ม.1, ม.2, ม.3`). |

---

## `scout.csv`

| Structure | Notes |
| :--- | :--- |
| Column Headers | Each header is a scout group name (e.g. `ลูกเสือม.1`). These match slot names in `preplace.csv`. |
| Cell Values | Each non-empty cell is a **teacher first name**. Must exist in `teacher.csv → ชื่อ`. |
| Sparse Matrix | Blank cells are completely valid. Not every slot has the same number of teachers. |

---

## `elective.csv`

| Column | Thai Header | Type | Edge Cases |
| :--- | :--- | :--- | :--- |
| Subject ID | `รหัสวิชา` | string | Optional on data rows. Section header rows (e.g. `เสรีม.ต้น`) occupy this field and must be **skipped**. |
| Subject Name | `ชื่อวิชา (เสรี)` | string | Optional. |
| Teacher | `ครูผู้สอน` | string | **Single teacher name only** (no multi-teacher in elective). Must exist in `teacher.csv → ชื่อ`. |
| Room | `ห้องเรียน` | string | Single room reference. Must resolve via 3-way room lookup. Can include Thai room names (e.g. `ดนตรีสากล` which resolves to a room type). |
| Slot Columns (dynamic) | `เสรีม.ต้น1`, `เสรีม.ปลาย3` etc. | number (`1`) or empty | Column headers must match slot names in `preplace.csv`. A `1` means this elective is offered in that slot. |

> **Section Header Rows**: Rows where `รหัสวิชา` = `เสรีม.ต้น` or `เสรีม.ปลาย` are structural dividers. Skip them.

---

## `curriculum.csv`

The most complex file. Contains structural rows, multi-value cells, and requires context from all other files.

| Column | Thai Header | Type | Edge Cases |
| :--- | :--- | :--- | :--- |
| Subject ID | `รหัสวิชา` | string | Optional on continuation rows. Grade headers (`ม.1`) appear here and must be **detected and skipped as structural rows**. |
| Subject Name | `ชื่อวิชา` | string | Optional on continuation rows (subject re-uses the name from the row above). |
| Periods/Week | `คาบ/สัปดาห์` | number | Required on all data rows. Numeric. |
| Num Classes | `จำนวนห้อง` | number | Informational. |
| Total Periods | `รวมคาบ` | number | Informational. |
| Teacher | `ครู` | string | ⚠️ **Multi-value**: comma-delimited first names. Split on `, `. Each token must exist in `teacher.csv → ชื่อ`. Validate each token independently. |
| Block Pattern | `การแบ่งคาบสอน` | string | e.g. `1`, `2`, `2-1`, `2-2`. Numeric tokens separated by `-`. Optional. |
| Student Class | `ห้อง (นักเรียน) ที่สอน` | string | ⚠️ **Range notation**: `/1, /3-5` = sections 1, 3, 4, 5. Scoped to the **current grade** (from the last grade header row). Each resolved section must exist in `student.csv` for that grade. |
| Note | `หมายเหตุ` | string | Free-form. May contain constraint hints like `type=TEAM`, `type=SUB_GROUP`. Informational — not validated by the frontend. |
| Room | `ห้องเรียน` | string | ⚠️ **Multi-value**: can use ` / ` as delimiter (e.g. `COM1 / COM2`). Each token resolved via 3-way room lookup. |
| Fixed Period | `คาบเรียน` | string | Optional. Slot format `DAY_N-DAY_M`. Same format as `available_slots`. |

> **Grade Header Detection**: A row is a structural grade header if the first cell matches `^ม\.[1-6]$` and all other cells are empty. Maintain a "current grade" variable while iterating rows.

> **Continuation Rows**: A row where Subject ID and Subject Name are empty but Periods/Week has a value — this is a continuation of the previous subject (e.g. different teacher group for a different set of sections). Validate normally.

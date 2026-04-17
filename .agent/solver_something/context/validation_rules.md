# ScheDool — Validation Rules Spec

The definitive pass/fail rules for each file. Derived from `field_catalog.md` and `pipeline.md`.
This is the source of truth for implementing the validator.

---

## `period.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| PR-1 | Headers: `คาบ` and `เวลา` must be present | "Missing required column: {column}" |
| PR-2 | `คาบ`: must be non-empty for every row | "Row {n}, 'คาบ': Period label is required." |
| PR-3 | `เวลา`: must be either `HH.MM-HH.MM` OR a plain integer | "Row {n}, 'เวลา': Must be a time range (08.05-08.55) or a duration in minutes (e.g. 10)." |

---

## `room.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| RM-1 | Header `ห้องทั้งหมด` must be present | "Missing required column: ห้องทั้งหมด" |
| RM-2 | `ห้องทั้งหมด`: must be non-empty for every row | "Row {n}, 'ห้องทั้งหมด': Room ID is required." |
| RM-3 | No duplicate values in `ห้องทั้งหมด` | "Duplicate Room ID '{value}' found at rows {n} and {m}." |

---

## `teacher.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| TC-1 | Headers: `teacher_id`, `ชื่อ` must be present | "Missing required column: {column}" |
| TC-2 | Skip rows where `teacher_id` is empty (structural markers) | — (no error) |
| TC-3 | `teacher_id`: must match `^[TE]\d{3}$` on data rows | "Row {n}, 'teacher_id': Must be T### or E### (e.g. T001, E003)." |
| TC-4 | `ชื่อ`: must be non-empty on data rows | "Row {n}, 'ชื่อ': Teacher first name is required." |
| TC-5 | No duplicate values in `teacher_id` | "Duplicate teacher_id '{value}' at rows {n} and {m}." |
| TC-6 | `available_slots` and `unavailable_slots`: if present, each token must match `DAY_N` or `DAY_N-DAY_M` | "Row {n}, '{column}': Invalid slot '{token}'. Expected format: MON_2 or MON_2-MON_10." |

---

## `student.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| ST-1 | Headers: `นักเรียน`, `ชั้น`, `ห้อง` must be present | "Missing required column: {column}" |
| ST-2 | `นักเรียน`: must match `^\d+/\d+$` | "Row {n}, 'นักเรียน': Must be in format G/S (e.g. 1/1)." |
| ST-3 | `ชั้น`: must match `^ม\.[1-6]$` | "Row {n}, 'ชั้น': Must be ม.1 through ม.6." |
| ST-4 | `ห้อง`: must be a positive integer | "Row {n}, 'ห้อง': Section must be a positive integer." |

**Phase 2 (Referential)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| ST-5 | `ห้องประจำ`: if present, must exist in `room_ids` (exact match only, no alias/type resolution) | "Row {n}, 'ห้องประจำ': Room '{value}' not found. Known rooms: [{list}]." |

---

## `preplace.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| PP-1 | Headers: `ชื่อ`, `คาบ`, `apply_to` must be present | "Missing required column: {column}" |
| PP-2 | `ชื่อ`: must be non-empty | "Row {n}, 'ชื่อ': Slot name is required." |
| PP-3 | `คาบ`: each token (split on `, `) must match `DAY_N`, `DAY_N-DAY_M`, or `Everyday_N` | "Row {n}, 'คาบ': Invalid period '{token}'. Expected: MON_1, MON_2-MON_5, or Everyday_1." |
| PP-4 | `apply_to`: must be `All`, a grade (`ม.1`), or a comma list of grades | "Row {n}, 'apply_to': Invalid value '{value}'. Must be 'All' or a list of grades (e.g. ม.1, ม.2)." |

---

## `scout.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| SC-1 | No structural rules — blank cells are valid | — |

**Phase 2 (Referential)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| SC-2 | Every non-empty cell must match a name in `teacher_names` | "Row {n}, Col '{header}': Teacher '{value}' not found. 💡 Did you mean: {suggestion}?" |

---

## `elective.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| EL-1 | Skip rows where `รหัสวิชา` = `เสรีม.ต้น` or `เสรีม.ปลาย` (section headers) | — |
| EL-2 | Slot column headers (all columns after `ห้องเรียน`) must match slot names in `preplace.csv` | Checked in Phase 2 |

**Phase 2 (Referential)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| EL-3 | Each slot column header must exist in `preplace_slots` | "Column header '{header}' does not match any slot in preplace.csv." |
| EL-4 | `ครูผู้สอน`: must exist in `teacher_names` | "Row {n}, 'ครูผู้สอน': Teacher '{value}' not found. 💡 Did you mean: {suggestion}?" |
| EL-5 | `ห้องเรียน`: must resolve via 3-way room lookup (ID, note, or type) | "Row {n}, 'ห้องเรียน': Room '{value}' not found. Use a Room ID, alias, or category." |

---

## `curriculum.csv`

**Phase 1 (Structural)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| CU-1 | Detect grade header rows (`^ม\.[1-6]$` in first cell, all others empty) — track current grade, skip row | — |
| CU-2 | `คาบ/สัปดาห์`: must be numeric on all data rows | "Row {n}, 'คาบ/สัปดาห์': Must be a number." |

**Phase 2 (Referential)**

| # | Rule | Error Message |
| :--- | :--- | :--- |
| CU-3 | `ครู`: split on `, ` → each token must exist in `teacher_names` | "Row {n}, 'ครู': Teacher '{token}' not found. 💡 Did you mean: {suggestion}?" |
| CU-4 | `ห้อง (นักเรียน) ที่สอน`: parse `/X` and `/X-Y` ranges → each section must exist in `student_classes[current_grade]` | "Row {n}, 'ห้อง (นักเรียน)': Section '{token}' is not defined for {current_grade}. (Defined: {list})" |
| CU-5 | `ห้องเรียน`: split on ` / ` → each token must resolve via 3-way room lookup | "Row {n}, 'ห้องเรียน': Room '{token}' not found. Use a Room ID, alias, or category." |
| CU-6 | `คาบเรียน`: if present, must match `DAY_N-DAY_M` slot format | "Row {n}, 'คาบเรียน': Invalid fixed period '{value}'. Expected: MON_9-MON_10." |

---

## Fuzzy Match ("Did You Mean?") Logic

For CU-3, EL-4, SC-2 — when a name lookup fails, compute **Levenshtein distance** against all names in the lookup set. Return the closest match if distance ≤ 3.

```
"Coultr"  →  distance 1 from "Coulter"   ✅ suggest
"XYZ"     →  distance 5+ from all names  ❌ no suggestion
```

# Schedool GAS Validation — Ground Truth Specification

> **Purpose:** This is the single source of truth for the Google Apps Script validation system.
> Use this to verify any code changes are correct. If the code disagrees with this doc, the code is wrong.

---

## File Inventory

| File | Purpose | Lines (current) |
|------|---------|-----------------|
| `Code.gs` | Menu, skeleton generation, validation runner, cell-level highlighting, onEdit live validation | 878 |
| `parsers.gs` | Sanitization, format checkers, token validators | 130 |
| `validators.gs` | Per-tab structural validators + cross-tab referential validators | 449 |

All 3 files use **plain ES5-style JavaScript** (no `const`/`let`/arrow functions) because Google Apps Script's V8 runtime is optional and these were written for Rhino compatibility.

---

## Tab Schema (TAB_DEFS)

These are the 9 tabs the skeleton creates. Headers are in Thai. **Do not rename or reorder headers.**

### period
```
Headers: ['คาบ', 'เวลา']
Example: ['1', '08.30-09.20']
```

### room
```
Headers: ['ห้องทั้งหมด', 'หมายเหตุ', 'ประเภท']
Example: ['101', 'ห้องปฏิบัติการวิทย์', 'ห้องเรียนพิเศษ']
```

### teacher
```
Headers: ['teacher_id', 'ตำแหน่ง', 'ชื่อ', 'กลุ่มสาระ', 'available_slots', 'unavailable_slots', 'หมายเหตุ']
Example: ['T001', 'ครู', 'สมชาย ใจดี', 'วิทยาศาสตร์', 'MON_1,MON_2,TUE_1', '', 'ครูประจำชั้น ม.1/1']
```

### student
```
Headers: ['นักเรียน', 'ชั้น', 'ห้อง', 'ห้องประจำ', 'หลักสูตร']
Example: ['1/1', 'ม.1', '1', '101', 'วิทย์-คณิต']
```

### preplace
```
Headers: ['ชื่อ', 'คาบ', 'apply_to']
Example: ['กิจกรรมหน้าเสาธง', 'Everyday_1', 'All']
```

### scout
```
Headers: ['ลูกเสือม.1', 'ลูกเสือม.2', 'ลูกเสือม.3']
Example: ['สมชาย ใจดี', 'สมหญิง รักเรียน', 'สมศักดิ์ มานะ']
```

### elective
```
Headers: ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน', 'เสรีม.ต้น1', 'เสรีม.ต้น2', 'เสรีม.ปลาย1', 'เสรีม.ปลาย2', 'เสรีม.ปลาย3', 'เสรีม.ปลาย4', 'เสรีม.ปลาย5', 'เสรีม.ปลาย6']
Example: ['EL001', 'ดนตรีสากล', 'สมชาย ใจดี', '201', '', '', '', '', '', '', '', '']
```

### curriculum
```
Headers: ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'จำนวนห้อง', 'รวมคาบ', 'ครู', 'การแบ่งคาบสอน', 'ห้อง (นักเรียน) ที่สอน', 'หมายเหตุ', 'ห้องเรียน', 'คาบเรียน']
Example: ['SCI101', 'วิทยาศาสตร์พื้นฐาน', '3', '4', '12', 'สมชาย ใจดี', '1+1+1', '1/1,1/2,1/3,1/4', '', '201', 'MON_2']
```

### constraints
```
Headers: ['id', 'Name', 'Type', 'description', 'Note', 'parameters (example)', 'Example Constraints']
Example: ['C001', 'MaxPeriodsPerDay', 'hard', 'จำกัดจำนวนคาบ/วัน', '', '{"max": 6}', '']
```

---

## Validation Rules (Structural)

These are the EXACT checks each validator function performs. Validators return `{ valid: boolean, errors: [...], warnings: [...] }`.

### validatePeriod(data)
- Required headers: `คาบ`, `เวลา`
- Skip: empty rows, marker rows
- **ERROR** if `คาบ` is empty (when row is non-empty)
- **ERROR** if `เวลา` doesn't match `isValidTimeFormat()`:
  - Valid: pure digits (e.g. `50`) OR `HH.MM-HH.MM` (e.g. `08.30-09.20`)
  - Regex: `/^\d+$/` or `/^\d{2}\.\d{2}-\d{2}\.\d{2}$/`

### validateRoom(data)
- Required headers: `ห้องทั้งหมด`
- Skip: empty rows, marker rows
- **ERROR** if `ห้องทั้งหมด` is empty (when row has other data)
- **ERROR** if duplicate `ห้องทั้งหมด` value (tracks `seen[roomId]`)

### validateTeacher(data)
- Required headers: `teacher_id`, `ชื่อ`
- Skip: empty rows, marker rows, skip-marker rows (`ครูในโรงเรียน`, `อาจารย์นอก`, `teacher_id`, empty)
- **ERROR** if `teacher_id` doesn't match `isValidTeacherId()`:
  - Regex: `/^[TE]\d{3,}$/` — must start with T or E, followed by 3+ digits
  - Valid: `T001`, `T1234`, `E001`
  - Invalid: `T01`, `T1`, `X001`, `teacher1`
- **ERROR** if `ชื่อ` is empty
- **ERROR** if duplicate `teacher_id`
- **ERROR** if `available_slots` or `unavailable_slots` contain invalid tokens:
  - Valid token: `/^(MON|TUE|WED|THU|FRI)_.+$/` — e.g. `MON_1`, `TUE_3`
  - Invalid: `monday_1`, `MON1`, `SAT_1`

### validateStudent(data)
- Required headers: `นักเรียน`, `ชั้น`, `ห้อง`
- Skip: empty rows, marker rows
- **ERROR** if `นักเรียน` doesn't match `isValidClassId()`:
  - Regex: `/^\d+\/\d+$/` — e.g. `1/1`, `3/12`
  - Invalid: `1-1`, `ม.1/1`, `1`
- **ERROR** if `ชั้น` doesn't match `/^ม\.[1-6]$/`:
  - Valid: `ม.1` through `ม.6`
  - Invalid: `ม1`, `ม.7`, `M.1`, `1`
- **ERROR** if `ห้อง` is not a positive integer:
  - Regex: `/^\d+$/` and `parseInt > 0`

### validatePreplace(data)
- Required headers: `ชื่อ`, `คาบ`, `apply_to`
- Skip: empty rows, marker rows
- **ERROR** if `ชื่อ` is empty
- **ERROR** if `คาบ` contains invalid preplace slot tokens:
  - Valid: `Everyday_1`, `MON_1`, `MON_1-FRI_5` (range)
  - Regexes: `/^Everyday_\d+$/`, `/^(MON|TUE|WED|THU|FRI)_\d+$/`, `/^(MON|TUE|WED|THU|FRI)_\d+-(MON|TUE|WED|THU|FRI)_\d+$/`
- **ERROR** if `apply_to` doesn't match `isValidApplyTo()`:
  - Valid: `All`, `all`, `ม.1`, `ม.1,ม.2,ม.3`
  - Invalid: `ม.7`, `grade 1`, `1`

### validateScout(data)
- Only checks: tab is non-empty
- No field-level validation (structural)

### validateElective(data)
- Required headers: `รหัสวิชา`, `ชื่อวิชา (เสรี)`, `ครูผู้สอน`, `ห้องเรียน`
- Skip: empty rows, marker rows
- No field-level structural validation currently (only header check)

### validateCurriculum(data)
- Required headers: `รหัสวิชา`, `ครู`, `คาบ/สัปดาห์`
- Skip: empty rows, marker rows, rows where `รหัสวิชา` is empty
- **ERROR** if `คาบ/สัปดาห์` is not a positive number:
  - Regex: `/^\d+(\.\d+)?$/` and `parseFloat > 0`
  - Valid: `3`, `1.5`, `0.5`
  - Invalid: `0`, `-1`, `three`, `3คาบ`

### validateConstraints(data)
- Always returns `{ valid: true, errors: [], warnings: [] }`

---

## Validation Rules (Referential / Cross-Tab)

These run in Phase 2, after all tabs are loaded. They use `lookups` built from `buildGASLookups()`.

### Lookups Built
- `roomIds`: Set of all `ห้องทั้งหมด` values from room tab
- `roomNotes`: Set of all `หมายเหตุ` values from room tab  
- `teacherNames`: Set of all `ชื่อ` values from teacher tab
- `gradeToSections`: Map of grade → section numbers from student tab

### _resolveRoom(ref, lookups)
Returns true if reference matches either `roomIds[ref]` or `roomNotes[ref]`.

### validateCurriculumRefs
- **ERROR** if `ครู` column contains teacher names not found in teacher tab
- **ERROR** if `ห้องเรียน` column contains rooms not found in room tab (by ID or note)
- Uses `splitAndSanitize()` — values can be comma/semicolon/newline separated

### validateElectiveRefs
- **ERROR** if `ครูผู้สอน` teacher name not found in teacher tab
- **WARNING** if `ครูผู้สอน` is empty
- **ERROR** if `ห้องเรียน` room not found in room tab
- **WARNING** if `ห้องเรียน` is empty

### validateStudentRefs
- **ERROR** if `ห้องประจำ` room not found in room tab

### validateScoutRefs
- **ERROR** if any cell in scout tab contains teacher names not found in teacher tab

---

## Parser Functions (parsers.gs)

### sanitize(val)
- Converts to string, trims whitespace
- Strips: zero-width chars (BOM, ZWSP, NBSP: `\u0000-\u001F`, `\u00A0`, `\u200B-\u200D`, `\u2060`, `\uFEFF`)
- Strips trailing commas/semicolons
- Returns trimmed string (empty string if null/undefined)

### splitAndSanitize(input)
- Splits by: comma, semicolon, newline, or ` / ` (slash with spaces)
- Sanitizes each part, filters out empty strings
- Returns array of non-empty strings

### isValidTimeFormat(value)
- `/^\d+$/` → true (pure number = minutes)
- `/^\d{2}\.\d{2}-\d{2}\.\d{2}$/` → true (time range)
- Otherwise → false

### isValidSlotToken(token)
- `/^(MON|TUE|WED|THU|FRI)_.+$/`

### isValidPreplaceSlotToken(token)
- `/^Everyday_\d+$/` OR
- `/^(MON|TUE|WED|THU|FRI)_\d+$/` OR
- `/^(MON|TUE|WED|THU|FRI)_\d+-(MON|TUE|WED|THU|FRI)_\d+$/`

### isValidTeacherId(value)
- `/^[TE]\d{3,}$/`

### isValidClassId(value)
- `/^\d+\/\d+$/`

### isGradeHeader(value)
- `/^ม\.([1-6])$/`

### isMarkerRow(row)
Returns true if:
1. First cell is non-empty AND all other cells are empty
2. AND first cell is either a grade header (`ม.1`–`ม.6`) or ends with colon (e.g. `กลุ่มสาระ:`)

### isSkipRow(firstCellValue)
Returns true if first cell is one of: `ครูในโรงเรียน`, `อาจารย์นอก`, `teacher_id`, or empty string.

### isValidApplyTo(value)
- `All` or `all` → true
- Single `ม.[1-6]` → true
- Comma-separated list where each item matches `ม.[1-6]` → true

---

## Color Constants

```
COLOR_RED    = '#FFCDD2'   // error cell/row
COLOR_YELLOW = '#FFF9C4'   // warning cell/row
COLOR_GREEN  = '#C8E6C9'   // clean row
COLOR_HEADER = '#E8EAF6'   // header row background
```

---

## Error/Warning Object Shape

```javascript
// Error
{ row: number, col: number, message: string, suggestion: string }
// row: 1-based sheet row (row 1 = header)
// col: 1-based sheet column

// Warning
{ row: number, col: number, message: string }
```

---

## Key Invariants (MUST remain true after any changes)

1. **Row 1 is always the header row.** It is frozen, protected, and colored `COLOR_HEADER`.
2. **Marker rows are never validated or colored.** `isMarkerRow()` must be checked before any validation.
3. **Skip rows (teacher tab only) are never validated.** `isSkipRow()` applies only to teacher tab.
4. **Empty rows are always skipped.** `_isEmptyRow()` checks all cells via `sanitize()`.
5. **All string comparisons use `sanitize()` first.** Never compare raw cell values.
6. **`col` in errors/warnings is 1-based** (matching Google Sheets column numbering).
7. **`row` in errors/warnings is 1-based** (matching Google Sheets row numbering, where row 1 = header).
8. **Referential validation is separate from structural.** `TAB_VALIDATORS` runs first, `REF_VALIDATORS` runs second. Both results merge.
9. **The `onEdit` trigger must NEVER run full validation.** Only validate the single edited cell. Max 30-second execution limit.
10. **Tab aliases must be preserved.** Tabs can have Thai names (`ครู`) or English names (`teacher`). `getSheetByAliases()` handles this.
11. **`generateSkeleton()` is idempotent on headers and example rows.** It only writes headers if row 1 is empty. It only writes the example row if row 2 is empty. It always re-applies formatting, dropdowns, and conditional formatting rules.
12. **Validation Results tab** is auto-created if missing, always cleared before each run, and navigated to after completion.
13. **Row 2 is reserved for the example row.** `onEdit` skips row 2 **only if it still matches the example data** (checked via `isExampleRow_`). If the user has overwritten the example with real data, row 2 is validated normally. `applyHighlights` skips row 2 when checking for clean rows. `_insertExampleRow_()` only writes to row 2 if it is empty and places reminder notes on ALL cells (not just A2).
14. **`isExampleRow_(def, row)` auto-detects forgotten example rows.** Compares the first 2 cells of the row to the `exampleRow` in `TAB_DEFS`. If they match, the row is silently skipped in `applyHighlights`. This prevents false errors if the user forgot to delete the example.
15. **Two onEdit triggers coexist but only one is active.** `onEdit(e)` is the simple trigger but is now a **no-op** to prevent double execution. `onEditInstallable(e)` is the installable trigger (registered by `createTriggerIfNeeded_()`, full permissions) and is the **sole** handler that calls `_handleEdit(e)`.
16. **Teacher name cache in onEdit.** `_getCachedTeacherNames()` uses `CacheService.getScriptCache()` with a 60-second TTL to avoid reading the teacher sheet on every keystroke. Teacher tab edits are reflected within a minute.
17. **Validation hint notes on headers.** `_addValidationHints_()` adds `"ℹ️ ตรวจสอบอัตโนมัติ: ..."` notes to header cells of columns that have `CELL_VALIDATORS` entries. Non-overwriting — skips columns that already have notes.

---

## Data Validation Dropdown Values

```
student.ชั้น         → ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
preplace.apply_to   → ['All', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
room.ประเภท          → ['ห้องเรียนปกติ', 'ห้องเรียนพิเศษ', 'ห้องปฏิบัติการ', 'โรงยิม', 'สนาม']
```

Use `setAllowInvalid(true)` — dropdown appears but custom values are still allowed.

---

## Conditional Formatting Formulas

Applied during `generateSkeleton()`, range is column rows 2–1000. All use light red background `#FFCDD2`.

| Tab | Column | Formula (where `{COL}` = column letter) |
|-----|--------|----------------------------------------|
| teacher | teacher_id | `=AND(NOT(ISBLANK({COL}2)), NOT(REGEXMATCH({COL}2, "^[TE]\d{3,}$")))` |
| student | นักเรียน | `=AND(NOT(ISBLANK({COL}2)), NOT(REGEXMATCH({COL}2, "^\d+/\d+$")))` |
| student | ชั้น | `=AND(NOT(ISBLANK({COL}2)), NOT(REGEXMATCH({COL}2, "^ม\.[1-6]$")))` |
| student | ห้อง | `=AND(NOT(ISBLANK({COL}2)), NOT(REGEXMATCH({COL}2, "^\d+$")))` |
| period | เวลา | `=AND(NOT(ISBLANK({COL}2)), NOT(REGEXMATCH({COL}2, "^\d{2}\.\d{2}-\d{2}\.\d{2}$")), NOT(REGEXMATCH({COL}2, "^\d+$")))` |
| curriculum | คาบ/สัปดาห์ | `=AND(NOT(ISBLANK({COL}2)), NOT(REGEXMATCH({COL}2, "^\d+(\.\d+)?$")))` |
| preplace | คาบ | `=AND(NOT(ISBLANK({COL}2)), NOT(REGEXMATCH({COL}2, "^(Everyday_\d+\|(MON\|TUE\|WED\|THU\|FRI)_\d+)(,...)*$")))` |

---

## onEdit Cell Validators

Only cheap single-cell checks. Maps `(tabName, headerName) → { check: function, errorMsg: string }`.

| Tab | Header | Check Function | Error Message |
|-----|--------|---------------|---------------|
| teacher | teacher_id | `isValidTeacherId(v)` | `"ต้องเป็น T### หรือ E### (อย่างน้อย 3 หลัก)"` |
| teacher | ชื่อ | `v.length > 0` | `"ต้องระบุชื่อครู"` |
| student | นักเรียน | `isValidClassId(v)` | `"ต้องเป็นรูปแบบ G/S เช่น 1/1"` |
| student | ชั้น | `/^ม\.[1-6]$/.test(v)` | `"ต้องเป็น ม.1–ม.6"` |
| student | ห้อง | `/^\d+$/.test(v) && parseInt(v) > 0` | `"ต้องเป็นจำนวนเต็มบวก"` |
| period | คาบ | `v.length > 0` | `"ต้องระบุชื่อคาบ"` |
| period | เวลา | `isValidTimeFormat(v)` | `"ต้องเป็น HH.MM-HH.MM หรือตัวเลข"` |
| preplace | ชื่อ | `v.length > 0` | `"ต้องระบุชื่อ slot"` |
| preplace | คาบ | `getInvalidPreplaceSlotTokens(v).length === 0` | `"รูปแบบ slot ไม่ถูกต้อง"` |
| preplace | apply_to | `isValidApplyTo(v)` | `"ต้องเป็น All, ม.X หรือรายการคั่นด้วยจุลภาค"` |
| curriculum | คาบ/สัปดาห์ | `/^\d+(\.\d+)?$/.test(v) && parseFloat(v) > 0` | `"ต้องเป็นจำนวนบวก"` |
| room | ห้องทั้งหมด | `v.length > 0` | `"ต้องระบุรหัสห้อง"` |
| elective | รหัสวิชา | `v.length > 0` | `"ต้องระบุรหัสวิชา"` |
| elective | ชื่อวิชา (เสรี) | `v.length > 0` | `"ต้องระบุชื่อวิชา"` |

**onEdit must:**
- Return immediately if editing row 1 (header)
- Return immediately if editing row 2 AND the row still matches the example data (checked via `isExampleRow_`). If the user has overwritten the example with real data, proceed with validation.
- Return immediately if sheet is not a known data tab
- Return immediately if column has no validator
- Return immediately if cell is blank (clear any previous error styling)
- When falling through without a specific validator, only clear error/warning backgrounds (red/yellow) — do NOT clear green markers from `applyHighlights`.
- Wrap everything in try-catch — never throw from onEdit
- NEVER call `runValidation()` or any cross-tab lookup
- Teacher name lookup uses `_getCachedTeacherNames()` with `CacheService` (60s TTL) to avoid reading the teacher sheet on every keystroke.
- Only the **installable** `onEditInstallable` trigger calls `_handleEdit`. The **simple** `onEdit` is a no-op to prevent double execution.

---

## Example Row Specification

Inserted in row 2 during `generateSkeleton()`. Formatting:
- Font style: **italic**
- Font color: `#9E9E9E` (gray)
- Background: `#FFF9C4` (light yellow)
- Note on cell A2: `"⬆ ตัวอย่าง — ลบแถวนี้ก่อนกรอกข้อมูลจริง"`

**Auto-skip during validation:** If row 2 matches the example row exactly (after `sanitize()`), skip it. Compare first 2 cells to avoid false positives.

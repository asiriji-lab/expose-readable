# ScheDool — Validator Pipeline (Conceptual)

This document defines the validation pipeline for raw CSV input.
Validation happens in two phases: **Structural** (single-file format checks) and **Referential** (cross-file integrity checks).

---

## Phase 1: Structural Validation (Per Upload, Immediate)

Runs as soon as each file is uploaded. No cross-file context needed.

| Step | File | What to Check |
| :--- | :--- | :--- |
| P1.1 | `period.csv` | Required columns present (`คาบ`, `เวลา`). Each row: `คาบ` is non-empty, `เวลา` is either `HH.MM-HH.MM` format or a plain number (duration). |
| P1.2 | `room.csv` | `ห้องทั้งหมด` (Room ID) is non-empty for every row. No duplicate Room IDs. |
| P1.3 | `teacher.csv` | `teacher_id` is non-empty and matches format `T###` or `E###`. `ชื่อ` (first name) is non-empty. Skip marker rows (`ครูในโรงเรียน`, `อาจารย์นอก`). No duplicate `teacher_id`. Slot columns use valid `DAY_N` or `DAY_N-DAY_M` format when present. |
| P1.4 | `student.csv` | `นักเรียน` matches `G/S` format (e.g. `1/1`). `ชั้น` matches `ม.[1-6]`. `ห้อง` is a positive integer. |
| P1.5 | `preplace.csv` | `ชื่อ` is non-empty. `คาบ` matches valid slot format (`DAY_N`, `DAY_N-DAY_M`, or `Everyday_N`). `apply_to` is either `All`, a grade (`ม.1`), or a comma list of grades. |
| P1.6 | `scout.csv` | Non-empty cells only (sparse matrix is OK — blank cells are valid). |
| P1.7 | `elective.csv` | `รหัสวิชา` follows subject code format where present. Section header rows (e.g. `เสรีม.ต้น`) are structural — skip them. |
| P1.8 | `curriculum.csv` | Grade header rows (`ม.1`, `ม.2` etc.) are structural — skip them. `คาบ/สัปดาห์` column must be numeric for all data rows. |

> No cross-file lookups happen here. If a file passes Phase 1, it stores its parsed data in state for Phase 2.

---

## Phase 2: Referential Validation (Global, Before Generation)

Runs once all required files are uploaded (triggered at Step 10 or on demand). Builds lookup tables from root files, then validates relational files against them.

### Step 1 — Build Lookup Tables

From the structurally-valid files:

```
period_labels    = Set of all values in `คาบ` column
room_ids         = Set of all values in `ห้องทั้งหมด`
room_notes       = Set of all values in `หมายเหตุ` (non-empty)
room_types       = Set of all values in `ประเภท` (non-empty)
room_lookup      = room_ids ∪ room_notes ∪ room_types   ← "any valid room reference"
teacher_names    = Set of all `ชื่อ` values (after filtering marker rows)
teacher_id_map   = Map<teacher_id → teacher_name>
student_classes  = Map<grade → Set<section numbers>>    ← e.g. {"ม.1" → {1,2,3,4}}
preplace_slots   = Set of all `ชื่อ` values in preplace
```

### Step 2 — Validate `student.csv`

| Check | Error if... |
| :--- | :--- |
| `ห้องประจำ` → `room_lookup` | Home room value not in any room_ids / notes / types |

### Step 3 — Validate `scout.csv`

| Check | Error if... |
| :--- | :--- |
| Every cell value → `teacher_names` | Name not found. Show "Did you mean: X?" suggestion. |

### Step 4 — Validate `elective.csv`

| Check | Error if... |
| :--- | :--- |
| `ครูผู้สอน` → `teacher_names` | Teacher name not found |
| `ห้องเรียน` → `room_lookup` | Room value not found via 3-way lookup (ID, note, type) |
| Column headers (slots) → `preplace_slots` | Slot name column does not match any preplace entry |

### Step 5 — Validate `curriculum.csv` (heaviest)

Validate each data row (after grade-header parsing):

| Column | Check | Error if... |
| :--- | :--- | :--- |
| `ครู` | Split on `, ` → each token → `teacher_names` | Any token not found → flag that specific token |
| `ห้อง (นักเรียน) ที่สอน` | Parse `/X` notation, validate each section against `student_classes[current_grade]` | Section not defined for that grade |
| `ห้องเรียน` | 3-way room lookup | Room not found in IDs, notes, or types |

---

## Multi-Value Parsing Rules

| Column | Delimiter | Example | Parse Into |
| :--- | :--- | :--- | :--- |
| `ครู` (curriculum) | `, ` | `ภฤศรินทร์, Coulter` | `["ภฤศรินทร์", "Coulter"]` |
| `ห้อง (นักเรียน)` (curriculum) | `, ` with range support | `/1, /3-5` | `[1, 3, 4, 5]` |
| `ห้องเรียน` (curriculum) | ` / ` | `COM1 / COM2` | `["COM1", "COM2"]` |
| `available_slots` (teacher) | `, ` | `MON_2-MON_10, TUE_2-TUE_6` | `["MON_2-MON_10", "TUE_2-TUE_6"]` |

---

## Error Output Format

Each error must include:
1. **Row number** (1-indexed, user-facing)
2. **Column name** (Thai header, not column index)
3. **The bad value** (the specific token, not the whole cell)
4. **Suggestion** (fuzzy match from the relevant lookup set, if applicable)

### Example Errors

```
❌ curriculum.csv, Row 11, "ครู": "Coultr" not found.
   💡 Did you mean: Coulter (T010)?

❌ curriculum.csv, Row 4, "ห้อง (นักเรียน) ที่สอน": Section "/5" is not defined for ม.1.
   (ม.1 has sections: 1, 2, 3, 4)

❌ elective.csv, Row 8, "ห้องเรียน": "LAB3" is not a known room.
   💡 Known rooms: [D201, D202, D203, D204, ...] or tags like [COM, ยิม, OUT]
```

---

## Validation Trigger Map

When does each phase of validation fire?

### Trigger 1 — File Upload (Per Step)
**When**: User drops or selects a file in any Step component.
**What runs**: Phase 1 (Structural) for that file only.
**Outcome**:
- ✅ Pass → Green "file accepted" badge. File stored in state.
- ❌ Fail → Red error list below the dropzone. File still stored (user may edit it).

### Trigger 2 — CsvEditor Real-Time (Cell Edit)
**When**: User edits a cell inside the `CsvEditor` inline spreadsheet (`onOp` event).
**What runs**: Phase 1 (Structural) for that specific cell only.
**Outcome**:
- ❌ Fail → Cell turns red with tooltip error. Non-blocking.

### Trigger 3 — CsvEditor Save
**When**: User clicks "Save Changes" in `CsvEditor`.
**What runs**: Full Phase 1 re-validation on the entire saved file.
**Outcome**:
- ✅ Pass → File updated in state, editor closes.
- ❌ Fail → Error list shown. **Warn but allow save** — user may fix cross-dependencies later.

### Trigger 4 — "Mark as Done" Button
**When**: User clicks "Mark as Done" on any step.
**What runs**: Gate check — Phase 1 errors for that file must be zero.
**Outcome**:
- ✅ No Phase 1 errors → Step marked as complete.
- ❌ Phase 1 errors exist → Toast: "Fix validation errors before marking as done." **Blocks action.**

### Trigger 5 — Generate Button (Step 10)
**When**: User clicks "Generate Schedule".
**What runs**:
1. Check all required steps are marked done.
2. Run Phase 2 (Referential) across all uploaded files.

**Outcome**:
- ✅ Pass → Proceed to API call.
- ❌ Fail → Show summary of all cross-file referential errors. **Generation blocked.**

---

## Trigger Summary Table

| User Action | Phase 1 | Phase 2 | Blocks? |
| :--- | :---: | :---: | :---: |
| File upload | ✅ (that file) | ❌ | No |
| Edit cell in CsvEditor | ✅ (that cell) | ❌ | No |
| Save in CsvEditor | ✅ (full file) | ❌ | Warn only |
| Click "Mark as Done" | ✅ (check existing state) | ❌ | **Yes** — if P1 errors |
| Click "Generate" | ✅ (check existing state) | ✅ (all files) | **Yes** — if any errors |

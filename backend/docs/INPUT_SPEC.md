# Schedool Input File Specification (v2)

> This document defines all 7 input CSV sheets sent to the GA scheduling backend.
> All files are UTF-8 CSV. Column headers are in English (the frontend translates Thai Google Sheet headers before sending).

---

## Validation Architecture

Validation runs in three layers. The first two are the source of truth — the server is a safety net only.

| Layer | Responsibility |
|---|---|
| **Google Sheet template** | Named ranges + data validation dropdowns for single-value cross-sheet references. Apps Script runs automatic validation on the copied sheet (on edit and on-demand). |
| **Frontend** | Mirrors all GSheet validation rules exactly before submission. User sees the same errors in-app as in the sheet. |
| **Server** | Re-validates as a last resort. Returns structured errors using the same rule set. Never the primary error surface. |

**Cross-sheet reference fields and their dropdown type:**

| Sheet | Column | Source | Dropdown type |
|---|---|---|---|
| Teacher | `homeroom_class` | Student → `class_id` | Single — native GSheets dropdown |
| Student | `homeroom_room` | Room → `room_id` | Single — native GSheets dropdown |
| Elective | `teacher` | Teacher → `teacher_name` | Single — native GSheets dropdown |
| Elective | `room` | Room → `room_id` | Single — native GSheets dropdown |
| Elective | `elective_slot` | Preplace → `name` | **Multi-value** — Apps Script custom UI + frontend/server validation |
| Curriculum | `teacher` | Teacher → `teacher_name` | **Multi-value** — Apps Script custom UI + frontend/server validation |
| Curriculum | `room` | Room → `room_id` / tags | Single — native GSheets dropdown |
| Preplace | `students` / `teachers` | Structured syntax | Free text with frontend/server validation |

---

## Table of Contents

1. [period](#1-period)
2. [teacher](#2-teacher)
3. [student](#3-student)
4. [room](#4-room)
5. [curriculum](#5-curriculum)
6. [elective](#6-elective)
7. [preplace](#7-preplace)

---

## 1. `period`

Defines the time slots in a school day. The scheduler uses this to label timetable columns.

| Column | Type | Required | Description |
|---|---|---|---|
| `period_label` | string | ✅ | Display name of the period (e.g. `1`, `2`, `Morning Break`) |
| `period_time` | string | ✅ | Time range string (e.g. `08.05-08.55`). Use a duration in minutes for break rows (e.g. `10`). |

**Notes:**
- Rows with a duration (no `-` separator) are treated as non-schedulable breaks.
- Row order defines the column order in the timetable.

**Example:**
```
period_label,period_time
1,07.55-08.05
2,08.05-08.55
Morning Break,10
3,09.00-09.50
```

---

## 2. `teacher`

Defines all teachers. In-school and external teachers are in the same sheet distinguished by the `type` column.

| Column | Type | Required | Description |
|---|---|---|---|
| `teacher_id` | string | ✅ | Unique identifier. Format: `T` + digits for in-school (e.g. `T001`), `E` + digits for external (e.g. `E001`). The prefix determines availability handling — no separate type column needed. |
| `prefix` | string | | Title/prefix (e.g. `ครู`, `อ.`, `รศ.ดร.`) — display only |
| `teacher_name` | string | ✅ | Full name used to reference this teacher in other sheets |
| `department` | string | ✅ | Department/subject group (e.g. `คณิตศาสตร์`, `ฟิสิกส์`). Used by preplace `teachers` targeting. |
| `available_slots` | string | | **`E`-prefixed teachers only.** Whitelist of slots when this teacher is available. Empty means always available. Format: `MON_2-10, WED_5-6` (see Timeslot format). `T`-prefixed teachers leave this empty. |
| `homeroom_class` | string | | **`T`-prefixed teachers only.** The student class this teacher is homeroom teacher for (e.g. `1/1`). One teacher can be homeroom for at most 1 class. Leave empty if not a homeroom teacher. |
| `note` | string | | Free-text note — display only, not used by scheduler |

**Notes:**
- Teacher type is derived from `teacher_id` prefix: `T` = in-school, `E` = external.
- Teacher unavailability is defined in the **Preplace sheet** `teachers` column, not here.
- Multiple teachers can share the same `homeroom_class` (a class can have several homeroom teachers).

**Example:**
```
teacher_id,prefix,teacher_name,department,available_slots,homeroom_class,note
T001,ครู,รัตติยาวัลย์,การงานอาชีพ,,,
T005,ครู,ภฤศรินทร์,คณิตศาสตร์,,3/2,
E001,T.,Falah,อาจารย์นอก,"MON_2-10, TUE_2-10",,
E002,อ.,อรชุน,อาจารย์นอก,"MON_2-5, WED_5-6",,
```

---

## 3. `student`

Defines all student classes.

| Column | Type | Required | Description |
|---|---|---|---|
| `class_id` | string | ✅ | Unique class identifier. Format: `{grade}/{section}` where both are positive integers (e.g. `1/1`, `4/5`). Grade and section are derived from this — no separate columns needed. |
| `homeroom_room` | string | | Room ID of this class's homeroom room (e.g. `C103`). Nullable — leave empty if the class has no fixed homeroom room. Must match an existing `room_id` in the Room sheet (hard error if not found). Each room can only be assigned to one class (validation error if duplicated). |

**Notes:**
- `grade` and `section` columns removed — both are derived by parsing `class_id` (e.g. `4/5` → grade 4, section 5).
- `curriculum` column removed — was unused by the scheduler.
- Homeroom room ownership lives here, not in the Room sheet. The Room sheet keeps the `homeroom` tag on room rows as an indicator for backend preprocessing.

**Example:**
```
class_id,homeroom_room
1/1,C103
1/2,C104
4/4,
```

---

## 4. `room`

Defines all rooms and their scheduling constraints.

| Column | Type | Required | Description |
|---|---|---|---|
| `room_id` | string | ✅ | Unique room identifier (e.g. `B101-102`, `COM1`) |
| `room_name` | string | | Display name (e.g. `ยิม`, `ดนตรีสากล`). Falls back to `room_id` if empty. |
| `tags` | string | | Comma-separated capability tags used to match rooms to subjects (e.g. `เคมี`, `COM`, `homeroom`, `exclude`). |

**Tag meanings:**

`tags` is a comma-separated list. There are two reserved keywords and free-form capability tags:

| Tag | Type | Meaning |
|---|---|---|
| `homeroom` | Reserved | Marks this room as a homeroom room. Must be referenced by exactly one class in the Student sheet `homeroom_room` column — error if unreferenced. |
| `exclude` | Reserved | Room is never auto-assigned by the scheduler. Only reachable via an explicit `room` reference in the Curriculum sheet or a Preplace slot. Intended for schools where students move between rooms (no fixed homeroom seat) — special-purpose venues like gyms, workshops, or off-site locations. |
| `เคมี`, `COM`, `ฟิสิกส์`, etc. | Capability | The room can be used for any subject whose `room` field matches one of these tags (**union** — a match on any tag qualifies). A room with multiple capability tags is eligible for all matching subjects. |

**Capability tag validation (bidirectional against Curriculum sheet):**

| Direction | Rule | Severity |
|---|---|---|
| Room → Curriculum | A capability tag on a room that is not referenced by any `curriculum.room` value — tag is unused | Warning |
| Curriculum → Room | A `curriculum.room` value that is not a `room_id` and not a capability tag on any room — nothing can satisfy this subject's room requirement | Hard error |

Reserved tags (`homeroom`, `exclude`) are exempt from this cross-check.

**Notes:**
- `class_id` column removed — homeroom class assignment moved to Student sheet `homeroom_room`.
- The `homeroom` tag is retained so the backend can identify homeroom rooms during preprocessing.

**Example:**
```
room_id,room_name,tags
C103,,homeroom
B101-102,,"เคมี"
D203,COM1,COM
D316,ยิม,exclude
```

---

## 5. `curriculum`

The main scheduling input. Each row represents one teaching assignment or one **batch** of simultaneous sub-groups. Complex subjects use multiple rows sharing the same `subject_id`.

> **`room_count` and `total_periods`** are not CSV columns. They are locked calculated cells in the Google Sheet template only (`total_periods = periods_per_week × room_count`). The scheduler derives these values itself.

| Column | Type | Required | Description |
|---|---|---|---|
| `subject_id` | string | | Subject code (e.g. `ท21102`). Empty for activities (EFF, กิจกรรมแนะแนว) or continuation rows. |
| `subject_name` | string | ✅ | Display name. Required on anchor rows; inherited by continuation rows. |
| `periods_per_week` | integer | ✅ | Periods per week for this row. Read independently per row — not inherited by continuation rows. |
| `teacher` | string | ✅ | Teacher name(s). See teaching type syntax below. |
| `block_pattern` | string | | How periods split across the week (e.g. `1-2`, `2-1`, `2-2`). Empty = no split constraint. |
| `student_class` | string | | Student classes for this row. See teaching type syntax below. |
| `constraint` | string | | Teaching type flag and/or scheduling constraint. Inherited by continuation rows. See values below. |
| `room` | string | | Room ID or capability tag. See teaching type syntax below. Inherited by continuation rows if empty. |
| `fixed_period` | string | | Pre-fixed time slot (e.g. `MON_9-10`). Inherited by continuation rows if empty. |

---

### Teaching types

Declared via the `constraint` column. Empty = standard.

| Type | `constraint` | Teachers | Students | Rooms |
|---|---|---|---|---|
| Standard | *(empty)* | 1 | 1 class | 1 |
| Team | `type=TEAM` | n, comma-separated | 1 class | 1 |
| Multi-class team | `type=MULTI_CLASS_TEAM` | n, comma-separated | n classes, comma-separated | 1 |
| Sub-group | `type=SUB_GROUP` | pipe-separated (1–n per sub-group) | pipe-separated per sub-group | pipe-separated |
| Teacher split | `type=TEACHER_SPLIT` | n, comma-separated | 1+ classes (continuation rows) | 1 per sub-lesson |

---

### `|` pipe syntax — SUB_GROUP only

One row = one **batch**: all pipe-separated sub-groups run simultaneously at the same time slot. Multiple rows with the same `subject_id` = multiple batches at different time slots.

- `teacher`: `"Ta | Tb, Tc | Td"` — sub-group 1 = Ta alone, sub-group 2 = Tb+Tc as a team, sub-group 3 = Td alone
- `room`: `"Ra | Rb | Rc"` — positionally matched to teacher segments
- `student_class`: `"/1 | /2 | /3"` — which sections attend each sub-group in this batch

**Pipe count must match across `teacher`, `room`, and `student_class`** (hard error if not).

**`constraint` on continuation rows:**

| Value | Behaviour |
|---|---|
| Empty | Inherited from anchor ✅ |
| Same as anchor | Redundant — warning |
| Different from anchor | Conflicting types in same group — hard error |

---

### `type=TEACHER_SPLIT` syntax

Splits a subject into N independent sub-lessons per class — one sub-lesson per teacher, sized by `block_pattern` position.

```
subject_id,subject_name,periods_per_week,teacher,block_pattern,student_class,constraint
ค21201,คณิตศาสตร์เพิ่มเติม1,3,"T005, E010",2-1,,type=TEACHER_SPLIT
```

- `block_pattern` position 0 → teacher[0]: T005 gets a 2-period block
- `block_pattern` position 1 → teacher[1]: E010 gets a 1-period block
- Each sub-lesson is scheduled independently by the GA
- Applied per class — continuation rows (different `student_class`) inherit the split
- **Rule:** number of comma-separated teachers must equal number of `-`-separated blocks in `block_pattern`

---

### `type=SEPARATE_SLOT` — scheduling constraint

Marks a multi-row group so the GA schedules each class at a **different** time slot (no overlap). Combinable with `type=` teaching flags using comma separation.

```
subject_id,subject_name,periods_per_week,teacher,block_pattern,student_class,constraint
ว22202,โครงงานและนวัตกรรม2,2,ปาริชาติ,2,/1,type=SEPARATE_SLOT
,,2,เมธา,2,/2,
,,2,วีรภัทร,2,/3,
,,2,ศรารัตน์,2,/4,
```

Write it only on the anchor row; continuation rows inherit it.

> **Backend note:** The backend currently spells this `SEPARATE_SLOT` (typo). A one-line fix is required in `data_loader.py` `_parse_constraint_type()` before this spec takes effect.

---

### Cross-row logic

The curriculum sheet maps directly to how teachers fill in the Google Sheet template, where subject rows use merged cells spanning multiple class rows. In the CSV export, those merged cells become one **anchor row** followed by **continuation rows** — the anchor row corresponds to the merged (top) cell in the original sheet.

---

#### Row types

| Row type | Detection | Effect |
|---|---|---|
| **Grade marker** | First column matches `ม.\d+` (e.g. `ม.1`) | Skipped. Sets the current-grade context used to default `student_class`. |
| **Anchor** | `subject_id` is present | Starts a new subject group. Provides values inherited by continuation rows below. |
| **Continuation** | Both `subject_id` AND `subject_name` are empty | Extends the nearest anchor above. Inherits selected columns (see propagation table). |
| **Activity** | `subject_id` empty, `subject_name` present | Treated as its own anchor. Uses `subject_name` as the internal subject identifier (e.g. `กิจกรรมแนะแนว`, `EFF1`). |

> **The anchor row acts as a merged cell.** In practice, teachers fill a Google Sheet where the subject code and name span multiple rows via cell merging. The anchor row is that merged cell — it sets the subject identity and default values for every continuation row below it until the next anchor.

---

#### Column propagation

Continuation rows inherit from the nearest anchor when their own value is empty:

| Column | Read per row? | Propagates to continuation? |
|---|---|---|
| `subject_id` | — | ✅ always (defines group membership) |
| `subject_name` | — | ✅ always |
| `constraint` | ❌ | ✅ when continuation value is empty |
| `room` | ❌ | ✅ when continuation value is empty |
| `fixed_period` | ❌ | ✅ when continuation value is empty |
| `periods_per_week` | ✅ every row | ❌ |
| `teacher` | ✅ every row | ❌ |
| `student_class` | ✅ every row | ❌ — but empty value defaults to all sections of the current grade |
| `block_pattern` | ✅ every row | ❌ — empty value auto-set to `periods_per_week` as a single block |

---

#### `subject_id` uniqueness

`subject_id` must be unique within each grade section (i.e. within the rows between two consecutive grade markers). A `subject_id` appearing more than once as an anchor row within the same grade is a **hard error**.

All multi-row subjects must be written as one anchor row followed by continuation rows. This directly mirrors the merged-cell pattern in the Google Sheet template.

---

#### `student_class` grade defaulting

When `student_class` is empty on any row (anchor or continuation), the system fills it with **all sections of the current grade** — derived from the most recent grade marker above and the Student sheet. This is intentional system behaviour matching how teachers leave the column blank when a subject applies to all sections.

---

### Examples

**Standard:**
```
subject_id,subject_name,periods_per_week,teacher,block_pattern,student_class,constraint,room,fixed_period
ท21102,ภาษาไทย2,3,จิรัสชยาณ์,1-2,,,,
```

**Different teachers per section group (continuation):**
```
ว21103,วิทยาศาสตร์2,3,วิฑูรย์,2-1,"/1, /2",,,
,,3,รัชนิกร,2-1,"/3, /4",,,
```

**Team teaching:**
```
ว21202,นักวิทยาศาสตร์และนวัตกร,2,"มนรวัส, นงค์นุช",2,"/1, /2",type=TEAM,,
,,2,"มนรวัส, พิมพ์วิภา",2,"/3, /4",,,
```

**Sub-group, 5 sections simultaneously (1 batch):**
```
ว31283,สัมมนาทางวิทยาศาสตร์,2,"สมใจ|สุขุมาภรณ์|พิรพงศ์|นงค์นุช|พีรวัฒน์",2,"/1|/2|/3|/4|/5","type=SUB_GROUP","B101-102|B108-109|D203|B212|B213",MON_9-10
```

**Sub-group, 18 sections in 6 batches (continuation rows):**
```
ART001,ศิลปะ,1,"Ta|Tb|Tc",,"/1|/2|/3",type=SUB_GROUP,"Ra|Rb|Rc",
,,1,,,"/4|/5|/6",,,
,,1,,,"/7|/8|/9",,,
,,1,,,"/10|/11|/12",,,
,,1,,,"/13|/14|/15",,,
,,1,,,"/16|/17|/18",,,
```

**Multi-class team at two fixed slots:**
```
ว32283,การสื่อสารวิทยาศาสตร์,3,"มนรวัส, มงคล, ปาริชาติ",2-1,"/1, /2, /3",type=MULTI_CLASS_TEAM,A316,TUE_8-10
,,3,"มนรวัส, มงคล, ปาริชาติ",2-1,"/4, /5",,,THU_8-10
```

---

## 6. `elective`

Defines elective subjects. Each row locks a teacher and room at the specified elective slot(s). Student eligibility and slot timing are fully handled by the Preplace sheet — the elective sheet does not need to repeat them.

| Column | Type | Required | Description |
|---|---|---|---|
| `subject_id` | string | ✅ | Subject code |
| `subject_name` | string | ✅ | Display name |
| `teacher` | string | ✅ | Single teacher name. Must match a `teacher_name` in the Teacher sheet. A teacher cannot appear in two elective rows that share any slot (validation error). |
| `room` | string | ✅ | Specific room ID. Must match a `room_id` in the Room sheet. A room cannot be double-assigned across elective rows that share any slot (validation error). |
| `elective_slot` | string | ✅ | Comma-separated preplace `name` value(s) this subject is offered in (e.g. `เสรีม.ปลาย2, เสรีม.ปลาย5`). Each name must exactly match a row in the Preplace sheet. |

**Notes:**
- Student group eligibility is not defined here — it comes from the Preplace `students` column of the referenced slot.
- Section groupings (`เสรีม.ต้น`, `เสรีม.ปลาย`) from the old sheet are removed; grouping is now implicit via preplace slot references.
- `elective_slot` is a multi-value field. Single-value entries are also valid.

**Example:**
```
subject_id,subject_name,teacher,room,elective_slot
ค20202,คณิตศิลป์,คณิตา,C106,เสรีม.ต้น1
ว20221,การออกแบบเนื้อหาดิจิทัล,พิมพ์วิภา,COM1,เสรีม.ต้น2
ว30285,หุ่นยนต์และการควบคุม,นิรมล,COM2,"เสรีม.ปลาย2, เสรีม.ปลาย5"
ค30201,ตัวแบบเชิงคณิตศาสตร์เบื้องต้น,สหรัฐ,B217,เสรีม.ปลาย3
```

---

## 7. `preplace`

Defines pre-fixed time blocks. Applies to students, teachers, or both. Replaces the old scout sheet and teacher `unavailable_slots`.

| Column | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Unique label for this block (e.g. `Homeroom`, `Math dept. meeting`, `ลูกเสือม.1`). Referenced by Elective `elective_slot`. No commas allowed in the name. |
| `periods` | string | ✅ | Slot(s) this block occupies. See timeslot format below. |
| `students` | string | | Which student classes/grades are blocked. See targeting syntax below. |
| `teachers` | string | | Which teachers are blocked (and/or duty triggered). See targeting syntax below. |

---

### Timeslot format

Used by: `preplace.periods`, `teacher.available_slots`

| Pattern | Example | Meaning |
|---|---|---|
| `DAY_p` | `MON_6` | Single slot — day, period |
| `DAY_p-q` | `MON_6-8` | Range within one day (periods 6, 7, 8) |
| `DAILY_p` | `DAILY_1` | Period p on every day (MON–FRI) |
| `DAILY_p-q` | `DAILY_6-7` | Period range on every day |
| Comma-separated | `MON_6-8, WED_6-8` | Multiple blocks combined |

**Days:** `MON` `TUE` `WED` `THU` `FRI`

**Periods:** integer matching a schedulable row in the Period sheet (break rows excluded).

**Slot picker UI (Apps Script):** A sidebar dialog available from the sheet menu for any timeslot cell. Shows a grid of days (MON–FRI + DAILY column) × schedulable periods only (break rows hidden, derived from Period sheet). Click or drag to select. Outputs the compact text format into the cell. Works for `preplace.periods`, `teacher.available_slots`, and multi-select preplace names in `elective.elective_slot`.

```
┌─────────────────────────────────────────┐
│  Slot Picker                        [×] │
├──────┬─────┬─────┬─────┬─────┬─────┬───┤
│      │ Mon │ Tue │ Wed │ Thu │ Fri │ ∀ │
├──────┼─────┼─────┼─────┼─────┼─────┼───┤
│  1   │     │     │     │     │     │ ☐ │
│  2   │  ☑  │  ☑  │  ☑  │     │     │   │
│  3   │  ☑  │  ☑  │  ☑  │     │     │   │
│  4   │     │     │     │     │     │   │
│  …   │     │     │     │     │     │   │
│  10  │     │     │     │     │     │   │
├──────┴─────┴─────┴─────┴─────┴─────┴───┤
│ Output: MON_2-3, TUE_2-3, WED_2-3      │
│              [Clear]  [Insert into cell]│
└─────────────────────────────────────────┘
```

---

### `teachers` targeting syntax

| Value | Meaning |
|---|---|
| *(empty)* | No teachers blocked |
| `ALL` | All in-school teachers |
| `department:คณิตศาสตร์` | All teachers in that department (matches `department` column in Teacher sheet) |
| `homeroom_grade:1` | All in-school teachers whose `homeroom_class` is in grade 1 (i.e. `1/1`, `1/2`, `1/3`…) |
| `T001, T003` | Specific teacher IDs (escape hatch for individual assignments) |

Multiple values are union-combined (comma-separated): `department:คณิตศาสตร์, department:ฟิสิกส์`

The `teachers` column also accepts the special duty keyword `homeroom_teacher` mixed with selectors:

| Special value | Meaning |
|---|---|
| `homeroom_teacher` | For each class resolved from `students`, find all teachers where `homeroom_class` = that class → block them and place at the class's homeroom room. Can be combined with other selectors. |

Example: `homeroom_teacher, department:แนะแนว` → triggers homeroom duty AND blocks all guidance teachers.

**How `homeroom_teacher` works:**
1. Resolve each student class from `students`.
2. Find all teachers where `homeroom_class` = that class.
3. Block those teachers at `periods` and assign them to the class's homeroom room.
4. Applies to any preplace row — not limited to the `Homeroom` activity.

---

### `students` targeting syntax

| Value | Meaning |
|---|---|
| *(empty)* | No students blocked |
| `ALL` | All student classes |
| `student_grade:1` | All classes in grade 1 (1/1, 1/2, 1/3…) |
| `student_grade:1, student_grade:2` | Multiple grades |
| `1/1` | Specific class |
| `1/1, 2/3` | Multiple specific classes |
| Mix | `student_grade:1, 2/3, 2/4` — grades and specific classes combined |

---

### Preplace examples

```
name,periods,students,teachers
Homeroom,DAILY_1,ALL,homeroom_teacher
Lunch ม.ต้น,DAILY_6,"student_grade:1, student_grade:2, student_grade:3",
Lunch ม.ปลาย,DAILY_7,"student_grade:4, student_grade:5, student_grade:6",
ชุมนุม,WED_10,ALL,
Math dept. meeting,"MON_6-8, WED_6-8",,department:คณิตศาสตร์
Chem dept. meeting,WED_6-8,,department:เคมี
ลูกเสือม.1,MON_10,student_grade:1,"T001, T003, T007, T012"
ลูกเสือม.2,TUE_10,student_grade:2,"T002, T008, T015, T021"
ลูกเสือม.3,THU_10,student_grade:3,"T004, T009, T016"
เสรีม.ต้น1,FRI_2-3,"student_grade:1, student_grade:2, student_grade:3",
เสรีม.ต้น2,FRI_4-5,"student_grade:1, student_grade:2, student_grade:3",
คลินิกวิชาการ,FRI_8-10,"student_grade:4, student_grade:5",
เสรีม.ปลาย3,TUE_8-9,student_grade:6,
Falah unavailable,THU_6-8,,E001
```

> **Scout migration:** The old `scout.csv` (wide format) is replaced by explicit teacher ID lists in preplace `teachers` column. Scout teacher groups are selected individually and managed via the slot picker UI (see Timeslot Format section).

---

## Appendix: Sheet Summary

| Sheet | Required | Replaces / Changes |
|---|---|---|
| `period` | ✅ | No change |
| `teacher` | ✅ | Removed `unavailable_slots`; removed `type` (derived from `teacher_id` prefix); added `homeroom_class` |
| `student` | ✅ | Added `homeroom_room`; removed `curriculum` |
| `room` | ✅ | Removed `class_id` (moved to Student sheet) |
| `curriculum` | ✅ | Removed `room_count`, `total_periods` (GSheet calculated cells only); renamed `note` → `constraint`; added `\|` pipe syntax for `SUB_GROUP`; added `type=TEACHER_SPLIT` and `type=SEPARATE_SLOT`; removed Thai-text scheduling constraints |
| `elective` | optional | Slot columns replaced by single `elective_slot` referencing preplace names |
| `preplace` | optional | Replaces `scout.csv`; renamed `apply_to` → `students`; added `teachers` column (merged with duty keyword `homeroom_teacher`) |

**Removed sheets:** `scout` (absorbed into `preplace`)

---

## Validation Rules

Severity levels:
- **Hard error** — submission blocked until resolved
- **Warning** — submission allowed but user is notified

---

### `period`

| Field | Rule | Severity |
|---|---|---|
| `period_label` | Required, non-empty | Hard error |
| `period_label` | Unique within sheet | Hard error |
| `period_time` | Required, non-empty | Hard error |
| `period_time` | Schedulable row: must match `HH.MM-HH.MM` with start < end | Hard error |
| `period_time` | Break row: must be a plain positive integer (duration in minutes) | Hard error |
| Sheet | At least 1 schedulable period must exist | Hard error |

---

### `teacher`

| Field | Rule | Severity |
|---|---|---|
| `teacher_id` | Required, non-empty | Hard error |
| `teacher_id` | Must match `T\d+` (in-school) or `E\d+` (external) | Hard error |
| `teacher_id` | Unique within sheet | Hard error |
| `teacher_name` | Required, non-empty | Hard error |
| `teacher_name` | Unique within sheet (referenced by name from other sheets) | Hard error |
| `department` | Required, non-empty | Hard error |
| `available_slots` | `T`-prefixed teacher: must be empty | Warning |
| `available_slots` | `E`-prefixed teacher: must be valid timeslot format if present | Hard error |
| `available_slots` | Each period referenced must exist as a schedulable period in Period sheet | Hard error |
| `homeroom_class` | `E`-prefixed teacher: must be empty | Warning |
| `homeroom_class` | `T`-prefixed teacher: if present, must match a `class_id` in Student sheet | Hard error |
| `homeroom_class` | Single value only (no comma-separated list) | Hard error |

---

### `student`

| Field | Rule | Severity |
|---|---|---|
| `class_id` | Required, non-empty | Hard error |
| `class_id` | Must match format `{positive integer}/{positive integer}` | Hard error |
| `class_id` | Unique within sheet | Hard error |
| `homeroom_room` | If present: must match a `room_id` in Room sheet | Hard error |
| `homeroom_room` | If present: must be unique across all rows (no two classes share a homeroom room) | Hard error |
| Cross → Room | Every room with `homeroom` tag must be referenced by exactly one row here | Hard error |

---

### `room`

| Field | Rule | Severity |
|---|---|---|
| `room_id` | Required, non-empty | Hard error |
| `room_id` | Unique within sheet | Hard error |
| `tags` | No duplicate tags within a cell | Hard error |
| `tags` | `homeroom` and `exclude` cannot both appear on the same room | Hard error |
| `tags` | Room with `homeroom` tag must appear in exactly one `student.homeroom_room` | Hard error |
| `tags` | Capability tag not referenced by any `curriculum.room` value | Warning |

---

### `curriculum`

**Cell-level (each row independently):**

| Field | Rule | Severity |
|---|---|---|
| `subject_name` | Required on anchor rows; continuation rows inherit | Hard error |
| `periods_per_week` | Required, positive integer, every row including continuation | Hard error |
| `teacher` | Required on anchor rows | Hard error |
| `teacher` | Each name (comma or pipe segment) must match a `teacher_name` in Teacher sheet | Hard error |
| `block_pattern` | If present: integers separated by `-`, each part ≥ 1, sum must equal `periods_per_week` | Hard error |
| `constraint` | `type=X` — X must be one of: `TEAM`, `MULTI_CLASS_TEAM`, `SUB_GROUP`, `TEACHER_SPLIT`, `SEPARATE_SLOT` | Hard error |
| `constraint` | At most one `type=` per cell | Hard error |
| `constraint` | `type=TEAM` requires multiple comma-separated names in `teacher` | Hard error |
| `constraint` | `type=SUB_GROUP` requires `teacher`, `room`, `student_class` to all use `\|` with matching segment counts | Hard error |
| `constraint` | `type=TEACHER_SPLIT` requires comma-separated teacher count to equal the number of blocks in `block_pattern` | Hard error |
| `constraint` | Continuation row with same `type=X` as anchor | Warning (redundant) |
| `constraint` | Continuation row with different `type=X` than anchor | Hard error |
| `room` | If present: must match a `room_id` or a capability tag on at least one room in Room sheet | Hard error |
| `fixed_period` | If present: valid timeslot format, periods must exist in Period sheet | Hard error |
| SUB_GROUP pipe | `|` count must match across `teacher`, `room`, and `student_class` in the same row | Hard error |

**Cross-row (group level — rows sharing same `subject_id`):**

| Rule | Severity |
|---|---|
| `subject_id` must be unique within each grade section (between consecutive grade markers) | Hard error |
| All rows in a group must have the same `periods_per_week` | Hard error |
| `type=` flag should appear on at most one row per group (typically anchor) | Warning |
| `type=SUB_GROUP`: same section must not appear more than once across all batch rows of the same group | Hard error |
| `type=MULTI_CLASS_TEAM`: all rows in group must share the same teacher list | Hard error |
| Continuation row at top of sheet with no preceding anchor | Hard error |

---

### `elective`

| Field | Rule | Severity |
|---|---|---|
| `subject_id` | Required, non-empty | Hard error |
| `subject_id` | Unique within sheet | Hard error |
| `subject_name` | Required, non-empty | Hard error |
| `teacher` | Required, must match a `teacher_name` in Teacher sheet | Hard error |
| `teacher` | Same teacher cannot appear in two rows that share any `elective_slot` value | Hard error |
| `room` | Required, must match a `room_id` in Room sheet | Hard error |
| `room` | Same room cannot appear in two rows that share any `elective_slot` value | Hard error |
| `elective_slot` | Required, non-empty | Hard error |
| `elective_slot` | Each comma-separated value must exactly match a `name` in Preplace sheet | Hard error |

---

### `preplace`

| Field | Rule | Severity |
|---|---|---|
| `name` | Required, non-empty | Hard error |
| `name` | Unique within sheet | Hard error |
| `name` | No commas allowed | Hard error |
| `periods` | Required, valid timeslot format | Hard error |
| `periods` | Each period referenced must exist as a schedulable period in Period sheet | Hard error |
| `students` | Each token must be `ALL`, `student_grade:{integer}`, or a `class_id` in Student sheet | Hard error |
| `students` | `student_grade:X` — grade X must exist among classes in Student sheet | Hard error |
| `teachers` | Each token must be a valid keyword or reference (see below) | Hard error |
| `teachers` | `department:X` — X must match a `department` value in Teacher sheet | Hard error |
| `teachers` | `homeroom_grade:X` — X must be a grade with at least one teacher having `homeroom_class` in that grade | Warning |
| `teachers` | Teacher ID token must match a `teacher_id` in Teacher sheet | Hard error |
| `teachers` | `homeroom_teacher` keyword requires `students` to be non-empty | Hard error |
| Cross-row | Two rows that resolve to blocking the same teacher at the same period | Warning |

---

### Cross-sheet reference summary

| Rule | Severity |
|---|---|
| `teacher.homeroom_class` not found in Student `class_id` | Hard error |
| `student.homeroom_room` not found in Room `room_id` | Hard error |
| Two students share the same `homeroom_room` | Hard error |
| Room tagged `homeroom` not referenced by any student | Hard error |
| `curriculum.teacher` name not found in Teacher `teacher_name` | Hard error |
| `curriculum.room` not matching any `room_id` or room capability tag | Hard error |
| Room capability tag not referenced by any `curriculum.room` | Warning |
| `elective.teacher` not found in Teacher `teacher_name` | Hard error |
| `elective.room` not found in Room `room_id` | Hard error |
| `elective.elective_slot` value not found in Preplace `name` | Hard error |
| Same teacher in two elective rows sharing any `elective_slot` | Hard error |
| Same room in two elective rows sharing any `elective_slot` | Hard error |
| `preplace.department:X` — X not found in Teacher `department` | Hard error |
| `preplace.homeroom_grade:X` — no teachers found for that grade | Warning |
| `preplace.teachers` ID token not found in Teacher `teacher_id` | Hard error |
| `homeroom_teacher` keyword with empty `students` | Hard error |
| Two preplace rows blocking same teacher at same period | Warning |
| `T`-prefixed teacher with non-empty `available_slots` | Warning |
| `E`-prefixed teacher with non-empty `homeroom_class` | Warning |

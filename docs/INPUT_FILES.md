# Input File Reference

Schedool accepts up to eight CSV files. Only `curriculum.csv` and `room.csv` are strictly required — the others are strongly recommended for correct results.

All files use **Thai column headers**. The system renames them to English automatically, so you do not need to change your files.

---

## Table of Contents

1. [curriculum.csv — Required](#1-curriculumcsv--required)
2. [room.csv — Required](#2-roomcsv--required)
3. [teacher.csv — Recommended](#3-teachercsv--recommended)
4. [period.csv — Recommended](#4-periodcsv--recommended)
5. [preplace.csv — Recommended](#5-preplacecsv--recommended)
6. [elective.csv — Recommended](#6-electivecsv--recommended)
7. [student.csv — Recommended](#7-studentcsv--recommended)
8. [scout.csv — Recommended](#8-scoutcsv--recommended)

---

## 1. `curriculum.csv` — Required

This is the most important file. It defines every lesson that the GA needs to schedule — one row per lesson.

| Thai Header | Internal Name | Description |
|---|---|---|
| `รหัสวิชา` | `subject_id` | Unique subject code, e.g. `PHY101` |
| `ชื่อวิชา` | `subject_name` | Subject display name |
| `คาบ/สัปดาห์` | `periods_per_week` | Total number of periods this lesson requires per week |
| `ครู` | `teacher` | Teacher ID(s). For co-taught lessons, separate multiple IDs with a delimiter |
| `การแบ่งคาบสอน` | `block_pattern` | How the periods should be grouped (see Block Patterns below) |
| `ห้อง (นักเรียน) ที่สอน` | `student_class` | Class group(s) being taught, e.g. `1/1` or `1/1,1/2` |
| `หมายเหตุ` | `constraint` | Special constraint type (see Constraint Types below). Leave blank for normal lessons. |
| `ห้องเรียน` | `room` | If the lesson must use a specific room, put the room ID here. Leave blank for any available room. |
| `คาบเรียน` | `fixed_period` | If the lesson must be scheduled at a specific period, put it here. Leave blank for flexible scheduling. |

### Block Patterns

The `block_pattern` column controls how a lesson's periods are grouped.

| Pattern | Total Periods | Meaning |
|---|---|---|
| `1` | 1 | One single period on one day |
| `2` | 2 | Two **consecutive** periods on the same day (a double) |
| `3` | 3 | Three consecutive periods on the same day |
| `2-1` | 3 | One double period (two consecutive) on one day, plus one single on a different day |
| `2-2` | 4 | Two doubles, each on different days |
| `1-1` | 2 | Two singles, each on different days |

If `block_pattern` is blank, the system treats the lesson as `periods_per_week` individual single periods.

### Constraint Types

The `constraint` column (`หมายเหตุ`) lets you describe special relationships between lessons.

| Value | Meaning |
|---|---|
| `TEAM` | Multiple teachers share the same lesson (co-teaching). List all teacher IDs in the `teacher` column. |
| `MULTI_CLASS_TEAM` | The lesson is taught to multiple classes at the same time. List all class IDs in `student_class`. |
| `SEPERATE_SLOT` | This lesson belongs to a group that must **not** share the same time slot (e.g. parallel sections of the same subject). |
| `SUB_GROUP` | This lesson belongs to a group that **must** share the same time slot (e.g. split classes that need to run simultaneously). |
| `TEACHER_SPLIT` | A teacher teaches multiple parallel sections; the system handles their slot allocation accordingly. |

---

## 2. `room.csv` — Required

Lists every classroom available for scheduling.

| Thai Header | Internal Name | Description |
|---|---|---|
| `ห้องทั้งหมด` | `room_id` | Unique room identifier, e.g. `A101`, `LAB2` |
| `หมายเหตุ` | `note` | Room display name or description |
| `ประเภท` | `tag` | Room type, e.g. `lab`, `gym`, `standard`. Used for room-matching constraints. |

---

## 3. `teacher.csv` — Recommended

Defines which teachers exist and when they are available. Without this file, the system cannot enforce teacher availability constraints.

| Thai Header | Internal Name | Description |
|---|---|---|
| `teacher_id` | `teacher_id` | Unique teacher identifier, must match IDs used in `curriculum.csv` |
| `ชื่อ` | `teacher_name` | Full display name |
| `available_slots` | `available_slots` | Slots the teacher **can** teach (leave blank to mean all slots are available) |
| `unavailable_slots` | `unavailable_slots` | Slots the teacher **cannot** teach |
| `หมายเหตุ` | `constraint` | Department name or other notes (used in the output JSON) |

---

## 4. `period.csv` — Recommended

Defines the period structure — how many periods there are in a day and what time each one starts and ends. Without this file, the system uses a default period structure.

| Thai Header | Internal Name | Description |
|---|---|---|
| `คาบ` | `period_label` | Period number or label, e.g. `1`, `2`, `3` |
| `เวลา` | `period_time` | Time range for this period, e.g. `08:05-08:55` |

Non-teaching periods (breaks, homeroom) should also be listed here with appropriate labels (e.g. `Homeroom`, `Lunch`) so the grids are built correctly.

---

## 5. `preplace.csv` — Recommended

Defines fixed slots that must be blocked before the GA runs — things like homeroom periods, morning/afternoon breaks, lunch, and assemblies. These slots are locked and the GA will never place lessons into them.

| Thai Header | Internal Name | Description |
|---|---|---|
| `ชื่อ` | `slot_name` | Label for this slot type, e.g. `Homeroom`, `Lunch`, `Morning Break` |
| `คาบ` | `periods` | Which period numbers this slot occupies |
| `apply_to` | `apply_to` | Which classes or teachers this slot applies to (leave blank to apply to everyone) |

---

## 6. `elective.csv` — Recommended

Elective courses (ชุมนุม/เสรี) that are pre-assigned before the GA runs. The GA does not schedule these — it just works around them.

| Thai Header | Internal Name | Description |
|---|---|---|
| `รหัสวิชา` | `subject_id` | Subject code |
| `ชื่อวิชา (เสรี)` | `subject_name` | Subject name |
| `ครูผู้สอน` | `teacher` | Teacher ID |
| `ห้องเรียน` | `room` | Room ID |
| *(dynamic slot columns)* | period labels | One column per available time slot. A value in the cell assigns that elective to that slot. |

---

## 7. `student.csv` — Recommended

Lists all student class groups. Without this, the system infers class groups from the curriculum, which may miss some details.

| Thai Header | Internal Name | Description |
|---|---|---|
| `นักเรียน` | `class_id` | Class identifier, e.g. `1/1`, `2/3` |
| `ชั้น` | `grade` | Grade level, e.g. `1`, `2`, `3` |
| `ห้อง` | `section` | Section number |
| `ห้องประจำ` | `default_room` | The class's homeroom — used for timetable initialisation |
| `หลักสูตร` | `curriculum` | Curriculum track (e.g. regular, gifted) |

---

## 8. `scout.csv` — Recommended

Scout sessions (ลูกเสือ) pre-assigned before the GA runs, similar to electives.

The format uses **dynamic columns** — one column per grade level, each cell containing a teacher ID. The system assigns scout periods to the appropriate classes and teachers before the GA starts.

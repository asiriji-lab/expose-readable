# Output Format

When a job completes, two types of output are produced:

1. **`schedule.json`** — the full structured timetable in JSON format, returned by `GET /result` and included in the download ZIP.
2. **CSV files** — one timetable grid per teacher, per student class, and per room, also in the download ZIP.

---

## Table of Contents

1. [schedule.json Structure](#1-schedulejson-structure)
2. [config](#2-config)
3. [teachers](#3-teachers)
4. [students](#4-students)
5. [rooms](#5-rooms)
6. [unfilled_slots](#6-unfilled_slots)
7. [CSV Files](#7-csv-files)

---

## 1. `schedule.json` Structure

The top-level keys are:

```json
{
  "config":         { ... },
  "teachers":       [ ... ],
  "students":       [ ... ],
  "rooms":          [ ... ],
  "unfilled_slots": [ ... ]
}
```

---

## 2. `config`

Metadata about the schedule and the column structure to use when rendering it.

```json
{
  "config": {
    "academic_year": "2026",
    "semester": 1,
    "columns": [
      { "key": "day",  "label": "Day",  "type": "text" },
      { "key": "1",    "label": "1",    "time": "08:05-08:55" },
      { "key": "2",    "label": "2",    "time": "08:55-09:45" },
      { "key": "3",    "label": "3",    "time": "09:45-10:35" }
    ]
  }
}
```

The `columns` array describes each column in the timetable grid in order — first the day column, then one entry per teaching period.

---

## 3. `teachers`

An array of teacher objects, one per teacher.

```json
{
  "teachers": [
    {
      "id":         "T001",
      "name":       "Ms. Somchai",
      "department": "Science",
      "rows": [
        {
          "day": "MON",
          "columns": [
            { "1": { "subject_id": "PHY101", "subject_name": "Physics", "class": "1/1", "room": "A101" } },
            { "2": { "subject_id": "PHY101", "subject_name": "Physics", "class": "1/1", "room": "A101" } },
            { "3": null },
            { "4": { "subject_id": "CHEM201", "subject_name": "Chemistry", "class": "2/2", "room": "LAB1" } }
          ]
        },
        {
          "day": "TUE",
          "columns": [ ... ]
        }
      ]
    }
  ]
}
```

### Teacher row cell

Each slot in a teacher's timetable is either `null` (free or blocked) or an object with:

| Field | Description |
|---|---|
| `subject_id` | Subject code |
| `subject_name` | Subject display name |
| `class` | The student class being taught at this slot |
| `room` | The room being used |

---

## 4. `students`

An array of class-group objects, one per student class.

```json
{
  "students": [
    {
      "id":          "1/1",
      "name":        "1/1",
      "class_group": "1/1",
      "rows": [
        {
          "day": "MON",
          "columns": [
            { "1": { "subject_id": "PHY101", "subject_name": "Physics", "teacher": "Ms. Somchai", "room": "A101" } },
            { "2": { "subject_id": "PHY101", "subject_name": "Physics", "teacher": "Ms. Somchai", "room": "A101" } },
            { "3": null }
          ]
        }
      ]
    }
  ]
}
```

### Student row cell

Each slot in a student timetable is either `null` or an object with:

| Field | Description |
|---|---|
| `subject_id` | Subject code |
| `subject_name` | Subject display name |
| `teacher` | Teacher name |
| `room` | Room being used |

---

## 5. `rooms`

An array of room objects, one per room.

```json
{
  "rooms": [
    {
      "id":   "A101",
      "name": "Classroom A101",
      "rows": [
        {
          "day": "MON",
          "columns": [
            { "1": { "subject_id": "PHY101", "subject_name": "Physics", "teacher": "Ms. Somchai", "class": "1/1" } },
            { "2": { "subject_id": "PHY101", "subject_name": "Physics", "teacher": "Ms. Somchai", "class": "1/1" } },
            { "3": null }
          ]
        }
      ]
    }
  ]
}
```

### Room row cell

Each slot in a room timetable is either `null` or an object with:

| Field | Description |
|---|---|
| `subject_id` | Subject code |
| `subject_name` | Subject display name |
| `teacher` | Teacher name |
| `class` | The student class using the room |

---

## 6. `unfilled_slots`

A list of lessons that the GA could not fully schedule. If this array is empty, the timetable is complete — every lesson got all its required periods.

```json
{
  "unfilled_slots": [
    {
      "lesson_id":        "PHY101_T001_1_1",
      "subject_id":       "PHY101",
      "subject_name":     "Physics",
      "teacher_ids":      ["T001"],
      "student_classes":  ["1/1"],
      "assigned_periods": 2,
      "expected_periods": 4,
      "missing_periods":  2
    }
  ]
}
```

| Field | Description |
|---|---|
| `lesson_id` | Internal lesson identifier |
| `subject_id` | Subject code |
| `subject_name` | Subject display name |
| `teacher_ids` | List of teacher IDs for this lesson |
| `student_classes` | List of class groups for this lesson |
| `assigned_periods` | How many periods were successfully scheduled |
| `expected_periods` | How many periods were required |
| `missing_periods` | The shortfall (`expected - assigned`) |

If there are unfilled slots, consider: relaxing teacher availability constraints, checking for over-constrained lessons, or increasing `max_generations`.

---

## 7. CSV Files

The download ZIP also contains individual CSV timetable grids. Each file is named after the entity it represents (e.g. `T001.csv`, `1_1.csv`, `A101.csv`).

The grid format is:

- **Rows** — one row per weekday (MON, TUE, WED, THU, FRI)
- **Columns** — one column per period, labelled with the period number and time

Each cell contains either:
- A formatted string describing what is happening at that slot, or
- A special keyword like `UNAVAILABLE`, `Homeroom`, `Lunch`, etc. for blocked slots
- Empty for a free slot

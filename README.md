# Schedool — Genetic Algorithm School Timetable API

Schedool is a REST API that uses an **Island Genetic Algorithm** to automatically complete a school timetable. Upload your raw scheduling CSVs in one request and the API handles everything — data cleaning, preschedule processing, GA optimisation, and export — in the background.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the Server](#running-the-server)
4. [Quick Start](#quick-start)
5. [Input File Reference](#input-file-reference)
6. [API Reference](#api-reference)
7. [Polling for Status](#polling-for-status)
8. [Response Format](#response-format)
9. [GA Parameter Tuning](#ga-parameter-tuning)
10. [Project Structure](#project-structure)
11. [Swagger UI](#swagger-ui)

---

## Prerequisites

- Python 3.11+
- pip

---

## Installation

```bash
git clone <repo-url>
cd schedool
pip install -r requirements.txt
```

---

## Running the Server

**Development:**
```bash
python app.py
```

**Production:**
```bash
gunicorn app:app -w 4 -b 0.0.0.0:5000
```

The API starts at `http://localhost:5000`.

---

## Quick Start

The entire workflow is a **single `POST` request**. Upload all your CSV files at once and get a `job_id` back immediately. The scheduling pipeline runs in the background.

```bash
curl -X POST http://localhost:5000/api/v1/schedule \
  -F "curriculum=@curriculum.csv" \
  -F "room=@room.csv" \
  -F "elective=@elective.csv" \
  -F "teacher=@teacher.csv" \
  -F "period=@period.csv" \
  -F "preplace=@preplace.csv" \
  -F "student=@student.csv" \
  -F "scout=@scout.csv" \
  -F "academic_year=2026" \
  -F "semester=1" \
  -F "job_name=My Timetable"
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_name": "My Timetable",
  "message": "Job queued and running. Poll the status endpoint for updates.",
  "status_url": "/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000",
  "download_url": "/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000/download"
}
```

Poll for progress:
```bash
curl http://localhost:5000/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000
```

Download results when `status` is `completed`:
```bash
curl -OJ http://localhost:5000/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000/download
```

---

## Input File Reference

All files use **Thai column headers** — the API cleans them automatically. Only `curriculum.csv` and `room.csv` are strictly required; the rest are strongly recommended.

### `curriculum.csv` — Required

Defines every lesson that needs to be scheduled.

| Thai Header | Internal name | Description |
|---|---|---|
| `รหัสวิชา` | `subject_id` | Unique subject code |
| `ชื่อวิชา` | `subject_name` | Subject name |
| `คาบ/สัปดาห์` | `periods_per_week` | Total periods per week |
| `ครู` | `teacher` | Teacher ID(s) |
| `การแบ่งคาบสอน` | `block_pattern` | Block layout (see below) |
| `ห้อง (นักเรียน) ที่สอน` | `student_class` | Class(es) being taught |
| `หมายเหตุ` | `constraint` | Constraint type (optional) |
| `ห้องเรียน` | `room` | Required room ID (optional) |
| `คาบเรียน` | `fixed_period` | Fixed time slot (optional) |

**Block patterns:**

| Pattern | Meaning |
|---|---|
| `1` | One single period |
| `2` | Two consecutive periods |
| `2-1` | Two consecutive + one separate |
| `2-2` | Two doubles on different days |

**Constraint types (`หมายเหตุ` column):**

| Value | Meaning |
|---|---|
| `TEAM` | Multiple teachers share the same lesson |
| `MULTI_CLASS_TEAM` | Lesson covers multiple classes at once |
| `SEPERATE_SLOT` | Grouped lessons must NOT share the same timeslot |
| `SUB_GROUP` | Grouped lessons MUST share the same timeslot |
| `TEACHER_SPLIT` | Teacher teaches multiple parallel sections |

---

### `room.csv` — Required

Lists all available classrooms.

| Thai Header | Internal name | Description |
|---|---|---|
| `ห้องทั้งหมด` | `room_id` | Unique room identifier |
| `หมายเหตุ` | `note` | Room description / display name |
| `ประเภท` | `tag` | Room type (e.g. lab, gym) |

---

### `teacher.csv` — Recommended

Teacher availability and constraints.

| Thai Header | Internal name | Description |
|---|---|---|
| `teacher_id` | `teacher_id` | Unique teacher ID |
| `ชื่อ` | `teacher_name` | Full name |
| `available_slots` | `available_slots` | Slots the teacher CAN teach |
| `unavailable_slots` | `unavailable_slots` | Slots the teacher CANNOT teach |
| `หมายเหตุ` | `constraint` | Department or note |

---

### `period.csv` — Recommended

Defines the period structure.

| Thai Header | Internal name | Description |
|---|---|---|
| `คาบ` | `period_label` | Period number / label |
| `เวลา` | `period_time` | Time range e.g. `08:05-08:55` |

---

### `preplace.csv` — Recommended

Fixed slots that block regular scheduling (homeroom, breaks, assemblies).

| Thai Header | Internal name | Description |
|---|---|---|
| `ชื่อ` | `slot_name` | Slot label (e.g. Homeroom, Lunch) |
| `คาบ` | `periods` | Period numbers occupied |
| `apply_to` | `apply_to` | Classes / teachers this applies to |

---

### `elective.csv` — Recommended

Elective courses pre-scheduled before the GA runs.

| Thai Header | Internal name | Description |
|---|---|---|
| `รหัสวิชา` | `subject_id` | Subject code |
| `ชื่อวิชา (เสรี)` | `subject_name` | Subject name |
| `ครูผู้สอน` | `teacher` | Teacher ID |
| `ห้องเรียน` | `room` | Room ID |
| *(dynamic slot columns)* | period labels | One column per available slot |

---

### `student.csv` — Recommended

Lists all student class groups.

| Thai Header | Internal name | Description |
|---|---|---|
| `นักเรียน` | `class_id` | Class identifier e.g. `1/1` |
| `ชั้น` | `grade` | Grade level |
| `ห้อง` | `section` | Section number |
| `ห้องประจำ` | `default_room` | Homeroom room ID |
| `หลักสูตร` | `curriculum` | Curriculum track |

---

### `scout.csv` — Recommended

Scout (ลูกเสือ) sessions pre-assigned before the GA.

Columns are dynamic — one column per grade level, each containing teacher IDs.

---

## API Reference

Base URL: `/api/v1`

### `POST /schedule` — Submit job ⭐

Upload all files and start scheduling in one request.

| Form field | Type | Required | Description |
|---|---|---|---|
| `curriculum` | file | **Yes** | curriculum.csv |
| `room` | file | **Yes** | room.csv |
| `elective` | file | No | elective.csv |
| `teacher` | file | No | teacher.csv |
| `period` | file | No | period.csv |
| `preplace` | file | No | preplace.csv |
| `student` | file | No | student.csv |
| `scout` | file | No | scout.csv |
| `job_name` | string | No | Display name |
| `academic_year` | string | No | e.g. `2026` |
| `semester` | int | No | Default `1` |
| `ga_params` | JSON string | No | GA overrides (see [GA Parameter Tuning](#ga-parameter-tuning)) |

Returns `202` immediately with a `job_id`. The job runs in the background.

---

### `GET /schedule/<job_id>` — Poll status

Returns the job object including `status`, `progress` (0–100), and `result` once completed.

**Status lifecycle:**
```
created → loading_data → running_ga → exporting → completed
                                                 ↘ failed
```

---

### `GET /schedule/<job_id>/download` — Download results

Available when `status == "completed"`. Returns a ZIP archive:

```
outputs/
├── teachers/   — one CSV timetable per teacher
├── students/   — one CSV timetable per class
├── rooms/      — one CSV timetable per room
└── schedule.json
```

---

### `DELETE /schedule/<job_id>` — Delete job

Removes the job record and all associated files.

---

### `GET /jobs` — List all jobs

Returns an array of all job objects.

---

### Legacy endpoints

These remain available for workflows that need fine-grained control.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/schedule/create` | Create a job without files |
| `POST` | `/curriculum/upload` | Upload curriculum to an existing job |
| `POST` | `/rooms/upload` | Upload rooms to an existing job |
| `POST` | `/timetables/upload` | Upload timetable CSVs to an existing job |
| `POST` | `/schedule/<job_id>/start` | Start a created job (synchronous) |

---

## Polling for Status

Poll every few seconds until `status` is `completed` or `failed`.

```bash
JOB_ID="550e8400-e29b-41d4-a716-446655440000"
while true; do
  RESP=$(curl -s http://localhost:5000/api/v1/schedule/$JOB_ID)
  STATUS=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['status'])")
  PROGRESS=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job']['progress'])")
  echo "Status: $STATUS  |  Progress: $PROGRESS%"
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then break; fi
  sleep 5
done
```

**Example progress response (during GA):**
```json
{
  "success": true,
  "job": {
    "status": "running_ga",
    "progress": 42.5,
    "progress_details": {
      "generation": 425,
      "max_generations": 1000,
      "best_fitness": 120,
      "violations": { "teacher_conflict": 0, "student_conflict": 2 }
    }
  }
}
```

---

## Response Format

### `schedule.json` structure

```json
{
  "config": {
    "academic_year": "2026",
    "semester": 1,
    "columns": [
      { "key": "day",  "label": "Day" },
      { "key": "1",    "label": "1",  "time": "08:05-08:55" },
      { "key": "2",    "label": "2",  "time": "08:55-09:45" }
    ]
  },
  "teachers": [
    {
      "id": "T001",
      "name": "Teacher Name",
      "department": "Science",
      "rows": [
        {
          "day": "MON",
          "columns": [
            { "1": { "subject_id": "PHY101", "subject_name": "Physics", "class": "1/1", "room": "A101" } },
            { "2": null }
          ]
        }
      ]
    }
  ],
  "students": [ "... same structure, cell has teacher + room ..." ],
  "rooms":    [ "... same structure, cell has teacher + class ..." ],
  "unfilled_slots": [
    {
      "lesson_id":       "PHY101_T001_1_1",
      "subject_id":      "PHY101",
      "subject_name":    "Physics",
      "teacher_ids":     ["T001"],
      "student_classes": ["1/1"],
      "assigned_periods": 2,
      "expected_periods": 4,
      "missing_periods":  2
    }
  ]
}
```

`unfilled_slots` lists lessons the GA could not fully schedule. An **empty array** means the timetable is complete.

### Fitness penalty reference

| Violation | Penalty |
|---|---|
| Teacher conflict | 100 |
| Student conflict | 100 |
| SEPERATE_SLOT / SUB_GROUP | 100 |
| Block pattern violation | 80 |
| Period count mismatch | 20 |
| Room conflict | 50 |
| Invalid room | 10 |

---

## GA Parameter Tuning

Pass `ga_params` as a JSON string in the form upload. The default uses the **Island GA** with 4 islands, matching `main.py`.

```bash
-F 'ga_params={"n_islands": 4, "max_generations": 1000, "mutation_rate": 0.015}'
```

### Island GA parameters (default)

| Parameter | Default | Description |
|---|---|---|
| `n_islands` | `4` | Number of independent islands. Set `1` to use standard GA. |
| `island_population_size` | `125` | Population size per island |
| `max_generations` | `1000` | Total generations |
| `migration_interval` | `50` | Generations between migrations |
| `migration_rate` | `0.1` | Fraction of population that migrates |
| `topology` | `ring` | Migration topology (`ring` or `fully_connected`) |
| `mutation_rate` | `0.015` | Base mutation probability (spread ×0.5 to ×2.0 across islands) |
| `crossover_rate` | `0.9` | Crossover probability |
| `tournament_size` | `9` | Tournament selection size |
| `elite_size` | `10` | Top individuals preserved each generation |
| `stagnation_limit` | `50` | Generations without improvement before island-level restart |
| `catastrophic_after` | `3` | Epochs of global stagnation before a full island reset |

### Standard GA parameters (when `n_islands=1`)

| Parameter | Default |
|---|---|
| `population_size` | `150` |
| `max_generations` | `500` |
| `mutation_rate` | `0.20` |
| `crossover_rate` | `0.80` |
| `tournament_size` | `7` |
| `elite_size` | `10` |

---

## Project Structure

```
schedool/
├── app.py                          # Flask app factory + Swagger setup
├── config.py                       # Environment-based configuration
├── main.py                         # Standalone CLI pipeline (no API)
├── requirements.txt
│
├── api/
│   ├── routes.py                   # All API endpoints
│   └── errors.py                   # Error handlers
│
├── src/
│   ├── data_cleaning/
│   │   ├── data_cleaning.py        # Column renaming + CSV cleaning
│   │   ├── csv_cleaner.py          # Per-file cleaning logic
│   │   ├── columns.py              # Thai → English column mappings
│   │   └── mapping.py              # Dynamic elective slot mapping
│   │
│   ├── preschedule/
│   │   ├── scheduleManager.py      # Central timetable grid state
│   │   └── prescheduleProcessor.py # 5-task preschedule pipeline
│   │
│   ├── ga/
│   │   ├── genetic_algorithm.py    # Standard GA engine
│   │   ├── island_ga.py            # Island (distributed) GA
│   │   ├── scheduler.py            # Job orchestration (pipeline runner)
│   │   ├── job_manager.py          # Job status persistence
│   │   ├── exporter.py             # CSV timetable export
│   │   ├── json_exporter.py        # JSON schedule export
│   │   ├── feasibility_checker.py  # Pre-GA feasibility check
│   │   ├── data_loader.py          # Builds Lesson objects from ScheduleManager
│   │   └── models.py               # Lesson, TimeSlot, Chromosome dataclasses
│   │
│   └── utils/
│       ├── validators.py           # CSV format validators
│       └── file_helpers.py         # ZIP creation, path helpers
│
├── data/                           # Created at runtime
│   └── jobs/
│       ├── jobs.json               # Job registry
│       └── <job_id>/
│           ├── uploads/            # Uploaded input CSVs
│           └── outputs/            # Generated timetables + schedule.json
│
└── input_dataset/                  # Example input files
```

---

## Swagger UI

Interactive API docs with live request testing:

```
http://localhost:5000/apidocs
```

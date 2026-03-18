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
10. [How the Genetic Algorithm Works](#how-the-genetic-algorithm-works)
11. [Project Structure](#project-structure)
12. [Swagger UI](#swagger-ui)

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
| `plateau_patience` | `150` | Generations with no meaningful improvement before early stop |
| `min_improvement` | `500` | Minimum fitness drop to count as a meaningful improvement |
| `min_gen_for_check` | `4500` | Generation after which the plateau stop is enabled |

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

## How the Genetic Algorithm Works

Timetable scheduling is an NP-hard combinatorial problem — the number of possible schedules is astronomically large, so brute-force search is impossible. Schedool uses an **Island Genetic Algorithm (Island GA)** inspired by biological evolution: a population of candidate schedules "evolves" over many generations through selection, crossover, and mutation, gradually improving until a good — or even perfect — timetable is found.

---

### The Big Picture

```
Start with N random (but plausible) timetables
        ↓
Evaluate how good each one is (fitness function)
        ↓
Select the best ones as parents
        ↓
Combine parents to produce children (crossover)
        ↓
Randomly adjust some children (mutation)
        ↓
Replace the weakest individuals with the children
        ↓
Repeat for thousands of generations, or until stopped
```

The algorithm runs this loop across **4 independent islands** (sub-populations) in parallel, occasionally sharing their best solutions with each other.

---

### Chromosomes — Representing a Timetable

Each candidate timetable is called a **chromosome**. A chromosome is a dictionary that maps every lesson to the time slot(s) and room it is assigned to:

```
Chromosome = {
    lesson_id → [(day, period, room), (day, period, room), ...]
}
```

For example, a Physics lesson taught by T001 to class 1/1 with a `2-1` block pattern would have three entries: two consecutive periods on one day, and one single period on another day.

---

### Initialization — Building the First Generation

Rather than starting with purely random timetables, the GA uses **greedy constructive initialization**:

1. Lessons are shuffled randomly.
2. Each lesson is placed greedily into an available slot, respecting the teacher's and students' free slots from the start.
3. Multi-period blocks (e.g., 2 consecutive periods) are placed first (largest blocks get priority) so they claim the consecutive slots they need before single-period blocks fill gaps.

This gives the first generation a significant head start over random placement, which dramatically reduces the time needed to find a good solution.

---

### Fitness Function — Measuring Quality

Every chromosome is scored by a **fitness function** that counts the total penalty for all constraint violations. A **lower score is better** — a perfect timetable scores 0.

The fitness score is the sum of all violations multiplied by their weights:

| Violation | Penalty per occurrence |
|---|---|
| Teacher double-booked at the same time | 100 |
| Student class double-booked at the same time | 100 |
| `SEPERATE_SLOT` group lessons placed at the same time | 100 |
| `SUB_GROUP` lessons NOT placed at the same time | 100 |
| Block pattern broken (e.g., double periods not consecutive) | 80 |
| Room double-booked at the same time | 50 |
| Wrong number of periods scheduled for a lesson | 20 |
| Lesson placed in a room it cannot use | 10 |

The GA tracks the best fitness seen so far across the entire run. When `best_fitness == 0`, a perfect, fully-valid timetable has been found.

---

### Selection — Choosing Parents

The GA uses **tournament selection**: to pick one parent, a small random group of chromosomes (default: 9) is drawn from the population, and the one with the lowest fitness (fewest violations) wins. This is repeated for each parent slot.

Tournament selection naturally biases toward better solutions while still giving weaker ones a small chance — preserving diversity and preventing the population from collapsing to a single solution too quickly.

---

### Crossover — Combining Two Parents

When two parent chromosomes are combined to produce children, the GA uses **teacher-grouped crossover**:

1. All lessons are grouped by teacher.
2. For each teacher group, the child inherits ALL of that teacher's lessons from one parent or the other (not a mix). This prevents a teacher's schedule from being internally inconsistent after crossover.
3. Within a lesson, a finer **block-level mix** can also occur: each individual period-block within a lesson may be inherited from either parent independently.

This two-level crossover (teacher group → individual block) is more intelligent than a naive random gene swap and tends to produce children that are already partially valid.

---

### Mutation — Random Adjustments

After crossover, each child's lessons are individually mutated with probability `mutation_rate`. When a lesson is selected for mutation, one of four operators is chosen:

| Operator | Weight | What it does |
|---|---|---|
| **Targeted block** | 50% | Identifies which specific time slot of this lesson is currently causing a conflict, then moves only that block to a conflict-free slot. Leaves the rest of the lesson untouched. |
| **Explore** | 20% | Like targeted block, but also considers slots from anywhere in the timetable — helps escape deep local optima. |
| **Room change** | 20% | Keeps the time slots the same but reassigns the lesson to a different valid room. |
| **Full re-slot** | 10% | Completely re-assigns all blocks for the lesson to random available slots. A low-probability "nuclear option" to escape stuck configurations. |

Targeted mutation is the key improvement over a basic GA: instead of blindly randomising a lesson, it surgically fixes the broken part while preserving what is already working.

---

### Island GA — Running Multiple Populations in Parallel

Rather than evolving a single population, the Island GA runs **4 independent islands** simultaneously. Each island:

- Has its own population of 125 chromosomes.
- Uses a **different mutation rate** (spread linearly from 0.5× to 2.0× the base rate), so different islands explore different parts of the solution space — cautious islands refine good solutions, aggressive islands break out of local optima.

Every `migration_interval` generations (default: 50), the best individuals from each island **migrate** to a neighbouring island in a **ring topology** (island 0 → 1 → 2 → 3 → 0). Migrants replace the worst individuals in the receiving island, injecting fresh genetic material without disrupting the whole population.

```
Island 0  →  Island 1
   ↑              ↓
Island 3  ←  Island 2
```

---

### Stopping Criteria — When Does the Algorithm Stop?

The GA can stop for three reasons, in addition to reaching `max_generations`:

#### 1. Perfect Solution
If the best fitness ever reaches **0**, all constraints are satisfied and the algorithm stops immediately.

#### 2. Stagnation Restart (Island-level)
If a single island's best fitness does not improve for `stagnation_limit` generations (default: 50), that island's **bottom half** is discarded and replaced with fresh random chromosomes. The top half (the good solutions) are kept. This prevents an island from getting permanently stuck in a local optimum.

#### 3. Catastrophic Reset (Global)
If no island makes any global improvement for `catastrophic_after` epochs (default: 3 epochs = 150 generations), the entire island that has been stagnating the longest is **completely rebuilt** from scratch with a fresh random population. This is a more aggressive restart to break out of deeper traps.

#### 4. Plateau Stop (Early Termination)
This is the primary stopping mechanism for long runs. After `min_gen_for_check` generations (default: **4,500**), the algorithm monitors whether the improvements being made are still meaningful:

- If the global best fitness has **not improved by at least `min_improvement`** (default: **500 penalty points**) within the last `plateau_patience` generations (default: 150), the algorithm concludes that further evolution is unlikely to produce significant gains and **stops early**.
- This is deliberately only activated after gen 4,500 so the algorithm has enough time to make large early improvements (e.g., going from 15,000 → 4,000) before the threshold applies.
- Tiny incremental improvements (e.g., 4,900 → 4,899 each generation) do **not** reset this counter — only a drop of 500+ points counts.

**Summary of stopping conditions:**

| Condition | Scope | Behaviour |
|---|---|---|
| `fitness == 0` | Global | Immediate stop — perfect timetable found |
| No improvement for 50 gens | Per island | Reseed bottom half of that island |
| No global improvement for 3 epochs | Global | Fully rebuild the worst island |
| Improvement < 500 pts for 150 gens after gen 4,500 | Global | Stop early — plateau reached |
| Generation limit reached | Global | Stop — return best solution found |

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

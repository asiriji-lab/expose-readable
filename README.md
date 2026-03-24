# Schedool — Genetic Algorithm School Timetable API

Schedool is a REST API that uses an **Island Genetic Algorithm** to automatically complete a school timetable. Upload your raw scheduling CSVs in one request and the API handles everything — data cleaning, preschedule processing, GA optimisation, and export — in the background.

---

## Documentation

| Document | Description |
|---|---|
| [Algorithm](docs/ALGORITHM.md) | How the Genetic Algorithm, Island GA, and stopping criteria work |
| [API Reference](docs/API.md) | All endpoints, request/response formats, and polling |
| [Input Files](docs/INPUT_FILES.md) | Every CSV file the system accepts, with column descriptions |
| [Output Format](docs/OUTPUT_FORMAT.md) | The structure of `schedule.json` and the CSV output files |
| [Configuration](docs/CONFIGURATION.md) | All GA parameters and how to tune them |

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
Interactive Swagger docs are at `http://localhost:5000/apidocs`.

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
  "status_url":   "/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000",
  "result_url":   "/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000/result",
  "download_url": "/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000/download"
}
```

Poll for progress:
```bash
curl http://localhost:5000/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000
```

Get the full result (including the schedule JSON) when `status` is `completed`:
```bash
curl http://localhost:5000/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000/result
```

Download all output files as a ZIP:
```bash
curl -OJ http://localhost:5000/api/v1/schedule/550e8400-e29b-41d4-a716-446655440000/download
```

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
├── docs/                           # Full documentation
│   ├── ALGORITHM.md
│   ├── API.md
│   ├── INPUT_FILES.md
│   ├── OUTPUT_FORMAT.md
│   └── CONFIGURATION.md
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

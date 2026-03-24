# API Reference

Base URL: `http://localhost:5000/api/v1`

Interactive docs (Swagger UI) are available at `http://localhost:5000/apidocs`.

---

## Table of Contents

1. [Job Lifecycle](#1-job-lifecycle)
2. [Submit a Job — POST /schedule](#2-submit-a-job)
3. [Poll Status — GET /schedule/:job_id](#3-poll-status)
4. [Get Result — GET /schedule/:job_id/result](#4-get-result)
5. [Download ZIP — GET /schedule/:job_id/download](#5-download-zip)
6. [Delete a Job — DELETE /schedule/:job_id](#6-delete-a-job)
7. [List All Jobs — GET /jobs](#7-list-all-jobs)
8. [Legacy Endpoints](#8-legacy-endpoints)
9. [Error Responses](#9-error-responses)

---

## 1. Job Lifecycle

When you submit a scheduling job, it runs in the background. The `status` field tells you where it is:

```
created → loading_data → running_ga → exporting → completed
                                                 ↘ failed
```

| Status | Meaning |
|---|---|
| `created` | Job has been registered, not yet started |
| `loading_data` | Reading and cleaning the uploaded CSV files |
| `running_ga` | Genetic algorithm is running — check `progress` for % complete |
| `exporting` | GA finished, writing output CSV and JSON files |
| `completed` | Everything done — result and download are available |
| `failed` | Something went wrong — check the `error` field |

---

## 2. Submit a Job

**`POST /api/v1/schedule`**

This is the main endpoint. Upload all your CSV files and optional parameters in one request. The job runs in the background and you get a `job_id` back immediately.

### Request

Content type: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `curriculum` | file | **Yes** | `curriculum.csv` — what needs to be scheduled |
| `room` | file | **Yes** | `room.csv` — all available classrooms |
| `elective` | file | No | `elective.csv` — elective courses (pre-scheduled before GA) |
| `teacher` | file | No | `teacher.csv` — teacher availability |
| `period` | file | No | `period.csv` — period structure and times |
| `preplace` | file | No | `preplace.csv` — fixed slots (breaks, homeroom, etc.) |
| `student` | file | No | `student.csv` — class group list |
| `scout` | file | No | `scout.csv` — scout session assignments |
| `job_name` | string | No | A human-readable label for this job |
| `academic_year` | string | No | Written into the output JSON, e.g. `2026` |
| `semester` | int | No | Written into the output JSON. Default: `1` |
| `ga_params` | JSON string | No | Override GA defaults. See [Configuration](CONFIGURATION.md). |

### Example

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
  -F "job_name=My Timetable" \
  -F 'ga_params={"max_generations": 2000}'
```

### Response — 202 Accepted

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

### Response — 400 Bad Request

Returned if a required file is missing or cannot be read:

```json
{
  "success": false,
  "error": "'curriculum.csv' is required"
}
```

---

## 3. Poll Status

**`GET /api/v1/schedule/:job_id`**

Check the current status and progress of a job. Call this repeatedly until `status` is `completed` or `failed`.

### Response — 200 OK

```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_name": "My Timetable",
  "status": "running_ga",
  "progress": 42.5,
  "progress_details": {
    "generation": 2125,
    "max_generations": 5000,
    "best_fitness": 340,
    "violations": {
      "teacher_conflict": 0,
      "student_conflict": 2
    }
  },
  "error": null,
  "created_at": "2026-03-24T10:00:00.000000",
  "updated_at": "2026-03-24T10:04:32.000000"
}
```

The `progress` field goes from 0 to 100 based on how many generations have completed out of `max_generations`.

### Polling Script

```bash
JOB_ID="550e8400-e29b-41d4-a716-446655440000"
while true; do
  RESP=$(curl -s http://localhost:5000/api/v1/schedule/$JOB_ID)
  STATUS=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  PROGRESS=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['progress'])")
  echo "Status: $STATUS  |  Progress: $PROGRESS%"
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then break; fi
  sleep 5
done
```

### Response — 404 Not Found

```json
{
  "success": false,
  "error": "Job not found"
}
```

---

## 4. Get Result

**`GET /api/v1/schedule/:job_id/result`**

Returns the full result for a completed job, including the complete schedule JSON.

Only available when `status == "completed"`.

### Response — 200 OK

```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "data_stats": {
      "curriculum_rows": 84,
      "rooms_rows": 20
    },
    "feasibility": {
      "is_feasible": true,
      "error_count": 0,
      "warning_count": 2
    },
    "ga_result": {
      "final_fitness": 0,
      "generations_run": 1850,
      "solution_found": true,
      "stopped_early": true
    },
    "export_result": { "teachers": 12, "students": 8, "rooms": 20 },
    "json_path": "/data/jobs/550e.../outputs/schedule.json"
  },
  "schedule": {
    "config": { ... },
    "teachers": [ ... ],
    "students": [ ... ],
    "rooms": [ ... ],
    "unfilled_slots": []
  }
}
```

The `schedule` field contains the full structured timetable. See [Output Format](OUTPUT_FORMAT.md) for the complete specification.

`schedule` will be `null` if the GA found no solution.

### Response — 400 Bad Request

Returned if the job is not yet completed:

```json
{
  "success": false,
  "error": "Result not available. Current status: running_ga"
}
```

---

## 5. Download ZIP

**`GET /api/v1/schedule/:job_id/download`**

Downloads a ZIP archive containing all output files. Only available when `status == "completed"`.

### Response — 200 OK

Returns a `application/zip` file named `schedules_<job_id>.zip` containing:

```
outputs/
├── teachers/
│   ├── T001.csv
│   ├── T002.csv
│   └── ...
├── students/
│   ├── 1_1.csv
│   ├── 1_2.csv
│   └── ...
├── rooms/
│   ├── A101.csv
│   └── ...
└── schedule.json
```

Each CSV is a standard timetable grid (days as rows, periods as columns) for that entity.

---

## 6. Delete a Job

**`DELETE /api/v1/schedule/:job_id`**

Removes the job record from the registry and deletes all uploaded and output files from disk.

### Response — 200 OK

```json
{
  "success": true,
  "message": "Job 550e8400-e29b-41d4-a716-446655440000 deleted successfully"
}
```

---

## 7. List All Jobs

**`GET /api/v1/jobs`**

Returns a list of all jobs (any status).

### Response — 200 OK

```json
{
  "success": true,
  "count": 3,
  "jobs": [
    {
      "job_id": "550e8400-...",
      "job_name": "My Timetable",
      "status": "completed",
      "progress": 100,
      "created_at": "2026-03-24T10:00:00",
      "updated_at": "2026-03-24T10:15:00"
    },
    ...
  ]
}
```

---

## 8. Legacy Endpoints

These endpoints are kept for workflows that need more fine-grained control (create job, then upload files separately, then start). For new integrations, prefer **`POST /api/v1/schedule`**.

### `POST /api/v1/schedule/create`

Create a job record without any files. Returns a `job_id` you can use to upload files next.

**Request body (JSON):**
```json
{
  "job_name": "My Schedule",
  "academic_year": "2026",
  "semester": 1,
  "ga_params": {
    "max_generations": 1000
  }
}
```

---

### `POST /api/v1/curriculum/upload`

Upload a curriculum CSV to an existing job.

| Field | Type | Description |
|---|---|---|
| `job_id` | form field | Job UUID from `/schedule/create` |
| `file` | file | `curriculum.csv` |

---

### `POST /api/v1/rooms/upload`

Upload a rooms CSV to an existing job.

| Field | Type | Description |
|---|---|---|
| `job_id` | form field | Job UUID |
| `file` | file | `room.csv` |

---

### `POST /api/v1/timetables/upload`

Upload existing timetable CSVs (pre-filled grids). Accepts multiple files. File type (teacher/student/room) is auto-detected from the filename.

| Field | Type | Description |
|---|---|---|
| `job_id` | form field | Job UUID |
| `files` | file(s) | One or more timetable CSV files |

---

### `POST /api/v1/schedule/:job_id/start`

Start a previously created job. This call **blocks** until the GA finishes and returns the full result in the response body. For anything non-trivial, prefer the async workflow via `POST /api/v1/schedule`.

---

## 9. Error Responses

All error responses follow the same shape:

```json
{
  "success": false,
  "error": "Human-readable description of what went wrong"
}
```

| HTTP Status | Meaning |
|---|---|
| `400` | Bad request — missing required field, unreadable CSV, wrong job state |
| `404` | Job not found |
| `500` | Internal server error — check server logs |

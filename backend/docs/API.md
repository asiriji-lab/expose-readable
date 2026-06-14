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
8. [Schedule Records (DB)](#8-schedule-records-db)
9. [Organizations](#9-organizations)
10. [Users](#10-users)
11. [Authentication](#11-authentication)
12. [Error Responses](#12-error-responses)

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

## 8. Schedule Records (DB)

These endpoints expose the `schedules` table directly. Unlike the job-management endpoints above (which read from the JSON file registry), these require the database to be configured.

### `GET /api/v1/schedules`

List schedule records with optional filters.

| Query param | Type | Description |
|---|---|---|
| `org_id` | string | Filter by organization UUID |
| `user_id` | string | Filter by user UUID |
| `status` | string | Filter by status (`created`, `running_ga`, `completed`, `failed`, …) |

**Example:**

```bash
# All completed schedules for an org
curl "http://localhost:5000/api/v1/schedules?org_id=550e8400-...&status=completed"
```

**Response — 200 OK:**

```json
{
  "success": true,
  "count": 2,
  "schedules": [
    {
      "schedule_id": "550e8400-...",
      "org_id": "...",
      "user_id": "...",
      "job_name": "Term 1 2026",
      "academic_year": "2026",
      "semester": 1,
      "status": "completed",
      "progress": 100,
      "ga_params": { "max_generations": 2000 },
      "error": null,
      "created_at": "2026-04-06T09:00:00+00:00",
      "updated_at": "2026-04-06T09:20:00+00:00"
    }
  ]
}
```

The `data` column (full schedule JSON) is excluded from list responses for efficiency. Use `GET /schedules/:id` to retrieve it.

---

### `GET /api/v1/schedules/:schedule_id`

Get a single schedule record by ID, including the full `data` JSONB column.

> `schedule_id` is the same UUID as the API `job_id`.

**Response — 200 OK:**

```json
{
  "success": true,
  "schedule": {
    "schedule_id": "550e8400-...",
    "status": "completed",
    "data": { ... },
    ...
  }
}
```

---

## 9. Organizations

These endpoints require the database to be configured.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/organizations` | Create an organization |
| GET | `/api/v1/organizations` | List all organizations |
| GET | `/api/v1/organizations/:org_id` | Get a single organization |
| GET | `/api/v1/organizations/:org_id/users` | List all users in an organization |
| GET | `/api/v1/organizations/:org_id/schedules` | List all schedules for an organization |

### `GET /api/v1/organizations/:org_id/users`

Returns all user accounts belonging to the given organization.

```bash
curl http://localhost:5000/api/v1/organizations/550e8400-.../users
```

**Response — 200 OK:**

```json
{
  "success": true,
  "count": 3,
  "users": [
    { "user_id": "...", "email": "jane@school.edu", "name": "Jane Smith", ... }
  ]
}
```

### `GET /api/v1/organizations/:org_id/schedules`

Returns all scheduling jobs submitted under this organization.

```bash
curl http://localhost:5000/api/v1/organizations/550e8400-.../schedules
```

**Response — 200 OK:**

```json
{
  "success": true,
  "count": 5,
  "schedules": [ { "schedule_id": "...", "status": "completed", ... } ]
}
```

---

## 10. Users

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/users` | Create a user (API-only, no password) |
| GET | `/api/v1/users` | List all users (`?org_id=` filter supported) |
| GET | `/api/v1/users/:user_id` | Get a single user |
| GET | `/api/v1/users/:user_id/schedules` | List all schedules submitted by this user |

### `GET /api/v1/users/:user_id/schedules`

Returns all scheduling jobs submitted by the given user.

```bash
curl http://localhost:5000/api/v1/users/6ba7b810-.../schedules
```

**Response — 200 OK:**

```json
{
  "success": true,
  "count": 2,
  "schedules": [
    { "schedule_id": "...", "job_name": "Term 1 2026", "status": "completed", ... }
  ]
}
```

---

## 11. Authentication

Schedool uses **JWT (JSON Web Tokens)** for user authentication. Include the token in the `Authorization` header as `Bearer <token>`.

> Auth requires the database to be configured. Accounts created here can also be used to associate scheduling jobs with a user via the `user_id` field on `POST /api/v1/schedule`.

### `POST /api/v1/auth/register`

Create a new user account with a password and receive an access token.

**Request body (JSON):**

```json
{
  "email": "jane@springfieldhs.edu",
  "password": "s3cur3p@ss",
  "name": "Jane Smith",
  "org_id": "550e8400-..."
}
```

`email` and `password` (≥ 8 characters) are required. `name` and `org_id` are optional.

**Response — 201 Created:**

```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "user_id": "6ba7b810-...",
    "email": "jane@springfieldhs.edu",
    "name": "Jane Smith",
    "org_id": "550e8400-...",
    "created_at": "2026-04-06T09:00:00+00:00"
  }
}
```

**Response — 409 Conflict:** Email already registered.

---

### `POST /api/v1/auth/login`

Login with email and password.

**Request body (JSON):**

```json
{
  "email": "jane@springfieldhs.edu",
  "password": "s3cur3p@ss"
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "user_id": "...", "email": "jane@springfieldhs.edu", ... }
}
```

**Response — 401 Unauthorized:** Invalid credentials.

---

### `GET /api/v1/auth/me`

Return the authenticated user's profile. Requires a valid token.

**Request header:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response — 200 OK:**

```json
{
  "success": true,
  "user": { "user_id": "...", "email": "jane@springfieldhs.edu", ... }
}
```

---

### `POST /api/v1/auth/logout`

Signal a logout to the server. The client must discard the token. Requires a valid token.

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Logged out successfully. Discard your token."
}
```

> Tokens are stateless JWTs — server-side revocation requires a token blocklist (see [ORM Guide](ORM.md#auth-integration)).

---

### Full auth example

```bash
# Register
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@school.edu","password":"s3cur3p@ss","name":"Jane"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Use the token
curl http://localhost:5000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"

# Submit a schedule as this user
curl -X POST http://localhost:5000/api/v1/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -F "curriculum=@curriculum.csv" \
  -F "room=@room.csv" \
  -F "user_id=6ba7b810-..."

# Logout
curl -X POST http://localhost:5000/api/v1/auth/logout -H "Authorization: Bearer $TOKEN"
```

---

## 12. Error Responses

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

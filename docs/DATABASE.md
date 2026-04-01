# Database

Schedool uses **PostgreSQL** for persistent data storage. The database is optional — the API runs in file-only mode if no `DATABASE_URL` is configured, falling back to the existing JSON-based job registry.

---

## Table of contents

1. [Schema overview](#schema-overview)
2. [Table reference](#table-reference)
   - [organizations](#organizations)
   - [users](#users)
   - [schedules](#schedules)
3. [Running with Docker Compose](#running-with-docker-compose)
4. [Connecting manually](#connecting-manually)
5. [Environment variables](#environment-variables)
6. [API endpoints](#api-endpoints)
7. [How data flows](#how-data-flows)
8. [Development notes](#development-notes)

---

## Schema overview

```
organizations ──< users ──< schedules
      └──────────────────────< schedules
```

| Table           | Purpose                                              |
|-----------------|------------------------------------------------------|
| `organizations` | Tenants — schools or institutions that own schedules |
| `users`         | Individual accounts that submit scheduling jobs      |
| `schedules`     | One row per scheduling job; stores the full output   |

The schema is applied automatically on startup and is fully idempotent — re-running against an existing database is safe.

---

## Table reference

### organizations

| Column       | Type           | Description                          |
|--------------|----------------|--------------------------------------|
| `org_id`     | UUID (PK)      | Auto-generated                       |
| `name`       | VARCHAR(255)   | Unique display name                  |
| `created_at` | TIMESTAMPTZ    | Row creation timestamp               |
| `updated_at` | TIMESTAMPTZ    | Auto-updated on every modification   |

### users

| Column       | Type           | Description                          |
|--------------|----------------|--------------------------------------|
| `user_id`    | UUID (PK)      | Auto-generated                       |
| `org_id`     | UUID (FK → organizations) | Organization this user belongs to (nullable) |
| `email`      | VARCHAR(255)   | Unique e-mail address                |
| `name`       | VARCHAR(255)   | Display name (optional)              |
| `created_at` | TIMESTAMPTZ    |                                      |
| `updated_at` | TIMESTAMPTZ    | Auto-updated on every modification   |

### schedules

| Column          | Type           | Description                                                |
|-----------------|----------------|------------------------------------------------------------|
| `schedule_id`   | UUID (PK)      | **Same UUID as the API `job_id`** — no mapping needed      |
| `org_id`        | UUID (FK → organizations) | Owning organization (nullable)                |
| `user_id`       | UUID (FK → users) | Submitting user (nullable)                           |
| `job_name`      | VARCHAR(255)   | Human-readable label                                       |
| `academic_year` | VARCHAR(10)    | e.g. `"2026"`                                              |
| `semester`      | INTEGER        | `1` or `2`                                                 |
| `status`        | VARCHAR(50)    | `created` → `loading_data` → `running_ga` → `exporting` → `completed` / `failed` |
| `progress`      | FLOAT          | 0–100                                                      |
| `sheet_url`     | TEXT           | Google Sheet link (reserved for future use, blank for now) |
| `data`          | JSONB          | Full schedule output — the contents of `schedule.json`     |
| `ga_params`     | JSONB          | GA configuration used for this run                         |
| `error`         | TEXT           | Error message when `status = 'failed'`                     |
| `created_at`    | TIMESTAMPTZ    |                                                            |
| `updated_at`    | TIMESTAMPTZ    | Auto-updated on every modification                         |

> **Note on `sheet_url`:** This column is intended for a future Google Sheets integration that will let users view the generated timetable directly in a Google Sheet. It is left empty for all schedules until that feature is implemented.

---

## Running with Docker Compose

The `docker-compose.yml` in the project root spins up both the backend and a PostgreSQL 16 instance with a single command:

```bash
docker compose up -d
```

PostgreSQL credentials (all defaults for local development):

| Setting  | Value      |
|----------|------------|
| Host     | `postgres` (container-to-container) / `localhost` (host machine) |
| Port     | `5432`     |
| Database | `schedool` |
| User     | `schedool` |
| Password | `schedool` |

The backend container waits for the `pg_isready` health-check to pass before starting, so no manual ordering is needed.

Data is persisted in the named Docker volume `postgres_data` — it survives container restarts and re-creations.

---

## Connecting manually

From the host machine (requires the `postgres` container to be running):

```bash
psql postgresql://schedool:schedool@localhost:5432/schedool
```

Or via `docker exec`:

```bash
docker exec -it schedool-postgres psql -U schedool -d schedool
```

---

## Environment variables

| Variable       | Description                                              | Default           |
|----------------|----------------------------------------------------------|-------------------|
| `DATABASE_URL` | Full libpq connection string for the PostgreSQL instance | *(empty — no DB)* |

**Example `.env` for local development outside Docker:**

```env
DATABASE_URL=postgresql://schedool:schedool@localhost:5432/schedool
```

The application reads `.env` automatically via `python-dotenv` if a `.env` file is present in the project root.

When `DATABASE_URL` is empty or the database is unreachable at startup, the app logs a warning and continues running in file-only mode (jobs are still tracked via `data/jobs/jobs.json`).

---

## API endpoints

### Organizations

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| POST   | `/api/v1/organizations`           | Create an organization   |
| GET    | `/api/v1/organizations`           | List all organizations   |
| GET    | `/api/v1/organizations/<org_id>`  | Get a single organization |

**Create organization — request body:**

```json
{ "name": "Springfield High School" }
```

**Response (201):**

```json
{
  "success": true,
  "organization": {
    "org_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Springfield High School",
    "created_at": "2026-04-01T09:00:00+00:00",
    "updated_at": "2026-04-01T09:00:00+00:00"
  }
}
```

---

### Users

| Method | Endpoint                    | Description                                  |
|--------|-----------------------------|----------------------------------------------|
| POST   | `/api/v1/users`             | Create a user                                |
| GET    | `/api/v1/users`             | List all users (filter via `?org_id=<uuid>`) |
| GET    | `/api/v1/users/<user_id>`   | Get a single user                            |

**Create user — request body:**

```json
{
  "email": "jane@springfieldhs.edu",
  "name": "Jane Smith",
  "org_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Only `email` is required; `name` and `org_id` are optional.

---

### Schedules (via the main scheduling API)

Schedule rows are created and updated automatically as jobs progress — no separate schedule creation endpoint is needed. You can associate a job with an organization or user by including the optional `org_id` and `user_id` form fields when submitting a schedule:

```bash
curl -X POST http://localhost:5000/api/v1/schedule \
  -F "curriculum=@curriculum.csv" \
  -F "room=@room.csv" \
  -F "job_name=Term 1 2026" \
  -F "academic_year=2026" \
  -F "semester=1" \
  -F "org_id=550e8400-e29b-41d4-a716-446655440000" \
  -F "user_id=6ba7b810-9dad-11d1-80b4-00c04fd430c8"
```

The `data` JSONB column is populated once the job status becomes `completed`.

---

## How data flows

```
POST /api/v1/schedule
        │
        ▼
  schedules row inserted (status = 'created')
        │
        ▼
  Background thread runs GA pipeline
        │
        ├── job succeeds ──▶  complete_schedule()  → status='completed', data=<schedule JSON>
        │
        └── job fails   ──▶  fail_schedule()       → status='failed', error=<message>
```

Job status is mirrored in both the JSON file (`data/jobs/jobs.json`) and the `schedules` table so the API continues to work even when the database is unavailable.

---

## Development notes

- The schema lives in `src/db/schema.sql` and is applied on every startup via `database._apply_schema()`.
- All CRUD functions in `src/db/models.py` are decorated with `@_guard`, which silently returns `None` / `[]` if the DB is not available. This keeps all callers free of try/except boilerplate.
- For production, change the PostgreSQL password via the `POSTGRES_PASSWORD` environment variable in `docker-compose.yml` and update `DATABASE_URL` accordingly.
- The `data` column stores the complete `schedule.json` content as JSONB, which can be several MB for large schools. Ensure adequate storage and consider archiving old rows if disk space is a concern.

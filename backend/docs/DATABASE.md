# Database

Schedool uses **PostgreSQL** for persistent data storage via the **SQLAlchemy ORM** (Flask-SQLAlchemy). The database is optional — the API runs in file-only mode if no database is configured, falling back to the existing JSON-based job registry.

For a complete guide on the ORM layer, model definitions, and how to extend the schema, see **[ORM.md](ORM.md)**.

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

For the full API reference including request/response examples, see **[API.md](API.md)**.

### Organizations

| Method | Endpoint                                     | Description                               |
|--------|----------------------------------------------|-------------------------------------------|
| POST   | `/api/v1/organizations`                      | Create an organization                    |
| GET    | `/api/v1/organizations`                      | List all organizations                    |
| GET    | `/api/v1/organizations/<org_id>`             | Get a single organization                 |
| GET    | `/api/v1/organizations/<org_id>/users`       | List all users in an organization         |
| GET    | `/api/v1/organizations/<org_id>/schedules`   | List all schedules for an organization    |

### Users

| Method | Endpoint                            | Description                                  |
|--------|-------------------------------------|----------------------------------------------|
| POST   | `/api/v1/users`                     | Create a user (API-only, no password)        |
| GET    | `/api/v1/users`                     | List all users (filter via `?org_id=<uuid>`) |
| GET    | `/api/v1/users/<user_id>`           | Get a single user                            |
| GET    | `/api/v1/users/<user_id>/schedules` | List all schedules submitted by a user       |

### Schedule Records

| Method | Endpoint                         | Description                                     |
|--------|----------------------------------|-------------------------------------------------|
| GET    | `/api/v1/schedules`              | List schedules (filters: org_id, user_id, status) |
| GET    | `/api/v1/schedules/<schedule_id>`| Get a single schedule record (includes data)    |

### Authentication

| Method | Endpoint                  | Description                                  |
|--------|---------------------------|----------------------------------------------|
| POST   | `/api/v1/auth/register`   | Register; returns JWT access token           |
| POST   | `/api/v1/auth/login`      | Login; returns JWT access token              |
| GET    | `/api/v1/auth/me`         | Get authenticated user profile               |
| POST   | `/api/v1/auth/logout`     | Logout (client-side token discard)           |

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

- **ORM:** The database layer now uses **SQLAlchemy / Flask-SQLAlchemy** instead of raw psycopg2. Model definitions live in `src/db/orm_models.py`; CRUD helpers are in `src/db/models.py`.
- **Schema bootstrap:** `db.create_all()` is called on every startup (inside `database.init_db(app)`). This is idempotent for existing tables; new tables are created automatically. `src/db/schema.sql` is kept as a reference but is no longer executed at startup.
- **Schema migrations:** For adding columns to existing tables use **Alembic** (`flask-migrate`). See [ORM.md — Migrations](ORM.md#migrations).
- All CRUD functions in `src/db/models.py` are decorated with `@_guard`, which silently returns `None` / `[]` if the DB is not available. This keeps all callers free of try/except boilerplate.
- For production, change the PostgreSQL password via the `POSTGRES_PASSWORD` environment variable in `docker-compose.yml`.
- The `data` column stores the complete `schedule.json` content as JSONB, which can be several MB for large schools. Ensure adequate storage and consider archiving old rows if disk space is a concern.
- **Auth:** The `users` table now includes a `password_hash` column used by the `/auth/register` and `/auth/login` endpoints. Existing user rows that were created without a password (via `POST /api/v1/users`) have `password_hash = NULL` and cannot log in — add a password via the register endpoint or a direct DB update.

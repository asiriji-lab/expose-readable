# Schedool — Codebase Guide

Schedool is a school timetable scheduling system. A Genetic Algorithm (GA) backend generates optimal schedules from CSV input files; a Next.js frontend lets admins upload those files, track scheduling jobs, and view/edit the resulting timetables.

---

## Repository Layout

```
root/
├── backend/        Python Flask API + GA scheduling engine
├── frontend/       Next.js 16 App Router web interface
├── graphify-out/   Auto-generated architecture diagrams (do not edit)
├── docker-compose.yaml   Runs both services + PostgreSQL
├── .gitignore
└── CLAUDE.md
```

---

## Backend

**Entry point:** `backend/app.py` (Flask application factory `create_app()`)  
**Run:** `cd backend && uv run python app.py` → `http://localhost:5000`  
**Docs:** `http://localhost:5000/apidocs` (Swagger UI)

### Install & run

```bash
cd backend
uv sync           # install dependencies from pyproject.toml
cp .env.example .env
uv run python app.py
```

### Key environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Flask + JWT signing key |
| `POSTGRES_HOST` / `_DB` / `_USER` / `_PASSWORD` | PostgreSQL connection |
| `GA_POPULATION_SIZE` | GA individuals per generation (default 150) |
| `GA_MAX_GENERATIONS` | GA stop condition (default 500) |
| `JOB_TIMEOUT` | Max seconds per job (default 600) |
| `MAX_CONCURRENT_JOBS` | ThreadPoolExecutor size (default 2) |

### Source layout

```
backend/
├── app.py              Flask app factory + root/health routes
├── config.py           Config classes (Dev / Prod / Test)
├── api/
│   ├── routes.py       All route registrations (Blueprint)
│   └── errors.py       Centralised error handlers
└── src/
    ├── data_cleaning/  CSV ingestion + column rename + row propagation
    │   ├── columns.py          Thai → English column mappings for all 7 sheets
    │   ├── csv_cleaner.py      Per-sheet cleaning (continuation row logic, teacher/room resolution)
    │   └── data_cleaning.py    Orchestrator — rename → clean pipeline
    ├── preschedule/    Pre-place fixed slots before GA runs
    │   ├── prescheduleProcessor.py
    │   └── scheduleManager.py
    ├── ga/             Genetic Algorithm engine
    │   ├── models.py           Lesson / Room / Teacher dataclasses
    │   ├── data_loader.py      Cleaned DataFrames → GA model objects
    │   ├── genetic_algorithm.py  Core GA operators (selection, crossover, mutation)
    │   ├── island_ga.py        Island GA — parallel sub-populations with migration
    │   ├── job_manager.py      Job lifecycle (submit, poll, cancel)
    │   ├── job_queue.py        ThreadPoolExecutor wrapper
    │   ├── scheduler.py        ScheduleManager — chromosome ↔ timetable
    │   └── json_exporter.py    GA result → schedule.json
    └── db/             SQLAlchemy models + helpers
        ├── orm_models.py       Organization / User / Schedule / Job tables
        └── models.py           CRUD helpers + reconcile_interrupted_jobs()
```

### API overview

All endpoints under `/api/v1/`. Auth via JWT (`Authorization: Bearer <token>`).

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/jobs` | Submit scheduling job (multipart CSV files) |
| `GET` | `/api/v1/jobs/<job_id>` | Poll job status + result |
| `GET` | `/api/v1/jobs/<job_id>/result` | Fetch result JSON |
| `GET` | `/api/v1/jobs/<job_id>/download` | Download result as ZIP |
| `DELETE` | `/api/v1/jobs/<job_id>` | Cancel / delete job |
| `POST` | `/api/v1/auth/register` | Register user |
| `POST` | `/api/v1/auth/login` | Login → JWT |
| `GET` | `/api/v1/schedules` | List schedules (filter by org/user) |
| `POST` | `/api/v1/organizations` | Create organisation |

### CSV input format

7 sheets submitted as multipart fields: `curriculum`, `teacher`, `student`, `room`, `period`, `preplace` (optional), `elective` (optional).  
Full column spec: **`backend/docs/INPUT_SPEC.md`**

### GA pipeline (in order)

1. `data_cleaning` — rename Thai headers, resolve teacher names → IDs, propagate continuation rows
2. `preschedule` — lock pre-placed slots into the grid before evolution
3. `island_ga` — evolve N islands in parallel, migrate best chromosomes every K generations
4. `json_exporter` — write `schedule.json` + per-entity CSV files

### Constraint types (in `curriculum.constraint` column)

| Value | Meaning |
|---|---|
| `type=TEAM` | Multiple teachers in same room, same class |
| `type=MULTI_CLASS_TEAM` | Multiple teachers + multiple classes together |
| `type=SUB_GROUP` | Class splits into sub-groups, each in a different room simultaneously |
| `type=TEACHER_SPLIT` | Subject split between teachers by block count (teacher[i] → block_pattern[i]) |
| `type=SEPARATE_SLOT` | GA must schedule each class in this group at a different time slot |

> **Backend spelling note:** The backend currently parses `SEPARATE_SLOT` (typo). A one-line fix is needed in `src/ga/data_loader.py` `_parse_constraint_type()` before the spec's `SEPARATE_SLOT` takes effect.

---

## Frontend

**Entry point:** `frontend/app/layout.tsx`  
**Run:** `cd frontend && npm run dev` → `http://localhost:3000`

### Install & run

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in Clerk + BACKEND_URL + Google vars
npm run dev
```

### Key environment variables (`frontend/.env.local`)

| Variable | Where used |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Baked into client bundle at build time |
| `CLERK_SECRET_KEY` | Server-only (middleware, API routes) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` etc. | Clerk redirect config |
| `BACKEND_URL` | Server-side fetch to Flask API |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Server-only — Google Sheets API auth |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Server-only secret — never expose to client |
| `GOOGLE_SHEET_TEMPLATE_ID` | Server-only — template sheet to copy from |
| `GOOGLE_DRIVE_FOLDER_ID` | Server-only — destination folder for new sheets |
| `GOOGLE_APPS_SCRIPT_URL` | Server-only — GAS web app exec URL |

> `NEXT_PUBLIC_*` vars are baked into the JS bundle at `next build` time. In Docker they must be passed as `--build-arg`, not just `env_file`.

### Route structure

```
app/
├── (admin)/
│   ├── dashboard/          Schedule list + create button
│   ├── dashboard/[id]/     Upload CSVs, track job, preview result
│   └── schedule/           Drag-and-drop timetable editor
├── (auth)/                 Login / register / complete-profile
├── teacher/schedule/       Teacher-facing read-only timetable
├── student/schedule/       Student-facing read-only timetable
└── room/schedule/          Room-facing read-only timetable
```

### Auth flow

Two layers enforced by `middleware.ts`:
1. **Clerk** — identity (SSO, OAuth). All non-public routes require a valid Clerk session.
2. **Backend JWT** (`auth-token` cookie) — issued by Flask after Clerk verification. Required for all routes except `/complete-profile` (used during initial registration).

Public routes (no auth): `/`, `/login`, `/after-sign-in`

### Key libraries

```
lib/api/scheduleApi.ts    Frontend ↔ backend HTTP calls
lib/api/backend.ts        Low-level fetch wrapper with auth-token
lib/adapters/scheduleAdapter.ts   Transform backend JSON → UI timetable model
lib/hooks/useJobStatus.ts         Polls GET /jobs/<id> until complete
```

### Google Apps Script (`../appscript/`)

Lives at the **project root** (`appscript/`), not inside `frontend/`. Runs inside the Google Sheets input template. Provides:
- **Slot picker** — sidebar UI for selecting timeslots (outputs `MON_2-5, WED_6-8` format)
- **Sheet validation** — mirrors frontend/server validation rules directly in the sheet

See `appscript/README.md` for the 3-part deployment structure (Library, Template Sheet, Web App).

### Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run test         # Vitest unit tests
npm run lint         # ESLint
```

---

## Running Everything Together

```bash
# From project root
cp backend/.env.example backend/.env   # fill in secrets
cp frontend/.env.example frontend/.env.local  # fill in Clerk + BACKEND_URL + Google vars
docker-compose up --build
```

Services:
- Frontend → `http://localhost:3065`
- Backend  → `http://localhost:5080`
- PostgreSQL → `localhost:5467`

---

## Key Documentation

| Doc | Location |
|---|---|
| CSV input specification | `backend/docs/INPUT_SPEC.md` |
| GA algorithm details | `backend/docs/ALGORITHM.md` |
| REST API reference | `backend/docs/API.md` |
| Database schema | `backend/docs/DATABASE.md` |
| Schedule JSON output format | `backend/docs/OUTPUT_FORMAT.md` |
| GA configuration parameters | `backend/docs/CONFIGURATION.md` |
| Frontend coding standards | `frontend/docs/coding_standard.md` |

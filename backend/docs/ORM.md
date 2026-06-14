# ORM Guide — SQLAlchemy

Schedool uses **Flask-SQLAlchemy** (backed by **SQLAlchemy 2.x**) as its ORM layer over PostgreSQL.  
The psycopg2 driver is still required as the underlying database adapter — it is listed in `requirements.txt` as `psycopg2-binary`.

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Key files](#key-files)
3. [Models](#models)
   - [Organization](#organization)
   - [User](#user)
   - [Schedule](#schedule)
4. [CRUD helpers](#crud-helpers)
5. [Adding a new model](#adding-a-new-model)
6. [Adding a new query](#adding-a-new-query)
7. [Graceful degradation](#graceful-degradation)
8. [Auth integration](#auth-integration)
9. [Migrations](#migrations)
10. [Configuration reference](#configuration-reference)

---

## Architecture overview

```
app.py
  └─ database.init_db(app)       ← binds SQLAlchemy to Flask, calls db.create_all()
       │
       ├─ src/db/database.py     ← holds the shared `db = SQLAlchemy()` instance
       ├─ src/db/orm_models.py   ← declarative model classes (Organization, User, Schedule)
       └─ src/db/models.py       ← CRUD helper functions (used by routes and background jobs)
```

The `db` object is the single Flask-SQLAlchemy extension instance.  Import it from `src.db.database` wherever you need it.

---

## Key files

| File | Purpose |
|---|---|
| `src/db/database.py` | Holds `db = SQLAlchemy()`, `init_db(app)`, `is_available()` |
| `src/db/orm_models.py` | Declarative model classes with `to_dict()` helpers |
| `src/db/models.py` | CRUD functions — used by routes and background threads |
| `config.py` | Sets `SQLALCHEMY_DATABASE_URI` and `SQLALCHEMY_TRACK_MODIFICATIONS` |

---

## Models

### Organization

```python
from src.db.orm_models import Organization

org = Organization(name="Springfield High School")
db.session.add(org)
db.session.commit()

print(org.org_id)   # uuid.UUID
print(org.to_dict())
# {
#   "org_id": "550e8400-...",
#   "name": "Springfield High School",
#   "created_at": "2026-04-06T09:00:00+00:00",
#   "updated_at": "2026-04-06T09:00:00+00:00"
# }
```

| Column | Type | Notes |
|---|---|---|
| `org_id` | `UUID` (PK) | Auto-generated |
| `name` | `VARCHAR(255)` | Unique |
| `created_at` | `TIMESTAMPTZ` | Set on insert |
| `updated_at` | `TIMESTAMPTZ` | Updated automatically on every write |

**Relationships:** `org.users` (dynamic query), `org.schedules` (dynamic query)

---

### User

```python
from src.db.orm_models import User
from werkzeug.security import generate_password_hash

user = User(
    email="jane@springfieldhs.edu",
    name="Jane Smith",
    org_id=org.org_id,
    password_hash=generate_password_hash("s3cur3p@ss"),
)
db.session.add(user)
db.session.commit()

print(user.to_dict())
# { "user_id": "...", "org_id": "...", "email": "...", "name": "...", ... }
# Note: password_hash is never included in to_dict()
```

| Column | Type | Notes |
|---|---|---|
| `user_id` | `UUID` (PK) | Auto-generated |
| `org_id` | `UUID` (FK → organizations) | Nullable; SET NULL on org delete |
| `email` | `VARCHAR(255)` | Unique |
| `name` | `VARCHAR(255)` | Optional |
| `password_hash` | `VARCHAR(255)` | Werkzeug hash; `NULL` for API-only accounts |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

**Relationships:** `user.organization`, `user.schedules` (dynamic query)

---

### Schedule

```python
from src.db.orm_models import Schedule
import uuid

sched = Schedule(
    schedule_id=uuid.UUID(job_id),
    job_name="Term 1 2026",
    academic_year="2026",
    semester=1,
    org_id=org.org_id,
    user_id=user.user_id,
    ga_params={"max_generations": 2000},
)
db.session.add(sched)
db.session.commit()

# Lightweight dict (data column excluded):
print(sched.to_dict())

# Include the full JSONB schedule output:
print(sched.to_dict(include_data=True))
```

| Column | Type | Notes |
|---|---|---|
| `schedule_id` | `UUID` (PK) | **Same UUID as the API `job_id`** |
| `org_id` | `UUID` (FK → organizations) | Nullable |
| `user_id` | `UUID` (FK → users) | Nullable |
| `job_name` | `VARCHAR(255)` | |
| `academic_year` | `VARCHAR(10)` | e.g. `"2026"` |
| `semester` | `INTEGER` | `1` or `2` |
| `status` | `VARCHAR(50)` | `created` → `completed` / `failed` |
| `progress` | `FLOAT` | 0–100 |
| `sheet_url` | `TEXT` | Reserved for Google Sheets integration |
| `data` | `JSONB` | Full schedule output; populated on completion |
| `ga_params` | `JSONB` | GA configuration snapshot |
| `error` | `TEXT` | Set when `status = 'failed'` |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

---

## CRUD helpers

`src/db/models.py` wraps every database operation in a `@_guard` decorator that silently returns `None`/`[]` when the database is not available — callers never need to handle connectivity errors.

```python
from src.db import models

# Organizations
org  = models.create_organization("Springfield High")     # → dict | None
org  = models.get_organization(org_id)                    # → dict | None
orgs = models.list_organizations()                        # → list[dict]

# Users
user  = models.create_user(email, name, org_id, password_hash)   # → dict | None
user  = models.get_user(user_id)                                  # → dict | None
user  = models.get_user_by_email(email)                           # → dict | None
user_orm = models.get_user_orm(email)                             # → User ORM object | None
users = models.list_users(org_id=None)                            # → list[dict]

# Schedules
sched  = models.create_schedule(schedule_id, job_name, academic_year,
                                semester, ga_params, org_id, user_id)
models.update_schedule_status(schedule_id, status, progress, error)
models.complete_schedule(schedule_id, data_dict)
models.fail_schedule(schedule_id, error_message)
sched  = models.get_schedule(schedule_id)                  # includes data column
scheds = models.list_schedules(org_id, user_id, status)    # excludes data column
scheds = models.get_user_schedules(user_id)
scheds = models.get_org_schedules(org_id)
```

All functions return plain Python dicts (or lists of dicts), never ORM objects, except `get_user_orm()` which returns the raw `User` instance for password verification.

---

## Adding a new model

1. **Define the class** in `src/db/orm_models.py`:

   ```python
   class Department(db.Model):
       __tablename__ = 'departments'

       dept_id    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
       org_id     = Column(UUID(as_uuid=True), ForeignKey('organizations.org_id', ondelete='CASCADE'))
       name       = Column(String(255), nullable=False)
       created_at = Column(DateTime(timezone=True), default=_utcnow)
       updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

       def to_dict(self):
           return {"dept_id": str(self.dept_id), "name": self.name, ...}
   ```

2. **The table is created automatically** on the next startup — `database.init_db(app)` calls `db.create_all()` which is idempotent.

3. **Add CRUD helpers** in `src/db/models.py`:

   ```python
   from .orm_models import Department

   @_guard
   def create_department(name: str, org_id: str) -> Optional[Dict]:
       dept = Department(name=name, org_id=_parse_uuid(org_id))
       db.session.add(dept)
       db.session.commit()
       return dept.to_dict()
   ```

4. **Add API endpoints** in `api/routes.py` following the existing patterns.

---

## Adding a new query

Use `Model.query` (legacy but fully supported) or `db.session.execute(select(Model)...)`:

```python
# Filter schedules by multiple criteria
from src.db.orm_models import Schedule

results = (
    Schedule.query
    .filter(Schedule.status == 'completed')
    .filter(Schedule.semester == 1)
    .order_by(Schedule.created_at.desc())
    .limit(50)
    .all()
)

# Join example — schedules with their submitting user
from sqlalchemy.orm import joinedload

results = (
    Schedule.query
    .options(joinedload(Schedule.user))
    .filter(Schedule.org_id == org_uuid)
    .all()
)
for s in results:
    print(s.user.email)  # no extra query needed
```

---

## Graceful degradation

When the PostgreSQL database is unreachable at startup, `database.init_db(app)` logs a warning and sets the internal availability flag to `False`.  All CRUD helpers decorated with `@_guard` then become no-ops and return `None`/`[]` rather than raising.

Check availability before any direct ORM usage:

```python
from src.db import database

if database.is_available():
    from src.db.orm_models import Schedule
    count = Schedule.query.count()
```

Routes that require the database return HTTP 400 with `{"error": "Database not configured"}` when it is unavailable.

---

## Auth integration

Schedool uses **Flask-JWT-Extended** for token-based authentication:

- `POST /api/v1/auth/register` — create an account; returns a JWT access token
- `POST /api/v1/auth/login` — verify credentials; returns a JWT access token
- `GET  /api/v1/auth/me` — return the authenticated user's profile (requires `Authorization: Bearer <token>`)
- `POST /api/v1/auth/logout` — client-side logout (discard the token)

**Password hashing** uses Werkzeug's `generate_password_hash` / `check_password_hash`.  
The hash is stored in `users.password_hash` and is never returned by any API.

**Using a token:**

```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@school.edu","password":"s3cur3p@ss","name":"Jane"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Use the token
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Token lifetime** is controlled by `JWT_EXPIRY_HOURS` (env var, default `24`).

**Server-side revocation:** Tokens are stateless JWTs — to invalidate tokens before they expire (e.g., on logout), implement a blocklist using Flask-JWT-Extended's `BLOCKLIST_ENABLED` feature and a Redis store. See the [Flask-JWT-Extended docs](https://flask-jwt-extended.readthedocs.io/en/stable/blocklist_and_token_revoking.html) for details.

---

## Migrations

`db.create_all()` creates tables that do not exist but does **not** alter existing tables (e.g., to add a new column).  For schema changes on a live database, use **Alembic** (the migration tool bundled with Flask-SQLAlchemy):

```bash
pip install flask-migrate

# In app.py (one-time setup):
from flask_migrate import Migrate
migrate = Migrate(app, db)

# Generate a migration after changing orm_models.py:
flask db migrate -m "add department table"
flask db upgrade
```

For a fresh install (no existing database), `db.create_all()` is sufficient — no migration step is needed.

---

## Configuration reference

| Config key | Env variable | Default | Description |
|---|---|---|---|
| `SQLALCHEMY_DATABASE_URI` | Built from `POSTGRES_*` vars | *(see below)* | Full PostgreSQL connection string |
| `SQLALCHEMY_TRACK_MODIFICATIONS` | — | `False` | Disable event system overhead |
| `JWT_SECRET_KEY` | `JWT_SECRET_KEY` | Falls back to `SECRET_KEY` | Signs JWT tokens |
| `JWT_ACCESS_TOKEN_EXPIRES` | `JWT_EXPIRY_HOURS` | `24` hours | Token lifetime |

The database URI is assembled from four environment variables:

```
postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@<POSTGRES_HOST>/<POSTGRES_DB>
```

Set these in your `.env` file or in `docker-compose.yml`.

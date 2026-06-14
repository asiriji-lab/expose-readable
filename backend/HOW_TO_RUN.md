# How to Run the Schedool Backend

The backend is a Flask API server. It accepts scheduling jobs via HTTP and returns results asynchronously.

---

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- PostgreSQL 16 (or use Docker Compose)

---

## Setup

```bash
cd backend

# Install dependencies
uv sync

# Copy and configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET_KEY, etc.
```

---

## Running

### With Docker Compose (recommended)

From the **project root**:

```bash
docker-compose up --build
```

This starts the backend (port 5080), frontend (port 3065), and PostgreSQL together.

### Locally (dev)

```bash
cd backend
uv run python app.py
```

Server runs on `http://localhost:5000`.

---

## API Usage

### Submit a scheduling job

```bash
curl -X POST http://localhost:5000/api/v1/jobs \
  -H "Authorization: Bearer <token>" \
  -F "curriculum=@input_dataset/curriculum.csv" \
  -F "teacher=@input_dataset/teacher.csv" \
  -F "student=@input_dataset/student.csv" \
  -F "room=@input_dataset/room.csv" \
  -F "period=@input_dataset/period.csv" \
  -F "preplace=@input_dataset/preplace.csv" \
  -F "elective=@input_dataset/elective.csv"
```

### Poll job status

```bash
curl http://localhost:5000/api/v1/jobs/<job_id> \
  -H "Authorization: Bearer <token>"
```

### Download result

```bash
curl http://localhost:5000/api/v1/jobs/<job_id>/result \
  -H "Authorization: Bearer <token>"
```

---

## Input Files

The scheduler expects 7 CSV files (UTF-8 encoded). See [`docs/INPUT_SPEC.md`](docs/INPUT_SPEC.md) for the full column specification.

| File | Required | Description |
|---|---|---|
| `curriculum.csv` | ✅ | Teaching assignments |
| `teacher.csv` | ✅ | Teacher availability and homeroom |
| `student.csv` | ✅ | Student classes and homeroom rooms |
| `room.csv` | ✅ | Rooms and capability tags |
| `period.csv` | ✅ | Period definitions and times |
| `preplace.csv` | optional | Pre-fixed time blocks |
| `elective.csv` | optional | Elective subject slots |

---

## Troubleshooting

**Import errors / missing packages**
```bash
uv sync
```

**Database connection errors**
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`

**CSV encoding issues**
- Save CSV files as UTF-8 (in Excel: *Save As → CSV UTF-8*)

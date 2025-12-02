# GA Scheduler Flask API

A Flask-based REST API for the Genetic Algorithm School Timetable Completion System.

## Project Structure

```
ga_scheduler_api/
├── app.py                 # Main Flask application entry point
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── README.md              # This file
│
├── api/                   # API layer
│   ├── __init__.py
│   ├── routes.py          # API endpoint definitions
│   └── errors.py          # Error handlers
│
├── core/                  # Core scheduling logic
│   ├── __init__.py
│   ├── models.py          # Data classes (Lesson, TimeSlot, Chromosome)
│   ├── data_loader.py     # File parsing and data loading
│   ├── genetic_algorithm.py # GA engine
│   ├── exporter.py        # Schedule output generation
│   ├── scheduler.py       # Main orchestration
│   └── job_manager.py     # Job tracking
│
├── utils/                 # Utility functions
│   ├── __init__.py
│   ├── file_helpers.py    # File handling utilities
│   └── validators.py      # Input validation
│
└── data/                  # Data storage (created at runtime)
    ├── uploads/           # Uploaded files
    ├── outputs/           # Generated schedules
    └── jobs/              # Job records
```

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the Server

### Development
```bash
python app.py
```

### Production
```bash
gunicorn app:app -w 4 -b 0.0.0.0:5000
```

## API Endpoints

### Job Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/jobs` | List all scheduling jobs |
| POST | `/api/v1/schedule/create` | Create a new job |
| GET | `/api/v1/schedule/<job_id>` | Get job status |
| POST | `/api/v1/schedule/<job_id>/start` | Start scheduling |
| GET | `/api/v1/schedule/<job_id>/download` | Download results |
| DELETE | `/api/v1/schedule/<job_id>` | Delete job |

### File Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/curriculum/upload` | Upload curriculum CSV |
| POST | `/api/v1/rooms/upload` | Upload rooms CSV |
| POST | `/api/v1/timetables/upload` | Upload existing timetables |

## Usage Example

### 1. Create a Job
```bash
curl -X POST http://localhost:5000/api/v1/schedule/create \
  -H "Content-Type: application/json" \
  -d '{
    "job_name": "Fall 2024 Schedule",
    "ga_params": {
      "population_size": 150,
      "max_generations": 500
    }
  }'
```

Response:
```json
{
  "success": true,
  "job_id": "abc123-...",
  "message": "Job created successfully"
}
```

### 2. Upload Curriculum
```bash
curl -X POST http://localhost:5000/api/v1/curriculum/upload \
  -F "job_id=abc123-..." \
  -F "file=@curriculum_cleaned.csv"
```

### 3. Upload Rooms
```bash
curl -X POST http://localhost:5000/api/v1/rooms/upload \
  -F "job_id=abc123-..." \
  -F "file=@room_cleaned.csv"
```

### 4. Upload Existing Timetables (Optional)
```bash
curl -X POST http://localhost:5000/api/v1/timetables/upload \
  -F "job_id=abc123-..." \
  -F "files=@student_1_1.csv" \
  -F "files=@teacher_T001.csv"
```

### 5. Start Scheduling
```bash
curl -X POST http://localhost:5000/api/v1/schedule/abc123-.../start
```

### 6. Check Status
```bash
curl http://localhost:5000/api/v1/schedule/abc123-...
```

### 7. Download Results
```bash
curl -O http://localhost:5000/api/v1/schedule/abc123-.../download
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | dev-secret | Flask secret key |
| `DEBUG` | True | Debug mode |
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 5000 | Server port |
| `GA_POPULATION_SIZE` | 150 | GA population size |
| `GA_MAX_GENERATIONS` | 500 | Max GA generations |
| `GA_MUTATION_RATE` | 0.20 | Mutation rate |
| `GA_CROSSOVER_RATE` | 0.80 | Crossover rate |

## File Formats

### Curriculum CSV
```csv
subject_id,subject_name,periods_per_week,teacher,block_pattern,student_class,constraint,room,fixed_period
ท21102,ภาษาไทย2,3.0,T033,1-2,"[1, 2, 3, 4]",,,
```

### Rooms CSV
```csv
room_id,note,tag
A316,,
B103,ม.3/1,
```

### Timetable CSV
```csv
,1,2,3,Morning Break,4,5,6,7,8,Afternoon Break,9,10
Monday,Homeroom,,,Morning Break,,,Lunch,,,Afternoon Break,,
```

## GA Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `population_size` | Number of chromosomes | 150 |
| `max_generations` | Maximum iterations | 500 |
| `mutation_rate` | Mutation probability | 0.20 |
| `crossover_rate` | Crossover probability | 0.80 |
| `elite_size` | Elites preserved | 10 |
| `tournament_size` | Tournament selection size | 7 |

## Fitness Function Weights

| Constraint | Weight | Description |
|------------|--------|-------------|
| Teacher conflict | 100 | Same teacher, same time |
| Student conflict | 100 | Same class, same time |
| Room conflict | 50 | Same room, same time |
| Block violation | 30 | Non-consecutive blocks |
| Period count | 20 | Wrong period count |
| Invalid room | 10 | Room not in list |

## License

MIT License
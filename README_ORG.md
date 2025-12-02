# Genetic Algorithm School Timetable Completion System

## Overview

This Python program uses a **Genetic Algorithm (GA)** to complete partially-filled school timetables. It respects all pre-placed slots (they are **never modified**) while filling in the remaining slots according to curriculum requirements and constraints.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INPUT DATA                                    │
├─────────────────────────────────────────────────────────────────────┤
│  curriculum_cleaned.csv  │  room_cleaned.csv  │  Existing Timetables │
│  (lessons to schedule)   │  (available rooms) │  (pre-placed slots)  │
└───────────────┬─────────────────────┬─────────────────────┬─────────┘
                │                     │                     │
                ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LOADER                                   │
│  • Parse curriculum into Lesson objects                              │
│  • Load room list                                                    │
│  • Extract pre-placed (immutable) slots from existing timetables    │
└───────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   GENETIC ALGORITHM ENGINE                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. Initialize Population (random valid schedules)                   │
│  2. Evaluate Fitness (count constraint violations)                   │
│  3. Selection (tournament selection)                                 │
│  4. Crossover (uniform crossover at lesson level)                   │
│  5. Mutation (slot change, room change, swap)                       │
│  6. Elitism (keep best solutions)                                   │
│  7. Repeat until solution or max generations                        │
└───────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SCHEDULE EXPORTER                             │
│  • Export student timetables (with rooms)                           │
│  • Export teacher timetables (with rooms)                           │
│  • Export room timetables                                           │
│  • PRESERVE all pre-placed slots                                    │
└───────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        OUTPUT FILES                                  │
│  student_*.csv  │  teacher_*.csv  │  room_*.csv                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Mathematical Model

### Decision Variables

For each lesson `l` and each possible time slot `t` and room `r`:

```
X[l,t,r] ∈ {0, 1}
```

Where `X[l,t,r] = 1` means lesson `l` is scheduled at time `t` in room `r`.

### Chromosome Representation

A **chromosome** represents a complete schedule:

```python
chromosome.genes = {
    "L0001": [(TimeSlot("Monday", "2"), "B103"), (TimeSlot("Monday", "3"), "B103")],
    "L0002": [(TimeSlot("Tuesday", "4"), "C210-211"), (TimeSlot("Tuesday", "5"), "C210-211")],
    ...
}
```

Each **gene** is a list of (TimeSlot, Room) tuples representing when and where a lesson is scheduled.

### Fitness Function

The fitness function minimizes constraint violations:

```
Fitness = Σ (weight_i × violation_count_i)
```

| Constraint Type       | Weight | Description                                      |
|-----------------------|--------|--------------------------------------------------|
| Teacher Conflict      | 100    | Same teacher scheduled at same time              |
| Student Conflict      | 100    | Same class scheduled at same time                |
| Room Conflict         | 50     | Same room used by multiple lessons at same time  |
| Block Violation       | 30     | Consecutive periods not respected                |
| Period Count Error    | 20     | Wrong number of periods per week                 |
| Invalid Room          | 10     | Room not in available room list                  |

**Goal:** Minimize fitness to 0 (no violations).

---

## Genetic Operators

### 1. Selection: Tournament Selection

```python
def tournament_selection(population, tournament_size):
    # Randomly select tournament_size individuals
    tournament = random.sample(population, tournament_size)
    # Return the best (lowest fitness)
    return min(tournament, key=lambda c: c.fitness)
```

### 2. Crossover: Uniform Crossover at Lesson Level

```python
for each lesson in curriculum:
    if random() < 0.5:
        child1.genes[lesson] = parent1.genes[lesson]
        child2.genes[lesson] = parent2.genes[lesson]
    else:
        child1.genes[lesson] = parent2.genes[lesson]
        child2.genes[lesson] = parent1.genes[lesson]
```

### 3. Mutation: Three Types

| Mutation Type | Description                                       |
|---------------|---------------------------------------------------|
| Slot Change   | Reassign time slots for a lesson                  |
| Room Change   | Change the room assignment for a lesson           |
| Swap          | Swap time slots between two lessons               |

---

## Key Constraints Handled

### Pre-placed Slots (IMMUTABLE)

```python
# These slots are NEVER modified:
BLOCKED_KEYWORDS = [
    'Homeroom',           # Daily homeroom period
    'Morning Break',      # Morning break
    'Afternoon Break',    # Afternoon break
    'Lunch',              # Lunch periods
    'ลูกเสือ',            # Scout activities
    'ชุมนุม',             # Club activities
    'เสรี',               # Elective periods
    'Bridging course'     # Bridging courses
]
```

### Block Patterns

| Pattern | Description                          | Example                    |
|---------|--------------------------------------|----------------------------|
| `1`     | Single period                        | [Mon-P2]                   |
| `2`     | Double period (consecutive)          | [Mon-P2, Mon-P3]           |
| `2-1`   | Two blocks (2+1 periods)             | [Mon-P2,P3], [Wed-P4]      |
| `2-2`   | Two double blocks                    | [Mon-P2,P3], [Thu-P4,P5]   |

### Room Assignment

- Uses only rooms from `room_cleaned.csv`
- Respects required rooms specified in curriculum
- No room conflicts (one room per time slot)

---

## Configuration Parameters

```python
# GA Parameters
POPULATION_SIZE = 150      # Number of chromosomes in population
MAX_GENERATIONS = 500      # Maximum evolution iterations
MUTATION_RATE = 0.20       # Probability of mutation per gene
CROSSOVER_RATE = 0.80      # Probability of crossover
ELITE_SIZE = 10            # Number of best solutions preserved
TOURNAMENT_SIZE = 7        # Size of selection tournament
```

---

## Data Structures

### Lesson Object

```python
@dataclass
class Lesson:
    lesson_id: str              # Unique identifier (L0001, L0002, ...)
    subject_id: str             # Subject code (ท21102, ว21103, ...)
    subject_name: str           # Subject name in Thai
    teacher_ids: List[str]      # Teacher(s) - can be multiple for team teaching
    student_classes: List[str]  # Classes taking this subject (1_1, 1_2, ...)
    periods_per_week: int       # Number of periods per week
    block_pattern: str          # Pattern (1, 2, 2-1, 2-2)
    required_room: str          # Specific room if required
    constraint: str             # Special constraints
    fixed_period: str           # Pre-fixed time slot
```

### TimeSlot Object

```python
@dataclass
class TimeSlot:
    day: str      # Monday, Tuesday, ..., Friday
    period: str   # 2, 3, 4, 5, 6, 7, 8, 9, 10
```

### Output Format

**Student Timetable Cell Format:**
```
Subject Name (Teacher IDs) [Room]
```
Example: `ภาษาไทย2 (T033) [C215-216]`

**Teacher Timetable Cell Format:**
```
Subject Name (Student Classes) [Room]
```
Example: `ภาษาไทย2 (1_1, 1_2) [C215-216]`

**Room Timetable Cell Format:**
```
Subject Name (Student Classes) - Teacher IDs
```
Example: `ภาษาไทย2 (1_1, 1_2) - T033`

---

## Usage

### Basic Usage

```python
from ga_scheduler import main

# Run the scheduler
best_solution = main()
```

### Custom Configuration

```python
from ga_scheduler import DataLoader, GeneticScheduler, ScheduleExporter

# Load data
data_loader = DataLoader("./data")
data_loader.load_all(
    curriculum_file="curriculum_cleaned.csv",
    room_file="room_cleaned.csv",
    student_files=["student_1_1.csv", "student_1_2.csv"],
    teacher_files=["teacher_T001.csv", "teacher_T002.csv"],
    room_timetable_files=["room_B103.csv"]
)

# Configure and run GA
scheduler = GeneticScheduler(
    data_loader=data_loader,
    population_size=200,
    max_generations=1000,
    mutation_rate=0.25
)
best = scheduler.evolve()

# Export results
exporter = ScheduleExporter(data_loader, best, "./output")
exporter.export_all()
```

---

## Algorithm Pseudocode

```
ALGORITHM: Genetic Algorithm for Timetable Completion

INPUT:
  - Curriculum (lessons to schedule)
  - Rooms (available rooms)
  - Existing timetables (with pre-placed slots)

OUTPUT:
  - Completed timetables for students, teachers, rooms

PROCEDURE:
  1. Load and parse all input data
  2. Identify pre-placed (immutable) slots
  3. Generate initial population of random schedules
  
  4. FOR generation = 1 TO MAX_GENERATIONS:
       a. Evaluate fitness of each chromosome
       b. Sort population by fitness
       c. IF best fitness = 0 THEN RETURN best solution
       
       d. Create new population:
          - Copy elite chromosomes directly
          - WHILE new_population.size < POPULATION_SIZE:
              i.   Select parent1 using tournament selection
              ii.  Select parent2 using tournament selection
              iii. Create children via crossover
              iv.  Apply mutation to children
              v.   Add children to new population
       
       e. Replace old population with new population
  
  5. RETURN best chromosome found
  6. Export completed schedules preserving pre-placed slots
```

---

## Performance Characteristics

| Metric                    | Typical Value            |
|---------------------------|--------------------------|
| Lessons handled           | 94 (from your curriculum)|
| Population size           | 150                      |
| Generations to converge   | 200-500                  |
| Time to complete          | 30-120 seconds           |
| Memory usage              | ~100 MB                  |

---

## File Structure

```
ga_scheduler.py                    # Main Python script
├── DataLoader                     # Data loading and parsing
├── Chromosome                     # Schedule representation
├── GeneticScheduler               # GA engine
├── ScheduleExporter               # Output generation
└── main()                         # Entry point

Output files:
completed_schedules/
├── student_1_1.csv
├── student_1_2.csv
├── ...
├── teacher_T001.csv
├── teacher_T002.csv
├── ...
├── room_B103.csv
├── room_C210-211.csv
└── ...
```

---

## Limitations and Future Improvements

### Current Limitations

1. **Local Optima:** GA may get stuck in local optima for very constrained problems
2. **No Hard Constraint Guarantee:** Some conflicts may remain if problem is over-constrained
3. **Fixed Block Patterns:** Limited to predefined block patterns (1, 2, 2-1, 2-2)

### Potential Improvements

1. **Hybrid Approach:** Combine GA with local search (memetic algorithm)
2. **Adaptive Mutation:** Increase mutation rate when stuck
3. **Multi-objective Optimization:** Balance multiple objectives (conflicts, room utilization, etc.)
4. **Parallelization:** Evaluate fitness in parallel for faster execution

---

## Dependencies

```
pandas
numpy
```

Install with:
```bash
pip install pandas numpy
```

---

## License

This code is provided as-is for educational and research purposes.
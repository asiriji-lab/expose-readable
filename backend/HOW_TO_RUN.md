# How to Run integrated_main.py

## Prerequisites

1. **Python Environment**
   ```bash
   # Make sure you have Python 3.8+ installed
   python --version
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Setup Steps

### Step 1: Prepare Input Data Directory

Create the input directory:
```bash
mkdir -p input_dataset
```

### Step 2: Place Your Input CSV Files

Copy your 8 input CSV files into `input_dataset/`:

1. **`curriculum.csv`** - Course curriculum data
   - Columns: subject_id, subject_name, periods_per_week, teacher, block_pattern, student_class, constraint, room, fixed_period

2. **`elective.csv`** - Elective courses data
   - Dynamic columns for elective time slots

3. **`teacher.csv`** - Teacher information
   - Columns: teacher_id, name, available_slots, unavailable_slots, etc.

4. **`period.csv`** - Period definitions
   - Columns: label, time

5. **`preplace.csv`** - Pre-placed slots
   - Columns: subject_id, period, apply_to, etc.

6. **`room.csv`** - Room information
   - Columns: room_id, note, tag

7. **`student.csv`** - Student class information
   - Columns: class_id, grade, etc.

8. **`scout.csv`** - Scout session information
   - Dynamic columns for grade levels

**Example:**
```bash
# If your CSV files are in a different location, copy them:
cp /path/to/your/csvs/*.csv input_dataset/

# Or check what's in the directory:
ls -la input_dataset/
```

### Step 3: Verify Setup

Run the integration test:
```bash
python test_integration.py
```

Expected output:
```
================================================================================
INTEGRATION TEST
================================================================================
...
✅ INTEGRATION TEST PASSED!
```

### Step 4: Run the Integrated System

Simply run:
```bash
python integrated_main.py
```

## What Happens When You Run It

The script will execute these stages:

### Stage 1: Load Raw Data
```
================================================================================
LOADING INPUT FILES
================================================================================
✅ Loaded curriculum: X rows, Y columns
✅ Loaded elective: X rows, Y columns
...
```

### Stage 2: Data Cleaning
```
================================================================================
CLEANING AND PREPROCESSING DATA
================================================================================
📤 Exporting cleaned data to cleaned_input/...
✅ All cleaned data exported
```

### Stage 3: Preschedule Processing
```
================================================================================
PRESCHEDULE PROCESSING
================================================================================
[State] Initialized grid template with X columns
...
📤 Exporting preschedule results...
```

### Stage 4: GA Optimization
```
================================================================================
GENETIC ALGORITHM OPTIMIZATION
================================================================================
🧬 Initializing Genetic Algorithm with ScheduleManager state...
  [GA Init] Loaded X lessons to schedule
  [GA Init] X rooms available
  [GA Init] X entities with preplaced slots
🚀 Starting GA evolution...
  Generation 0/500: Best Fitness = XXX, Violations = {...}
  Generation 50/500: Best Fitness = XXX, Violations = {...}
  ...
✅ GA Optimization Complete!
```

### Stage 5: Export Results
```
================================================================================
APPLYING GA SOLUTION TO SCHEDULES
================================================================================
  [GA] Applied X assignments to ScheduleManager
📤 Exporting final GA-optimized schedules...
```

### Stage 6: Complete
```
================================================================================
EXECUTION COMPLETE
================================================================================
✅ All processing complete!
```

## Output Files

After running, you'll find:

```
cleaned_input/
├── curriculum_cleaned.csv
├── elective_cleaned.csv
├── teacher_cleaned.csv
├── period_cleaned.csv
├── preplace_cleaned.csv
├── room_cleaned.csv
├── student_cleaned.csv
└── scout_cleaned.csv

output/
├── preschedule/
│   ├── students/
│   │   ├── student_1_1.csv
│   │   ├── student_1_2.csv
│   │   └── ...
│   ├── teachers/
│   │   ├── teacher_T001.csv
│   │   ├── teacher_T002.csv
│   │   └── ...
│   └── rooms/
│       ├── room_A101.csv
│       └── ...
│
├── final/
│   ├── students/
│   │   └── ... (GA-optimized schedules)
│   ├── teachers/
│   │   └── ... (GA-optimized schedules)
│   └── rooms/
│       └── ... (GA-optimized schedules)
│
├── ga_results/
│   └── ga_statistics.json
│
└── preschedule_conflicts.csv (if any conflicts)
```

## Customizing GA Parameters

Edit the `ga_params` dictionary in `integrated_main.py` (around line 180):

```python
ga_params = {
    'population_size': 150,      # Number of chromosomes (higher = slower but better)
    'max_generations': 500,      # Maximum iterations (higher = more optimization)
    'mutation_rate': 0.20,       # 20% mutation rate
    'crossover_rate': 0.80,      # 80% crossover rate
    'elite_size': 10,            # Keep top 10 solutions
    'tournament_size': 7         # Tournament selection size
}
```

## Troubleshooting

### Error: "No data loaded. Please check file paths."
- Make sure all 8 CSV files are in `input_dataset/`
- Check file names match exactly (case-sensitive)

### Error: Import errors
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

### Error: encoding issues
- Make sure CSV files are UTF-8 encoded
- Excel users: Save as "CSV UTF-8 (Comma delimited)"

### Want to see what's happening in detail?
- Check console output - it shows progress for each stage
- Check conflicts: `output/preschedule_conflicts.csv`
- Check GA stats: `output/ga_results/ga_statistics.json`

## Quick Command Reference

```bash
# Full workflow (from project root)
cd "/Users/poonmac/Desktop/ScheDool URD 2/schedool"

# Test integration
python test_integration.py

# Run the integrated system
python integrated_main.py

# Check outputs
ls -la output/final/students/
ls -la output/final/teachers/
ls -la output/final/rooms/

# View GA statistics
cat output/ga_results/ga_statistics.json
```

## Alternative: Run Old Scripts Separately

If you want to run modules separately (old way):

```bash
# Preschedule only (old main.py)
python main.py

# Flask API server
python app.py
```

## Need Help?

See detailed documentation:
- `INTEGRATED_README.md` - Full system documentation
- `ARCHITECTURE.md` - System architecture diagrams
- `INTEGRATION_SUMMARY.md` - Technical integration details

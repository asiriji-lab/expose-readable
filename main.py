"""
================================================================================
MAIN PIPELINE — School Timetable Generation
================================================================================

Execution order:
  1. Load raw CSV files
  2. Data cleaning  (src.data_cleaning)
  3. Preschedule processing  (src.preschedule)
  4. GA optimisation  (src.ga.ga_scheduler)
  5. Export results
================================================================================
"""

import os
import json
import pandas as pd
import optuna
from typing import Dict

from src.data_cleaning.data_cleaning import clean_input_data
from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from src.ga.genetic_algorithm import GeneticAlgorithm


# =============================================================================
# FILE I/O HELPERS
# =============================================================================

def load_csv_files(file_paths: Dict[str, str]) -> Dict[str, pd.DataFrame]:
    """Load each CSV file path into a DataFrame dict. Missing files are skipped."""
    raw_data: Dict[str, pd.DataFrame] = {}
    print("\n--- Loading Raw CSV Files ---")
    for key, path in file_paths.items():
        if os.path.exists(path):
            raw_data[key] = pd.read_csv(path, encoding='utf-8-sig')
            print(f"  ✅ Loaded '{key}': {path}  ({len(raw_data[key])} rows)")
        else:
            print(f"  ⚠️  Missing '{key}': {path}")
    return raw_data


def create_output_directories():
    dirs = [
        "cleaned_input",
        "output/preschedule/students",
        "output/preschedule/teachers",
        "output/preschedule/rooms",
        "output/final/students",
        "output/final/teachers",
        "output/final/rooms",
        "output/ga_results",
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)


# =============================================================================
# EXPORT HELPERS
# =============================================================================

def export_cleaned_data(cleaned_data: Dict[str, pd.DataFrame], output_dir: str = "cleaned_input"):
    """Write each cleaned DataFrame to CSV."""
    print(f"\n--- Exporting Cleaned Data to '{output_dir}/' ---")
    for key, df in cleaned_data.items():
        if df is None or df.empty:
            print(f"  ⚠️  Skipping empty sheet: {key}")
            continue
        path = os.path.join(output_dir, f"{key}_cleaned.csv")
        df.to_csv(path, index=False, encoding='utf-8-sig')
        print(f"  ✅ {key} -> {path}")


def export_grids(grids: Dict[str, pd.DataFrame], output_dir: str, label: str):
    """Write a dict of entity grids (student/teacher/room) to individual CSVs."""
    os.makedirs(output_dir, exist_ok=True)
    for entity_id, df in grids.items():
        safe_id = str(entity_id).replace('/', '-').replace('\\', '-')
        path = os.path.join(output_dir, f"{safe_id}.csv")
        df.to_csv(path, encoding='utf-8-sig')
    print(f"  ✅ {label}: {len(grids)} files -> {output_dir}/")


def export_preschedule_results(manager: ScheduleManager, output_dir: str = "output"):
    """Export preschedule-stage grids and conflict log."""
    print(f"\n--- Exporting Preschedule Results ---")
    export_grids(manager.student_grids, f"{output_dir}/preschedule/students", "Student grids")
    export_grids(manager.teacher_grids, f"{output_dir}/preschedule/teachers", "Teacher grids")
    export_grids(manager.room_grids,    f"{output_dir}/preschedule/rooms",    "Room grids")

    if manager.conflicts:
        conflicts_path = f"{output_dir}/preschedule_conflicts.csv"
        pd.DataFrame(manager.conflicts).to_csv(conflicts_path, index=False, encoding='utf-8-sig')
        print(f"  ✅ Conflicts ({len(manager.conflicts)}) -> {conflicts_path}")
    else:
        print("  ✅ No preschedule conflicts.")


def export_final_schedules(manager: ScheduleManager, output_dir: str = "output"):
    """Export final (post-GA) grids."""
    print(f"\n--- Exporting Final GA-Optimised Schedules ---")
    export_grids(manager.student_grids, f"{output_dir}/final/students", "Student grids (final)")
    export_grids(manager.teacher_grids, f"{output_dir}/final/teachers", "Teacher grids (final)")
    export_grids(manager.room_grids,    f"{output_dir}/final/rooms",    "Room grids (final)")

# =============================================================================
# MAIN
# =============================================================================

def main():
    create_output_directories()

    # =========================================================================
    # STEP 1 — Load raw data
    # =========================================================================
    file_paths = {
        'curriculum': 'input_dataset/curriculum.csv',
        'elective':   'input_dataset/elective.csv',
        'teacher':    'input_dataset/teacher.csv',
        'period':     'input_dataset/period.csv',
        'preplace':   'input_dataset/preplace.csv',
        'room':       'input_dataset/room.csv',
        'student':    'input_dataset/student.csv',
        'scout':      'input_dataset/scout.csv',
    }

    raw_data = load_csv_files(file_paths)
    if not raw_data:
        print("❌ No data loaded. Check file paths.")
        return

    # =========================================================================
    # STEP 2 — Data cleaning
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 2 — DATA CLEANING")
    print("=" * 80)

    cleaned_data = clean_input_data(raw_data)
    export_cleaned_data(cleaned_data, output_dir="cleaned_input")

    # =========================================================================
    # STEP 3 — Preschedule processing
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 3 — PRESCHEDULE PROCESSING")
    print("=" * 80)

    schedule_manager = ScheduleManager()
    processor = PrescheduleProcessor(schedule_manager)
    preschedule_results = processor.run_all_tasks(cleaned_data)

    # Export the preschedule-stage grids (before GA fills in the gaps)
    export_preschedule_results(schedule_manager, "output")

    print("\n📊 Preschedule Task Summary:")
    for task_name, task_result in preschedule_results.items():
        if task_name == 'summary':
            continue
        print(f"\n  {task_name.upper()}:")
        if isinstance(task_result, dict):
            for k, v in task_result.items():
                print(f"    - {k}: {v}")

    # =========================================================================
    # STEP 4 — GA hyperparameter tuning (Optuna)
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 4 — GENETIC ALGORITHM HYPERPARAMETER TUNING")
    print("=" * 80)

    def objective(trial):
        # 1. Define the range of parameters to "suggest"
        pop_size = trial.suggest_int("population_size", 50, 500, step=50)
        mut_rate = trial.suggest_float("mutation_rate", 0.01, 0.3)
        cross_rate = trial.suggest_float("crossover_rate", 0.6, 0.95)
        tourn_size = trial.suggest_int("tournament_size", 3, 15)
        
        # 2. Setup your GA with the suggested parameters
        ga_trial = GeneticAlgorithm(
            schedule_manager=schedule_manager,
            population_size=pop_size,
            mutation_rate=mut_rate,
            crossover_rate=cross_rate,
            tournament_size=tourn_size,
            max_generations=250,  # Keep generations lower for faster tuning
            elite_size=10
        )
        
        # 3. Run the GA
        best_indiv = ga_trial.evolve()
        
        # 4. Return the fitness value Optuna should try to MINIMIZE
        # NOTE: Using "minimize" because fitness here is a sum of penalties.
        return best_indiv.fitness

    # Create a study object
    study = optuna.create_study(direction="minimize")

    # Run the optimization for 100 trials (total GA runs)
    study.optimize(objective, n_trials=30)

    # Print the best results
    print("\nBest parameters found:")
    print(study.best_params)
    print(f"Best fitness: {study.best_value}")

    # For the final results, we'll run one last GA with the best parameters found
    print("\n--- Running final GA with best parameters ---")
    ga = GeneticAlgorithm(
        schedule_manager=schedule_manager,
        population_size=study.best_params["population_size"],
        mutation_rate=study.best_params["mutation_rate"],
        crossover_rate=study.best_params["crossover_rate"],
        tournament_size=study.best_params["tournament_size"],
        max_generations=1000,  # Run longer for the final result
        elite_size=10
    )
    ga.evolve()
    ga_result = ga.get_result_summary()

    print("\n📊 GA Results:")
    for k, v in ga_result.items():
        print(f"  - {k}: {v}")

    # =========================================================================
    # STEP 5 — Apply GA solution to ScheduleManager & export final schedules
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 5 — APPLYING SOLUTION & EXPORTING")
    print("=" * 80)

    # Write the GA's best chromosome back into the ScheduleManager grids
    ga.apply_solution()

    # Export the final state of the grids
    export_final_schedules(schedule_manager, "output")

    # Save GA statistics as JSON
    ga_stats_path = "output/ga_results/ga_statistics.json"
    with open(ga_stats_path, 'w', encoding='utf-8') as f:
        json.dump(
            {
                'result_summary': ga_result,
                'generation_stats': ga.generation_stats,
            },
            f,
            indent=2,
            ensure_ascii=False,
            default=str,   # handles any non-serialisable types gracefully
        )
    print(f"  ✅ GA statistics -> {ga_stats_path}")

    # =========================================================================
    # FINAL SUMMARY
    # =========================================================================
    print("\n" + "=" * 80)
    print("EXECUTION COMPLETE")
    print("=" * 80)
    print(f"\n📁 Output structure:")
    print(f"   cleaned_input/            — 8 cleaned CSV files")
    print(f"   output/preschedule/       — grids after preschedule tasks")
    print(f"     students/               — {len(schedule_manager.student_grids)} files")
    print(f"     teachers/               — {len(schedule_manager.teacher_grids)} files")
    print(f"     rooms/                  — {len(schedule_manager.room_grids)} files")
    if schedule_manager.conflicts:
        print(f"   output/preschedule_conflicts.csv — {len(schedule_manager.conflicts)} entries")
    print(f"   output/final/             — GA-completed timetables")
    print(f"     students/               — {len(schedule_manager.student_grids)} files")
    print(f"     teachers/               — {len(schedule_manager.teacher_grids)} files")
    print(f"     rooms/                  — {len(schedule_manager.room_grids)} files")
    print(f"   output/ga_results/ga_statistics.json")
    print(f"\n   GA fitness  : {ga_result.get('final_fitness', 'N/A')}")
    print(f"   Violations  : {ga_result.get('final_violations', 'N/A')}")
    print(f"   Solution ✅ : {ga_result.get('solution_found', False)}")

    # Print the best results parameters
    print("\nBest parameters found:")
    print(study.best_params)
    print(f"Best fitness: {study.best_value}")


if __name__ == "__main__":
    main()
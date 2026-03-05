"""
================================================================================
MAIN PIPELINE — School Timetable Generation  (+ Export Verification)
================================================================================

Execution order:
  1. Load raw CSV files           (input_dataset/)
  2. Data cleaning                (src.data_cleaning)
  3. Preschedule processing       (src.preschedule)
  4. GA optimisation              (src.ga.genetic_algorithm)
  5. Export  — CSV  → output/final/{teachers,students,rooms}/
             — JSON → output/schedule.json
  6. Verification — list generated files, preview JSON
================================================================================
"""

import os
import json
import shutil
import pandas as pd
from typing import Dict

from src.data_cleaning.data_cleaning import clean_input_data
from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from src.ga.genetic_algorithm import GeneticAlgorithm
from src.ga.exporter import ScheduleExporter
from src.ga.json_exporter import ScheduleJsonExporter
from src.ga.feasibility_checker import FeasibilityChecker


# =============================================================================
# CONFIGURATION
# =============================================================================

INPUT_DIR   = "input_dataset"
OUTPUT_DIR  = "output"
CLEANED_DIR = "cleaned_input"

# Timetable metadata written into the JSON output
ACADEMIC_YEAR = "2026"
SEMESTER      = 1

# GA parameters (feel free to tweak)
GA_PARAMS = dict(
    population_size=500,
    mutation_rate=0.015,
    crossover_rate=0.9,
    tournament_size=9,
    max_generations=10000,
    elite_size=10,
)


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


def export_cleaned_data(cleaned_data: Dict[str, pd.DataFrame], output_dir: str = CLEANED_DIR):
    """Write each cleaned DataFrame to CSV."""
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n--- Exporting Cleaned Data to '{output_dir}/' ---")
    for key, df in cleaned_data.items():
        if df is None or df.empty:
            print(f"  ⚠️  Skipping empty sheet: {key}")
            continue
        path = os.path.join(output_dir, f"{key}_cleaned.csv")
        df.to_csv(path, index=False, encoding='utf-8-sig')
        print(f"  ✅ {key} -> {path}")


def export_grids(grids: Dict[str, pd.DataFrame], output_dir: str, label: str, prefix: str = ""):
    """Write a dict of entity grids (student/teacher/room) to individual CSVs."""
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    for entity_id, df in grids.items():
        safe_id = str(entity_id).replace('/', '-').replace('\\', '-')
        path = os.path.join(output_dir, f"{prefix}{safe_id}.csv")
        df.to_csv(path, encoding='utf-8-sig')
    print(f"  ✅ {label}: {len(grids)} files -> {output_dir}/")


def export_preschedule_results(manager: ScheduleManager, output_dir: str = OUTPUT_DIR):
    """Export preschedule-stage grids and conflict log."""
    print(f"\n--- Exporting Preschedule Results ---")
    export_grids(manager.student_grids, f"{output_dir}/preschedule/students", "Student grids",  "student_")
    export_grids(manager.teacher_grids, f"{output_dir}/preschedule/teachers", "Teacher grids",  "teacher_")
    export_grids(manager.room_grids,    f"{output_dir}/preschedule/rooms",    "Room grids",     "room_")

    if manager.conflicts:
        path = f"{output_dir}/preschedule_conflicts.csv"
        pd.DataFrame(manager.conflicts).to_csv(path, index=False, encoding='utf-8-sig')
        print(f"  ✅ Conflicts ({len(manager.conflicts)}) -> {path}")
    else:
        print("  ✅ No preschedule conflicts.")


# =============================================================================
# VERIFICATION HELPERS
# =============================================================================

def _walk_csvs(directory: str):
    """Recursively yield (relative_path, size_kb) for every CSV under directory."""
    for root, _, files in os.walk(directory):
        for fname in sorted(files):
            if fname.endswith('.csv'):
                full = os.path.join(root, fname)
                rel  = os.path.relpath(full, directory)
                size = os.path.getsize(full) / 1024
                yield rel, size


def verify_csv_outputs(output_dir: str):
    """List every generated CSV file under output_dir with its size."""
    print(f"\n{'='*60}")
    print(f"  CSV OUTPUT VERIFICATION  →  {output_dir}/")
    print(f"{'='*60}")

    groups = {
        "teachers": os.path.join(output_dir, "teachers"),
        "students": os.path.join(output_dir, "students"),
        "rooms":    os.path.join(output_dir, "rooms"),
    }

    total = 0
    for group, path in groups.items():
        files = list(_walk_csvs(path)) if os.path.isdir(path) else []
        print(f"\n  [{group.upper()}]  ({len(files)} files)")
        for rel, kb in files:
            print(f"    {rel:<45}  {kb:>6.1f} KB")
        total += len(files)

    print(f"\n  Total CSV files generated: {total}")


def verify_json_output(json_path: str, max_rows: int = 2):
    """Print a structural summary and a short data preview of schedule.json."""
    print(f"\n{'='*60}")
    print(f"  JSON OUTPUT VERIFICATION  →  {json_path}")
    print(f"{'='*60}")

    if not os.path.exists(json_path):
        print("  ❌ schedule.json not found!")
        return

    size_kb = os.path.getsize(json_path) / 1024
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)

    # ── Config section ──────────────────────────────────────────────────────
    cfg = data.get("config", {})
    periods = [c for c in cfg.get("columns", []) if c.get("key") != "day"]
    print(f"\n  CONFIG")
    print(f"    academic_year : {cfg.get('academic_year')}")
    print(f"    semester      : {cfg.get('semester')}")
    print(f"    periods       : {len(periods)}  "
          f"({periods[0]['key'] if periods else '?'} → {periods[-1]['key'] if periods else '?'})")

    # ── Entity counts ────────────────────────────────────────────────────────
    teachers = data.get("teachers", [])
    students = data.get("students", [])
    rooms    = data.get("rooms",    [])
    print(f"\n  ENTITY COUNTS")
    print(f"    teachers : {len(teachers)}")
    print(f"    students : {len(students)}  (class groups)")
    print(f"    rooms    : {len(rooms)}")

    # ── Sample preview ───────────────────────────────────────────────────────
    def _print_entity_sample(entity_list, label, cell_keys):
        if not entity_list:
            return
        print(f"\n  SAMPLE — {label} (first {min(max_rows, len(entity_list))})")
        for ent in entity_list[:max_rows]:
            eid   = ent.get("id", "?")
            ename = ent.get("name", "?")
            rows  = ent.get("rows", [])

            # Each row: {"day": "MON", "columns": [{period_label: cell}, ...]}
            filled = sum(
                1 for row in rows
                for col_entry in row.get("columns", [])
                for cell in col_entry.values()
                if cell is not None
            )
            total_cells = sum(len(row.get("columns", [])) for row in rows)

            print(f"\n    {label[:-1]} {eid} ({ename})")
            print(f"      Scheduled slots: {filled}/{total_cells}")

            # Show first day that has at least one filled cell
            for row in rows:
                day_cells = [
                    (period, cell)
                    for col_entry in row.get("columns", [])
                    for period, cell in col_entry.items()
                    if cell is not None
                ]
                if day_cells:
                    print(f"      Sample ({row['day']}):")
                    for period, cell in day_cells[:3]:
                        cell_str = "  ".join(
                            f"{ck}={cv}" for ck, cv in cell.items()
                            if cv is not None and ck in cell_keys
                        )
                        print(f"        Period {period}: {cell_str}")
                    break

    _print_entity_sample(teachers, "Teachers", ["subject", "class", "room"])
    _print_entity_sample(students, "Students", ["subject", "teacher", "room"])
    _print_entity_sample(rooms,    "Rooms",    ["subject", "teacher", "class"])

    print(f"\n  File size: {size_kb:.1f} KB")
    print(f"  ✅ schedule.json is valid and readable.")


# =============================================================================
# MAIN
# =============================================================================

def main():
    final_dir = os.path.join(OUTPUT_DIR, "final")
    json_path = os.path.join(OUTPUT_DIR, "schedule.json")

    # =========================================================================
    # STEP 1 — Load raw data
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 1 — LOADING RAW DATA")
    print("=" * 80)

    file_paths = {
        'curriculum': f'{INPUT_DIR}/curriculum.csv',
        'elective':   f'{INPUT_DIR}/elective.csv',
        'teacher':    f'{INPUT_DIR}/teacher.csv',
        'period':     f'{INPUT_DIR}/period.csv',
        'preplace':   f'{INPUT_DIR}/preplace.csv',
        'room':       f'{INPUT_DIR}/room.csv',
        'student':    f'{INPUT_DIR}/student.csv',
        'scout':      f'{INPUT_DIR}/scout.csv',
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
    export_cleaned_data(cleaned_data)

    # =========================================================================
    # STEP 3 — Preschedule processing
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 3 — PRESCHEDULE PROCESSING")
    print("=" * 80)

    schedule_manager = ScheduleManager()
    processor = PrescheduleProcessor(schedule_manager)
    preschedule_results = processor.run_all_tasks(cleaned_data)

    export_preschedule_results(schedule_manager)

    print("\n📊 Preschedule Task Summary:")
    for task_name, task_result in preschedule_results.items():
        if task_name == 'summary':
            continue
        print(f"\n  {task_name.upper()}:")
        if isinstance(task_result, dict):
            for k, v in task_result.items():
                print(f"    - {k}: {v}")

    # =========================================================================
    # STEP 3.5 — Feasibility check (before GA)
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 3.5 — FEASIBILITY CHECK")
    print("=" * 80)

    checker = FeasibilityChecker(schedule_manager)
    feasibility_report = checker.check()

    # =========================================================================
    # STEP 4 — Genetic Algorithm
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 4 — GENETIC ALGORITHM")
    print("=" * 80)

    ga = GeneticAlgorithm(schedule_manager=schedule_manager, **GA_PARAMS)
    best_chromosome = ga.evolve()
    ga_result = ga.get_result_summary()

    print("\n📊 GA Results:")
    for k, v in ga_result.items():
        print(f"  - {k}: {v}")

    # =========================================================================
    # STEP 5 — Export: CSV + JSON
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 5 — EXPORTING RESULTS")
    print("=" * 80)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if best_chromosome is None:
        print("❌ GA produced no solution. Skipping export.")
        return

    # ── CSV export ─────────────────────────────────────────────────────────
    print(f"\n  Exporting CSV timetables → {final_dir}/")
    csv_exporter = ScheduleExporter(
        schedule_manager=schedule_manager,
        chromosome=best_chromosome,
        output_dir=final_dir,
    )
    csv_stats = csv_exporter.export_all(ga.lessons)
    print(f"  ✅ Teachers : {csv_stats['teachers_exported']} files")
    print(f"  ✅ Students : {csv_stats['students_exported']} files")
    print(f"  ✅ Rooms    : {csv_stats['rooms_exported']} files")

    # ── JSON export ────────────────────────────────────────────────────────
    print(f"\n  Exporting JSON schedule → {json_path}")
    json_exporter = ScheduleJsonExporter(
        schedule_manager=schedule_manager,
        chromosome=best_chromosome,
        academic_year=ACADEMIC_YEAR,
        semester=SEMESTER,
    )
    schedule_json = json_exporter.export(ga.lessons)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(schedule_json, f, ensure_ascii=False, indent=2)
    print(f"  ✅ schedule.json written ({os.path.getsize(json_path)/1024:.1f} KB)")

    # ── GA statistics ──────────────────────────────────────────────────────
    ga_stats_path = os.path.join(OUTPUT_DIR, "ga_results", "ga_statistics.json")
    os.makedirs(os.path.dirname(ga_stats_path), exist_ok=True)
    with open(ga_stats_path, 'w', encoding='utf-8') as f:
        json.dump(
            {'result_summary': ga_result, 'generation_stats': ga.generation_stats},
            f, indent=2, ensure_ascii=False, default=str,
        )
    print(f"  ✅ GA statistics -> {ga_stats_path}")

    # =========================================================================
    # STEP 6 — Verification
    # =========================================================================
    print("\n" + "=" * 80)
    print("STEP 6 — OUTPUT VERIFICATION")
    print("=" * 80)

    verify_csv_outputs(final_dir)
    verify_json_output(json_path)

    # =========================================================================
    # FINAL SUMMARY
    # =========================================================================
    print("\n" + "=" * 80)
    print("EXECUTION COMPLETE")
    print("=" * 80)
    print(f"\n📁 Output layout:")
    print(f"   {CLEANED_DIR}/                     — cleaned input CSVs")
    print(f"   {OUTPUT_DIR}/preschedule/           — grids after preschedule tasks")
    print(f"   {OUTPUT_DIR}/final/teachers/        — {csv_stats['teachers_exported']} teacher CSVs")
    print(f"   {OUTPUT_DIR}/final/students/        — {csv_stats['students_exported']} student CSVs")
    print(f"   {OUTPUT_DIR}/final/rooms/           — {csv_stats['rooms_exported']} room CSVs")
    print(f"   {OUTPUT_DIR}/schedule.json          — JSON schedule for API")
    print(f"   {OUTPUT_DIR}/ga_results/            — GA run statistics")
    print(f"\n   GA fitness  : {ga_result.get('final_fitness', 'N/A')}")
    print(f"   Violations  : {ga_result.get('final_violations', 'N/A')}")
    print(f"   Solution ✅ : {ga_result.get('solution_found', False)}")


if __name__ == "__main__":
    main()

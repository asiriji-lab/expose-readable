"""Quick 1000-gen test run — no export, just GA stats."""
import os
import sys
import json
import pandas as pd
from typing import Dict

from src.data_cleaning.data_cleaning import clean_input_data
from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from src.ga.data_loader import build_ga_context
from src.ga.island_ga import IslandGeneticAlgorithm
from src.ga.feasibility_checker import FeasibilityChecker

INPUT_DIR = "input_dataset"

GA_PARAMS = dict(
    n_islands=4,
    island_population_size=125,
    migration_interval=50,
    migration_rate=0.1,
    topology='ring',
    mutation_rate=0.015,
    crossover_rate=0.9,
    tournament_size=9,
    max_generations=1000,
    elite_size=10,
    stagnation_limit=50,
    catastrophic_after=3,
    min_improvement=500,
    window_size=1000,
    sa_budget=2000,
    lns_after=2,
    lns_collateral_rate=0.25,
    block_crossover_rate=0.5,
)


def load_csvs():
    files = {
        'curriculum': f'{INPUT_DIR}/curriculum.csv',
        'elective':   f'{INPUT_DIR}/elective.csv',
        'teacher':    f'{INPUT_DIR}/teacher.csv',
        'period':     f'{INPUT_DIR}/period.csv',
        'preplace':   f'{INPUT_DIR}/preplace.csv',
        'room':       f'{INPUT_DIR}/room.csv',
        'student':    f'{INPUT_DIR}/student.csv',
        'scout':      f'{INPUT_DIR}/scout.csv',
    }
    return {k: pd.read_csv(p, encoding='utf-8-sig') for k, p in files.items() if os.path.exists(p)}


def main():
    raw = load_csvs()
    cleaned = clean_input_data(raw)

    mgr = ScheduleManager()
    proc = PrescheduleProcessor(mgr)
    proc.run_all_tasks(cleaned)

    ctx = build_ga_context(mgr)

    checker = FeasibilityChecker(mgr, context=ctx)
    report = checker.check()
    if not report.is_feasible:
        print("FEASIBILITY FAILED")
        return

    ga = IslandGeneticAlgorithm(schedule_manager=mgr, context=ctx, **GA_PARAMS)
    best = ga.evolve()
    ga.close()

    result = ga.get_result_summary()
    print("\n=== FINAL RESULT ===")
    for k, v in result.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()

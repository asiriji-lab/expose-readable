"""Profile _repair_rooms + _retime_required_room_conflicts timing."""
import os
import time
import pandas as pd
from src.data_cleaning.data_cleaning import clean_input_data
from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from src.ga.data_loader import build_ga_context
from src.ga.island_ga import IslandGeneticAlgorithm
from src.ga.feasibility_checker import FeasibilityChecker

INPUT_DIR = "input_dataset"

GA_PARAMS = dict(
    n_islands=1,
    island_population_size=50,
    migration_interval=10,
    migration_rate=0.1,
    topology='ring',
    mutation_rate=0.015,
    crossover_rate=0.9,
    tournament_size=5,
    max_generations=10,   # just 10 gens
    elite_size=5,
    stagnation_limit=50,
    catastrophic_after=3,
    min_improvement=500,
    window_size=1000,
    sa_threshold=5000,
    sa_budget=0,
    sa_cooling=0.95,
    lns_after=999,        # disable LNS
    lns_collateral_rate=0.25,
    block_crossover_rate=0.5,
)


def load_csvs():
    files = {
        'curriculum': f'{INPUT_DIR}/curriculum.csv',
        'elective': f'{INPUT_DIR}/elective.csv',
        'teacher': f'{INPUT_DIR}/teacher.csv',
        'period': f'{INPUT_DIR}/period.csv',
        'preplace': f'{INPUT_DIR}/preplace.csv',
        'room': f'{INPUT_DIR}/room.csv',
        'student': f'{INPUT_DIR}/student.csv',
        'scout': f'{INPUT_DIR}/scout.csv',
    }
    return {k: pd.read_csv(p, encoding='utf-8-sig') for k, p in files.items() if os.path.exists(p)}


def main():
    import cProfile
    import pstats
    import io

    raw = load_csvs()
    cleaned = clean_input_data(raw)

    mgr = ScheduleManager()
    PrescheduleProcessor(mgr).run_all_tasks(cleaned)
    ctx = build_ga_context(mgr)

    checker = FeasibilityChecker(mgr, context=ctx)
    if not checker.check().is_feasible:
        print("FEASIBILITY FAILED"); return

    print("\n[Profiling 10 generations, 1 island, pop=50...]")
    ga = IslandGeneticAlgorithm(schedule_manager=mgr, context=ctx, **GA_PARAMS)

    pr = cProfile.Profile()
    pr.enable()
    ga.evolve()
    pr.disable()
    ga.close()

    s = io.StringIO()
    ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
    ps.print_stats(25)
    print(s.getvalue())


if __name__ == "__main__":
    main()

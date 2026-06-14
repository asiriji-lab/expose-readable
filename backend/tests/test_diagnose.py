"""
Diagnostic: load the best chromosome and print per-slot room occupancy
for the top conflicting rooms to understand WHY conflicts persist.
"""
import os
import sys
import pandas as pd
from collections import defaultdict
from typing import Dict, List, Set, Tuple

from src.data_cleaning.data_cleaning import clean_input_data
from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from src.ga.data_loader import build_ga_context
from src.ga.island_ga import IslandGeneticAlgorithm
from src.ga.feasibility_checker import FeasibilityChecker
from src.ga.genetic_algorithm import NO_ROOM

INPUT_DIR = "input_dataset"

GA_PARAMS = dict(
    n_islands=1,               # single island for simplicity
    island_population_size=50,
    migration_interval=50,
    migration_rate=0.1,
    topology='ring',
    mutation_rate=0.015,
    crossover_rate=0.9,
    tournament_size=9,
    max_generations=200,       # short run
    elite_size=5,
    stagnation_limit=50,
    catastrophic_after=3,
    min_improvement=500,
    window_size=1000,
    sa_threshold=5000,
    sa_budget=300,
    sa_cooling=0.95,
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


def diagnose(ga, chromosome):
    island = ga.islands[0]
    lessons = island.lessons
    lesson_map = {l.lesson_id: l for l in lessons}

    # Build slot → room → [lid] index
    slot_room_lids: Dict = defaultdict(lambda: defaultdict(list))
    for lid, assignments in chromosome.genes.items():
        for ts, room in assignments:
            if room and room != NO_ROOM:
                slot_room_lids[(ts.day, ts.period_col)][room].append(lid)

    # Find conflicting rooms
    conflicts_by_room: Dict[str, int] = defaultdict(int)
    for slot, room_map in slot_room_lids.items():
        for room, lids in room_map.items():
            if len(lids) > 1:
                conflicts_by_room[room] += len(lids) - 1

    print("\n=== TOP CONFLICTING ROOMS ===")
    top_rooms = sorted(conflicts_by_room, key=lambda r: -conflicts_by_room[r])[:5]

    for room in top_rooms:
        print(f"\n--- {room} (conflict score: {conflicts_by_room[room]}) ---")
        for slot, room_map in sorted(slot_room_lids.items()):
            lids = room_map.get(room, [])
            if len(lids) > 1:
                print(f"  slot {slot[0]:3s} {slot[1].split(',')[0]:>3s}: {len(lids)} lessons")
                for lid in lids:
                    les = lesson_map.get(lid)
                    if les:
                        print(f"    {lid} {les.subject_id} classes={les.student_classes} "
                              f"req={les.required_rooms} tags={les.preferred_tags}")

    # Show lessons by room type for top rooms
    print("\n=== LESSONS PER TAGGED ROOM (from best chromosome) ===")
    tagged_room_lids: Dict[str, Set[str]] = defaultdict(set)
    for lid, assignments in chromosome.genes.items():
        for ts, room in assignments:
            if room and room != NO_ROOM:
                tagged_room_lids[room].add(lid)

    tag_map = island._tag_to_rooms
    room_to_tags = {}
    for tag, rooms in tag_map.items():
        for r in rooms:
            room_to_tags.setdefault(r, []).append(tag)

    for room in top_rooms:
        lids = tagged_room_lids.get(room, set())
        tags = room_to_tags.get(room, [])
        print(f"  {room} (tags={tags}): {len(lids)} unique lessons placed here")

    # Show general room usage
    print("\n=== GENERAL ROOM USAGE ===")
    for room in island.room_list:
        lids = tagged_room_lids.get(room, set())
        print(f"  {room}: {len(lids)} lessons")

    # Show slot density: how many lessons compete per slot?
    print("\n=== SLOT DENSITY (lessons per slot that use non-homeroom rooms) ===")
    slot_non_hr_count: Dict = defaultdict(int)
    hr_rooms = set(island.homeroom_room_to_class.keys())
    for lid, assignments in chromosome.genes.items():
        for ts, room in assignments:
            if room and room != NO_ROOM and room not in hr_rooms:
                slot_non_hr_count[(ts.day, ts.period_col)] += 1

    dense_slots = sorted(slot_non_hr_count, key=lambda s: -slot_non_hr_count[s])[:10]
    for s in dense_slots:
        print(f"  {s[0]:3s} {s[1].split(',')[0]:>3s}: {slot_non_hr_count[s]} lessons (non-homeroom)")

    # Show available rooms per slot
    print("\n=== ROOM AVAILABILITY AT DENSE SLOTS ===")
    all_non_hr_rooms = island.room_list + [
        r for r in island._tag_to_rooms.get(t, [])
        for tags in [island._tag_to_rooms]
        for t in tags
    ]
    # Simpler: just count non-homeroom rooms used vs available
    all_non_hr_room_ids = set(island.room_list)
    for rooms in island._tag_to_rooms.values():
        all_non_hr_room_ids.update(rooms)

    for s in dense_slots[:5]:
        used_rooms = set(slot_room_lids[s].keys()) - hr_rooms
        total_rooms_at_slot = all_non_hr_room_ids
        free_rooms = total_rooms_at_slot - used_rooms
        print(f"  {s[0]:3s} {s[1].split(',')[0]:>3s}: "
              f"{len(used_rooms)} rooms used / {len(total_rooms_at_slot)} available "
              f"(free: {sorted(free_rooms)[:5]}...)")

    # Show required_rooms vs preferred_tags breakdown
    print("\n=== LESSON ROOM TYPE BREAKDOWN ===")
    required = [l for l in lessons if l.required_rooms]
    tagged_pref = [l for l in lessons if l.preferred_tags and not l.required_rooms]
    no_pref = [l for l in lessons if not l.required_rooms and not l.preferred_tags]
    print(f"  required_rooms : {len(required)} lessons → forced to specific room(s)")
    print(f"  preferred_tags : {len(tagged_pref)} lessons → tagged + general pool")
    print(f"  no preference  : {len(no_pref)} lessons → general pool only")


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

    print("\n[Running short GA for diagnostics...]")
    ga = IslandGeneticAlgorithm(schedule_manager=mgr, context=ctx, **GA_PARAMS)
    best = ga.evolve()
    ga.close()

    island = ga.islands[0]
    chromosome = island.best_chromosome

    print(f"\nBest fitness: {chromosome.fitness}")
    print(f"Violations: {chromosome.violations}")

    diagnose(ga, chromosome)


if __name__ == "__main__":
    main()

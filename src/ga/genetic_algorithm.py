"""
================================================================================
GENETIC ALGORITHM SCHOOL TIMETABLE COMPLETION SYSTEM
================================================================================

Integrated with ScheduleManager pipeline. Reads pre-placed state directly from
ScheduleManager grids and sheets instead of CSV files, and writes results back
via ScheduleManager.place_slot().

Key design decisions:
- Weekdays use ScheduleManager format: ["MON", "TUE", "WED", "THU", "FRI"]
- Period columns use ScheduleManager format: "label,time" (e.g. "2,08:30-09:20")
- Occupied slots are detected from existing non-None cells in entity grids
- Lessons are built from manager.sheets['curriculum'] + manager.sheets['student']
- GA evolves over only the UNPLACED curriculum lessons (not electives/scouts)
- Best chromosome is applied back to ScheduleManager via place_slot()
================================================================================
"""

import pandas as pd
import numpy as np
import random
import copy
import re
import ast
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Set, Optional, Any, Callable
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')

from src.preschedule.scheduleManager import ScheduleManager
from .models import (
    Lesson,
    TimeSlot,
    Chromosome,
    WEEKDAYS,
    BLOCKED_CELL_KEYWORDS
)
from .data_loader import (
    _parse_block_pattern,
    _parse_list_field,
    _cell_is_blocked,
    _cell_is_free,
    build_lessons_from_manager,
    get_teaching_period_cols,
    get_occupied_slots,
    build_free_slots_per_entity,
    get_lesson_available_slots,
    get_consecutive_slots,
)

# =============================================================================
# GENETIC ALGORITHM
# =============================================================================

class GeneticAlgorithm:
    """
    GA that completes the timetable by scheduling curriculum lessons
    that were not pre-placed during preschedule processing.

    Reads all state from ScheduleManager; writes the best solution back
    via ScheduleManager.place_slot() after evolution.

    Fitness penalties (lower = better):
      - Teacher conflict:  100 per violation
      - Student conflict:  100 per violation
      - Room conflict:      50 per violation
      - Block violation:    30 per violation (non-consecutive)
      - Period count error: 20 per unit off
      - Invalid room:       10 per violation
    """

    PENALTY_TEACHER_CONFLICT = 100
    PENALTY_STUDENT_CONFLICT = 100
    PENALTY_ROOM_CONFLICT = 50
    PENALTY_BLOCK_VIOLATION = 30
    PENALTY_PERIOD_COUNT = 20
    PENALTY_INVALID_ROOM = 10

    def __init__(
        self,
        schedule_manager: ScheduleManager,
        population_size: int = 100,
        max_generations: int = 500,
        mutation_rate: float = 0.15,
        crossover_rate: float = 0.80,
        elite_size: int = 5,
        tournament_size: int = 5,
        progress_callback: Optional[Callable] = None,
    ):
        self.manager = schedule_manager
        self.population_size = population_size
        self.max_generations = max_generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.elite_size = elite_size
        self.tournament_size = tournament_size
        self.progress_callback = progress_callback

        # Derived state
        self.teaching_cols: List[str] = get_teaching_period_cols(schedule_manager)
        self.all_slots: Set[Tuple[str, str]] = {
            (day, pc) for day in WEEKDAYS for pc in self.teaching_cols
        }
        self.lessons: List[Lesson] = build_lessons_from_manager(schedule_manager)
        self.lesson_map: Dict[str, Lesson] = {l.lesson_id: l for l in self.lessons}

        self.room_list: List[str] = self._get_room_list()

        # Pre-compute free slots per entity (snapshot of preschedule state)
        self.free_slots: Dict[str, Set[Tuple[str, str]]] = build_free_slots_per_entity(
            schedule_manager, self.teaching_cols, self.lessons
        )

        # GA state
        self.population: List[Chromosome] = []
        self.best_chromosome: Optional[Chromosome] = None
        self.generation_stats: List[Dict] = []

        print(f"  [GA] Teaching columns: {len(self.teaching_cols)}")
        print(f"  [GA] Total lesson units to schedule: {len(self.lessons)}")

    def _get_room_list(self) -> List[str]:
        df_room = self.manager.get_sheet_data('room')
        if df_room is not None and 'room_id' in df_room.columns:
            return [str(r).strip() for r in df_room['room_id'].unique() if str(r).strip()]
        # Fallback to room_grids keys
        return list(self.manager.room_grids.keys())

    # -------------------------------------------------------------------------
    # SLOT SELECTION HELPERS
    # -------------------------------------------------------------------------

    def _lesson_available_slots(self, lesson: Lesson) -> List[Tuple[str, str]]:
        slots = get_lesson_available_slots(lesson, self.free_slots, self.all_slots)
        if not slots:
            slots = list(self.all_slots)  # last resort: unconstrained
        return slots

    def _pick_room(self, lesson: Lesson) -> str:
        if lesson.required_rooms:
            return random.choice(lesson.required_rooms)
        if self.room_list:
            return random.choice(self.room_list)
        return "NO_ROOM"

    def _assign_blocks(
        self,
        lesson: Lesson,
        available: List[Tuple[str, str]],
        room: str,
    ) -> List[Tuple[TimeSlot, str]]:
        """
        Try to assign consecutive blocks on separate days.
        Falls back to random slots if no consecutive run is found.
        """
        block_sizes = _parse_block_pattern(lesson.block_pattern)
        assignments: List[Tuple[TimeSlot, str]] = []
        available_set = set(available)
        used_days: Set[str] = set()

        for block_size in block_sizes:
            placed = False
            shuffled = list(available)
            random.shuffle(shuffled)

            for start in shuffled:
                day, _ = start
                if day in used_days:
                    continue
                consecutive = get_consecutive_slots(start, block_size, self.teaching_cols)
                if consecutive and all(s in available_set for s in consecutive):
                    for s in consecutive:
                        assignments.append((TimeSlot(s[0], s[1]), room))
                    used_days.add(day)
                    placed = True
                    break

            if not placed:
                # Fallback: pick random slots for this block
                for _ in range(block_size):
                    if available:
                        s = random.choice(available)
                        assignments.append((TimeSlot(s[0], s[1]), room))

        return assignments

    # -------------------------------------------------------------------------
    # POPULATION INITIALIZATION
    # -------------------------------------------------------------------------

    def _create_chromosome(self) -> Chromosome:
        c = Chromosome()
        for lesson in self.lessons:
            available = self._lesson_available_slots(lesson)
            room = self._pick_room(lesson)
            c.genes[lesson.lesson_id] = self._assign_blocks(lesson, available, room)
        return c

    def initialize_population(self):
        print(f"  [GA] Initializing population of {self.population_size}...")
        self.population = [self._create_chromosome() for _ in range(self.population_size)]
        print(f"  [GA] Population initialized.")

    # -------------------------------------------------------------------------
    # FITNESS EVALUATION
    # -------------------------------------------------------------------------

    def evaluate_fitness(self, chromosome: Chromosome) -> float:
        violations: Dict[str, int] = defaultdict(int)

        # Slot usage tracking: entity_key -> {(day, period_col): lesson_id}
        teacher_usage: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        student_usage: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        room_usage: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)

        for lesson in self.lessons:
            assignments = chromosome.genes.get(lesson.lesson_id, [])

            # Period count check
            expected = sum(_parse_block_pattern(lesson.block_pattern))
            diff = abs(len(assignments) - expected)
            violations['period_count'] += diff

            for ts, room in assignments:
                slot_key = (ts.day, ts.period_col)

                # Teacher conflicts
                for tid in lesson.teacher_ids:
                    if slot_key in teacher_usage[tid]:
                        violations['teacher_conflict'] += 1
                    else:
                        teacher_usage[tid][slot_key] = lesson.lesson_id

                # Student conflicts
                for cid in lesson.student_classes:
                    if slot_key in student_usage[cid]:
                        violations['student_conflict'] += 1
                    else:
                        student_usage[cid][slot_key] = lesson.lesson_id

                # Room conflicts
                if room:
                    if slot_key in room_usage[room]:
                        violations['room_conflict'] += 1
                    else:
                        room_usage[room][slot_key] = lesson.lesson_id

                # Invalid room
                if room and self.room_list and room not in self.room_list:
                    violations['invalid_room'] += 1

        # Block consecutiveness check
        for lesson in self.lessons:
            assignments = chromosome.genes.get(lesson.lesson_id, [])
            block_sizes = _parse_block_pattern(lesson.block_pattern)

            # Group slots by day
            by_day: Dict[str, List[str]] = defaultdict(list)
            for ts, _ in assignments:
                by_day[ts.day].append(ts.period_col)

            for day, day_cols in by_day.items():
                # Sort by teaching_cols order
                try:
                    day_cols_sorted = sorted(
                        day_cols,
                        key=lambda c: self.teaching_cols.index(c) if c in self.teaching_cols else 999
                    )
                except Exception:
                    continue
                # Check adjacency
                for i in range(len(day_cols_sorted) - 1):
                    try:
                        idx1 = self.teaching_cols.index(day_cols_sorted[i])
                        idx2 = self.teaching_cols.index(day_cols_sorted[i + 1])
                        if idx2 - idx1 != 1:
                            violations['block_violation'] += 1
                    except ValueError:
                        violations['block_violation'] += 1

        fitness = (
            violations['teacher_conflict'] * self.PENALTY_TEACHER_CONFLICT +
            violations['student_conflict'] * self.PENALTY_STUDENT_CONFLICT +
            violations['room_conflict'] * self.PENALTY_ROOM_CONFLICT +
            violations['block_violation'] * self.PENALTY_BLOCK_VIOLATION +
            violations['period_count'] * self.PENALTY_PERIOD_COUNT +
            violations['invalid_room'] * self.PENALTY_INVALID_ROOM
        )

        chromosome.fitness = fitness
        chromosome.violations = dict(violations)
        return fitness

    # -------------------------------------------------------------------------
    # GENETIC OPERATORS
    # -------------------------------------------------------------------------

    def _tournament_select(self) -> Chromosome:
        contestants = random.sample(self.population, min(self.tournament_size, len(self.population)))
        return min(contestants, key=lambda c: c.fitness)

    def _crossover(self, p1: Chromosome, p2: Chromosome) -> Tuple[Chromosome, Chromosome]:
        if random.random() > self.crossover_rate:
            return p1.copy(), p2.copy()

        c1, c2 = Chromosome(), Chromosome()
        for lesson in self.lessons:
            lid = lesson.lesson_id
            if random.random() < 0.5:
                c1.genes[lid] = copy.deepcopy(p1.genes.get(lid, []))
                c2.genes[lid] = copy.deepcopy(p2.genes.get(lid, []))
            else:
                c1.genes[lid] = copy.deepcopy(p2.genes.get(lid, []))
                c2.genes[lid] = copy.deepcopy(p1.genes.get(lid, []))
        return c1, c2

    def _mutate(self, chromosome: Chromosome):
        for lesson in self.lessons:
            if random.random() > self.mutation_rate:
                continue

            mutation_type = random.choices(
                ['slot', 'room', 'swap'],
                weights=[0.5, 0.3, 0.2]
            )[0]

            if mutation_type == 'slot':
                available = self._lesson_available_slots(lesson)
                room = chromosome.genes.get(lesson.lesson_id, [])
                room = room[0][1] if room else self._pick_room(lesson)
                chromosome.genes[lesson.lesson_id] = self._assign_blocks(lesson, available, room)

            elif mutation_type == 'room':
                new_room = self._pick_room(lesson)
                if lesson.lesson_id in chromosome.genes:
                    chromosome.genes[lesson.lesson_id] = [
                        (ts, new_room) for ts, _ in chromosome.genes[lesson.lesson_id]
                    ]

            elif mutation_type == 'swap':
                other = random.choice(self.lessons)
                if other.lesson_id == lesson.lesson_id:
                    continue
                g1 = chromosome.genes.get(lesson.lesson_id, [])
                g2 = chromosome.genes.get(other.lesson_id, [])
                if len(g1) == len(g2) and g1 and g2:
                    chromosome.genes[lesson.lesson_id] = [(g2[i][0], g1[i][1]) for i in range(len(g1))]
                    chromosome.genes[other.lesson_id] = [(g1[i][0], g2[i][1]) for i in range(len(g2))]

    # -------------------------------------------------------------------------
    # EVOLUTION LOOP
    # -------------------------------------------------------------------------

    def evolve(self) -> Chromosome:
        print("\n" + "=" * 60)
        print("  GENETIC ALGORITHM EVOLUTION STARTING")
        print("=" * 60)
        print(f"  Lessons     : {len(self.lessons)}")
        print(f"  Population  : {self.population_size}")
        print(f"  Generations : {self.max_generations}")
        print(f"  Mutation    : {self.mutation_rate}")
        print(f"  Crossover   : {self.crossover_rate}")
        print("=" * 60 + "\n")

        self.initialize_population()

        # Evaluate initial population
        for c in self.population:
            self.evaluate_fitness(c)

        self.best_chromosome = min(self.population, key=lambda c: c.fitness).copy()
        print(f"  Initial best fitness: {self.best_chromosome.fitness}")
        print(f"  Initial violations  : {self.best_chromosome.violations}")

        generations_run = 0

        for gen in range(self.max_generations):
            generations_run = gen + 1
            self.population.sort(key=lambda c: c.fitness)

            # Elitism
            new_pop: List[Chromosome] = [c.copy() for c in self.population[:self.elite_size]]

            # Breed offspring
            while len(new_pop) < self.population_size:
                p1 = self._tournament_select()
                p2 = self._tournament_select()
                c1, c2 = self._crossover(p1, p2)
                self._mutate(c1)
                self._mutate(c2)
                self.evaluate_fitness(c1)
                self.evaluate_fitness(c2)
                new_pop.extend([c1, c2])

            self.population = new_pop[:self.population_size]

            # Track best
            gen_best = min(self.population, key=lambda c: c.fitness)
            if gen_best.fitness < self.best_chromosome.fitness:
                self.best_chromosome = gen_best.copy()

            # Stats
            avg_fitness = sum(c.fitness for c in self.population) / len(self.population)
            stat = {
                'generation': gen,
                'best_fitness': self.best_chromosome.fitness,
                'avg_fitness': avg_fitness,
                'violations': self.best_chromosome.violations,
            }
            self.generation_stats.append(stat)

            # Progress callback
            if self.progress_callback:
                self.progress_callback(gen, self.max_generations, stat)

            # Console progress
            if gen % 50 == 0 or self.best_chromosome.fitness == 0:
                print(f"  Gen {gen:>4d} | Best: {self.best_chromosome.fitness:.0f} | "
                      f"Avg: {avg_fitness:.0f} | "
                      f"Violations: {self.best_chromosome.violations}")

            if self.best_chromosome.fitness == 0:
                print(f"\n  ✅ Perfect solution found at generation {gen}!")
                break

        print("\n" + "=" * 60)
        print("  EVOLUTION COMPLETE")
        print(f"  Final fitness   : {self.best_chromosome.fitness}")
        print(f"  Generations run : {generations_run}")
        print(f"  Final violations: {self.best_chromosome.violations}")
        print("=" * 60 + "\n")

        return self.best_chromosome

    # -------------------------------------------------------------------------
    # APPLY SOLUTION BACK TO SCHEDULE MANAGER
    # -------------------------------------------------------------------------

    def apply_solution(self):
        """
        Write the best chromosome's assignments back into the ScheduleManager
        via place_slot(). Only writes to cells that are currently free.
        Pre-placed / occupied slots are never overwritten.
        """
        if self.best_chromosome is None:
            print("  [GA] No solution to apply.")
            return

        print("\n  [GA] Applying best solution to ScheduleManager...")
        success_count = 0
        conflict_count = 0

        for lesson in self.lessons:
            assignments = self.best_chromosome.genes.get(lesson.lesson_id, [])
            for ts, room in assignments:
                # For multi-class lessons, place for each student class
                for class_id in lesson.student_classes:
                    # Use first teacher only for now (multi-teacher would need
                    # looping here, but place_slot takes a single teacher_id)
                    teacher_id = lesson.teacher_ids[0] if lesson.teacher_ids else None
                    room_id = room if room and room != "NO_ROOM" else None

                    result = self.manager.place_slot(
                        day=ts.day,
                        period_col=ts.period_col,
                        subject_id=lesson.subject_id,
                        teacher_id=teacher_id,
                        room_id=room_id,
                        class_id=class_id,
                        reason='ga'
                    )
                    if result.startswith("SUCCESS"):
                        success_count += 1
                    else:
                        conflict_count += 1

        print(f"  [GA] Applied {success_count} slots successfully.")
        print(f"  [GA] Skipped {conflict_count} slots due to conflicts.")

    # -------------------------------------------------------------------------
    # RESULT SUMMARY
    # -------------------------------------------------------------------------

    def get_result_summary(self) -> Dict[str, Any]:
        if not self.best_chromosome:
            return {}
        return {
            'final_fitness': self.best_chromosome.fitness,
            'generations_run': len(self.generation_stats),
            'solution_found': self.best_chromosome.fitness == 0,
            'final_violations': self.best_chromosome.violations,
            'lessons_scheduled': len(self.lessons),
        }
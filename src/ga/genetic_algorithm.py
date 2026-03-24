"""
================================================================================
GA SCHEDULER - Genetic Algorithm Core
================================================================================

Handles the execution of the main evolutionary process.
"""

import random
from collections import defaultdict, deque
from typing import Dict, List, Tuple, Set, Optional, Any, Callable

from src.preschedule.scheduleManager import ScheduleManager

from .models import (
    Lesson,
    TimeSlot,
    Chromosome,
    WEEKDAYS
)

from .data_loader import (
    _parse_block_pattern,
    get_teaching_period_cols,
    build_lessons_from_manager,
    build_free_slots_per_entity,
    get_lesson_available_slots,
    get_consecutive_slots,
    build_blocked_keywords,
)
from .models import BLOCKED_CELL_KEYWORDS

# =============================================================================
# GENETIC ALGORITHM
# =============================================================================

class GeneticAlgorithm:
    """
    Optimized GA for school timetable completion.

    Improvements over baseline:
      1. Greedy constructive initialization
      2. Teacher-grouped crossover
      3. Targeted single-block mutation
      4. Lower tournament size (default 3)
      5. Stagnation restart-with-memory
    """

    PENALTY_TEACHER_CONFLICT = 100
    PENALTY_STUDENT_CONFLICT = 100
    PENALTY_ROOM_CONFLICT    = 50
    PENALTY_BLOCK_VIOLATION  = 80   # raised from 30 — non-consecutive is not a cheap option
    PENALTY_PERIOD_COUNT     = 20
    PENALTY_INVALID_ROOM     = 10
    PENALTY_SEPERATE_SLOT    = 100  # two lessons in same SEPERATE_SLOT group share a slot
    PENALTY_SUB_GROUP        = 100  # lessons in same SUB_GROUP group are NOT at the same slot

    # Stagnation: if best fitness hasn't improved in this many generations,
    # reseed the bottom half of the population.
    STAGNATION_LIMIT = 50

    def __init__(
        self,
        schedule_manager: ScheduleManager,
        population_size: int = 100,
        max_generations: int = 500,
        mutation_rate: float = 0.15,
        crossover_rate: float = 0.80,
        elite_size: int = 5,
        tournament_size: int = 3,       # lowered from 5-7 for more diversity
        stagnation_limit: int = 50,
        min_improvement: float = 500,       # min total fitness drop over the window to keep running
        window_size: int = 1000,            # generations to look back for the sliding-window stop
        block_crossover_rate: float = 0.5,  # probability of block-level mixing per lesson in crossover
        progress_callback: Optional[Callable] = None,
    ):
        self.manager = schedule_manager
        self.population_size = population_size
        self.max_generations = max_generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.elite_size = elite_size
        self.tournament_size = tournament_size
        self.stagnation_limit = stagnation_limit
        self.min_improvement = min_improvement
        self.window_size = window_size
        self.block_crossover_rate = block_crossover_rate
        self.progress_callback = progress_callback

        # ── Blocked keywords (built from period labels, preplace, electives) ──
        BLOCKED_CELL_KEYWORDS[:] = build_blocked_keywords(schedule_manager)
        print(f"  [GA] Blocked keywords   : {BLOCKED_CELL_KEYWORDS}")

        # ── Core data ─────────────────────────────────────────────────────────
        self.teaching_cols: List[str] = get_teaching_period_cols(schedule_manager)
        self.all_slots: Set[Tuple[str, str]] = {
            (day, pc) for day in WEEKDAYS for pc in self.teaching_cols
        }
        self.lessons: List[Lesson] = build_lessons_from_manager(schedule_manager)
        self.lesson_map: Dict[str, Lesson] = {l.lesson_id: l for l in self.lessons}
        self.room_list: List[str] = self._get_room_list()

        # Preschedule-state free slots (immutable snapshot)
        self.free_slots: Dict[str, Set[Tuple[str, str]]] = build_free_slots_per_entity(
            schedule_manager, self.teaching_cols
        )

        # ── Speed caches ───────────────────────────────────────────────────────
        # O(1) period column -> index
        self._col_idx: Dict[str, int] = {col: i for i, col in enumerate(self.teaching_cols)}
        # Pre-parsed block sizes per lesson
        self._block_sizes: Dict[str, List[int]] = {
            l.lesson_id: _parse_block_pattern(l.block_pattern) for l in self.lessons
        }
        # Pre-computed expected period count per lesson
        self._expected_periods: Dict[str, int] = {
            lid: sum(bs) for lid, bs in self._block_sizes.items()
        }
        # Pre-computed available slots per lesson (preschedule snapshot, sorted
        # ascending by number of available start positions so most-constrained first)
        self._lesson_slots_cache: Dict[str, List[Tuple[str, str]]] = {
            l.lesson_id: get_lesson_available_slots(l, self.free_slots, self.all_slots)
            for l in self.lessons
        }

        # ── Improvement 2: teacher -> lesson_ids grouping for crossover ─────────
        # Maps each teacher_id to the list of lesson_ids they teach.
        # Crossover swaps entire teacher groups, not individual lessons.
        self._teacher_groups: Dict[str, List[str]] = defaultdict(list)
        for lesson in self.lessons:
            for tid in lesson.teacher_ids:
                self._teacher_groups[tid].append(lesson.lesson_id)
        # Lessons with no teacher form their own group keyed by lesson_id
        self._no_teacher_lids: List[str] = [
            l.lesson_id for l in self.lessons if not l.teacher_ids
        ]

        # ── Constraint groups ─────────────────────────────────────────────────
        # Maps constraint_group_id -> [lesson_ids] for SEPERATE_SLOT and SUB_GROUP
        self._seperate_slot_groups: Dict[str, List[str]] = defaultdict(list)
        self._sub_group_groups:     Dict[str, List[str]] = defaultdict(list)
        for lesson in self.lessons:
            if lesson.constraint_type == 'SEPERATE_SLOT' and lesson.constraint_group_id:
                self._seperate_slot_groups[lesson.constraint_group_id].append(lesson.lesson_id)
            elif lesson.constraint_type == 'SUB_GROUP' and lesson.constraint_group_id:
                self._sub_group_groups[lesson.constraint_group_id].append(lesson.lesson_id)

        # ── Fixed-period slot cache (SUB_GROUP with fixed_period) ─────────────
        # Parsed once at init; timeslot is immutable — only room may change.
        self._fixed_slots: Dict[str, List[Tuple[str, str]]] = {}
        for lesson in self.lessons:
            if lesson.fixed_period:
                slots = self._parse_fixed_period(lesson.fixed_period)
                if slots:
                    self._fixed_slots[lesson.lesson_id] = slots

        # ── GA state ──────────────────────────────────────────────────────────
        self.population: List[Chromosome] = []
        self.best_chromosome: Optional[Chromosome] = None
        self.generation_stats: List[Dict] = []
        self._gens_without_improvement: int = 0   # resets on restart
        self._fitness_window: deque = deque(maxlen=window_size)  # sliding window for stop check
        self._stopped_early: bool = False
        self._current_generation: int = 0

        print(f"  [GA] Teaching columns : {len(self.teaching_cols)}")
        print(f"  [GA] Lessons to place : {len(self.lessons)}")
        print(f"  [GA] Teacher groups   : {len(self._teacher_groups)}")

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _get_room_list(self) -> List[str]:
        df_room = self.manager.get_sheet_data('room')
        if df_room is not None and 'room_id' in df_room.columns:
            return [str(r).strip() for r in df_room['room_id'].unique() if str(r).strip()]
        return list(self.manager.room_grids.keys())

    def _pick_room(self, lesson: Lesson) -> str:
        if lesson.required_rooms:
            return random.choice(lesson.required_rooms)
        if self.room_list:
            return random.choice(self.room_list)
        return "NO_ROOM"

    def _parse_fixed_period(self, fixed_period_str: str) -> List[Tuple[str, str]]:
        """
        Parse "MON_9-MON_10" → [(MON, "9,xx:xx-xx:xx"), (MON, "10,xx:xx-xx:xx")]
        The format is START_DAY_PERIOD-END_DAY_PERIOD representing an inclusive range
        of consecutive periods on the same day.
        """
        label_to_col = {col.split(',')[0]: col for col in self.teaching_cols}
        parts = fixed_period_str.strip().split('-')
        if len(parts) < 2:
            return []

        start_str = parts[0].strip()
        end_str   = parts[-1].strip()
        if '_' not in start_str or '_' not in end_str:
            return []

        start_day, start_label = start_str.rsplit('_', 1)
        end_day,   end_label   = end_str.rsplit('_', 1)
        if start_day.upper() != end_day.upper():
            return []

        day = start_day.upper()
        if day not in WEEKDAYS:
            return []

        try:
            s_idx = next(i for i, col in enumerate(self.teaching_cols) if col.split(',')[0] == start_label)
            e_idx = next(i for i, col in enumerate(self.teaching_cols) if col.split(',')[0] == end_label)
        except StopIteration:
            return []

        return [(day, self.teaching_cols[i]) for i in range(min(s_idx, e_idx), max(s_idx, e_idx) + 1)]

    def _has_free_neighbor(
        self,
        slot: Tuple[str, str],
        available_set: Set[Tuple[str, str]],
    ) -> bool:
        """Return True if slot has at least one free adjacent slot on the same day."""
        day, col = slot
        idx = self._col_idx.get(col, -1)
        if idx < 0:
            return False
        if idx > 0 and (day, self.teaching_cols[idx - 1]) in available_set:
            return True
        if idx + 1 < len(self.teaching_cols) and (day, self.teaching_cols[idx + 1]) in available_set:
            return True
        return False

    def _assign_blocks(
        self,
        lesson: Lesson,
        available: List[Tuple[str, str]],
        room: str,
        committed: Optional[Set[Tuple[str, str]]] = None,
    ) -> List[Tuple[TimeSlot, str]]:
        """
        Place all blocks for a lesson.

        `committed` is an optional set of (day, period_col) slots already
        committed by earlier lessons in the same chromosome build pass.
        When provided (greedy init), the assignment avoids those slots.
        """
        # Largest blocks first — multi-period blocks need consecutive slots and get priority
        block_sizes = sorted(self._block_sizes[lesson.lesson_id], reverse=True)
        assignments: List[Tuple[TimeSlot, str]] = []
        available_set = set(available)
        if committed:
            available_set -= committed
        used_days: Set[str] = set()

        for block_size in block_sizes:
            placed = False

            if block_size == 1:
                # Single-period block: prefer isolated slots (no free adjacent neighbor)
                # so we don't break consecutive pairs that larger blocks still need.
                pool = [s for s in available_set if s[0] not in used_days]
                if not pool:
                    pool = list(available_set)  # relax day constraint as last resort
                if pool:
                    isolated = [s for s in pool if not self._has_free_neighbor(s, available_set)]
                    s = random.choice(isolated if isolated else pool)
                    assignments.append((TimeSlot(s[0], s[1]), room))
                    available_set.discard(s)
                    if committed is not None:
                        committed.add(s)
                    used_days.add(s[0])
                    placed = True

            else:
                shuffled = list(available_set)
                random.shuffle(shuffled)

                # Pass 1: consecutive run on a fresh (unused) day
                for start in shuffled:
                    day, _ = start
                    if day in used_days:
                        continue
                    consecutive = get_consecutive_slots(start, block_size, self.teaching_cols, self._col_idx)
                    if consecutive and all(s in available_set for s in consecutive):
                        for s in consecutive:
                            assignments.append((TimeSlot(s[0], s[1]), room))
                            available_set.discard(s)
                            if committed is not None:
                                committed.add(s)
                        used_days.add(day)
                        placed = True
                        break

                if not placed:
                    # Pass 2: consecutive on any day (relax used-day constraint)
                    for start in shuffled:
                        consecutive = get_consecutive_slots(start, block_size, self.teaching_cols, self._col_idx)
                        if consecutive and all(s in available_set for s in consecutive):
                            day = start[0]
                            for s in consecutive:
                                assignments.append((TimeSlot(s[0], s[1]), room))
                                available_set.discard(s)
                                if committed is not None:
                                    committed.add(s)
                            used_days.add(day)
                            placed = True
                            break
                # Multi-period blocks that still can't find consecutive slots remain
                # unassigned — never scatter them across non-consecutive slots.

        return assignments

    # =========================================================================
    # IMPROVEMENT 1: GREEDY CONSTRUCTIVE INITIALIZATION
    # =========================================================================

    def _create_chromosome_greedy(self) -> Chromosome:
        """
        Build a chromosome by placing lessons in order of most-constrained first
        (fewest available slots -> scheduled first), tracking committed slots
        within the chromosome so each new lesson avoids conflicts with
        already-placed ones.

        Result: initial chromosomes start with near-zero conflicts rather than
        hundreds, so the GA refines rather than recovers.
        """
        c = Chromosome()

        # Sort lessons: most constrained (fewest available slots) first
        sorted_lessons = sorted(
            self.lessons,
            key=lambda l: len(self._lesson_slots_cache[l.lesson_id])
        )

        # Per-entity committed slots for this chromosome build pass
        # key: "teacher:T001" / "student:1/1" / "room:C103"
        committed_per_entity: Dict[str, Set[Tuple[str, str]]] = defaultdict(set)

        for lesson in sorted_lessons:
            room = self._pick_room(lesson)

            # Fixed-period lessons (SUB_GROUP): timeslot is prescribed — only pick room
            if lesson.lesson_id in self._fixed_slots:
                slots = self._fixed_slots[lesson.lesson_id]
                c.genes[lesson.lesson_id] = [(TimeSlot(day, col), room) for day, col in slots]
                placed_slots = set(slots)
                for tid in lesson.teacher_ids:
                    committed_per_entity[f"teacher:{tid}"] |= placed_slots
                for cid in lesson.student_classes:
                    committed_per_entity[f"student:{cid}"] |= placed_slots
                if room != "NO_ROOM":
                    committed_per_entity[f"room:{room}"] |= placed_slots
                continue

            # Compute available slots intersected with entity-level committed slots
            base_available = set(self._lesson_slots_cache[lesson.lesson_id])

            # Remove slots already committed for this lesson's teachers/students
            local_committed: Set[Tuple[str, str]] = set()
            for tid in lesson.teacher_ids:
                local_committed |= committed_per_entity[f"teacher:{tid}"]
            for cid in lesson.student_classes:
                local_committed |= committed_per_entity[f"student:{cid}"]
            if room != "NO_ROOM":
                local_committed |= committed_per_entity[f"room:{room}"]

            # Slots free for this lesson within this chromosome
            lesson_free = list(base_available - local_committed)
            if not lesson_free:
                lesson_free = list(base_available) or list(self.all_slots)

            # A shared committed set so _assign_blocks can update it inline
            block_committed: Set[Tuple[str, str]] = set(local_committed)
            assignments = self._assign_blocks(lesson, lesson_free, room, committed=block_committed)

            # Register the newly committed slots back to each entity
            placed_slots = {(ts.day, ts.period_col) for ts, _ in assignments}
            for tid in lesson.teacher_ids:
                committed_per_entity[f"teacher:{tid}"] |= placed_slots
            for cid in lesson.student_classes:
                committed_per_entity[f"student:{cid}"] |= placed_slots
            if room != "NO_ROOM":
                committed_per_entity[f"room:{room}"] |= placed_slots

            c.genes[lesson.lesson_id] = assignments

        return c

    def _create_chromosome_random(self) -> Chromosome:
        """Original random initialization — used for diversity injection during restarts."""
        c = Chromosome()
        for lesson in self.lessons:
            room = self._pick_room(lesson)
            if lesson.lesson_id in self._fixed_slots:
                slots = self._fixed_slots[lesson.lesson_id]
                c.genes[lesson.lesson_id] = [(TimeSlot(day, col), room) for day, col in slots]
                continue
            available = self._lesson_slots_cache[lesson.lesson_id] or list(self.all_slots)
            c.genes[lesson.lesson_id] = self._assign_blocks(lesson, available, room)
        return c

    def initialize_population(self):
        """
        80% greedy chromosomes + 20% random for initial diversity.
        Greedy ones start near-feasible; random ones maintain exploration breadth.
        """
        print(f"  [GA] Initializing population of {self.population_size} "
              f"(80% greedy + 20% random)...")
        n_greedy = int(self.population_size * 0.8)
        n_random = self.population_size - n_greedy
        self.population = (
            [self._create_chromosome_greedy() for _ in range(n_greedy)] +
            [self._create_chromosome_random()  for _ in range(n_random)]
        )
        print(f"  [GA] Population initialized.")

    # =========================================================================
    # FITNESS EVALUATION
    # =========================================================================

    def evaluate_fitness(self, chromosome: Chromosome) -> float:
        violations: Dict[str, int] = defaultdict(int)

        # PERF-3: flat counters keyed by (entity_id, slot_key) — avoids nested defaultdict overhead
        teacher_slot: Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        student_slot: Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        room_slot:    Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)

        for lesson in self.lessons:
            lid = lesson.lesson_id
            assignments = chromosome.genes.get(lid, [])

            diff = abs(len(assignments) - self._expected_periods[lid])
            if diff:
                violations['period_count'] += diff

            for ts, room in assignments:
                slot_key = (ts.day, ts.period_col)
                for tid in lesson.teacher_ids:
                    teacher_slot[(tid, slot_key)] += 1
                for cid in lesson.student_classes:
                    student_slot[(cid, slot_key)] += 1
                if room:
                    room_slot[(room, slot_key)] += 1
                if room and self.room_list and room not in self.room_list:
                    violations['invalid_room'] += 1

        for count in teacher_slot.values():
            if count > 1:
                violations['teacher_conflict'] += count - 1

        for count in student_slot.values():
            if count > 1:
                violations['student_conflict'] += count - 1

        for count in room_slot.values():
            if count > 1:
                violations['room_conflict'] += count - 1

        # Block pattern check: each block must occupy consecutive same-day slots,
        # and the number of slots per day must match the corresponding block size.
        for lesson in self.lessons:
            lid = lesson.lesson_id
            assignments = chromosome.genes.get(lid, [])
            by_day: Dict[str, List[str]] = defaultdict(list)
            for ts, _ in assignments:
                by_day[ts.day].append(ts.period_col)

            # Sort both sides descending so the largest day-group matches the largest block
            block_sizes = sorted(self._block_sizes[lid], reverse=True)
            day_groups  = sorted(by_day.values(), key=len, reverse=True)

            # Number of occupied days must equal number of blocks
            if len(day_groups) != len(block_sizes):
                violations['block_violation'] += abs(len(day_groups) - len(block_sizes))

            for i, day_cols in enumerate(day_groups):
                expected_size = block_sizes[i] if i < len(block_sizes) else 0
                day_cols_sorted = sorted(day_cols, key=lambda c: self._col_idx.get(c, 999))

                # Slot count on this day must match the expected block size
                if len(day_cols_sorted) != expected_size:
                    violations['block_violation'] += abs(len(day_cols_sorted) - expected_size)

                # Slots within the day must be consecutive
                for j in range(len(day_cols_sorted) - 1):
                    i1 = self._col_idx.get(day_cols_sorted[j],     -1)
                    i2 = self._col_idx.get(day_cols_sorted[j + 1], -1)
                    if i1 < 0 or i2 < 0 or i2 - i1 != 1:
                        violations['block_violation'] += 1
                        break  # one gap violation per day is sufficient

        # SEPERATE_SLOT: lessons in the same group must NOT share any (day, period_col)
        for gid, lids in self._seperate_slot_groups.items():
            slot_count: Dict[Tuple[str, str], int] = defaultdict(int)
            for lid in lids:
                for ts, _ in chromosome.genes.get(lid, []):
                    slot_count[(ts.day, ts.period_col)] += 1
            for count in slot_count.values():
                if count > 1:
                    violations['seperate_slot'] += count - 1

        # SUB_GROUP: all lessons in the same group MUST share the same slot set
        # BUG-9: all-pairs comparison so no single lesson acts as a privileged reference
        for gid, lids in self._sub_group_groups.items():
            if len(lids) < 2:
                continue
            slot_sets = [
                frozenset((ts.day, ts.period_col) for ts, _ in chromosome.genes.get(lid, []))
                for lid in lids
            ]
            for i in range(len(slot_sets)):
                for j in range(i + 1, len(slot_sets)):
                    violations['sub_group'] += len(slot_sets[i].symmetric_difference(slot_sets[j]))

        fitness = (
            violations['teacher_conflict'] * self.PENALTY_TEACHER_CONFLICT +
            violations['student_conflict'] * self.PENALTY_STUDENT_CONFLICT +
            violations['room_conflict']    * self.PENALTY_ROOM_CONFLICT    +
            violations['block_violation']  * self.PENALTY_BLOCK_VIOLATION  +
            violations['period_count']     * self.PENALTY_PERIOD_COUNT     +
            violations['invalid_room']     * self.PENALTY_INVALID_ROOM     +
            violations['seperate_slot']    * self.PENALTY_SEPERATE_SLOT    +
            violations['sub_group']        * self.PENALTY_SUB_GROUP
        )
        chromosome.fitness = fitness
        chromosome.violations = dict(violations)
        return fitness

    # =========================================================================
    # IMPROVEMENT 2: TEACHER-GROUPED CROSSOVER
    # =========================================================================

    def _mix_blocks(
        self,
        gene1: List[Tuple[TimeSlot, str]],
        gene2: List[Tuple[TimeSlot, str]],
        lid: str,
    ) -> Tuple[List[Tuple[TimeSlot, str]], List[Tuple[TimeSlot, str]]]:
        """
        Block-level crossover for a single lesson.
        Splits both parent genes into logical blocks (by block_sizes, sorted desc)
        then flips a coin per block to decide which child inherits which block.
        The two children always get complementary blocks so no information is lost.
        """
        block_sizes = sorted(self._block_sizes.get(lid, [1]), reverse=True)

        def split(gene: List) -> List[List]:
            blocks, idx = [], 0
            for bs in block_sizes:
                blocks.append(gene[idx: idx + bs])
                idx += bs
            return blocks

        blocks1 = split(gene1)
        blocks2 = split(gene2)

        child1: List[Tuple[TimeSlot, str]] = []
        child2: List[Tuple[TimeSlot, str]] = []
        for b1, b2 in zip(blocks1, blocks2):
            if random.random() < 0.5:
                child1.extend(b1)
                child2.extend(b2)
            else:
                child1.extend(b2)
                child2.extend(b1)
        return child1, child2

    def _crossover(self, p1: Chromosome, p2: Chromosome) -> Tuple[Chromosome, Chromosome]:
        """
        Teacher-grouped crossover: for each teacher group, take ALL of that
        teacher's lessons from either p1 or p2 (decided once per group, not
        per lesson). This preserves the teacher's internal schedule integrity
        so children don't inherit impossible teacher conflicts from the
        combination.

        Lessons without a teacher are crossed over individually (uniform).
        """
        if random.random() > self.crossover_rate:
            return p1.copy(), p2.copy()

        c1, c2 = Chromosome(), Chromosome()

        # Track which lesson_ids have been assigned (a lesson may appear in
        # multiple teacher groups if team-taught — first assignment wins)
        assigned_c1: Set[str] = set()
        assigned_c2: Set[str] = set()

        for tid, lids in self._teacher_groups.items():
            # One coin flip decides the default donor parent for this teacher group
            if random.random() < 0.5:
                src_c1, src_c2 = p1, p2
            else:
                src_c1, src_c2 = p2, p1

            for lid in lids:
                need_c1 = lid not in assigned_c1
                need_c2 = lid not in assigned_c2
                if not need_c1 and not need_c2:
                    continue

                if random.random() < self.block_crossover_rate:
                    # Block-level: flip a coin per block — finer-grained than whole-lesson swap
                    gene_c1, gene_c2 = self._mix_blocks(
                        p1.genes.get(lid, []), p2.genes.get(lid, []), lid
                    )
                else:
                    gene_c1 = list(src_c1.genes.get(lid, []))
                    gene_c2 = list(src_c2.genes.get(lid, []))

                if need_c1:
                    c1.genes[lid] = gene_c1
                    assigned_c1.add(lid)
                if need_c2:
                    c2.genes[lid] = gene_c2
                    assigned_c2.add(lid)

        # Lessons without a teacher — uniform crossover with optional block-level mixing
        # BUG-2 FIX: check c1 and c2 independently so neither child loses genes
        for lid in self._no_teacher_lids:
            need_c1 = lid not in assigned_c1
            need_c2 = lid not in assigned_c2
            if not need_c1 and not need_c2:
                continue

            if random.random() < self.block_crossover_rate:
                gene_c1, gene_c2 = self._mix_blocks(
                    p1.genes.get(lid, []), p2.genes.get(lid, []), lid
                )
            else:
                take_from_p1 = random.random() < 0.5
                gene_c1 = list((p1 if take_from_p1 else p2).genes.get(lid, []))
                gene_c2 = list((p2 if take_from_p1 else p1).genes.get(lid, []))

            if need_c1:
                c1.genes[lid] = gene_c1
                assigned_c1.add(lid)
            if need_c2:
                c2.genes[lid] = gene_c2
                assigned_c2.add(lid)

        return c1, c2

    # =========================================================================
    # IMPROVEMENT 3: TARGETED SINGLE-BLOCK MUTATION
    # =========================================================================

    def _find_conflicted_slots(self, chromosome: Chromosome) -> Dict[str, Set[Tuple[str, str]]]:
        """
        Return a dict mapping lesson_id -> set of (day, period_col) slots
        that are currently in a conflict (teacher, student, or room clash).
        Used by targeted mutation to know exactly which slots to move.
        """
        teacher_usage: Dict[str, Dict[Tuple[str, str], List[str]]] = defaultdict(lambda: defaultdict(list))
        student_usage: Dict[str, Dict[Tuple[str, str], List[str]]] = defaultdict(lambda: defaultdict(list))
        room_usage:    Dict[str, Dict[Tuple[str, str], List[str]]] = defaultdict(lambda: defaultdict(list))

        for lesson in self.lessons:
            for ts, room in chromosome.genes.get(lesson.lesson_id, []):
                sk = (ts.day, ts.period_col)
                for tid in lesson.teacher_ids:
                    teacher_usage[tid][sk].append(lesson.lesson_id)
                for cid in lesson.student_classes:
                    student_usage[cid][sk].append(lesson.lesson_id)
                if room:
                    room_usage[room][sk].append(lesson.lesson_id)

        conflicted: Dict[str, Set[Tuple[str, str]]] = defaultdict(set)

        for usage in (teacher_usage, student_usage, room_usage):
            for _entity, slots in usage.items():
                for sk, lids in slots.items():
                    if len(lids) > 1:
                        for lid in lids:
                            conflicted[lid].add(sk)

        return conflicted

    def _mutate(self, chromosome: Chromosome):
        """
        Three mutation operators applied per lesson with probability mutation_rate:

        1. targeted_block (60%): Find a conflicted slot for this lesson and
           replace only THAT block with a new non-conflicting placement.
           If no conflict exists, skip — don't disturb a working gene.

        2. room (25%): Change the room assignment for all blocks of a lesson.

        3. full_slot (15%): Full random re-assignment (same as original baseline).
           Kept as a low-probability escape from local optima.
        """
        # PERF-2: Lazy — compute conflict map only when a targeted_block mutation actually fires
        conflicted_slots: Optional[Dict[str, Set[Tuple[str, str]]]] = None

        for lesson in self.lessons:
            if random.random() > self.mutation_rate:
                continue

            lid = lesson.lesson_id

            # Fixed-period lessons: timeslot is locked — only room may change
            if lid in self._fixed_slots:
                new_room = self._pick_room(lesson)
                if lid in chromosome.genes:
                    chromosome.genes[lid] = [(ts, new_room) for ts, _ in chromosome.genes[lid]]
                continue

            mutation_type = random.choices(
                ['targeted_block', 'room', 'full_slot', 'explore'],
                weights=[0.50, 0.20, 0.10, 0.20]
            )[0]

            # ── targeted_block ───────────────────────────────────────────────
            if mutation_type == 'targeted_block':
                if conflicted_slots is None:
                    conflicted_slots = self._find_conflicted_slots(chromosome)
                bad_slots = conflicted_slots.get(lid, set())
                if not bad_slots:
                    continue  # lesson is fine — don't touch it

                current = chromosome.genes.get(lid, [])
                if not current:
                    continue

                # Find index of one conflicted block to replace
                bad_indices = [
                    i for i, (ts, _) in enumerate(current)
                    if (ts.day, ts.period_col) in bad_slots
                ]
                if not bad_indices:
                    continue
                replace_idx = random.choice(bad_indices)

                # Determine the block size at that index by checking which
                # logical block it belongs to.
                # Use the same descending sort as _assign_blocks so indices align.
                block_sizes = sorted(self._block_sizes[lid], reverse=True)
                block_of_idx = []
                for bi, bs in enumerate(block_sizes):
                    block_of_idx.extend([bi] * bs)
                if replace_idx >= len(block_of_idx):
                    continue
                target_block = block_of_idx[replace_idx]
                target_block_size = block_sizes[target_block]

                # Slots currently used by OTHER blocks of this lesson (keep them)
                kept_slots = {
                    (ts.day, ts.period_col)
                    for i, (ts, _) in enumerate(current)
                    if block_of_idx[i] != target_block
                }

                # Find a new consecutive run for the target block
                available = [
                    s for s in (self._lesson_slots_cache[lid] or list(self.all_slots))
                    if s not in kept_slots and s not in bad_slots
                ]
                random.shuffle(available)
                available_set = set(available)

                used_days_kept = {ts.day for i, (ts, _) in enumerate(current)
                                  if block_of_idx[i] != target_block}

                new_slots: Optional[List[Tuple[str, str]]] = None
                for start in available:
                    day, _ = start
                    if day in used_days_kept:
                        continue
                    consecutive = get_consecutive_slots(
                        start, target_block_size, self.teaching_cols, self._col_idx
                    )
                    if consecutive and all(s in available_set for s in consecutive):
                        new_slots = consecutive
                        break

                if new_slots is None:
                    continue  # couldn't find a better placement — leave gene intact

                # Reconstruct gene: replace just the target block's slots
                room = current[0][1] if current else self._pick_room(lesson)
                new_gene: List[Tuple[TimeSlot, str]] = []
                new_block_iter = iter(new_slots)
                for i, (ts, rm) in enumerate(current):
                    if block_of_idx[i] == target_block:
                        try:
                            s = next(new_block_iter)
                            new_gene.append((TimeSlot(s[0], s[1]), room))
                        except StopIteration:
                            new_gene.append((ts, rm))
                    else:
                        new_gene.append((ts, rm))
                chromosome.genes[lid] = new_gene

            # ── room ─────────────────────────────────────────────────────────
            elif mutation_type == 'room':
                new_room = self._pick_room(lesson)
                if lid in chromosome.genes:
                    chromosome.genes[lid] = [
                        (ts, new_room) for ts, _ in chromosome.genes[lid]
                    ]

            # ── full_slot ────────────────────────────────────────────────────
            elif mutation_type == 'full_slot':
                available = self._lesson_slots_cache[lid] or list(self.all_slots)
                existing = chromosome.genes.get(lid, [])
                room = existing[0][1] if existing else self._pick_room(lesson)
                chromosome.genes[lid] = self._assign_blocks(lesson, available, room)

    # =========================================================================
    # IMPROVEMENT 4: LOWER TOURNAMENT SIZE (set at __init__ default = 3)
    # =========================================================================

    def _tournament_select(self) -> Chromosome:
        contestants = random.sample(
            self.population, min(self.tournament_size, len(self.population))
        )
        return min(contestants, key=lambda c: c.fitness)

    # =========================================================================
    # IMPROVEMENT 5: STAGNATION RESTART-WITH-MEMORY
    # =========================================================================

    def _restart_bottom_half(self):
        """
        Replace the bottom 50% of the population with fresh greedy chromosomes.
        The top 50% (including best known solution) are kept intact.
        This injects diversity without losing the best solutions found so far.
        """
        self.population.sort(key=lambda c: c.fitness)
        keep = self.population[:self.population_size // 2]

        # GA-2: 50% greedy + 50% random for diversity
        n_fresh  = self.population_size // 2
        n_greedy = n_fresh // 2
        n_random = n_fresh - n_greedy
        print(f"  [GA] ⟳ Stagnation restart — reseeding bottom {n_fresh} "
              f"({n_greedy} greedy + {n_random} random)...")
        fresh = (
            [self._create_chromosome_greedy() for _ in range(n_greedy)] +
            [self._create_chromosome_random()  for _ in range(n_random)]
        )
        for c in fresh:
            self.evaluate_fitness(c)

        self.population = keep + fresh
        self._gens_without_improvement = 0

    # =========================================================================
    # ISLAND GA HELPER — evolve for a fixed number of generations
    # =========================================================================

    def evolve_n_generations(self, n_generations: int, verbose: bool = False) -> None:
        """
        Run the inner GA loop for exactly n_generations.
        Population must already be initialized and evaluated before calling.
        Used by IslandGeneticAlgorithm to evolve each island between migrations.
        """
        for _ in range(n_generations):
            self._current_generation += 1

            self.population.sort(key=lambda c: c.fitness)
            new_pop: List[Chromosome] = [c.copy() for c in self.population[:self.elite_size]]

            while len(new_pop) < self.population_size:
                p1 = self._tournament_select()
                p2 = self._tournament_select()
                retries = 0
                while p2 is p1 and retries < 5:
                    p2 = self._tournament_select()
                    retries += 1
                c1, c2 = self._crossover(p1, p2)
                self._mutate(c1)
                self._mutate(c2)
                self.evaluate_fitness(c1)
                self.evaluate_fitness(c2)
                new_pop.extend([c1, c2])

            self.population = new_pop[:self.population_size]

            gen_best = min(self.population, key=lambda c: c.fitness)
            if gen_best.fitness < self.best_chromosome.fitness:
                self.best_chromosome = gen_best.copy()
                self._gens_without_improvement = 0
            else:
                self._gens_without_improvement += 1

            if self._gens_without_improvement >= self.stagnation_limit:
                self._restart_bottom_half()

            avg_fitness = sum(c.fitness for c in self.population) / len(self.population)
            stat = {
                'generation': self._current_generation,
                'best_fitness': self.best_chromosome.fitness,
                'avg_fitness': avg_fitness,
                'violations': self.best_chromosome.violations,
                'stagnation': self._gens_without_improvement,
            }
            self.generation_stats.append(stat)

            if self.progress_callback:
                self.progress_callback(self._current_generation, self.max_generations, stat)

            if verbose and (self._current_generation % 10 == 0 or self.best_chromosome.fitness == 0):
                print(f"  Gen {self._current_generation:>4d} | Best: {self.best_chromosome.fitness:.0f} | "
                      f"Avg: {avg_fitness:.0f} | Stag: {self._gens_without_improvement:>3d}")

            if self.best_chromosome.fitness == 0:
                break

    # =========================================================================
    # EVOLUTION LOOP
    # =========================================================================

    def evolve(self) -> Chromosome:
        print("\n" + "=" * 60)
        print("  GENETIC ALGORITHM EVOLUTION STARTING")
        print("=" * 60)
        print(f"  Lessons      : {len(self.lessons)}")
        print(f"  Population   : {self.population_size}")
        print(f"  Generations  : {self.max_generations}")
        print(f"  Mutation     : {self.mutation_rate}")
        print(f"  Crossover    : {self.crossover_rate}")
        print(f"  Tournament   : {self.tournament_size}")
        print(f"  Stagnation   : restart after {self.stagnation_limit} gens")
        print(f"  Window stop  : stop when improvement over last {self.window_size} gens < {self.min_improvement:.0f}")
        print("=" * 60 + "\n")

        self.initialize_population()

        for c in self.population:
            self.evaluate_fitness(c)

        self.best_chromosome = min(self.population, key=lambda c: c.fitness).copy()
        print(f"  Initial best fitness : {self.best_chromosome.fitness}")
        print(f"  Initial violations   : {self.best_chromosome.violations}\n")

        generations_run = 0

        for gen in range(self.max_generations):
            generations_run = gen + 1
            self.population.sort(key=lambda c: c.fitness)

            # Elitism: carry forward best chromosomes unchanged
            new_pop: List[Chromosome] = [c.copy() for c in self.population[:self.elite_size]]

            # Breed offspring
            while len(new_pop) < self.population_size:
                p1 = self._tournament_select()
                p2 = self._tournament_select()
                # GA-1: avoid crossing a chromosome with itself
                retries = 0
                while p2 is p1 and retries < 5:
                    p2 = self._tournament_select()
                    retries += 1
                c1, c2 = self._crossover(p1, p2)
                self._mutate(c1)
                self._mutate(c2)
                self.evaluate_fitness(c1)
                self.evaluate_fitness(c2)
                new_pop.extend([c1, c2])

            self.population = new_pop[:self.population_size]

            # Track best & stagnation counter
            gen_best = min(self.population, key=lambda c: c.fitness)
            improvement = self.best_chromosome.fitness - gen_best.fitness
            if improvement > 0:
                self.best_chromosome = gen_best.copy()
                self._gens_without_improvement = 0
            else:
                self._gens_without_improvement += 1

            # Stagnation restart
            if self._gens_without_improvement >= self.stagnation_limit:
                self._restart_bottom_half()

            # Sliding-window stop: stop when total improvement over the last
            # window_size generations is less than min_improvement.
            self._fitness_window.append(self.best_chromosome.fitness)
            if (len(self._fitness_window) == self.window_size and
                    self._fitness_window[0] - self.best_chromosome.fitness < self.min_improvement):
                self._stopped_early = True
                print(f"\n  ⏹  Window stop at gen {gen}: improvement over last {self.window_size} gens "
                      f"({self._fitness_window[0]:.0f} → {self.best_chromosome.fitness:.0f}) "
                      f"< {self.min_improvement:.0f}")
                break

            # Stats
            avg_fitness = sum(c.fitness for c in self.population) / len(self.population)
            stat = {
                'generation':        gen,
                'best_fitness':      self.best_chromosome.fitness,
                'avg_fitness':       avg_fitness,
                'violations':        self.best_chromosome.violations,
                'stagnation':        self._gens_without_improvement,
                'global_stagnation': self._global_stagnation,
            }
            self.generation_stats.append(stat)

            if self.progress_callback:
                self.progress_callback(gen, self.max_generations, stat)

            if gen % 10 == 0 or self.best_chromosome.fitness == 0:
                print(f"  Gen {gen:>4d} | Best: {self.best_chromosome.fitness:.0f} | "
                      f"Avg: {avg_fitness:.0f} | "
                      f"Stag: {self._gens_without_improvement:>3d} | "
                      f"Violations: {self.best_chromosome.violations}")

            if self.best_chromosome.fitness == 0:
                print(f"\n  ✅ Perfect solution found at generation {gen}!")
                break

        print("\n" + "=" * 60)
        print("  EVOLUTION COMPLETE")
        print(f"  Final fitness    : {self.best_chromosome.fitness}")
        print(f"  Generations run  : {generations_run}")
        print(f"  Final violations : {self.best_chromosome.violations}")

        # Unassigned slot detail
        unassigned = []
        for lesson in self.lessons:
            assigned = len(self.best_chromosome.genes.get(lesson.lesson_id, []))
            expected = self._expected_periods[lesson.lesson_id]
            if assigned < expected:
                unassigned.append((lesson, assigned, expected))

        if unassigned:
            print(f"\n  Unassigned slots ({len(unassigned)} lessons):")
            for lesson, assigned, expected in unassigned:
                print(f"    {lesson.lesson_id} | {lesson.subject_id} | {lesson.subject_name} | "
                      f"classes={lesson.student_classes} | "
                      f"assigned={assigned}/{expected} | missing={expected - assigned}")
        else:
            print("\n  All lessons fully assigned.")
        print("=" * 60 + "\n")

        return self.best_chromosome

    # =========================================================================
    # APPLY SOLUTION BACK TO SCHEDULE MANAGER
    # =========================================================================

    def apply_solution(self):
        """
        Write the best chromosome back into ScheduleManager via place_slot().
        Pre-placed slots are never overwritten (place_slot handles conflict detection).
        All teachers in a team-taught lesson are placed individually.
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
                room_id = room if room and room != "NO_ROOM" else None

                # Place for each student class
                for class_id in lesson.student_classes:
                    # Primary teacher (with class_id so student grid is updated)
                    primary_tid = lesson.teacher_ids[0] if lesson.teacher_ids else None
                    result = self.manager.place_slot(
                        day=ts.day,
                        period_col=ts.period_col,
                        subject_id=lesson.subject_id,
                        teacher_id=primary_tid,
                        room_id=room_id,
                        class_id=class_id,
                        reason='ga',
                    )
                    if result.startswith("SUCCESS"):
                        success_count += 1
                    else:
                        conflict_count += 1

                # Extra teachers (team teaching) — update their grids without
                # double-writing student or room grids
                for extra_tid in lesson.teacher_ids[1:]:
                    result = self.manager.place_slot(
                        day=ts.day,
                        period_col=ts.period_col,
                        subject_id=lesson.subject_id,
                        teacher_id=extra_tid,
                        room_id=None,   # room already written by primary
                        class_id=None,  # student already written by primary
                        reason='ga',
                    )
                    if result.startswith("SUCCESS"):
                        success_count += 1
                    else:
                        conflict_count += 1

        print(f"  [GA] Applied {success_count} slots successfully.")
        print(f"  [GA] Skipped {conflict_count} slots due to conflicts.")

    # =========================================================================
    # RESULT SUMMARY
    # =========================================================================

    def get_result_summary(self) -> Dict[str, Any]:
        if not self.best_chromosome:
            return {}
        return {
            'final_fitness':     self.best_chromosome.fitness,
            'generations_run':   len(self.generation_stats),
            'solution_found':    self.best_chromosome.fitness == 0,
            'stopped_early':     self._stopped_early,
            'final_violations':  self.best_chromosome.violations,
            'lessons_scheduled': len(self.lessons),
        }
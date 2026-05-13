"""
================================================================================
GA SCHEDULER - Genetic Algorithm Core
================================================================================

Handles the execution of the main evolutionary process.
"""

import random
from collections import defaultdict, deque
from time import perf_counter
from typing import Dict, List, Tuple, Set, Optional, Any, Callable

from .analytics import AnalyticsCollector

from src.preschedule.scheduleManager import ScheduleManager

from .models import (
    Lesson,
    TimeSlot,
    Chromosome,
    WEEKDAYS
)

from .data_loader import (
    GAContext,
    _parse_block_pattern,
    get_teaching_period_cols,
    build_lessons_from_manager,
    build_free_slots_per_entity,
    build_room_type_data,
    get_lesson_available_slots,
    get_consecutive_slots,
    build_blocked_keywords,
)
from .models import BLOCKED_CELL_KEYWORDS
from src.constants import NO_ROOM

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

    PENALTY_TEACHER_CONFLICT    = 100
    PENALTY_STUDENT_CONFLICT    = 100
    PENALTY_ROOM_CONFLICT       = 100
    PENALTY_BLOCK_VIOLATION     = 100  # raised: non-consecutive blocks are a hard structural constraint
    PENALTY_PERIOD_COUNT        = 125  # lowered: less dominant early, still > any single violation
    PENALTY_SEPERATE_SLOT       = 100  # two lessons in same SEPERATE_SLOT group share a slot
    PENALTY_SUB_GROUP           = 100  # lessons in same SUB_GROUP group are NOT at the same slot
    PENALTY_HOMEROOM_VIOLATION  = 100  # lesson placed in a homeroom belonging to another class
    PENALTY_SPECIALIST_ROOM     = 50   # soft preference, not a hard constraint
    PENALTY_PREFERRED_ROOM_MISS = 30   # soft: lesson has preferred_tag but placed in general/wrong room
    PENALTY_DAY_DISTRIBUTION    = 25   # soft: teacher overloaded on one day (> DAY_LOAD_THRESHOLD periods)
    DAY_LOAD_THRESHOLD          = 5    # periods per day per teacher before penalty kicks in

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
        analytics: Optional[AnalyticsCollector] = None,
        island_idx: int = 0,
        context: Optional[GAContext] = None,
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
        self.analytics = analytics
        self.island_idx = island_idx

        if context is not None:
            # ── Shared context path: reuse pre-built data, skip N-fold redundant builds ──
            BLOCKED_CELL_KEYWORDS[:] = context.blocked_keywords
            print(f"  [GA] Blocked keywords   : {BLOCKED_CELL_KEYWORDS}")
            self.teaching_cols = context.teaching_cols
            self.all_slots     = context.all_slots
            self.lessons       = context.lessons
            self.free_slots    = context.free_slots
            self._col_idx      = context.col_idx
            self._block_sizes  = context.block_sizes
        else:
            # ── Standalone path: build all data independently ──────────────────
            BLOCKED_CELL_KEYWORDS[:] = build_blocked_keywords(schedule_manager)
            print(f"  [GA] Blocked keywords   : {BLOCKED_CELL_KEYWORDS}")
            self.teaching_cols: List[str] = get_teaching_period_cols(schedule_manager)
            self.all_slots: Set[Tuple[str, str]] = {
                (day, pc) for day in WEEKDAYS for pc in self.teaching_cols
            }
            self.lessons: List[Lesson] = build_lessons_from_manager(schedule_manager)
            self.free_slots: Dict[str, Set[Tuple[str, str]]] = build_free_slots_per_entity(
                schedule_manager, self.teaching_cols
            )
            self._col_idx: Dict[str, int] = {col: i for i, col in enumerate(self.teaching_cols)}
            self._block_sizes: Dict[str, List[int]] = {
                l.lesson_id: _parse_block_pattern(l.block_pattern) for l in self.lessons
            }

        self.lesson_map: Dict[str, Lesson] = {l.lesson_id: l for l in self.lessons}

        # Room type data — not in context; depends on room sheet specifics per-island
        (
            self.homeroom_map,           # class_id  -> room_id
            self.homeroom_room_to_class, # room_id   -> class_id
            self._general_rooms,         # free pool
            self._specialist_rooms,      # exclusive pool (curriculum.room only)
            self._tag_to_rooms,          # tag -> [room_id] (exclude tag omitted)
        ) = build_room_type_data(schedule_manager)

        self.room_list: List[str] = self._get_room_list()

        # ── Speed caches ───────────────────────────────────────────────────────
        # Pre-parsed block sizes per lesson (already set above via context or standalone)
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

        # ── Diagnostic counters (reset each epoch by IslandGA) ─────────────
        self._mutation_stats: Dict[str, int] = defaultdict(int)
        self._restart_count: int = 0

        print(f"  [GA] Teaching columns : {len(self.teaching_cols)}")
        print(f"  [GA] Lessons to place : {len(self.lessons)}")
        print(f"  [GA] Teacher groups   : {len(self._teacher_groups)}")

        # Warn about zero-slot lessons — structurally unplaceable due to overcrowded preschedule.
        zero_slot = [l for l in self.lessons if not self._lesson_slots_cache[l.lesson_id]]
        if zero_slot:
            print(f"  [GA] WARNING: {len(zero_slot)} lesson(s) have zero available slots "
                  f"(preschedule filled all entity slots) — will force-place with conflicts:")
            for l in zero_slot:
                print(f"       {l.lesson_id} {l.subject_id}/{','.join(l.student_classes)} "
                      f"teachers={l.teacher_ids} ppw={l.periods_per_week}")

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _get_room_list(self) -> List[str]:
        # General rooms only — homeroom and specialist rooms excluded from free pool.
        # Falls back to all room_grids if room type data is unavailable.
        if self._general_rooms:
            return list(self._general_rooms)
        df_room = self.manager.get_sheet_data('room')
        if df_room is not None and 'room_id' in df_room.columns:
            return [str(r).strip() for r in df_room['room_id'].unique() if str(r).strip()]
        return list(self.manager.room_grids.keys())

    def _pick_room(self, lesson: Lesson) -> str:
        # 1. Hard: curriculum specifies required room(s) by id/name — must use.
        if lesson.required_rooms:
            return random.choice(lesson.required_rooms)
        # 2. Single-class lesson — prefer the class's designated homeroom.
        if len(lesson.student_classes) == 1:
            hr = self.homeroom_map.get(lesson.student_classes[0])
            if hr:
                return hr
        # 3. Soft: curriculum specifies preferred tag(s).
        #    Pool = tagged rooms + general rooms so the GA can explore both.
        #    Tagged rooms get 2× weight to bias toward the preference while
        #    still allowing general rooms to be picked.
        if lesson.preferred_tags:
            lesson_class_set = set(lesson.student_classes)
            tagged: List[str] = []
            for tag in lesson.preferred_tags:
                for rid in self._tag_to_rooms.get(tag, []):
                    owner = self.homeroom_room_to_class.get(rid)
                    if owner is None or owner in lesson_class_set:
                        tagged.append(rid)
            # Union of tagged (2× weight) + general rooms
            pool = tagged + tagged + self.room_list
            if pool:
                return random.choice(pool)
        # 4. General pool.
        if self.room_list:
            return random.choice(self.room_list)
        return NO_ROOM

    def _pick_room_aware(
        self,
        lesson: Lesson,
        busy_slots: Set[Tuple[str, str]],
        occ: Dict[Tuple[str, str], Set[str]],
    ) -> str:
        """
        Conflict-aware room pick (Options A & B).
        Same priority as _pick_room but filters to conflict-free rooms first;
        falls back to least-conflicted if every candidate is busy.
        """
        def is_free(room: str) -> bool:
            return not any(room in occ.get(s, set()) for s in busy_slots)

        def least_conflicted(pool: List[str]) -> str:
            return min(pool, key=lambda r: sum(1 for s in busy_slots if r in occ.get(s, set())))

        # 1. Required rooms: pick free one; fall back to least-conflicted
        if lesson.required_rooms:
            free = [r for r in lesson.required_rooms if is_free(r)]
            return random.choice(free) if free else least_conflicted(lesson.required_rooms)

        # 2. Homeroom: use if free; else fall through to tagged/general
        if len(lesson.student_classes) == 1:
            hr = self.homeroom_map.get(lesson.student_classes[0])
            if hr and is_free(hr):
                return hr

        # 3. Tagged rooms (2× weight) + general; prefer free
        if lesson.preferred_tags:
            lesson_class_set = set(lesson.student_classes)
            tagged: List[str] = []
            for tag in lesson.preferred_tags:
                for rid in self._tag_to_rooms.get(tag, []):
                    owner = self.homeroom_room_to_class.get(rid)
                    if owner is None or owner in lesson_class_set:
                        tagged.append(rid)
            free_tagged   = [r for r in tagged          if is_free(r)]
            free_general  = [r for r in self.room_list  if is_free(r)]
            pool = free_tagged + free_general
            if pool:
                return random.choice(pool)
            full = tagged + self.room_list
            return least_conflicted(full) if full else NO_ROOM

        # 4. General pool
        free_general = [r for r in self.room_list if is_free(r)]
        if free_general:
            return random.choice(free_general)
        if self.room_list:
            return least_conflicted(self.room_list)
        return NO_ROOM

    def _repair_rooms(self, chromosome: Chromosome, max_passes: int = 3) -> None:
        """
        Post-init/post-mutation room conflict repair.

        Runs up to max_passes times so that conflicts introduced by earlier
        reassignments in the same pass are caught and resolved in subsequent
        passes.  A single pass can leave residual conflicts when many lessons
        compete for the same slots and the fallback "least_conflicted" room is
        still busy — a second pass almost always clears those.

        Uses a Counter-based occupancy dict (room → count per slot) so that
        decrementing one lesson's room does not make it look free when another
        lesson still occupies the same slot with the same room.
        """
        for _pass in range(max_passes):
            # Counter-based occupancy: slot → {room: count}
            occ: Dict[Tuple[str, str], Dict[str, int]] = defaultdict(lambda: defaultdict(int))
            for lid, assignments in chromosome.genes.items():
                for ts, room in assignments:
                    if room and room != NO_ROOM:
                        occ[(ts.day, ts.period_col)][room] += 1

            # Build slot+room → [lesson_ids] index
            slot_room_lids: Dict[Tuple, Dict[str, List[str]]] = defaultdict(lambda: defaultdict(list))
            for lid, assignments in chromosome.genes.items():
                for ts, room in assignments:
                    slot_room_lids[(ts.day, ts.period_col)][room].append(lid)

            # Collect losers: required_rooms lessons become winners (sorted first)
            # so regular lessons are always the ones reassigned when they share a room.
            conflict_count: Dict[str, int] = defaultdict(int)
            for slot, room_map in slot_room_lids.items():
                for room, lids in room_map.items():
                    if len(lids) <= 1:
                        continue
                    # Put required_rooms lessons first (key=0) so they are the winners.
                    sorted_lids = sorted(
                        lids,
                        key=lambda l: 0 if (self.lesson_map.get(l) and self.lesson_map[l].required_rooms) else 1,
                    )
                    for lid in sorted_lids[1:]:
                        conflict_count[lid] += 1

            if not conflict_count:
                break  # No conflicts — done early

            # Process most-conflicted losers first for better repair quality
            for lid in sorted(conflict_count, key=lambda x: -conflict_count[x]):
                lesson = self.lesson_map.get(lid)
                if lesson is None or lesson.required_rooms:
                    continue
                assignments = chromosome.genes.get(lid, [])
                if not assignments:
                    continue

                busy_slots   = {(ts.day, ts.period_col) for ts, _ in assignments}
                current_room = assignments[0][1]

                # Decrement counter for current room (winner's count remains; only ours drops).
                for s in busy_slots:
                    cnt = occ[s]
                    cnt[current_room] -= 1
                    if cnt[current_room] <= 0:
                        del cnt[current_room]

                new_room = self._pick_room_aware(lesson, busy_slots, occ)
                chromosome.genes[lid] = [(ts, new_room) for ts, _ in assignments]

                # Increment counter for new room
                for s in busy_slots:
                    if new_room and new_room != NO_ROOM:
                        occ[s][new_room] += 1

    def _normalize_gene_room(self, lid: str, gene: List[Tuple[TimeSlot, str]]) -> List[Tuple[TimeSlot, str]]:
        """
        Ensure all periods of a lesson use a consistent room after block-level crossover.
        Inherits the first valid room already present in the gene rather than re-randomizing
        via _pick_room — avoids introducing fresh room assignments that _repair_rooms must
        then fix every generation, reducing crossover-induced room conflict churn.
        Required-room lessons always re-pick from required_rooms (hard constraint).
        """
        if not gene:
            return gene
        lesson = self.lesson_map.get(lid)
        if not lesson:
            return gene
        if lesson.required_rooms:
            room = random.choice(lesson.required_rooms)
        else:
            # Use the first valid room already in the gene (from whichever parent
            # contributed that block); only fall back to _pick_room if gene has no room.
            room = next((r for _, r in gene if r and r != NO_ROOM), None)
            if room is None:
                room = self._pick_room(lesson)
        return [(ts, room) for ts, _ in gene]

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

    def _create_chromosome_greedy(self, pure: bool = False) -> Chromosome:
        """
        Build a chromosome using a greedy conflict-aware constructor.
        Each call uses a different random lesson ordering so the 60% greedy
        chromosomes in the initial population are diverse rather than near-copies.

        pure=True: strict most-constrained-first (used for the single seed
                   chromosome to guarantee one high-quality starting point).
        pure=False (default): random order with a constraint-level bias —
                   highly constrained lessons still tend to go first but the
                   exact sequence differs every call.
        """
        c = Chromosome()

        if pure:
            sorted_lessons = sorted(
                self.lessons,
                key=lambda l: len(self._lesson_slots_cache[l.lesson_id])
            )
        else:
            # Random ordering biased toward most-constrained first.
            # Noise range ≈ 25% of the slot-count spread so constrained lessons
            # still tend to be placed early but ordering varies each call.
            slot_counts = [len(self._lesson_slots_cache[l.lesson_id]) for l in self.lessons]
            spread = max(slot_counts) - min(slot_counts) if slot_counts else 1
            noise = max(1, spread * 0.25)
            sorted_lessons = sorted(
                self.lessons,
                key=lambda l: len(self._lesson_slots_cache[l.lesson_id]) + random.uniform(0, noise)
            )

        # Per-entity committed slots for this chromosome build pass
        # key: "teacher:T001" / "student:1/1" / "room:C103"
        committed_per_entity: Dict[str, Set[Tuple[str, str]]] = defaultdict(set)
        force_placed_lids: Set[str] = set()  # lessons placed with conflicts (pure=True only)

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
                if room != NO_ROOM:
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
            if room != NO_ROOM:
                local_committed |= committed_per_entity[f"room:{room}"]
            # Virtual tagged-room tracking: treat the preferred specialist room as a
            # shared resource even when this lesson ends up in a general room.
            # This spreads all preferred_tags lessons across distinct time slots during
            # init, preventing multiple same-tag lessons from stacking at the same
            # time and competing for the single tagged room.
            if lesson.preferred_tags:
                for _tag in lesson.preferred_tags:
                    for _rid in self._tag_to_rooms.get(_tag, []):
                        local_committed |= committed_per_entity[f"room:{_rid}"]

            lesson_free = list(base_available - local_committed)

            if not lesson_free and lesson.preferred_tags:
                # Virtual tagged-room tracking emptied lesson_free. The tagged room
                # may be "virtually full" but the actual rooms (general + tagged) at
                # those slots may still be available. Relax by dropping the virtual
                # constraint while keeping teacher/student/actual-room constraints —
                # this avoids cascading teacher/student conflicts that _repair_rooms
                # cannot fix, while still producing a reasonable placement.
                local_committed_staged: Set[Tuple[str, str]] = set()
                for _tid in lesson.teacher_ids:
                    local_committed_staged |= committed_per_entity[f"teacher:{_tid}"]
                for _cid in lesson.student_classes:
                    local_committed_staged |= committed_per_entity[f"student:{_cid}"]
                if room != NO_ROOM:
                    local_committed_staged |= committed_per_entity[f"room:{room}"]
                lesson_free = list(base_available - local_committed_staged)

            if lesson_free:
                # Happy path: conflict-free slots exist within this chromosome.
                block_committed: Set[Tuple[str, str]] = set(local_committed)
                assignments = self._assign_blocks(lesson, lesson_free, room, committed=block_committed)
            else:
                # All preschedule-free slots for this lesson are already taken by
                # other lessons placed earlier in this chromosome.  Force-place by
                # ignoring chromosome-level committed slots — this will generate a
                # conflict that the fitness function penalises, but a placed lesson
                # with a conflict (penalty ≤ 150) is cheaper than an unplaced
                # lesson (ppw × PENALTY_PERIOD_COUNT = ppw × 150).
                # committed=None tells _assign_blocks not to subtract anything.
                fallback = list(base_available) or list(self.all_slots)
                assignments = self._assign_blocks(lesson, fallback, room, committed=None)
                if pure:
                    force_placed_lids.add(lesson.lesson_id)

            # Register the newly committed slots back to each entity
            placed_slots = {(ts.day, ts.period_col) for ts, _ in assignments}
            for tid in lesson.teacher_ids:
                committed_per_entity[f"teacher:{tid}"] |= placed_slots
            for cid in lesson.student_classes:
                committed_per_entity[f"student:{cid}"] |= placed_slots
            if room != NO_ROOM:
                committed_per_entity[f"room:{room}"] |= placed_slots
            # Back-commit to all tagged rooms for this lesson's tags so that future
            # same-tag lessons see this time slot as taken (virtual capacity tracking).
            if lesson.preferred_tags:
                for _tag in lesson.preferred_tags:
                    for _rid in self._tag_to_rooms.get(_tag, []):
                        committed_per_entity[f"room:{_rid}"] |= placed_slots

            c.genes[lesson.lesson_id] = assignments

        # Pure seed repair pass: try to move force-placed lessons to conflict-free slots
        if pure and force_placed_lids:
            self._greedy_repair_pass(c, committed_per_entity, force_placed_lids)

        return c

    def _greedy_repair_pass(
        self,
        c: Chromosome,
        committed: Dict[str, Set[Tuple[str, str]]],
        target_lids: Set[str],
        max_repairs: int = 5,
    ) -> None:
        """
        Post-placement repair for the pure greedy seed.
        For each force-placed lesson (up to max_repairs), temporarily frees its
        committed slots and tries to find a conflict-free alternative. If found,
        re-places it there; otherwise restores the original placement unchanged.
        """
        repaired = 0
        for lesson in self.lessons:
            lid = lesson.lesson_id
            if lid not in target_lids or lid in self._fixed_slots:
                continue
            if repaired >= max_repairs:
                break

            current_assignments = c.genes.get(lid, [])
            if not current_assignments:
                continue
            current_slots = {(ts.day, ts.period_col) for ts, _ in current_assignments}
            current_room  = current_assignments[0][1]

            # Temporarily free this lesson's committed slots
            for tid in lesson.teacher_ids:
                committed[f"teacher:{tid}"] -= current_slots
            for cid in lesson.student_classes:
                committed[f"student:{cid}"] -= current_slots
            if current_room and current_room != NO_ROOM:
                committed[f"room:{current_room}"] -= current_slots

            # Check what's free now
            local_committed: Set[Tuple[str, str]] = set()
            for tid in lesson.teacher_ids:
                local_committed |= committed[f"teacher:{tid}"]
            for cid in lesson.student_classes:
                local_committed |= committed[f"student:{cid}"]
            if current_room and current_room != NO_ROOM:
                local_committed |= committed[f"room:{current_room}"]

            free_slots = list(set(self._lesson_slots_cache[lid]) - local_committed)

            if free_slots:
                new_assignments = self._assign_blocks(lesson, free_slots, current_room, committed=set(local_committed))
                new_slots = {(ts.day, ts.period_col) for ts, _ in new_assignments}
                # Commit new slots
                for tid in lesson.teacher_ids:
                    committed[f"teacher:{tid}"] |= new_slots
                for cid in lesson.student_classes:
                    committed[f"student:{cid}"] |= new_slots
                if current_room and current_room != NO_ROOM:
                    committed[f"room:{current_room}"] |= new_slots
                c.genes[lid] = new_assignments
                repaired += 1
            else:
                # No improvement possible — restore original committed slots
                for tid in lesson.teacher_ids:
                    committed[f"teacher:{tid}"] |= current_slots
                for cid in lesson.student_classes:
                    committed[f"student:{cid}"] |= current_slots
                if current_room and current_room != NO_ROOM:
                    committed[f"room:{current_room}"] |= current_slots

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
        1 pure greedy seed (most-constrained-first) + 59% greedy with random
        lesson ordering + 40% fully random.  Each greedy chromosome processes
        lessons in a different sequence so the initial population is diverse
        rather than 80% near-identical near-copies of the same greedy solution.
        """
        n_greedy = max(1, int(self.population_size * 0.6))
        n_random = self.population_size - n_greedy
        print(f"  [GA] Initializing population of {self.population_size} "
              f"(1 pure greedy seed + {n_greedy - 1} random-order greedy + {n_random} random)...")
        self.population = (
            [self._create_chromosome_greedy(pure=True)] +
            [self._create_chromosome_greedy(pure=False) for _ in range(n_greedy - 1)] +
            [self._create_chromosome_random() for _ in range(n_random)]
        )
        # Option A: repair room conflicts in each initial chromosome
        for c in self.population:
            self._repair_rooms(c)
        print(f"  [GA] Population initialized.")

    # =========================================================================
    # FITNESS EVALUATION
    # =========================================================================

    def evaluate_fitness(self, chromosome: Chromosome) -> float:
        violations: Dict[str, int] = defaultdict(int)

        # PERF-3: flat counters keyed by (entity_id, slot_key) — avoids nested defaultdict overhead
        teacher_slot:    Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        student_slot:    Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        room_slot:       Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        teacher_day_load: Dict[Tuple[str, str], int]            = defaultdict(int)

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
                    teacher_day_load[(tid, ts.day)] += 1
                for cid in lesson.student_classes:
                    student_slot[(cid, slot_key)] += 1
                if room:
                    room_slot[(room, slot_key)] += 1

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

        # Homeroom, specialist room, and preferred-room-miss violations
        if self.homeroom_room_to_class or self._specialist_rooms:
            for lesson in self.lessons:
                lesson_class_set = set(lesson.student_classes)
                for ts, room in chromosome.genes.get(lesson.lesson_id, []):
                    if not room or room == NO_ROOM:
                        continue
                    owner = self.homeroom_room_to_class.get(room)
                    if owner is not None and owner not in lesson_class_set:
                        # Wrong class's homeroom
                        violations['homeroom_violation'] += 1
                    elif owner is None and room in self._specialist_rooms and not lesson.required_rooms:
                        # Tagged specialist room — only penalise if lesson has no preferred-tag claim.
                        # A lesson with preferred_tags that matches this room's tags has a soft claim
                        # and should not be penalised (it was sent here by _pick_room on purpose).
                        room_is_preferred = any(
                            room in self._tag_to_rooms.get(tag, [])
                            for tag in lesson.preferred_tags
                        )
                        if not room_is_preferred:
                            violations['specialist_room'] += 1
                    # Preferred-room miss: lesson has a tag preference but landed in a
                    # non-preferred room (general or wrong specialist).  Penalty is soft
                    # (30) — less than one room conflict (100) — so the GA prefers using
                    # a general room over causing a conflict, but still has gradient to
                    # pack as many tagged lessons into their preferred room as possible.
                    if lesson.preferred_tags and not lesson.required_rooms:
                        room_is_preferred = any(
                            room in self._tag_to_rooms.get(tag, [])
                            for tag in lesson.preferred_tags
                        )
                        if not room_is_preferred:
                            violations['preferred_room_miss'] += 1

        # Day distribution: penalise teachers overloaded on a single day
        for load in teacher_day_load.values():
            if load > self.DAY_LOAD_THRESHOLD:
                violations['day_distribution'] += load - self.DAY_LOAD_THRESHOLD

        fitness = (
            violations['teacher_conflict']    * self.PENALTY_TEACHER_CONFLICT    +
            violations['student_conflict']    * self.PENALTY_STUDENT_CONFLICT    +
            violations['room_conflict']       * self.PENALTY_ROOM_CONFLICT       +
            violations['block_violation']     * self.PENALTY_BLOCK_VIOLATION     +
            violations['period_count']        * self.PENALTY_PERIOD_COUNT        +
            violations['seperate_slot']       * self.PENALTY_SEPERATE_SLOT       +
            violations['sub_group']           * self.PENALTY_SUB_GROUP           +
            violations['homeroom_violation']  * self.PENALTY_HOMEROOM_VIOLATION  +
            violations['specialist_room']     * self.PENALTY_SPECIALIST_ROOM     +
            violations['preferred_room_miss'] * self.PENALTY_PREFERRED_ROOM_MISS +
            violations['day_distribution']    * self.PENALTY_DAY_DISTRIBUTION
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
                    # Normalize rooms: mixing blocks can produce inconsistent room assignments
                    gene_c1 = self._normalize_gene_room(lid, gene_c1)
                    gene_c2 = self._normalize_gene_room(lid, gene_c2)
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
                # Normalize rooms: mixing blocks can produce inconsistent room assignments
                gene_c1 = self._normalize_gene_room(lid, gene_c1)
                gene_c2 = self._normalize_gene_room(lid, gene_c2)
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

        self._repair_rooms(c1, max_passes=5)
        self._repair_rooms(c2, max_passes=5)
        return c1, c2

    # =========================================================================
    # IMPROVEMENT 3: TARGETED SINGLE-BLOCK MUTATION
    # =========================================================================

    def _build_conflict_state(self, chromosome: Chromosome):
        """
        Build occupancy maps and conflicted-slot index in one pass.

        Returns:
            conflicted   : lesson_id -> set of (day, period_col) in conflict
            teacher_usage: teacher_id -> slot -> [lesson_ids]
            student_usage: class_id   -> slot -> [lesson_ids]
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

        return conflicted, teacher_usage, student_usage, room_usage

    def _find_conflicted_slots(self, chromosome: Chromosome) -> Dict[str, Set[Tuple[str, str]]]:
        """Thin wrapper kept for callers that only need the conflicted dict."""
        conflicted, _, _, _ = self._build_conflict_state(chromosome)
        return conflicted

    def _apply_swap_blocker(
        self,
        chromosome: Chromosome,
        lesson: 'Lesson',
        conflicted: Dict[str, Set[Tuple[str, str]]],
        teacher_usage: Dict[str, Dict[Tuple[str, str], List[str]]],
        student_usage: Dict[str, Dict[Tuple[str, str], List[str]]],
        room_usage:    Dict[str, Dict[Tuple[str, str], List[str]]],
        room_occ: Optional[Dict[Tuple[str, str], Dict[str, int]]] = None,
    ) -> bool:
        """
        Human-like repair: when a lesson's conflict at a slot is caused by exactly
        ONE entity type being busy (teacher, student, OR room — not multiple), find
        the lesson occupying that entity and move it elsewhere.

        Fires on any single blocking type — including room-only conflicts.
        Does nothing when multiple entity types simultaneously block (would require
        moving more than one lesson — too disruptive for a single repair step).
        """
        lid = lesson.lesson_id
        bad_slots = conflicted.get(lid)
        if not bad_slots:
            return False

        for bad_slot in bad_slots:
            teacher_blocker_lids: Set[str] = set()
            student_blocker_lids: Set[str] = set()
            room_blocker_lids:    Set[str] = set()

            for tid in lesson.teacher_ids:
                for other_lid in teacher_usage.get(tid, {}).get(bad_slot, []):
                    if other_lid != lid:
                        teacher_blocker_lids.add(other_lid)

            for cid in lesson.student_classes:
                for other_lid in student_usage.get(cid, {}).get(bad_slot, []):
                    if other_lid != lid:
                        student_blocker_lids.add(other_lid)

            # Find what room the victim lesson occupies at this slot
            victim_room = next(
                (rm for ts, rm in chromosome.genes.get(lid, [])
                 if (ts.day, ts.period_col) == bad_slot),
                None,
            )
            if victim_room:
                for other_lid in room_usage.get(victim_room, {}).get(bad_slot, []):
                    if other_lid != lid:
                        room_blocker_lids.add(other_lid)

            # Exactly one entity type blocking — safe to move its lesson.
            # Multiple types busy simultaneously would need multiple moves.
            n_busy_types = sum([
                bool(teacher_blocker_lids),
                bool(student_blocker_lids),
                bool(room_blocker_lids),
            ])
            if n_busy_types != 1:
                continue

            if teacher_blocker_lids:
                blocker_pool = teacher_blocker_lids
            elif student_blocker_lids:
                blocker_pool = student_blocker_lids
            else:
                blocker_pool = room_blocker_lids

            blocker_lid = random.choice(list(blocker_pool))
            blocker_lesson = self.lesson_map.get(blocker_lid)
            if not blocker_lesson or blocker_lid in self._fixed_slots:
                continue

            available = [
                s for s in (self._lesson_slots_cache[blocker_lid] or list(self.all_slots))
                if s != bad_slot
            ]
            if not available:
                continue

            random.shuffle(available)
            new_room = self._pick_room(blocker_lesson)
            new_assignments = self._assign_blocks(blocker_lesson, available, new_room)
            if new_assignments:
                if room_occ is not None and new_room and new_room != NO_ROOM:
                    new_busy = {(ts.day, ts.period_col) for ts, _ in new_assignments}
                    if any(new_room in room_occ.get(s, {}) for s in new_busy):
                        new_room = self._pick_room_aware(blocker_lesson, new_busy, room_occ)
                        new_assignments = [(ts, new_room) for ts, _ in new_assignments]
                chromosome.genes[blocker_lid] = new_assignments
                return True

        return False

    def _apply_explore(
        self,
        chromosome: Chromosome,
        lesson: 'Lesson',
        room_occ: Optional[Dict[Tuple[str, str], Dict[str, int]]] = None,
    ) -> bool:
        """
        Neighbourhood shift: move one random block of a lesson ±3 period positions
        on the same day.  Returns True if the gene was changed.

        Falls back to a full random re-assignment when the ±3 neighbourhood
        contains no valid consecutive run (empty neighbourhood or single-period
        lesson with no adjacent free slot).  The fallback also returns True.
        """
        lid     = lesson.lesson_id
        current = chromosome.genes.get(lid, [])
        if not current:
            return False

        block_sizes   = sorted(self._block_sizes[lid], reverse=True)
        block_of_idx: List[int] = []
        for bi, bs in enumerate(block_sizes):
            block_of_idx.extend([bi] * bs)

        target_block = random.randrange(len(block_sizes))
        target_size  = block_sizes[target_block]
        kept_slots   = {
            (ts.day, ts.period_col)
            for i, (ts, _) in enumerate(current)
            if i < len(block_of_idx) and block_of_idx[i] != target_block
        }
        block_slots = [
            (ts.day, ts.period_col)
            for i, (ts, _) in enumerate(current)
            if i < len(block_of_idx) and block_of_idx[i] == target_block
        ]

        pool: Set[Tuple[str, str]] = set()
        cache_set = set(self._lesson_slots_cache[lid]) if self._lesson_slots_cache[lid] else self.all_slots
        for day, col in block_slots:
            idx = self._col_idx.get(col, -1)
            if idx < 0:
                continue
            for delta in range(-3, 4):
                ni = idx + delta
                if 0 <= ni < len(self.teaching_cols):
                    candidate = (day, self.teaching_cols[ni])
                    if candidate in cache_set and candidate not in kept_slots:
                        pool.add(candidate)

        if not pool:
            # Neighbourhood empty — full random re-assignment as fallback.
            available = self._lesson_slots_cache[lid] or list(self.all_slots)
            room = self._pick_room(lesson)
            assignments = self._assign_blocks(lesson, available, room)
            if assignments and room_occ is not None and room and room != NO_ROOM:
                new_busy = {(ts.day, ts.period_col) for ts, _ in assignments}
                if any(room in room_occ.get(s, {}) for s in new_busy):
                    room = self._pick_room_aware(lesson, new_busy, room_occ)
                    assignments = [(ts, room) for ts, _ in assignments]
            chromosome.genes[lid] = assignments
            return True

        room = current[0][1] if current else self._pick_room(lesson)

        pool_list = list(pool)
        random.shuffle(pool_list)
        kept_days = {s[0] for s in kept_slots}

        # Prefer slots where current room is free; fall back to full pool.
        room_free_pool = (
            [s for s in pool_list if room and room != NO_ROOM and room not in room_occ.get(s, {})]
            if room_occ is not None else []
        )

        new_slots: Optional[List[Tuple[str, str]]] = None
        for candidate_pool, fresh_day_only in [
            (room_free_pool, True), (room_free_pool, False),
            (pool_list,      True), (pool_list,      False),
        ]:
            if not candidate_pool:
                continue
            cset = set(candidate_pool)
            for start in candidate_pool:
                if fresh_day_only and start[0] in kept_days:
                    continue
                consecutive = get_consecutive_slots(
                    start, target_size, self.teaching_cols, self._col_idx
                )
                if consecutive and all(s in cset for s in consecutive):
                    new_slots = consecutive
                    break
            if new_slots:
                break

        if new_slots is None:
            return False

        # If room is busy at new slots, find a conflict-free room.
        if room_occ is not None and room and room != NO_ROOM:
            if any(room in room_occ.get(s, {}) for s in new_slots):
                room = self._pick_room_aware(lesson, set(new_slots), room_occ)
        new_gene: List[Tuple[TimeSlot, str]] = []
        new_block_iter = iter(new_slots)
        for i, (ts, rm) in enumerate(current):
            bi = block_of_idx[i] if i < len(block_of_idx) else -1
            if bi == target_block:
                try:
                    s = next(new_block_iter)
                    new_gene.append((TimeSlot(s[0], s[1]), room))
                except StopIteration:
                    new_gene.append((ts, rm))
            else:
                new_gene.append((ts, rm))
        chromosome.genes[lid] = new_gene
        self._mutation_stats['explore'] += 1
        return True

    def _mutate(self, chromosome: Chromosome):
        """
        Mutation operators applied per lesson with probability mutation_rate:

        1. targeted_block (40%): Move a conflicted block to a free slot.
                                  Falls back to explore when lesson has no conflict.
        2. swap_blocker   (15%): Move the lesson blocking a desired slot.
                                  Fires when exactly one entity type (teacher,
                                  student, OR room) is busy at the conflict slot.
        3. room           (15%): Change room assignment.
                                  Skipped for single-class homeroom lessons (no-op).
        4. full_slot      (10%): Full random re-assignment.
        5. explore        (20%): Neighbourhood shift ±3 positions.

        Conflict state is invalidated after any mutation that moves timeslots so
        subsequent lessons in the same _mutate call work on fresh data.
        """
        # Lazily built on first use; invalidated after mutations that change timeslots.
        conflicted_slots:  Optional[Dict[str, Set[Tuple[str, str]]]] = None
        teacher_usage_map: Optional[Dict]                            = None
        student_usage_map: Optional[Dict]                            = None
        room_usage_map:    Optional[Dict]                            = None
        # Option B: slot → {room: count} for conflict-aware room mutation (Counter, lazy, updated on reassign)
        room_occ: Optional[Dict[Tuple[str, str], Dict[str, int]]] = None

        # Violation-directed: collect lesson IDs with wrong period count (fast, no conflict build)
        _violated_lids: Set[str] = {
            l.lesson_id for l in self.lessons
            if l.lesson_id not in self._fixed_slots
            and len(chromosome.genes.get(l.lesson_id, [])) != self._expected_periods[l.lesson_id]
        }
        # Flag to merge slot-conflicted lessons once conflict_state is built
        _conflict_state_merged: bool = False
        # Lessons with room conflict only (no teacher/student conflict) — get room-biased weights
        _room_only_lids: Set[str] = set()

        for lesson in self.lessons:
            if random.random() > self.mutation_rate:
                continue

            lid = lesson.lesson_id

            # Violation-directed: 70% chance to redirect this mutation to a violated lesson
            if _violated_lids and random.random() < 0.70:
                target_lid = random.choice(list(_violated_lids))
                lesson = self.lesson_map[target_lid]
                lid    = target_lid

            # Merge slot-conflicted lessons into _violated_lids once available
            if conflicted_slots is not None and not _conflict_state_merged:
                _violated_lids |= {
                    k for k in conflicted_slots if k not in self._fixed_slots
                }
                _conflict_state_merged = True
                # Build room-only conflict set: room conflict with no teacher/student conflict.
                _ts_conflicted: Set[str] = set()
                for _usage in (teacher_usage_map, student_usage_map):
                    for _, _slots in _usage.items():
                        for _, _lids in _slots.items():
                            if len(_lids) > 1:
                                _ts_conflicted.update(_lids)
                _room_only_lids = {
                    _l for _, _slots in room_usage_map.items()
                    for _, _lids in _slots.items()
                    if len(_lids) > 1
                    for _l in _lids
                    if _l not in _ts_conflicted and _l not in self._fixed_slots
                }

            # Fixed-period lessons: timeslot is locked — only room may change.
            # Skip if only one required room — no alternative to switch to.
            if lid in self._fixed_slots:
                if lesson.required_rooms and len(lesson.required_rooms) <= 1:
                    continue
                new_room = self._pick_room(lesson)
                if lid in chromosome.genes:
                    chromosome.genes[lid] = [(ts, new_room) for ts, _ in chromosome.genes[lid]]
                continue

            mutation_type = random.choices(
                ['targeted_block', 'swap_blocker', 'room', 'full_slot', 'explore'],
                weights=(
                    [0.10, 0.05, 0.65, 0.05, 0.15]
                    if lid in _room_only_lids
                    else [0.35, 0.15, 0.20, 0.10, 0.20]
                )
            )[0]

            # ── swap_blocker ─────────────────────────────────────────────────
            if mutation_type == 'swap_blocker':
                if conflicted_slots is None:
                    conflicted_slots, teacher_usage_map, student_usage_map, room_usage_map = \
                        self._build_conflict_state(chromosome)
                if room_occ is None:
                    room_occ = defaultdict(lambda: defaultdict(int))
                    for _lid, _asgn in chromosome.genes.items():
                        for _ts, _rm in _asgn:
                            if _rm and _rm != NO_ROOM:
                                room_occ[(_ts.day, _ts.period_col)][_rm] += 1
                self._mutation_stats['swap_blocker_attempt'] += 1
                hit = self._apply_swap_blocker(
                    chromosome, lesson,
                    conflicted_slots, teacher_usage_map, student_usage_map, room_usage_map,
                    room_occ=room_occ,
                )
                if hit:
                    self._mutation_stats['swap_blocker_hit'] += 1
                continue

            # ── targeted_block ───────────────────────────────────────────────
            if mutation_type == 'targeted_block':
                if conflicted_slots is None:
                    conflicted_slots, teacher_usage_map, student_usage_map, room_usage_map = \
                        self._build_conflict_state(chromosome)
                bad_slots = conflicted_slots.get(lid, set())
                if not bad_slots:
                    continue  # lesson is conflict-free — don't disturb it

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

                # Find a new consecutive run for the target block.
                # Get current room early for room-free slot filtering.
                room = current[0][1] if current else self._pick_room(lesson)

                # Build room_occ lazily (shared with room/explore mutations).
                if room_occ is None:
                    room_occ = defaultdict(lambda: defaultdict(int))
                    for _lid, _asgn in chromosome.genes.items():
                        for _ts, _rm in _asgn:
                            if _rm and _rm != NO_ROOM:
                                room_occ[(_ts.day, _ts.period_col)][_rm] += 1

                all_available = [
                    s for s in (self._lesson_slots_cache[lid] or list(self.all_slots))
                    if s not in kept_slots and s not in bad_slots
                ]
                random.shuffle(all_available)

                # Prefer slots where current room is free.
                room_free_available = [
                    s for s in all_available
                    if room and room != NO_ROOM and room not in room_occ.get(s, {})
                ]

                used_days_kept = {ts.day for i, (ts, _) in enumerate(current)
                                  if block_of_idx[i] != target_block}

                new_slots: Optional[List[Tuple[str, str]]] = None
                for candidate_pool, fresh_day_only in [
                    (room_free_available, True), (room_free_available, False),
                    (all_available,       True), (all_available,       False),
                ]:
                    if not candidate_pool:
                        continue
                    cset = set(candidate_pool)
                    for start in candidate_pool:
                        if fresh_day_only and start[0] in used_days_kept:
                            continue
                        consecutive = get_consecutive_slots(
                            start, target_block_size, self.teaching_cols, self._col_idx
                        )
                        if consecutive and all(s in cset for s in consecutive):
                            new_slots = consecutive
                            break
                    if new_slots:
                        break

                if new_slots is None:
                    continue  # couldn't find a better placement — leave gene intact

                # If room is busy at new slots, find a conflict-free room.
                if room and room != NO_ROOM:
                    if any(room in room_occ.get(s, {}) for s in new_slots):
                        room = self._pick_room_aware(lesson, set(new_slots), room_occ)

                # Reconstruct gene: replace just the target block's slots
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
                self._mutation_stats['targeted_block'] += 1

            # ── room ─────────────────────────────────────────────────────────
            elif mutation_type == 'room':
                # Skip if required room is fixed (nothing to switch to).
                if lesson.required_rooms and len(lesson.required_rooms) <= 1:
                    continue
                # Skip if _pick_room is deterministic — single-class lessons with a
                # homeroom and no preferred tags always return the same homeroom, making
                # this mutation a no-op that wastes budget.
                if (len(lesson.student_classes) == 1
                        and not lesson.preferred_tags
                        and not lesson.required_rooms
                        and self.homeroom_map.get(lesson.student_classes[0])):
                    continue
                current = chromosome.genes.get(lid, [])
                if not current:
                    continue
                # Option B: conflict-aware room pick (Counter-based, not Set)
                if room_occ is None:
                    room_occ = defaultdict(lambda: defaultdict(int))
                    for _lid, _asgn in chromosome.genes.items():
                        for _ts, _rm in _asgn:
                            if _rm and _rm != NO_ROOM:
                                room_occ[(_ts.day, _ts.period_col)][_rm] += 1
                busy_slots = {(ts.day, ts.period_col) for ts, _ in current}
                old_room   = current[0][1]
                # Decrement this lesson's room count so it doesn't block itself,
                # but keep winner's copy in the counter.
                for s in busy_slots:
                    cnt = room_occ[s]
                    cnt[old_room] -= 1
                    if cnt[old_room] <= 0:
                        del cnt[old_room]
                new_room = self._pick_room_aware(lesson, busy_slots, room_occ)
                chromosome.genes[lid] = [(ts, new_room) for ts, _ in current]
                # Increment counter for new room
                for s in busy_slots:
                    if new_room and new_room != NO_ROOM:
                        room_occ[s][new_room] += 1
                self._mutation_stats['room'] += 1

            # ── full_slot ────────────────────────────────────────────────────
            elif mutation_type == 'full_slot':
                available = self._lesson_slots_cache[lid] or list(self.all_slots)
                room = self._pick_room(lesson)
                if room_occ is None:
                    room_occ = defaultdict(lambda: defaultdict(int))
                    for _lid, _asgn in chromosome.genes.items():
                        for _ts, _rm in _asgn:
                            if _rm and _rm != NO_ROOM:
                                room_occ[(_ts.day, _ts.period_col)][_rm] += 1
                assignments = self._assign_blocks(lesson, available, room)
                if assignments and room and room != NO_ROOM:
                    new_busy = {(ts.day, ts.period_col) for ts, _ in assignments}
                    if any(room in room_occ.get(s, {}) for s in new_busy):
                        room = self._pick_room_aware(lesson, new_busy, room_occ)
                        assignments = [(ts, room) for ts, _ in assignments]
                chromosome.genes[lid] = assignments
                self._mutation_stats['full_slot'] += 1

            # ── explore ──────────────────────────────────────────────────────
            elif mutation_type == 'explore':
                if room_occ is None:
                    room_occ = defaultdict(lambda: defaultdict(int))
                    for _lid, _asgn in chromosome.genes.items():
                        for _ts, _rm in _asgn:
                            if _rm and _rm != NO_ROOM:
                                room_occ[(_ts.day, _ts.period_col)][_rm] += 1
                self._apply_explore(chromosome, lesson, room_occ)

        # Slot mutations move lessons without updating rooms → new room conflicts.
        # Repair once here so every mutated chromosome stays room-conflict-free.
        self._repair_rooms(chromosome)

    def reset_epoch_stats(self) -> None:
        """Reset per-epoch diagnostic counters. Called by IslandGA at epoch start."""
        self._mutation_stats = defaultdict(int)
        self._restart_count  = 0

    def unassigned_summary(self, chromosome: Chromosome) -> Tuple[int, int]:
        """Return (n_lessons_missing, n_periods_missing) for a chromosome."""
        n_lessons = n_periods = 0
        for lesson in self.lessons:
            assigned = len(chromosome.genes.get(lesson.lesson_id, []))
            expected = self._expected_periods[lesson.lesson_id]
            if assigned < expected:
                n_lessons += 1
                n_periods += expected - assigned
        return n_lessons, n_periods

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
        Diversity injection on stagnation: keep top 25%, perturb middle 25%
        with extra mutations, replace bottom 50% with fresh chromosomes.
        Replaces less than before, preserving more accumulated gene patterns.
        """
        _t0 = perf_counter()

        self.population.sort(key=lambda c: c.fitness)
        n = self.population_size
        n_keep    = max(self.elite_size, n // 4)        # top 25% kept intact
        n_perturb = n // 4                              # next 25% get extra mutations
        n_fresh   = n - n_keep - n_perturb              # bottom 50% replaced
        n_greedy  = n_fresh // 2
        n_random  = n_fresh - n_greedy

        print(f"  [GA] ⟳ Stagnation restart — keep {n_keep} | perturb {n_perturb} "
              f"| replace {n_fresh} ({n_greedy} greedy + {n_random} random)...")

        keep    = self.population[:n_keep]
        perturb = [c.copy() for c in self.population[n_keep:n_keep + n_perturb]]
        for c in perturb:
            # Apply 3× extra mutation passes to escape local basin
            for _ in range(3):
                self._mutate(c)
            self.evaluate_fitness(c)

        fresh = (
            [self._create_chromosome_greedy(pure=False) for _ in range(n_greedy)] +
            [self._create_chromosome_random()            for _ in range(n_random)]
        )
        for c in fresh:
            self._repair_rooms(c)
            self.evaluate_fitness(c)

        self.population = keep + perturb + fresh
        self._gens_without_improvement = 0
        self._restart_count += 1

        if self.analytics is not None:
            self.analytics.record_restart(
                self.island_idx, self._current_generation,
                perf_counter() - _t0,
                n_kept=n_keep, n_perturbed=n_perturb, n_fresh=n_fresh,
            )

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

            _t0 = perf_counter()
            self.population.sort(key=lambda c: c.fitness)
            _t_sort = perf_counter() - _t0

            _t0 = perf_counter()
            new_pop: List[Chromosome] = [c.copy() for c in self.population[:self.elite_size]]
            _t_elite = perf_counter() - _t0

            _t_sel = _t_cross = _t_mut = _t_eval = 0.0

            while len(new_pop) < self.population_size:
                _t0 = perf_counter()
                p1 = self._tournament_select()
                p2 = self._tournament_select()
                retries = 0
                while p2 is p1 and retries < 5:
                    p2 = self._tournament_select()
                    retries += 1
                _t_sel += perf_counter() - _t0

                _t0 = perf_counter()
                c1, c2 = self._crossover(p1, p2)
                _t_cross += perf_counter() - _t0

                _t0 = perf_counter()
                self._mutate(c1)
                self._mutate(c2)
                _t_mut += perf_counter() - _t0

                _t0 = perf_counter()
                self.evaluate_fitness(c1)
                self.evaluate_fitness(c2)
                _t_eval += perf_counter() - _t0

                new_pop.extend([c1, c2])

            if self.analytics is not None:
                self.analytics.record_gen_timing(
                    self.island_idx, self._current_generation,
                    _t_sel, _t_cross, _t_mut, _t_eval,
                    sort_s=_t_sort, elite_copy_s=_t_elite,
                )

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

            _t0 = perf_counter()
            self.population.sort(key=lambda c: c.fitness)
            _t_sort = perf_counter() - _t0

            # Elitism: carry forward best chromosomes unchanged
            _t0 = perf_counter()
            new_pop: List[Chromosome] = [c.copy() for c in self.population[:self.elite_size]]
            _t_elite = perf_counter() - _t0

            _t_sel = _t_cross = _t_mut = _t_eval = 0.0

            # Breed offspring
            while len(new_pop) < self.population_size:
                _t0 = perf_counter()
                p1 = self._tournament_select()
                p2 = self._tournament_select()
                # GA-1: avoid crossing a chromosome with itself
                retries = 0
                while p2 is p1 and retries < 5:
                    p2 = self._tournament_select()
                    retries += 1
                _t_sel += perf_counter() - _t0

                _t0 = perf_counter()
                c1, c2 = self._crossover(p1, p2)
                _t_cross += perf_counter() - _t0

                _t0 = perf_counter()
                self._mutate(c1)
                self._mutate(c2)
                _t_mut += perf_counter() - _t0

                _t0 = perf_counter()
                self.evaluate_fitness(c1)
                self.evaluate_fitness(c2)
                _t_eval += perf_counter() - _t0

                new_pop.extend([c1, c2])

            if self.analytics is not None:
                self.analytics.record_gen_timing(
                    self.island_idx, gen,
                    _t_sel, _t_cross, _t_mut, _t_eval,
                    sort_s=_t_sort, elite_copy_s=_t_elite,
                )

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
                if self.analytics is not None:
                    self.analytics.set_stop_reason(
                        "window_stop", gen,
                        window_improvement=float(self._fitness_window[0] - self.best_chromosome.fitness),
                        min_improvement=self.min_improvement,
                        window_size=self.window_size,
                    )
                break

            # Stats
            avg_fitness = sum(c.fitness for c in self.population) / len(self.population)
            stat = {
                'generation':  gen,
                'best_fitness': self.best_chromosome.fitness,
                'avg_fitness':  avg_fitness,
                'violations':   self.best_chromosome.violations,
                'stagnation':   self._gens_without_improvement,
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
                if self.analytics is not None:
                    self.analytics.set_stop_reason("perfect_solution", gen)
                break

        if self.analytics is not None and not self.analytics.stop:
            self.analytics.set_stop_reason("max_generations", generations_run)

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
                room_id = room if room and room != NO_ROOM else None

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

    # =========================================================================
    # LNS REPAIR
    # =========================================================================

    def lns_repair(self, chromosome: Chromosome, collateral_rate: float = 0.10) -> Chromosome:
        """
        Large Neighbourhood Search repair on a single chromosome.

        Destroy phase:
          - Unassign all lessons involved in violations
          - Randomly unassign `collateral_rate` fraction of remaining lessons
            (creates breathing room so previously-frozen placements don't block repair)

        Repair phase:
          - Re-place unassigned lessons using greedy most-constrained-first,
            respecting the slots already committed by the kept lessons.

        Returns a new chromosome (original unchanged).
        """
        repaired = chromosome.copy()

        # ── Identify violated lessons ─────────────────────────────────────────
        destroy_lids: Set[str] = set()

        # Period-count violations
        for lesson in self.lessons:
            lid = lesson.lesson_id
            if len(repaired.genes.get(lid, [])) != self._expected_periods[lid]:
                destroy_lids.add(lid)

        # Slot-conflict violations (teacher / student / room)
        teacher_slot: Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        student_slot: Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        room_slot:    Dict[Tuple[str, Tuple[str, str]], int] = defaultdict(int)
        for lesson in self.lessons:
            for ts, room in repaired.genes.get(lesson.lesson_id, []):
                slot_key = (ts.day, ts.period_col)
                for tid in lesson.teacher_ids:
                    teacher_slot[(tid, slot_key)] += 1
                for cid in lesson.student_classes:
                    student_slot[(cid, slot_key)] += 1
                if room:
                    room_slot[(room, slot_key)] += 1

        conflict_slots: Set[Tuple[str, str]] = set()
        for (_, sk), cnt in teacher_slot.items():
            if cnt > 1:
                conflict_slots.add(sk)
        for (_, sk), cnt in student_slot.items():
            if cnt > 1:
                conflict_slots.add(sk)
        for (_, sk), cnt in room_slot.items():
            if cnt > 1:
                conflict_slots.add(sk)

        for lesson in self.lessons:
            lid = lesson.lesson_id
            for ts, _ in repaired.genes.get(lid, []):
                if (ts.day, ts.period_col) in conflict_slots:
                    destroy_lids.add(lid)
                    break

        # ── Collateral damage: random 10% of kept lessons ─────────────────────
        kept_lids = [
            l.lesson_id for l in self.lessons
            if l.lesson_id not in destroy_lids and l.lesson_id not in self._fixed_slots
        ]
        n_collateral = max(1, int(len(kept_lids) * collateral_rate))
        destroy_lids |= set(random.sample(kept_lids, min(n_collateral, len(kept_lids))))

        # ── Destroy ───────────────────────────────────────────────────────────
        for lid in destroy_lids:
            repaired.genes.pop(lid, None)

        # ── Build committed map from kept lessons ─────────────────────────────
        committed: Dict[str, Set[Tuple[str, str]]] = defaultdict(set)
        for lesson in self.lessons:
            lid = lesson.lesson_id
            if lid in destroy_lids:
                continue
            for ts, room in repaired.genes.get(lid, []):
                slot = (ts.day, ts.period_col)
                for tid in lesson.teacher_ids:
                    committed[f"teacher:{tid}"].add(slot)
                for cid in lesson.student_classes:
                    committed[f"student:{cid}"].add(slot)
                if room and room != NO_ROOM:
                    committed[f"room:{room}"].add(slot)

        # ── Repair: greedy most-constrained-first on destroyed lessons ────────
        destroyed_lessons = sorted(
            [l for l in self.lessons if l.lesson_id in destroy_lids],
            key=lambda l: len(self._lesson_slots_cache[l.lesson_id]),
        )

        for lesson in destroyed_lessons:
            lid = lesson.lesson_id
            if lid in self._fixed_slots:
                slots = self._fixed_slots[lid]
                room  = self._pick_room(lesson)
                repaired.genes[lid] = [(TimeSlot(d, c), room) for d, c in slots]
                for d, c in slots:
                    for tid in lesson.teacher_ids:
                        committed[f"teacher:{tid}"].add((d, c))
                    for cid in lesson.student_classes:
                        committed[f"student:{cid}"].add((d, c))
                continue

            room = self._pick_room(lesson)
            local_committed: Set[Tuple[str, str]] = set()
            for tid in lesson.teacher_ids:
                local_committed |= committed[f"teacher:{tid}"]
            for cid in lesson.student_classes:
                local_committed |= committed[f"student:{cid}"]
            if room != NO_ROOM:
                local_committed |= committed[f"room:{room}"]

            free = list(set(self._lesson_slots_cache[lid]) - local_committed)
            if not free:
                free = list(self._lesson_slots_cache[lid]) or list(self.all_slots)

            assignments = self._assign_blocks(lesson, free, room, committed=set(local_committed))
            repaired.genes[lid] = assignments

            placed_slots = {(ts.day, ts.period_col) for ts, _ in assignments}
            for tid in lesson.teacher_ids:
                committed[f"teacher:{tid}"] |= placed_slots
            for cid in lesson.student_classes:
                committed[f"student:{cid}"] |= placed_slots
            if room != NO_ROOM:
                committed[f"room:{room}"] |= placed_slots

        self._repair_rooms(repaired)
        self.evaluate_fitness(repaired)
        return repaired

    def get_analytics(self) -> Optional[AnalyticsCollector]:
        return self.analytics

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
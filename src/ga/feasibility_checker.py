"""
================================================================================
GA SCHEDULER - Feasibility Checker
================================================================================

Pre-flight checks to determine if a dataset can have a valid solution before
running the (expensive) genetic algorithm.

Checks necessary conditions only — passing all checks does NOT guarantee a
solution exists (timetabling is NP-complete), but failing any ERROR-level
check proves infeasibility (GA will never reach fitness=0).
"""

import sys
from collections import defaultdict
from typing import Dict, List, Tuple, Set

from src.preschedule.scheduleManager import ScheduleManager
from .models import Lesson, WEEKDAYS
from .data_loader import (
    _parse_block_pattern,
    _parse_list_field,
    get_teaching_period_cols,
    build_lessons_from_manager,
    build_free_slots_per_entity,
    get_lesson_available_slots,
    get_consecutive_slots,
)


# =============================================================================
# REPORT DATA CLASSES
# =============================================================================

class FeasibilityIssue:
    def __init__(self, level: str, category: str, entity: str, description: str):
        self.level = level          # 'ERROR' | 'WARNING'
        self.category = category    # 'entity_capacity' | 'lesson_slots' | 'block_structure' | 'day_diversity'
        self.entity = entity
        self.description = description

    def __repr__(self):
        return f"[{self.level}] {self.category} | {self.entity}: {self.description}"


class FeasibilityReport:
    def __init__(self):
        self.issues: List[FeasibilityIssue] = []
        self.is_feasible: bool = True
        self.summary: Dict = {}

    def add(self, level: str, category: str, entity: str, description: str):
        self.issues.append(FeasibilityIssue(level, category, entity, description))
        if level == 'ERROR':
            self.is_feasible = False

    def errors(self) -> List[FeasibilityIssue]:
        return [i for i in self.issues if i.level == 'ERROR']

    def warnings(self) -> List[FeasibilityIssue]:
        return [i for i in self.issues if i.level == 'WARNING']

    def print_report(self):
        print("\n" + "=" * 60)
        print("  FEASIBILITY CHECK REPORT")
        print("=" * 60)

        errors = self.errors()
        warnings = self.warnings()

        s = self.summary
        print(f"  Lessons         : {s.get('total_lessons', '?')}")
        print(f"  Total slots     : {s.get('total_slots', '?')}")
        print(f"  Periods needed  : {s.get('total_periods_needed', '?')}")

        if not self.issues:
            print("\n  ✅ All checks passed — dataset appears feasible.")
        else:
            if errors:
                print(f"\n  ❌ ERRORS ({len(errors)}) — infeasible, GA cannot reach fitness=0:")
                for e in errors:
                    print(f"    • [{e.category}] {e.entity}: {e.description}")
            if warnings:
                print(f"\n  ⚠️  WARNINGS ({len(warnings)}) — highly constrained, GA may struggle:")
                for w in warnings:
                    print(f"    • [{w.category}] {w.entity}: {w.description}")

        print(f"\n  Result: {'INFEASIBLE' if not self.is_feasible else 'LIKELY FEASIBLE'} "
              f"| {len(errors)} errors, {len(warnings)} warnings")
        print("=" * 60 + "\n")
        sys.stdout.flush()

    def to_dict(self) -> Dict:
        return {
            'is_feasible': self.is_feasible,
            'error_count': len(self.errors()),
            'warning_count': len(self.warnings()),
            'issues': [
                {
                    'level': i.level,
                    'category': i.category,
                    'entity': i.entity,
                    'description': i.description,
                }
                for i in self.issues
            ],
            'summary': self.summary,
        }


# =============================================================================
# FEASIBILITY CHECKER
# =============================================================================

class FeasibilityChecker:
    """
    Pre-flight feasibility checker for the GA scheduler.

    Reuses the same data-loading infrastructure as GeneticAlgorithm so the
    results are consistent with what the GA will actually see.

    Checks (in order):
      1. Entity capacity   — teacher/class/room not over-booked
      2. Lesson slots      — each lesson has enough free slots for its periods
      3. Block structure   — each multi-period block has a valid consecutive run
      4. Day diversity     — enough distinct free days for multi-block lessons
    """

    # Threshold above which an entity is flagged as 'highly loaded' (WARNING)
    HIGH_LOAD_RATIO = 0.85

    def __init__(self, schedule_manager: ScheduleManager):
        self.manager = schedule_manager

        # Mirror GeneticAlgorithm's data setup
        self.teaching_cols: List[str] = get_teaching_period_cols(schedule_manager)
        self.all_slots: Set[Tuple[str, str]] = {
            (day, pc) for day in WEEKDAYS for pc in self.teaching_cols
        }
        # Suppress the build print here — GA will print it again on its own init
        import io, contextlib
        with contextlib.redirect_stdout(io.StringIO()):
            self.lessons: List[Lesson] = build_lessons_from_manager(schedule_manager)
        self.free_slots: Dict[str, Set[Tuple[str, str]]] = build_free_slots_per_entity(
            schedule_manager, self.teaching_cols
        )
        self._col_idx: Dict[str, int] = {col: i for i, col in enumerate(self.teaching_cols)}
        self._block_sizes: Dict[str, List[int]] = {
            l.lesson_id: _parse_block_pattern(l.block_pattern) for l in self.lessons
        }
        # Intersection of teacher+student free slots per lesson
        self._lesson_slots_cache: Dict[str, List[Tuple[str, str]]] = {
            l.lesson_id: get_lesson_available_slots(l, self.free_slots, self.all_slots)
            for l in self.lessons
        }

    # =========================================================================
    # CHECK 0: Cross-sheet reference validation
    # =========================================================================

    def _check_cross_sheet_references(self, report: FeasibilityReport):
        """
        Validate that every ID referenced in the curriculum exists in its
        master sheet. Detects typos and missing entries before the GA runs.

        Validated fields:
          - teacher  column → manager.teacher_grids keys
          - room     column → manager.room_grids keys
          - student_class column → manager.student_grids keys

        Note: subject_id has no dedicated master sheet and is not validated.
        """
        df_curriculum = self.manager.get_sheet_data('curriculum')
        if df_curriculum is None:
            return

        valid_teachers = set(self.manager.teacher_grids.keys())
        valid_classes  = set(self.manager.student_grids.keys())
        valid_rooms    = set(self.manager.room_grids.keys())

        unknown_teachers: Set[str] = set()
        unknown_classes:  Set[str] = set()
        unknown_rooms:    Set[str] = set()

        for _, row in df_curriculum.iterrows():
            for tid in _parse_list_field(row.get('teacher')):
                if valid_teachers and tid not in valid_teachers:
                    unknown_teachers.add(tid)
            for cid in _parse_list_field(row.get('student_class')):
                if valid_classes and cid not in valid_classes:
                    unknown_classes.add(cid)
            for rid in _parse_list_field(row.get('room')):
                if valid_rooms and rid not in valid_rooms:
                    unknown_rooms.add(rid)

        for tid in sorted(unknown_teachers):
            report.add('ERROR', 'cross_sheet_reference', f"teacher:{tid}",
                f"teacher ID '{tid}' in curriculum not found in teacher sheet")
        for cid in sorted(unknown_classes):
            report.add('ERROR', 'cross_sheet_reference', f"class:{cid}",
                f"class ID '{cid}' in curriculum not found in student sheet")
        for rid in sorted(unknown_rooms):
            report.add('ERROR', 'cross_sheet_reference', f"room:{rid}",
                f"room ID '{rid}' in curriculum not found in room sheet")

    # =========================================================================
    # CHECK 1: Entity capacity
    # =========================================================================

    def _check_entity_capacity(self, report: FeasibilityReport):
        """
        Sums required periods per teacher / student class / room and compares
        against the number of free slots each entity actually has.
        """
        teacher_demand: Dict[str, int] = defaultdict(int)
        student_demand: Dict[str, int] = defaultdict(int)
        room_demand: Dict[str, int] = defaultdict(int)

        for lesson in self.lessons:
            ppw = lesson.periods_per_week
            for tid in lesson.teacher_ids:
                teacher_demand[tid] += ppw
            for cid in lesson.student_classes:
                student_demand[cid] += ppw
            for rid in lesson.required_rooms:
                room_demand[rid] += ppw

        for tid, demand in teacher_demand.items():
            free_count = len(self.free_slots.get(f"teacher:{tid}", self.all_slots))
            if demand > free_count:
                report.add('ERROR', 'entity_capacity', f"teacher:{tid}",
                    f"needs {demand} periods but only {free_count} free slots available "
                    f"(over by {demand - free_count})")
            elif free_count > 0 and demand / free_count >= self.HIGH_LOAD_RATIO:
                report.add('WARNING', 'entity_capacity', f"teacher:{tid}",
                    f"highly loaded — {demand}/{free_count} slots used "
                    f"({demand/free_count*100:.0f}%)")

        for cid, demand in student_demand.items():
            free_count = len(self.free_slots.get(f"student:{cid}", self.all_slots))
            if demand > free_count:
                report.add('ERROR', 'entity_capacity', f"class:{cid}",
                    f"needs {demand} periods but only {free_count} free slots available "
                    f"(over by {demand - free_count})")
            elif free_count > 0 and demand / free_count >= self.HIGH_LOAD_RATIO:
                report.add('WARNING', 'entity_capacity', f"class:{cid}",
                    f"highly loaded — {demand}/{free_count} slots used "
                    f"({demand/free_count*100:.0f}%)")

        for rid, demand in room_demand.items():
            free_count = len(self.free_slots.get(f"room:{rid}", self.all_slots))
            if demand > free_count:
                report.add('ERROR', 'entity_capacity', f"room:{rid}",
                    f"needs {demand} periods but only {free_count} free slots available "
                    f"(over by {demand - free_count})")

    # =========================================================================
    # CHECK 2: Per-lesson available slot count
    # =========================================================================

    def _check_lesson_slots(self, report: FeasibilityReport):
        """
        Checks that the intersection of teacher + student class free slots
        has enough entries to hold all periods for the lesson.
        """
        for lesson in self.lessons:
            available = self._lesson_slots_cache[lesson.lesson_id]
            needed = lesson.periods_per_week
            label = f"{lesson.subject_id} (class {'/'.join(lesson.student_classes)})"

            if len(available) == 0:
                report.add('ERROR', 'lesson_slots', lesson.lesson_id,
                    f"{label}: 0 slots available — teacher and class schedules "
                    f"have no free overlap at all")
            elif len(available) < needed:
                report.add('ERROR', 'lesson_slots', lesson.lesson_id,
                    f"{label}: only {len(available)} slots available "
                    f"but needs {needed} periods")

    # =========================================================================
    # CHECK 3: Block structure feasibility
    # =========================================================================

    def _check_block_structure(self, report: FeasibilityReport):
        """
        For each multi-period block (size >= 2), verifies that at least one
        day exists where the lesson's available slots include a consecutive
        run of the required length.

        Example: a block-2 lesson needs day X where periods P and P+1 are
        both free for the teacher AND the student class.
        """
        for lesson in self.lessons:
            available_set = set(self._lesson_slots_cache[lesson.lesson_id])
            block_sizes = self._block_sizes[lesson.lesson_id]
            label = f"{lesson.subject_id} (class {'/'.join(lesson.student_classes)})"

            # Group available slots by day for efficient iteration
            by_day: Dict[str, Set[str]] = defaultdict(set)
            for day, pc in available_set:
                by_day[day].add(pc)

            for block_idx, block_size in enumerate(block_sizes):
                if block_size <= 1:
                    continue  # single-period blocks need no consecutiveness check

                has_valid_run = False
                for day, day_pcs in by_day.items():
                    for pc in day_pcs:
                        consecutive = get_consecutive_slots(
                            (day, pc), block_size, self.teaching_cols, self._col_idx
                        )
                        if consecutive and all(s in available_set for s in consecutive):
                            has_valid_run = True
                            break
                    if has_valid_run:
                        break

                if not has_valid_run:
                    report.add('ERROR', 'block_structure', lesson.lesson_id,
                        f"{label}: block {block_idx + 1} (size={block_size}) has no "
                        f"valid consecutive run of {block_size} periods anywhere in "
                        f"teacher+class free slots")

    # =========================================================================
    # CHECK 4: Day diversity
    # =========================================================================

    def _check_day_diversity(self, report: FeasibilityReport):
        """
        _assign_blocks places each block on a different day. So a lesson with
        N blocks requires N distinct days that have at least one available slot
        in the teacher+student intersection.
        """
        for lesson in self.lessons:
            available_set = set(self._lesson_slots_cache[lesson.lesson_id])
            block_sizes = self._block_sizes[lesson.lesson_id]
            n_blocks = len(block_sizes)

            if n_blocks <= 1:
                continue

            available_days = {day for day, _ in available_set}
            if len(available_days) < n_blocks:
                label = f"{lesson.subject_id} (class {'/'.join(lesson.student_classes)})"

                # Per-entity free-day breakdown to show which entity is the bottleneck
                teacher_days: Dict[str, set] = {}
                for tid in lesson.teacher_ids:
                    t_slots = self.free_slots.get(f"teacher:{tid}", self.all_slots)
                    teacher_days[tid] = {d for d, _ in t_slots}

                student_days: Dict[str, set] = {}
                for cid in lesson.student_classes:
                    s_slots = self.free_slots.get(f"student:{cid}", self.all_slots)
                    student_days[cid] = {d for d, _ in s_slots}

                teacher_info = " | ".join(
                    f"{t}: {sorted(d)}" for t, d in teacher_days.items()
                ) or "no teachers"
                student_info = " | ".join(
                    f"{c}: {sorted(d)}" for c, d in student_days.items()
                ) or "no classes"

                report.add('ERROR', 'day_diversity', lesson.lesson_id,
                    f"{label}: needs {n_blocks} separate days for its blocks "
                    f"(pattern={lesson.block_pattern}) but intersection only has "
                    f"{len(available_days)} day(s): {sorted(available_days)}\n"
                    f"        teacher free days : {teacher_info}\n"
                    f"        student free days : {student_info}")

    # =========================================================================
    # PUBLIC API
    # =========================================================================

    def check(self) -> FeasibilityReport:
        """Run all checks and return a FeasibilityReport."""
        print("  [Feasibility] Running pre-flight checks...")

        report = FeasibilityReport()

        self._check_cross_sheet_references(report)
        self._check_entity_capacity(report)
        self._check_lesson_slots(report)
        self._check_block_structure(report)
        self._check_day_diversity(report)

        report.summary = {
            'total_lessons': len(self.lessons),
            'total_slots': len(self.all_slots),
            'total_periods_needed': sum(l.periods_per_week for l in self.lessons),
            'errors': len(report.errors()),
            'warnings': len(report.warnings()),
        }

        report.print_report()
        return report

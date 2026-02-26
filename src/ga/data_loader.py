"""
================================================================================
GA SCHEDULER - Data Loader
================================================================================

Handles parsing and formatting of payloads from ScheduleManager for the GA.
"""

import ast
import pandas as pd
import numpy as np
import random
import copy
from typing import Dict, List, Tuple, Set, Optional, Any, Callable
from collections import defaultdict

from .models import (
    Lesson,
    TimeSlot,
    Chromosome,
    WEEKDAYS,
    BLOCKED_CELL_KEYWORDS
)

from src.preschedule.scheduleManager import ScheduleManager

# =============================================================================
# PARSING HELPERS
# =============================================================================

def _parse_list_field(value: Any) -> List[str]:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return []
    s = str(value).strip()
    if not s or s == 'nan' or s == 'None':
        return []
    if s.startswith('['):
        try:
            items = ast.literal_eval(s)
            return [str(i).strip() for i in items if i]
        except Exception:
            pass
    return [x.strip() for x in s.split(',') if x.strip()]


def _parse_block_pattern(pattern: Any) -> List[int]:
    """
    "1"   -> [1]
    "2"   -> [2]
    "2-1" -> [2, 1]
    "2-2" -> [2, 2]
    """
    if pattern is None or (isinstance(pattern, float) and np.isnan(pattern)):
        return [1]
    s = str(pattern).strip()
    if not s or s == 'nan':
        return [1]
    try:
        if '-' in s:
            return [int(x) for x in s.split('-')]
        return [int(float(s))]
    except ValueError:
        return [1]


def _cell_is_blocked(cell_value: Any) -> bool:
    if cell_value is None:
        return False
    if isinstance(cell_value, float) and np.isnan(cell_value):
        return False
    s = str(cell_value).strip()
    if not s or s == 'nan' or s == 'None':
        return False
    for kw in BLOCKED_CELL_KEYWORDS:
        if kw.lower() in s.lower():
            return True
    return True  # any non-empty value = occupied


# =============================================================================
# LESSON BUILDER
# =============================================================================

def build_lessons_from_manager(manager: ScheduleManager) -> List['Lesson']:
    """
    Build Lesson objects from the curriculum sheet in ScheduleManager.
    student_class already contains full class_ids (e.g. ["1/1", "1/2"])
    after the csv_cleaner fix — no grade marker scanning needed.
    """
    df_curriculum = manager.get_sheet_data('curriculum')
    df_room = manager.get_sheet_data('room')

    if df_curriculum is None:
        raise ValueError("Curriculum sheet not found in ScheduleManager.")

    valid_rooms: Set[str] = set()
    if df_room is not None:
        valid_rooms = {str(r).strip() for r in df_room['room_id'] if str(r).strip()}

    valid_class_ids: Set[str] = set(manager.student_grids.keys())

    lessons: List[Lesson] = []
    skipped = {'no_periods': 0, 'fixed': 0, 'no_classes': 0}

    for idx, row in df_curriculum.iterrows():
        ppw_raw = row.get('periods_per_week')
        if ppw_raw is None or (isinstance(ppw_raw, float) and np.isnan(ppw_raw)):
            skipped['no_periods'] += 1
            continue
        try:
            periods_per_week = int(float(ppw_raw))
        except (ValueError, TypeError):
            skipped['no_periods'] += 1
            continue
        if periods_per_week <= 0:
            skipped['no_periods'] += 1
            continue

        fixed_period_raw = row.get('fixed_period')
        if fixed_period_raw and str(fixed_period_raw).strip() not in ('', 'nan', 'None'):
            skipped['fixed'] += 1
            continue

        teacher_ids = _parse_list_field(row.get('teacher'))
        student_classes = _parse_list_field(row.get('student_class'))
        if valid_class_ids:
            student_classes = [c for c in student_classes if c in valid_class_ids]
        if not student_classes:
            skipped['no_classes'] += 1
            print(f"  [GA] Warning: row {idx} ({row.get('subject_id','?')}) has no valid classes — skipped.")
            continue

        required_rooms = _parse_list_field(row.get('room'))
        if valid_rooms:
            required_rooms = [r for r in required_rooms if r in valid_rooms]

        block_pattern = str(row.get('block_pattern', '')).strip()
        if not block_pattern or block_pattern == 'nan':
            block_pattern = str(periods_per_week)

        subject_id_raw = str(row.get('subject_id', '')).strip()
        subject_name = str(row.get('subject_name', '')).strip()

        # Expand: one Lesson object per class.
        # Each class needs its own independently-scheduled timeslot.
        # Teacher/room requirements are the same for all, but slots are separate.
        for class_id in student_classes:
            lesson = Lesson(
                lesson_id=f"L{len(lessons):04d}",
                subject_id=subject_id_raw if subject_id_raw else f"SUB{len(lessons)}",
                subject_name=subject_name,
                teacher_ids=teacher_ids,
                student_classes=[class_id],
                periods_per_week=periods_per_week,
                block_pattern=block_pattern,
                required_rooms=required_rooms,
                fixed_period=None,
            )
            lessons.append(lesson)

    print(f"  [GA] Built {len(lessons)} lessons. "
          f"Skipped — no_periods:{skipped['no_periods']} fixed:{skipped['fixed']} no_classes:{skipped['no_classes']}")
    return lessons


# =============================================================================
# SLOT HELPERS
# =============================================================================

def get_teaching_period_cols(manager: ScheduleManager) -> List[str]:
    """Ordered list of numeric (non-homeroom) period column headers."""
    result = []
    for p in manager.get_periods():
        label = p.label.strip()
        if label.isdigit() and label != '1':
            result.append(f"{p.label},{p.time}")
    return result


def get_occupied_slots(grid: pd.DataFrame, teaching_cols: List[str]) -> Set[Tuple[str, str]]:
    occupied: Set[Tuple[str, str]] = set()
    for day in grid.index:
        if day not in WEEKDAYS:
            continue
        for pc in teaching_cols:
            if pc not in grid.columns:
                continue
            if _cell_is_blocked(grid.at[day, pc]):
                occupied.add((day, pc))
    return occupied


def build_free_slots_per_entity(
    manager: ScheduleManager,
    teaching_cols: List[str],
) -> Dict[str, Set[Tuple[str, str]]]:
    all_slots: Set[Tuple[str, str]] = {
        (day, pc) for day in WEEKDAYS for pc in teaching_cols
    }
    free: Dict[str, Set[Tuple[str, str]]] = {}
    for grid_id, grid_df in manager.teacher_grids.items():
        free[f"teacher:{grid_id}"] = all_slots - get_occupied_slots(grid_df, teaching_cols)
    for grid_id, grid_df in manager.student_grids.items():
        free[f"student:{grid_id}"] = all_slots - get_occupied_slots(grid_df, teaching_cols)
    for grid_id, grid_df in manager.room_grids.items():
        free[f"room:{grid_id}"] = all_slots - get_occupied_slots(grid_df, teaching_cols)
    return free


def get_lesson_available_slots(
    lesson: Lesson,
    free_slots: Dict[str, Set[Tuple[str, str]]],
    all_slots: Set[Tuple[str, str]],
) -> List[Tuple[str, str]]:
    available = set(all_slots)
    for tid in lesson.teacher_ids:
        key = f"teacher:{tid}"
        if key in free_slots:
            available &= free_slots[key]
    for cid in lesson.student_classes:
        key = f"student:{cid}"
        if key in free_slots:
            available &= free_slots[key]
    return list(available)


def get_consecutive_slots(
    start: Tuple[str, str],
    count: int,
    teaching_cols: List[str],
    col_idx: Dict[str, int],
) -> Optional[List[Tuple[str, str]]]:
    day, start_col = start
    idx = col_idx.get(start_col, -1)
    if idx < 0 or idx + count > len(teaching_cols):
        return None
    return [(day, teaching_cols[idx + i]) for i in range(count)]

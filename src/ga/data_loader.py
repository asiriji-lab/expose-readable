"""
================================================================================
GA SCHEDULER - Data Loader
================================================================================

Handles loading and parsing of input data files.
"""

import os
import re
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
# PARSING FUNCTIONS
# =============================================================================

def _parse_list_field(value: Any) -> List[str]:
    """Parse a field that may be a single string, a Python list repr, or None."""
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
    # Comma-separated single value or bare value
    return [x.strip() for x in s.split(',') if x.strip()]


def _parse_block_pattern(pattern: Any) -> List[int]:
    """
    Parse block_pattern into a list of block sizes.
    "1"   -> [1]
    "2"   -> [2]
    "2-1" -> [2, 1]
    "1-1-1" -> [1, 1, 1]
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
    """Return True if a grid cell is already occupied (not free for the GA)."""
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
    # Any non-empty value means occupied
    return True


def _cell_is_free(cell_value: Any) -> bool:
    return not _cell_is_blocked(cell_value)

# =============================================================================
# LESSON BUILDER  (reads from ScheduleManager.sheets)
# =============================================================================

def build_lessons_from_manager(manager: ScheduleManager) -> List[Lesson]:
    """
    Parse the curriculum sheet stored in the ScheduleManager into Lesson objects.

    After the csv_cleaner fix, student_class already contains full class_ids
    (e.g. ["1/1", "1/2"]) — no grade marker scanning or section resolution needed.

    Skips rows that:
      - Have no periods_per_week
      - Have a fixed_period (already placed by preschedule processor)
      - Have no student_class after parsing

    Allows rows with no teacher (teacher_ids=[]) so no lessons are silently lost.
    """
    df_curriculum = manager.get_sheet_data('curriculum')
    df_room = manager.get_sheet_data('room')

    if df_curriculum is None:
        raise ValueError("Curriculum sheet not found in ScheduleManager.")

    # Valid room_ids for filtering required_rooms
    valid_rooms: Set[str] = set()
    if df_room is not None:
        valid_rooms = {str(r).strip() for r in df_room['room_id'] if str(r).strip()}

    # Valid class_ids actually present in student grids (post-preschedule)
    valid_class_ids: Set[str] = set(manager.student_grids.keys())

    lessons: List[Lesson] = []
    skipped_no_periods = 0
    skipped_fixed = 0
    skipped_no_classes = 0

    for idx, row in df_curriculum.iterrows():

        # --- Skip rows with no period data ---
        ppw_raw = row.get('periods_per_week')
        if ppw_raw is None or (isinstance(ppw_raw, float) and np.isnan(ppw_raw)):
            skipped_no_periods += 1
            continue
        try:
            periods_per_week = int(float(ppw_raw))
        except (ValueError, TypeError):
            skipped_no_periods += 1
            continue
        if periods_per_week <= 0:
            skipped_no_periods += 1
            continue

        # --- Skip lessons that already have a fixed period (pre-placed by preschedule) ---
        fixed_period_raw = row.get('fixed_period')
        if fixed_period_raw and str(fixed_period_raw).strip() not in ('', 'nan', 'None'):
            skipped_fixed += 1
            continue

        # --- Teacher IDs (allow empty — don't skip) ---
        teacher_ids = _parse_list_field(row.get('teacher'))

        # --- Student classes: cleaned csv_cleaner now outputs full class_ids directly ---
        # e.g. student_class = "['1/1', '1/2', '1/3', '1/4']"
        student_classes = _parse_list_field(row.get('student_class'))

        # Filter to only class_ids that actually exist in the student grids
        if valid_class_ids:
            student_classes = [c for c in student_classes if c in valid_class_ids]

        if not student_classes:
            skipped_no_classes += 1
            subject_id_raw = str(row.get('subject_id', '')).strip()
            print(f"  [GA] Warning: Row {idx} ({subject_id_raw}) has no valid student classes — skipped.")
            continue

        # --- Required rooms ---
        required_rooms = _parse_list_field(row.get('room'))
        if valid_rooms:
            required_rooms = [r for r in required_rooms if r in valid_rooms]

        # --- Block pattern ---
        block_pattern = str(row.get('block_pattern', '')).strip()
        if not block_pattern or block_pattern == 'nan':
            block_pattern = str(periods_per_week)

        # --- Subject ID / name ---
        subject_id_raw = str(row.get('subject_id', '')).strip()
        subject_name = str(row.get('subject_name', '')).strip()

        lesson = Lesson(
            lesson_id=f"L{len(lessons):04d}",
            subject_id=subject_id_raw if subject_id_raw else f"SUB{len(lessons)}",
            subject_name=subject_name,
            teacher_ids=teacher_ids,
            student_classes=student_classes,
            periods_per_week=periods_per_week,
            block_pattern=block_pattern,
            required_rooms=required_rooms,
            fixed_period=None,
        )
        lessons.append(lesson)

    print(f"  [GA] Built {len(lessons)} lessons from curriculum (non-fixed only).")
    print(f"  [GA] Skipped — no periods: {skipped_no_periods}, fixed: {skipped_fixed}, no classes: {skipped_no_classes}")
    return lessons


# =============================================================================
# AVAILABLE SLOT EXTRACTION  (reads occupied state from grids)
# =============================================================================

def get_teaching_period_cols(manager: ScheduleManager) -> List[str]:
    """
    Return the ordered list of period_col strings that are numeric teaching slots.
    These are columns whose label part (before the comma) is a digit.
    Period 1 (Homeroom) is excluded — it's pre-filled by template.
    """
    result = []
    for p in manager.get_periods():
        label = p.label.strip()
        if label.isdigit() and label != '1':
            result.append(f"{p.label},{p.time}")
    return result


def get_occupied_slots(grid: pd.DataFrame, teaching_cols: List[str]) -> Set[Tuple[str, str]]:
    """
    Scan a grid and return (day, period_col) pairs that are already occupied.
    Only considers teaching_cols (numeric, non-homeroom periods).
    """
    occupied: Set[Tuple[str, str]] = set()
    for day in grid.index:
        if day not in WEEKDAYS:
            continue
        for period_col in teaching_cols:
            if period_col not in grid.columns:
                continue
            if _cell_is_blocked(grid.at[day, period_col]):
                occupied.add((day, period_col))
    return occupied


def build_free_slots_per_entity(
    manager: ScheduleManager,
    teaching_cols: List[str],
    lessons: List[Lesson]
) -> Dict[str, Set[Tuple[str, str]]]:
    """
    For every entity (teacher_id, class_id) involved in any lesson,
    compute the set of (day, period_col) slots that are currently FREE.
    """
    all_slots: Set[Tuple[str, str]] = {
        (day, pc) for day in WEEKDAYS for pc in teaching_cols
    }

    free: Dict[str, Set[Tuple[str, str]]] = {}

    # Teachers
    for grid_id, grid_df in manager.teacher_grids.items():
        occupied = get_occupied_slots(grid_df, teaching_cols)
        free[f"teacher:{grid_id}"] = all_slots - occupied

    # Students
    for grid_id, grid_df in manager.student_grids.items():
        occupied = get_occupied_slots(grid_df, teaching_cols)
        free[f"student:{grid_id}"] = all_slots - occupied

    # Rooms
    for grid_id, grid_df in manager.room_grids.items():
        occupied = get_occupied_slots(grid_df, teaching_cols)
        free[f"room:{grid_id}"] = all_slots - occupied

    return free


def get_lesson_available_slots(
    lesson: Lesson,
    free_slots: Dict[str, Set[Tuple[str, str]]],
    all_slots: Set[Tuple[str, str]]
) -> List[Tuple[str, str]]:
    """Intersection of free slots across all entities involved in a lesson."""
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


# =============================================================================
# CONSECUTIVE SLOT HELPERS
# =============================================================================

def _period_label(period_col: str) -> str:
    return period_col.split(',')[0].strip()


def get_consecutive_slots(
    start: Tuple[str, str],
    count: int,
    teaching_cols: List[str]
) -> Optional[List[Tuple[str, str]]]:
    """
    Return `count` consecutive teaching period_cols starting from `start`,
    all on the same day. Returns None if not enough consecutive slots exist.
    """
    day, start_col = start
    try:
        idx = teaching_cols.index(start_col)
    except ValueError:
        return None
    if idx + count > len(teaching_cols):
        return None
    slots = [(day, teaching_cols[idx + i]) for i in range(count)]
    return slots

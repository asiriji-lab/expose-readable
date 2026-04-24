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
    """Any non-empty cell is treated as occupied — regardless of what's written there."""
    if cell_value is None:
        return False
    if isinstance(cell_value, float) and np.isnan(cell_value):
        return False
    s = str(cell_value).strip()
    return bool(s and s not in ('nan', 'None'))


# =============================================================================
# DYNAMIC BLOCKED KEYWORD BUILDER
# =============================================================================

def build_blocked_keywords(manager: 'ScheduleManager') -> List[str]:
    """
    Build the list of cell values that identify permanently blocked slots.
    Sources:
      1. Non-numeric period labels  (Morning Break, Afternoon Break, Homeroom…)
      2. Preplace slot names        (Free, ชุมนุม, Lunch ม.ต้น, เสรีม.ปลาย1…)
      3. Elective subject IDs/names (written into grids by the elective scheduler)
    """
    keywords: set = set()

    # 1. Period labels that are not plain numbers
    for p in manager.get_periods():
        label = p.label.strip()
        if label and not label.isdigit():
            keywords.add(label)

    # 2. Preplace slot names
    df_pre = manager.get_sheet_data('preplace')
    if df_pre is not None and 'slot_name' in df_pre.columns:
        for val in df_pre['slot_name'].dropna():
            s = str(val).strip()
            if s and s not in ('nan', 'None'):
                keywords.add(s)

    # 3. Elective subject IDs (names are display-only and not written into grids)
    df_elec = manager.get_sheet_data('elective')
    if df_elec is not None and 'subject_id' in df_elec.columns:
        for val in df_elec['subject_id'].dropna():
            s = str(val).strip()
            if s and s not in ('nan', 'None'):
                keywords.add(s)

    return sorted(keywords)


# =============================================================================
# CONSTRAINT HELPERS
# =============================================================================

def _parse_constraint_type(constraint_str: Any) -> Optional[str]:
    """
    Extract the constraint type keyword from the constraint column value.
    Checks for type=XXX patterns (case-insensitive, space-tolerant).
    Returns one of: TEAM | MULTI_CLASS_TEAM | SEPERATE_SLOT | SUB_GROUP | TEACHER_SPLIT | None
    """
    if constraint_str is None or (isinstance(constraint_str, float) and np.isnan(constraint_str)):
        return None
    s = str(constraint_str).upper().replace(' ', '')
    if not s or s in ('NAN', 'NONE'):
        return None
    # MULTI_CLASS_TEAM must be checked before TEAM to avoid partial match
    if 'TYPE=MULTI_CLASS_TEAM' in s:
        return 'MULTI_CLASS_TEAM'
    if 'TYPE=TEAM' in s:
        return 'TEAM'
    if 'TYPE=SEPERATE_SLOT' in s:
        return 'SEPERATE_SLOT'
    if 'TYPE=SUB_GROUP' in s:
        return 'SUB_GROUP'
    if 'TYPE=TEACHER_SPLIT' in s:
        return 'TEACHER_SPLIT'
    return None


# =============================================================================
# LESSON BUILDER
# =============================================================================

def build_lessons_from_manager(manager: ScheduleManager) -> List['Lesson']:
    """
    Build Lesson objects from the curriculum sheet in ScheduleManager.
    student_class already contains full class_ids (e.g. ["1/1", "1/2"])
    after the csv_cleaner fix — no grade marker scanning needed.

    Constraint handling:
      TEAM / MULTI_CLASS_TEAM  — one lesson per ROW (all classes in that row share one slot)
      SEPERATE_SLOT            — one lesson per class; tagged so the GA penalises same-slot
      SUB_GROUP                — one lesson per class; tagged so the GA rewards same-slot
      TEACHER_SPLIT            — split into N sub-lessons per class (one per block/teacher pair)
      (none)                   — one lesson per class (default)
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

        # Parse constraint type early — needed to decide whether to skip fixed-period rows
        constraint_raw = row.get('constraint', '')
        constraint_type = _parse_constraint_type(constraint_raw)

        fixed_period_raw = row.get('fixed_period')
        fp_str = str(fixed_period_raw).strip() if fixed_period_raw is not None else ''
        has_fixed_period = fp_str not in ('', 'nan', 'None')
        # Fixed-period rows are handled by the preschedule processor — skip them here,
        # EXCEPT SUB_GROUP which uses fixed_period as the group's required shared slot.
        if has_fixed_period and constraint_type != 'SUB_GROUP':
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
        subject_name   = str(row.get('subject_name', '')).strip()
        group_id_raw   = row.get('group_id', None)

        # constraint_type already parsed above (before fixed_period check)
        constraint_group_id = str(int(group_id_raw)) if group_id_raw is not None and not (isinstance(group_id_raw, float) and np.isnan(group_id_raw)) else None

        sid = subject_id_raw if subject_id_raw else f"SUB{len(lessons)}"

        # ------------------------------------------------------------------
        # MULTI_CLASS_TEAM: one lesson for ALL classes together (all attend the same slot)
        # ------------------------------------------------------------------
        if constraint_type == 'MULTI_CLASS_TEAM':
            lesson = Lesson(
                lesson_id=f"L{len(lessons):04d}",
                subject_id=sid,
                subject_name=subject_name,
                teacher_ids=teacher_ids,
                student_classes=student_classes,   # all classes share one slot
                periods_per_week=periods_per_week,
                block_pattern=block_pattern,
                required_rooms=required_rooms,
                fixed_period=None,
                constraint_type=constraint_type,
                constraint_group_id=constraint_group_id,
            )
            lessons.append(lesson)

        # ------------------------------------------------------------------
        # TEAM: one lesson PER CLASS, all teachers assigned to each class
        # (different from MULTI_CLASS_TEAM — classes are scheduled independently
        #  but each class gets all listed teachers)
        # ------------------------------------------------------------------
        elif constraint_type == 'TEAM':
            for class_id in student_classes:
                lesson = Lesson(
                    lesson_id=f"L{len(lessons):04d}",
                    subject_id=sid,
                    subject_name=subject_name,
                    teacher_ids=teacher_ids,        # all teachers for this class
                    student_classes=[class_id],     # one class per lesson
                    periods_per_week=periods_per_week,
                    block_pattern=block_pattern,
                    required_rooms=required_rooms,
                    fixed_period=None,
                    constraint_type=constraint_type,
                    constraint_group_id=constraint_group_id,
                )
                lessons.append(lesson)

        # ------------------------------------------------------------------
        # TEACHER_SPLIT: split into one sub-lesson per block × class
        #   block_pattern "2-1" + teachers [T005, T010]
        #   → lesson A: block 2 periods, teacher T005
        #   → lesson B: block 1 period,  teacher T010
        # IMPORTANT: block_pattern order is semantically tied to teacher order.
        # Do NOT sort block_sizes — position i in block_sizes maps to teacher_ids[i].
        # ------------------------------------------------------------------
        elif constraint_type == 'TEACHER_SPLIT':
            block_sizes = _parse_block_pattern(block_pattern)
            if len(teacher_ids) == len(block_sizes):
                for class_id in student_classes:
                    for bs, tid in zip(block_sizes, teacher_ids):
                        lesson = Lesson(
                            lesson_id=f"L{len(lessons):04d}",
                            subject_id=sid,
                            subject_name=subject_name,
                            teacher_ids=[tid],
                            student_classes=[class_id],
                            periods_per_week=bs,
                            block_pattern=str(bs),
                            required_rooms=required_rooms,
                            fixed_period=None,
                            constraint_type='TEACHER_SPLIT',
                            constraint_group_id=constraint_group_id,
                        )
                        lessons.append(lesson)
            else:
                # Mismatch: fall back to default behaviour with constraint tag
                print(f"  [GA] Warning: TEACHER_SPLIT mismatch — "
                      f"{len(teacher_ids)} teachers vs {len(block_sizes)} blocks for {sid}. "
                      f"Using default lesson creation.")
                for class_id in student_classes:
                    lesson = Lesson(
                        lesson_id=f"L{len(lessons):04d}",
                        subject_id=sid,
                        subject_name=subject_name,
                        teacher_ids=teacher_ids,
                        student_classes=[class_id],
                        periods_per_week=periods_per_week,
                        block_pattern=block_pattern,
                        required_rooms=required_rooms,
                        fixed_period=None,
                        constraint_type='TEACHER_SPLIT',
                        constraint_group_id=constraint_group_id,
                    )
                    lessons.append(lesson)

        # ------------------------------------------------------------------
        # SEPERATE_SLOT / SUB_GROUP: one lesson per class, tagged with group
        # SUB_GROUP: fixed_period is the required shared slot for the whole group;
        #            each class has its own teacher(s) and room as listed.
        # ------------------------------------------------------------------
        elif constraint_type in ('SEPERATE_SLOT', 'SUB_GROUP'):
            sub_group_fp = fp_str if (constraint_type == 'SUB_GROUP' and has_fixed_period) else None
            for class_id in student_classes:
                lesson = Lesson(
                    lesson_id=f"L{len(lessons):04d}",
                    subject_id=sid,
                    subject_name=subject_name,
                    teacher_ids=teacher_ids,
                    student_classes=[class_id],
                    periods_per_week=periods_per_week,
                    block_pattern=block_pattern,
                    required_rooms=required_rooms,
                    fixed_period=sub_group_fp,
                    constraint_type=constraint_type,
                    constraint_group_id=constraint_group_id,
                )
                lessons.append(lesson)

        # ------------------------------------------------------------------
        # Default: one lesson per class (original behaviour)
        # ------------------------------------------------------------------
        else:
            for class_id in student_classes:
                lesson = Lesson(
                    lesson_id=f"L{len(lessons):04d}",
                    subject_id=sid,
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
# ROOM TYPE DATA
# =============================================================================

def build_room_type_data(
    manager: ScheduleManager,
) -> tuple:
    """
    Returns (homeroom_map, homeroom_room_to_class, general_rooms, specialist_rooms).

    homeroom_map          : class_id  -> room_id   (from room.class_id)
    homeroom_room_to_class: room_id   -> class_id  (reverse)
    general_rooms         : [room_id] available to any lesson without required_rooms
    specialist_rooms      : {room_id} excluded from free pool; only via curriculum.room

    Room type resolution (room sheet only):
      1. class_id column filled  -> homeroom (excluded from general pool)
      2. tags column non-empty   -> specialist (excluded from general pool)
      3. fallback                -> general
    """
    df_room = manager.get_sheet_data('room')

    homeroom_map: Dict[str, str] = {}
    homeroom_room_to_class: Dict[str, str] = {}
    general_rooms:    List[str] = []
    specialist_rooms: set       = set()

    _EMPTY = {'', 'nan', 'none'}

    if df_room is not None and 'room_id' in df_room.columns:
        for _, row in df_room.iterrows():
            room_id = str(row.get('room_id', '')).strip()
            if not room_id or room_id.lower() in _EMPTY:
                continue

            class_id = str(row.get('class_id', '')).strip()
            tags     = str(row.get('tags',     '')).strip()

            if class_id and class_id.lower() not in _EMPTY:
                homeroom_map[class_id] = room_id
                homeroom_room_to_class[room_id] = class_id
                specialist_rooms.add(room_id)
            elif tags and tags.lower() not in _EMPTY:
                specialist_rooms.add(room_id)
            else:
                general_rooms.append(room_id)

    homeroom_room_ids = set(homeroom_map.values())
    print(f"  [GA] Room pool — general:{len(general_rooms)}  "
          f"homeroom:{len(homeroom_room_ids)}  specialist:{len(specialist_rooms) - len(homeroom_room_ids)}")
    return homeroom_map, homeroom_room_to_class, general_rooms, specialist_rooms


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
    # BUG-4 FIX: intersect required room free slots
    for rid in lesson.required_rooms:
        key = f"room:{rid}"
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

"""
Entity Metadata Extractor
Computes static entity metadata from cleaned CSV data before the GA runs.
"""

import ast
import re
import numpy as np
import pandas as pd
from collections import defaultdict
from typing import Any, Dict, List, Optional


def _parse_list_field(value: Any) -> List[str]:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return []
    s = str(value).strip()
    if not s or s in ('nan', 'None'):
        return []
    if s.startswith('['):
        try:
            items = ast.literal_eval(s)
            return [str(i).strip() for i in items if i]
        except Exception:
            pass
    return [x.strip() for x in s.split(',') if x.strip()]


def _parse_constraint_type_em(constraint_str: Any) -> Optional[str]:
    if constraint_str is None or (isinstance(constraint_str, float) and np.isnan(constraint_str)):
        return None
    s = str(constraint_str).upper().replace(' ', '')
    if not s or s in ('NAN', 'NONE'):
        return None
    if 'TYPE=MULTI_CLASS_TEAM' in s:
        return 'MULTI_CLASS_TEAM'
    if 'TYPE=TEACHER_SPLIT' in s:
        return 'TEACHER_SPLIT'
    return None


def _parse_block_pattern_em(pattern: Any) -> List[int]:
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


def _subject_variant(subject_id: str, subject_name: str) -> str:
    """
    Return the variant key for a subject:
    - '_activity' if subject_id == subject_name (ID missing, name used as fallback)
    - first character of subject_id otherwise
    """
    if subject_id == subject_name:
        return '_activity'
    return subject_id[0] if subject_id else '_activity'


def compute_entity_meta(cleaned_data: Dict[str, pd.DataFrame]) -> Dict:
    """
    Compute entity metadata from cleaned CSV data.

    Returns a dict matching the frontend EntityMeta interface:
        teacher_codes, teacher_meta, class_codes, class_meta,
        room_codes, room_meta, subjects, subject_room_map, teacher_workload
    """
    df_teacher = cleaned_data.get('teacher')
    df_student = cleaned_data.get('student')
    df_room = cleaned_data.get('room')
    df_curriculum = cleaned_data.get('curriculum')

    # ── Teacher codes / meta ─────────────────────────────────────────────────
    teacher_codes: List[str] = []
    teacher_meta: Dict = {}

    if df_teacher is not None and not df_teacher.empty:
        for _, row in df_teacher.iterrows():
            tid = str(row.get('teacher_id', '')).strip()
            if not tid or tid == 'nan':
                continue
            name = str(row.get('teacher_name', '')).strip()
            dept = str(row.get('constraint', '')).strip()
            teacher_codes.append(tid)
            teacher_meta[tid] = {
                'name': name if name and name != 'nan' else tid,
                'department': dept if dept and dept != 'nan' else '',
            }

    # ── Build homeroom map from room sheet (class_id column) ────────────────
    _EMPTY_VALS = {'', 'nan', 'none'}
    homeroom_from_room: Dict[str, str] = {}  # class_id → room_id

    if df_room is not None and not df_room.empty:
        for _, row in df_room.iterrows():
            rid = str(row.get('room_id', '')).strip()
            cid = str(row.get('class_id', '')).strip()
            if rid and rid.lower() not in _EMPTY_VALS and cid and cid.lower() not in _EMPTY_VALS:
                homeroom_from_room[cid] = rid

    # ── Class codes / meta (from student.csv) ───────────────────────────────
    class_level: Dict[str, str] = {}
    class_codes_set: set = set()

    if df_student is not None and not df_student.empty:
        for _, row in df_student.iterrows():
            grade = str(row.get('grade', '')).strip()
            section_raw = row.get('section')
            if section_raw is None or (isinstance(section_raw, float) and np.isnan(section_raw)):
                continue
            try:
                section = int(float(section_raw))
            except (ValueError, TypeError):
                continue
            if not grade or grade == 'nan' or section <= 0:
                continue
            m = re.search(r'(\d+)', grade)
            if not m:
                continue
            grade_num = m.group(1)
            class_code = f"{grade_num}/{section}"
            if class_code not in class_codes_set:
                class_codes_set.add(class_code)
                class_level[class_code] = f"ม.{grade_num}"

    class_codes = sorted(
        class_codes_set,
        key=lambda c: tuple(int(x) for x in c.split('/'))
    )
    class_meta = {
        code: {
            'defaultRoom': homeroom_from_room.get(code, ''),
            'level': class_level.get(code, ''),
        }
        for code in class_codes
    }

    # ── Room codes / meta ────────────────────────────────────────────────────
    homeroom_room_ids = set(homeroom_from_room.values())
    room_codes: List[str] = []
    room_meta: Dict = {}

    if df_room is not None and not df_room.empty:
        for _, row in df_room.iterrows():
            rid = str(row.get('room_id', '')).strip()
            if not rid or rid == 'nan':
                continue
            room_name = str(row.get('room_name', '')).strip()
            name = room_name if room_name and room_name != 'nan' else rid
            cid = str(row.get('class_id', '')).strip()
            tags = str(row.get('tags', '')).strip()
            if cid and cid.lower() not in _EMPTY_VALS:
                room_type = 'homeroom'
            elif tags and tags.lower() not in _EMPTY_VALS:
                room_type = 'specialist'
            else:
                room_type = 'general'
            room_codes.append(rid)
            room_meta[rid] = {'name': name, 'type': room_type}

    # ── Subjects + subject_room_map (from curriculum) ────────────────────────
    subjects: Dict = {}
    subject_room_map: Dict[str, str] = {}

    if df_curriculum is not None and not df_curriculum.empty:
        for _, row in df_curriculum.iterrows():
            sid = str(row.get('subject_id', '')).strip()
            sname = str(row.get('subject_name', '')).strip()
            if not sid or sid == 'nan':
                continue
            if sid not in subjects:
                subjects[sid] = {
                    'code': sid,
                    'name': sname,
                    'variant': _subject_variant(sid, sname),
                }
            # subject_room_map: subject has exactly one required specialist room
            room_raw = row.get('room')
            if room_raw is not None and sid not in subject_room_map:
                rooms = _parse_list_field(room_raw)
                if len(rooms) == 1:
                    subject_room_map[sid] = rooms[0]

    # ── Teacher workload (from curriculum) ───────────────────────────────────
    teacher_workload: Dict[str, List] = {}

    if df_curriculum is not None and not df_curriculum.empty:
        workload_map: Dict[str, Dict[str, Dict]] = defaultdict(dict)

        for _, row in df_curriculum.iterrows():
            sid = str(row.get('subject_id', '')).strip()
            sname = str(row.get('subject_name', '')).strip()
            if not sid or sid == 'nan':
                continue

            ppw_raw = row.get('periods_per_week')
            if ppw_raw is None or (isinstance(ppw_raw, float) and np.isnan(ppw_raw)):
                continue
            try:
                ppw = int(float(ppw_raw))
            except (ValueError, TypeError):
                continue
            if ppw <= 0:
                continue

            tids = _parse_list_field(row.get('teacher'))
            classes = _parse_list_field(row.get('student_class'))
            if not classes:
                continue

            rooms = _parse_list_field(row.get('room')) if row.get('room') is not None else []
            assignment_room = rooms[0] if rooms else ''
            variant = _subject_variant(sid, sname)
            constraint_type = _parse_constraint_type_em(row.get('constraint', ''))

            # TEACHER_SPLIT: pair each teacher with their block size from block_pattern
            block_pattern_raw = row.get('block_pattern')
            block_sizes = _parse_block_pattern_em(block_pattern_raw)
            is_teacher_split = (
                constraint_type == 'TEACHER_SPLIT'
                and len(tids) == len(block_sizes)
                and len(tids) > 1
            )

            for t_idx, tid in enumerate(tids):
                if sid not in workload_map[tid]:
                    workload_map[tid][sid] = {
                        'subjectCode': sid,
                        'subject': sname,
                        'variant': variant,
                        'assignments': [],
                        'totalPeriods': 0,
                    }

                if constraint_type == 'MULTI_CLASS_TEAM':
                    # All classes share one slot — teacher physically present ppw times.
                    workload_map[tid][sid]['assignments'].append({
                        'classCode': ','.join(classes),
                        'studentClasses': classes,
                        'room': assignment_room,
                        'periodsPerWeek': ppw,
                        'isMultiClass': True,
                    })
                    workload_map[tid][sid]['totalPeriods'] += ppw

                elif is_teacher_split:
                    # Each teacher teaches their own block per class, not full ppw.
                    teacher_ppw = block_sizes[t_idx]
                    for class_code in classes:
                        workload_map[tid][sid]['assignments'].append({
                            'classCode': class_code,
                            'room': assignment_room,
                            'periodsPerWeek': teacher_ppw,
                        })
                    workload_map[tid][sid]['totalPeriods'] += teacher_ppw * len(classes)

                else:
                    # Default / TEAM / SEPERATE_SLOT / SUB_GROUP:
                    # GA creates one lesson per class — teacher teaches ppw × num_classes periods.
                    for class_code in classes:
                        workload_map[tid][sid]['assignments'].append({
                            'classCode': class_code,
                            'room': assignment_room,
                            'periodsPerWeek': ppw,
                        })
                    workload_map[tid][sid]['totalPeriods'] += ppw * len(classes)

        for tid, subject_entries in workload_map.items():
            teacher_workload[tid] = list(subject_entries.values())

    return {
        'teacher_codes': teacher_codes,
        'teacher_meta': teacher_meta,
        'class_codes': class_codes,
        'class_meta': class_meta,
        'room_codes': room_codes,
        'room_meta': room_meta,
        'subjects': subjects,
        'subject_room_map': subject_room_map,
        'teacher_workload': teacher_workload,
    }

"""
Entity Metadata Extractor
Computes static entity metadata from cleaned CSV data before the GA runs.
"""

import ast
import re
import numpy as np
import pandas as pd
from collections import defaultdict
from typing import Any, Dict, List


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

    # ── Class codes / meta (from student.csv) ───────────────────────────────
    class_default_room: Dict[str, str] = {}
    class_level: Dict[str, str] = {}

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
            if class_code not in class_default_room:
                dr = str(row.get('default_room', '')).strip()
                class_default_room[class_code] = '' if dr in ('nan', 'None', '') else dr
                class_level[class_code] = f"ม.{grade_num}"

    class_codes = sorted(
        class_default_room.keys(),
        key=lambda c: tuple(int(x) for x in c.split('/'))
    )
    class_meta = {
        code: {
            'defaultRoom': class_default_room[code],
            'level': class_level.get(code, ''),
        }
        for code in class_codes
    }

    # ── Room codes / meta ────────────────────────────────────────────────────
    homeroom_ids = {v for v in class_default_room.values() if v}
    room_codes: List[str] = []
    room_meta: Dict = {}

    if df_room is not None and not df_room.empty:
        for _, row in df_room.iterrows():
            rid = str(row.get('room_id', '')).strip()
            if not rid or rid == 'nan':
                continue
            note = str(row.get('note', '')).strip()
            name = note if note and note != 'nan' else rid
            room_type = 'homeroom' if rid in homeroom_ids else 'specialist'
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

            for tid in tids:
                if sid not in workload_map[tid]:
                    workload_map[tid][sid] = {
                        'subjectCode': sid,
                        'subject': sname,
                        'variant': variant,
                        'assignments': [],
                        'totalPeriods': 0,
                    }
                for class_code in classes:
                    workload_map[tid][sid]['assignments'].append({
                        'classCode': class_code,
                        'room': assignment_room,
                        'periodsPerWeek': ppw,
                    })
                    workload_map[tid][sid]['totalPeriods'] += ppw

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

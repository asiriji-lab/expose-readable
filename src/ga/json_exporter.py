"""
================================================================================
GA SCHEDULER - Schedule JSON Exporter
================================================================================

Converts the GA chromosome output and ScheduleManager state into the structured
JSON format required by the API response.
"""

import re
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

from .models import Lesson, Chromosome


# Cell values that represent blocked/non-lesson slots (should appear as null).
_SPECIAL_KEYWORDS = [
    'UNAVAILABLE', 'Homeroom', 'Morning Break', 'Afternoon Break',
    'Lunch', 'ลูกเสือ', 'ชุมนุม', 'เสรี', 'Bridging', 'preplace',
    'scout', 'elective', 'constraint',
]


class ScheduleJsonExporter:
    """
    Converts GA chromosome results and ScheduleManager state into the structured
    JSON format required by the API:

        {
          "config": { "academic_year", "semester", "columns" },
          "teachers": [ { "id", "name", "department", "rows" } ],
          "students": [ { "id", "name", "class_group", "rows" } ],
          "rooms":    [ { "id", "name", "rows" } ]
        }
    """

    def __init__(self, schedule_manager, chromosome: Chromosome,
                 academic_year: str = "", semester: int = 1):
        self.manager = schedule_manager
        self.chromosome = chromosome
        self.academic_year = academic_year
        self.semester = semester

        # All periods (PeriodItemData); only numeric labels appear in output rows.
        self.all_periods = schedule_manager.periods
        self.teaching_periods = [p for p in self.all_periods if p.label.strip().isdigit()]
        self.weekdays = schedule_manager.weekdays

        # Metadata lookups built once
        self._teacher_meta: Dict[str, Dict] = self._build_teacher_meta()
        self._subject_meta: Dict[str, str]  = self._build_subject_meta()
        self._room_meta:    Dict[str, Dict] = self._build_room_meta()

    # =========================================================================
    # METADATA LOOKUPS
    # =========================================================================

    def _build_teacher_meta(self) -> Dict[str, Dict]:
        """teacher_id → {name, department}"""
        meta: Dict[str, Dict] = {}
        df = self.manager.get_sheet_data('teacher')
        if df is not None:
            for _, row in df.iterrows():
                tid = str(row.get('teacher_id', '')).strip()
                if not tid or tid == 'nan':
                    continue
                name = str(row.get('teacher_name', '')).strip()
                dept = str(row.get('constraint', '')).strip()
                meta[tid] = {
                    'name': name if name and name != 'nan' else tid,
                    'department': dept if dept and dept != 'nan' else None,
                }
        return meta

    def _build_subject_meta(self) -> Dict[str, str]:
        """subject_id → subject_name"""
        meta: Dict[str, str] = {}
        df = self.manager.get_sheet_data('curriculum')
        if df is not None:
            for _, row in df.iterrows():
                sid   = str(row.get('subject_id',   '')).strip()
                sname = str(row.get('subject_name', '')).strip()
                if sid and sid != 'nan' and sname and sname != 'nan':
                    meta[sid] = sname
        return meta

    def _build_room_meta(self) -> Dict[str, Dict]:
        """room_id → {name, tag}"""
        meta: Dict[str, Dict] = {}
        df = self.manager.get_sheet_data('room')
        if df is not None:
            for _, row in df.iterrows():
                rid  = str(row.get('room_id', '')).strip()
                note = str(row.get('note',    '')).strip()
                tag  = str(row.get('tag',     '')).strip()
                if not rid or rid == 'nan':
                    continue
                meta[rid] = {
                    'name': note if note and note != 'nan' else rid,
                    'tag':  tag  if tag  and tag  != 'nan' else None,
                }
        return meta

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _teacher_name(self, teacher_id: str) -> str:
        return self._teacher_meta.get(teacher_id, {}).get('name') or teacher_id

    def _subject_name(self, subject_id: str) -> str:
        return self._subject_meta.get(subject_id, subject_id)

    def _period_label(self, period_col: str) -> str:
        """'2,08.30-09.20' → '2'"""
        return period_col.split(',')[0]

    def _is_special(self, value: Any) -> bool:
        """Return True if the cell value is a blocked/special slot, not a real lesson."""
        if value is None:
            return True
        s = str(value).strip()
        if not s or s in ('nan', 'None'):
            return True
        lower = s.lower()
        return any(kw.lower() in lower for kw in _SPECIAL_KEYWORDS)

    # =========================================================================
    # MANAGER GRID CELL PARSERS
    # =========================================================================

    def _parse_teacher_cell(self, cell_value) -> Optional[Dict]:
        """
        Teacher grid stores: "{class_id} ({subject_id}) at {room_id}"
        Returns {"subject_id", "subject_name", "class", "room"} or None for blocked slots.
        """
        if self._is_special(cell_value):
            return None
        s = str(cell_value).strip()
        m = re.match(r'^(.+?)\s*\((.+?)\)\s*at\s*(.+)$', s)
        if m:
            class_id   = m.group(1).strip()
            subject_id = m.group(2).strip()
            room_id    = m.group(3).strip()
            return {
                "subject_id":   subject_id,
                "subject_name": self._subject_name(subject_id),
                "class":        class_id,
                "room":         room_id,
            }
        # Fallback: treat entire string as subject
        return {"subject_id": s, "subject_name": s, "class": None, "room": None}

    def _parse_student_cell(self, cell_value) -> Optional[Dict]:
        """
        Student grid stores: "{subject_id}"
        Returns {"subject_id", "subject_name", "teacher", "room"} or None for blocked slots.
        """
        if self._is_special(cell_value):
            return None
        s = str(cell_value).strip()
        return {"subject_id": s, "subject_name": self._subject_name(s), "teacher": None, "room": None}

    def _parse_room_cell(self, cell_value) -> Optional[Dict]:
        """
        Room grid stores: "{class_id} ({subject_id}) with {teacher_id}"
        Returns {"subject_id", "subject_name", "teacher", "class"} or None for blocked slots.
        """
        if self._is_special(cell_value):
            return None
        s = str(cell_value).strip()
        m = re.match(r'^(.+?)\s*\((.+?)\)\s*with\s*(.+)$', s)
        if m:
            class_id   = m.group(1).strip()
            subject_id = m.group(2).strip()
            teacher_id = m.group(3).strip()
            return {
                "subject_id":   subject_id,
                "subject_name": self._subject_name(subject_id),
                "teacher":      self._teacher_name(teacher_id),
                "class":        class_id,
            }
        return {"subject_id": s, "subject_name": s, "teacher": None, "class": None}

    # =========================================================================
    # ROW BUILDER
    # =========================================================================

    def _build_rows(
        self,
        ga_cells: Dict[Tuple[str, str], Dict],
        manager_grid,
        grid_type: str,
    ) -> List[Dict]:
        """
        Build the 'rows' list for one entity (teacher / student / room).

        ga_cells:     {(day, period_label) → cell_dict}  — from chromosome
        manager_grid: DataFrame (or None)                 — pre-scheduled state
        grid_type:    'teacher' | 'student' | 'room'
        """
        rows = []
        for day in self.weekdays:
            columns: List[Dict] = []
            for period in self.teaching_periods:
                key        = (day, period.label)
                period_col = f"{period.label},{period.time}"

                # Priority 1: GA chromosome assignment
                cell = ga_cells.get(key)

                # Priority 2: pre-scheduled data from manager grid
                if cell is None and manager_grid is not None:
                    if (day in manager_grid.index
                            and period_col in manager_grid.columns):
                        raw = manager_grid.at[day, period_col]
                        if pd.notna(raw):
                            if grid_type == 'teacher':
                                cell = self._parse_teacher_cell(raw)
                            elif grid_type == 'student':
                                cell = self._parse_student_cell(raw)
                            elif grid_type == 'room':
                                cell = self._parse_room_cell(raw)

                columns.append({period.label: cell})
            rows.append({"day": day, "columns": columns})
        return rows

    # =========================================================================
    # CONFIG BUILDER
    # =========================================================================

    def _build_config(self) -> Dict:
        columns = [{"key": "day", "label": "Day", "type": "text"}]
        for p in self.teaching_periods:
            columns.append({"key": p.label, "label": p.label, "time": p.time})
        return {
            "academic_year": self.academic_year,
            "semester": self.semester,
            "columns": columns,
        }

    # =========================================================================
    # MAIN EXPORT
    # =========================================================================

    def export(self, lessons: List[Lesson]) -> Dict:
        """
        Build and return the complete JSON schedule.

        Args:
            lessons: List of Lesson objects produced by the GA.

        Returns:
            Dict with keys: config, teachers, students, rooms.
        """
        lesson_lookup = {l.lesson_id: l for l in lessons}

        # ── Index chromosome assignments by entity ─────────────────────────────
        # teacher_id / class_id / room_id → {(day, label): cell_dict}
        teacher_ga: Dict[str, Dict] = defaultdict(dict)
        student_ga: Dict[str, Dict] = defaultdict(dict)
        room_ga:    Dict[str, Dict] = defaultdict(dict)

        for lesson_id, slots in self.chromosome.genes.items():
            lesson = lesson_lookup.get(lesson_id)
            if not lesson:
                continue

            for ts, room in slots:
                label    = self._period_label(ts.period_col)
                key      = (ts.day, label)
                room_str = room if room and room != "NO_ROOM" else None

                # Teacher rows cell
                class_str = lesson.student_classes[0] if lesson.student_classes else None
                for tid in lesson.teacher_ids:
                    teacher_ga[tid][key] = {
                        "subject_id":   lesson.subject_id,
                        "subject_name": lesson.subject_name,
                        "class":        class_str,
                        "room":         room_str,
                    }

                # Student/class rows cell
                t_name = self._teacher_name(lesson.teacher_ids[0]) if lesson.teacher_ids else None
                for cid in lesson.student_classes:
                    student_ga[cid][key] = {
                        "subject_id":   lesson.subject_id,
                        "subject_name": lesson.subject_name,
                        "teacher":      t_name,
                        "room":         room_str,
                    }

                # Room rows cell
                if room_str:
                    room_ga[room_str][key] = {
                        "subject_id":   lesson.subject_id,
                        "subject_name": lesson.subject_name,
                        "teacher":      t_name,
                        "class":        class_str,
                    }

        # ── Teachers ──────────────────────────────────────────────────────────
        all_teacher_ids = sorted(
            set(self.manager.teacher_grids.keys()) | set(teacher_ga.keys())
        )
        teachers = []
        for tid in all_teacher_ids:
            meta = self._teacher_meta.get(tid, {})
            teachers.append({
                "id":         tid,
                "name":       meta.get('name', tid),
                "department": meta.get('department'),
                "rows": self._build_rows(
                    teacher_ga.get(tid, {}),
                    self.manager.teacher_grids.get(tid),
                    'teacher',
                ),
            })

        # ── Students (class groups) ───────────────────────────────────────────
        all_class_ids = sorted(
            set(self.manager.student_grids.keys()) | set(student_ga.keys())
        )
        students = []
        for cid in all_class_ids:
            students.append({
                "id":          cid,
                "name":        cid,
                "class_group": cid,
                "rows": self._build_rows(
                    student_ga.get(cid, {}),
                    self.manager.student_grids.get(cid),
                    'student',
                ),
            })

        # ── Rooms ─────────────────────────────────────────────────────────────
        all_room_ids = sorted(
            set(self.manager.room_grids.keys()) | set(room_ga.keys())
        )
        rooms = []
        for rid in all_room_ids:
            meta = self._room_meta.get(rid, {})
            rooms.append({
                "id":   rid,
                "name": meta.get('name', rid),
                "rows": self._build_rows(
                    room_ga.get(rid, {}),
                    self.manager.room_grids.get(rid),
                    'room',
                ),
            })

        return {
            "config":   self._build_config(),
            "teachers": teachers,
            "students": students,
            "rooms":    rooms,
        }

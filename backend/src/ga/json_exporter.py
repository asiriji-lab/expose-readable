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
from src.constants import NO_CLASS, NO_ROOM, NO_TEACHER


# Truly blocked slots — teacher constraints, not visible lessons.
_BLOCKED_KEYWORDS = ['UNAVAILABLE']

# Pre-placed activity slots (from preschedule phase) — exported with slot_type "preplace".
_PREPLACE_KEYWORDS = [
    'Homeroom', 'Morning Break', 'Afternoon Break',
    'Lunch', 'ลูกเสือ', 'ชุมนุม', 'เสรี', 'Bridging',
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
        """subject_id → subject_name (curriculum + elective)"""
        meta: Dict[str, str] = {}
        for sheet in ('curriculum', 'elective'):
            df = self.manager.get_sheet_data(sheet)
            if df is None:
                continue
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
                rid       = str(row.get('room_id',   '')).strip()
                room_name = str(row.get('room_name', '')).strip()
                tags      = str(row.get('tags',      '')).strip()
                if not rid or rid == 'nan':
                    continue
                meta[rid] = {
                    'name': room_name if room_name and room_name != 'nan' else rid,
                    'tag':  tags if tags and tags != 'nan' else None,
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

    def _count_expected_periods(self, block_pattern: str) -> int:
        """Return total period count implied by a block pattern like '2-1' or '2'."""
        if not block_pattern:
            return 1
        total = 0
        for part in str(block_pattern).split('-'):
            try:
                total += int(part.strip())
            except ValueError:
                total += 1
        return total

    def _is_special(self, value: Any) -> bool:
        """Return True if the cell value is a truly blocked slot (UNAVAILABLE)."""
        if value is None:
            return True
        s = str(value).strip()
        if not s or s in ('nan', 'None'):
            return True
        lower = s.lower()
        return any(kw.lower() in lower for kw in _BLOCKED_KEYWORDS)

    def _is_preplace_activity(self, subject_id: str) -> bool:
        """Return True if subject_id matches a pre-placed activity keyword."""
        lower = subject_id.lower()
        return any(kw.lower() in lower for kw in _PREPLACE_KEYWORDS)

    # =========================================================================
    # MANAGER GRID CELL PARSERS
    # =========================================================================

    def _parse_teacher_cell(self, cell_value) -> Optional[Dict]:
        """
        Teacher grid stores: "{class_id} ({subject_id}) at {room_id}"
        Returns a cell dict or None for blocked slots.
        Preplace cells return slot_type "preplace" with null class/room.
        """
        if self._is_special(cell_value):
            return None
        s = str(cell_value).strip()
        m = re.match(r'^(.+?)\s*\((.+?)\)\s*at\s*(.+)$', s)
        if m:
            class_id   = m.group(1).strip()
            subject_id = m.group(2).strip()
            room_id    = m.group(3).strip()
            if self._is_preplace_activity(subject_id):
                return {
                    "subject_id":   subject_id,
                    "subject_name": subject_id,
                    "class":        None,
                    "room":         None,
                    "slot_type":    "preplace",
                }
            if class_id in (NO_CLASS, ''):
                return {
                    "subject_id":   subject_id,
                    "subject_name": self._subject_name(subject_id),
                    "class":        None,
                    "room":         None if room_id == NO_ROOM else room_id,
                    "slot_type":    "elective",
                }
            return {
                "subject_id":   subject_id,
                "subject_name": self._subject_name(subject_id),
                "class":        class_id,
                "room":         None if room_id == NO_ROOM else room_id,
            }
        if self._is_preplace_activity(s):
            return {
                "subject_id":   s,
                "subject_name": s,
                "class":        None,
                "room":         None,
                "slot_type":    "preplace",
            }
        return {"subject_id": s, "subject_name": s, "class": None, "room": None}

    def _parse_student_cell(self, cell_value) -> Optional[Dict]:
        """
        Student grid stores: "{subject_id}"
        Returns a cell dict or None for blocked slots.
        Preplace cells return slot_type "preplace".
        """
        if self._is_special(cell_value):
            return None
        s = str(cell_value).strip()
        if self._is_preplace_activity(s):
            return {
                "subject_id":   s,
                "subject_name": s,
                "teacher":      None,
                "room":         None,
                "slot_type":    "preplace",
            }
        return {"subject_id": s, "subject_name": self._subject_name(s), "teacher": None, "room": None}

    def _parse_room_cell(self, cell_value) -> Optional[Dict]:
        """
        Room grid stores: "{class_id} ({subject_id}) with {teacher_id}"
        Returns a cell dict or None for blocked slots.
        Preplace cells return slot_type "preplace".
        """
        if self._is_special(cell_value):
            return None
        s = str(cell_value).strip()
        m = re.match(r'^(.+?)\s*\((.+?)\)\s*with\s*(.+)$', s)
        if m:
            class_id   = m.group(1).strip()
            subject_id = m.group(2).strip()
            teacher_id = m.group(3).strip()
            if self._is_preplace_activity(subject_id):
                return {
                    "subject_id":   subject_id,
                    "subject_name": subject_id,
                    "teacher":      None,
                    "class":        None,
                    "slot_type":    "preplace",
                }
            if class_id in (NO_CLASS, ''):
                return {
                    "subject_id":   subject_id,
                    "subject_name": self._subject_name(subject_id),
                    "teacher":      None if teacher_id == NO_TEACHER else self._teacher_name(teacher_id),
                    "class":        None,
                    "slot_type":    "elective",
                }
            return {
                "subject_id":   subject_id,
                "subject_name": self._subject_name(subject_id),
                "teacher":      None if teacher_id == NO_TEACHER else self._teacher_name(teacher_id),
                "class":        class_id,
            }
        if self._is_preplace_activity(s):
            return {
                "subject_id":   s,
                "subject_name": s,
                "teacher":      None,
                "class":        None,
                "slot_type":    "preplace",
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
    # UNFILLED SLOTS
    # =========================================================================

    def _build_unfilled_slots(self, lessons: List[Lesson]) -> List[Dict]:
        """Return lessons whose chromosome assignment is fewer periods than expected."""
        unfilled = []
        for lesson in lessons:
            assigned = len(self.chromosome.genes.get(lesson.lesson_id, []))
            expected = self._count_expected_periods(lesson.block_pattern)
            if assigned < expected:
                unfilled.append({
                    "lesson_id":       lesson.lesson_id,
                    "subject_id":      lesson.subject_id,
                    "subject_name":    lesson.subject_name,
                    "teacher_ids":     lesson.teacher_ids,
                    "student_classes": lesson.student_classes,
                    "assigned_periods": assigned,
                    "expected_periods": expected,
                    "missing_periods":  expected - assigned,
                })
        return unfilled

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

        # Tracks lessons that were overwritten at a slot by a later-processed lesson.
        # These lessons are fully placed in the chromosome but invisible in the grid.
        conflict_slots: List[Dict] = []

        def _conflict_entry(lesson_id, lesson, ts, label,
                            entity_type: str, entity_id: str) -> Dict:
            return {
                "lesson_id":       lesson_id,
                "subject_id":      lesson.subject_id,
                "subject_name":    lesson.subject_name,
                "student_classes": lesson.student_classes,
                "teacher_ids":     lesson.teacher_ids,
                "entity_type":     entity_type,
                "entity_id":       entity_id,
                "day":             ts.day,
                "period":          label,
            }

        for lesson_id, slots in self.chromosome.genes.items():
            lesson = lesson_lookup.get(lesson_id)
            if not lesson:
                continue

            for ts, room in slots:
                label    = self._period_label(ts.period_col)
                key      = (ts.day, label)
                room_str = room if room and room != NO_ROOM else None

                # Join all classes and all teacher names so multi-class / team
                # lessons are fully represented in every entity view.
                class_str = ', '.join(lesson.student_classes) if lesson.student_classes else None
                t_names   = [self._teacher_name(tid) for tid in lesson.teacher_ids]
                t_name    = ', '.join(t_names) if t_names else None

                for tid in lesson.teacher_ids:
                    if key in teacher_ga[tid]:
                        conflict_slots.append(_conflict_entry(lesson_id, lesson, ts, label, "teacher", tid))
                    else:
                        teacher_ga[tid][key] = {
                            "subject_id":   lesson.subject_id,
                            "subject_name": lesson.subject_name,
                            "class":        class_str,
                            "room":         room_str,
                        }

                for cid in lesson.student_classes:
                    if key in student_ga[cid]:
                        conflict_slots.append(_conflict_entry(lesson_id, lesson, ts, label, "student", cid))
                    else:
                        student_ga[cid][key] = {
                            "subject_id":   lesson.subject_id,
                            "subject_name": lesson.subject_name,
                            "teacher":      t_name,
                            "room":         room_str,
                        }

                if room_str:
                    if key in room_ga[room_str]:
                        conflict_slots.append(_conflict_entry(lesson_id, lesson, ts, label, "room", room_str))
                    else:
                        room_ga[room_str][key] = {
                            "subject_id":   lesson.subject_id,
                            "subject_name": lesson.subject_name,
                            "teacher":      t_name,
                            "class":        class_str,
                        }

        # ── Inject locked lessons (fixed-period curriculum rows from preschedule) ──
        # Locked lessons always overwrite GA lessons at the same slot — preschedule
        # takes priority over GA assignments.
        for locked in getattr(self.manager, 'locked_lessons', []):
            t_names   = [self._teacher_name(tid) for tid in locked.get('teacher_ids', [])]
            t_name    = ', '.join(t_names) if t_names else None
            classes   = locked.get('student_classes', [])
            class_str = ', '.join(classes) if classes else None
            room_str  = locked.get('room')

            for (day, label) in locked.get('slots', []):
                key = (day, label)

                for tid in locked.get('teacher_ids', []):
                    teacher_ga[tid][key] = {
                        "subject_id":   locked['subject_id'],
                        "subject_name": locked['subject_name'],
                        "class":        class_str,
                        "room":         room_str,
                    }

                for cid in classes:
                    student_ga[cid][key] = {
                        "subject_id":   locked['subject_id'],
                        "subject_name": locked['subject_name'],
                        "teacher":      t_name,
                        "room":         room_str,
                    }

                if room_str:
                    room_ga[room_str][key] = {
                        "subject_id":   locked['subject_id'],
                        "subject_name": locked['subject_name'],
                        "teacher":      t_name,
                        "class":        class_str,
                    }

        # Post-pass: annotate teacher cells with teaching_type when multiple
        # teachers share the same (day, slot, class, subject).
        # Same room → 'team'; different rooms → 'split'.
        slot_teacher_map: Dict[Tuple, list] = defaultdict(list)
        for tid, cells in teacher_ga.items():
            for key, cell in cells.items():
                bucket_key = (key[0], key[1], cell.get("class"), cell.get("subject_id"))
                slot_teacher_map[bucket_key].append((tid, key))

        for bucket_key, entries in slot_teacher_map.items():
            if len(entries) <= 1:
                continue
            rooms = {teacher_ga[tid][key].get("room") for tid, key in entries}
            teaching_type = "team" if len(rooms) == 1 else "split"
            for tid, key in entries:
                teacher_ga[tid][key]["teaching_type"] = teaching_type

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
            "config":          self._build_config(),
            "teachers":        teachers,
            "students":        students,
            "rooms":           rooms,
            "unfilled_slots":  self._build_unfilled_slots(lessons),
            "conflict_slots":  conflict_slots,
        }

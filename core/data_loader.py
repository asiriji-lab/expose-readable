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
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict

from .models import (
    Lesson, TimeSlot, DAYS, TEACHING_PERIODS, 
    BLOCKED_KEYWORDS, GRADE_LEVELS
)


# =============================================================================
# PARSER FUNCTIONS
# =============================================================================

def parse_student_classes(student_class_str: str) -> List[str]:
    """Parse student class string like '[1, 2, 3, 4]' into class identifiers."""
    if pd.isna(student_class_str) or not student_class_str:
        return []
    try:
        if isinstance(student_class_str, str):
            classes = ast.literal_eval(student_class_str)
        else:
            classes = student_class_str
        return [str(c) for c in classes]
    except:
        return []


def parse_teacher_ids(teacher_str: str) -> List[str]:
    """Parse teacher ID string which can be single ID or list."""
    if pd.isna(teacher_str) or not teacher_str:
        return []
    try:
        teacher_str = str(teacher_str).strip()
        if teacher_str.startswith('['):
            teachers = ast.literal_eval(teacher_str)
            return [str(t).strip() for t in teachers]
        else:
            return [teacher_str.strip()]
    except:
        return [str(teacher_str).strip()] if teacher_str else []


def parse_block_pattern(pattern: str) -> Tuple[int, List[int]]:
    """
    Parse block pattern string into total periods and block sizes.
    
    Examples:
    - '1' -> (1, [1])
    - '2' -> (2, [2])
    - '2-1' -> (3, [2, 1])
    - '2-2' -> (4, [2, 2])
    """
    if pd.isna(pattern) or not pattern:
        return (1, [1])
    
    pattern = str(pattern).strip()
    if '-' in pattern:
        blocks = [int(x) for x in pattern.split('-')]
        return (sum(blocks), blocks)
    else:
        try:
            n = int(float(pattern))
            return (n, [n])
        except:
            return (1, [1])


def parse_fixed_period(fixed_str: str) -> List[Tuple[str, str]]:
    """Parse fixed period string like 'MON_9-MON_10' into list of (day, period) tuples."""
    if pd.isna(fixed_str) or not fixed_str:
        return []
    
    fixed_str = str(fixed_str).strip()
    result = []
    
    day_map = {'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday',
               'THU': 'Thursday', 'FRI': 'Friday'}
    
    parts = re.findall(r'([A-Z]+)_(\d+)', fixed_str)
    for day_abbr, period in parts:
        day = day_map.get(day_abbr.upper(), day_abbr)
        result.append((day, period))
    
    return result


def is_slot_blocked(cell_value: str) -> bool:
    """Check if a cell value represents a blocked/occupied slot."""
    if pd.isna(cell_value) or cell_value == '':
        return False
    
    cell_str = str(cell_value).strip()
    if not cell_str:
        return False
    
    for keyword in BLOCKED_KEYWORDS:
        if keyword.lower() in cell_str.lower():
            return True
    
    return True


# =============================================================================
# DATA LOADER CLASS
# =============================================================================

class DataLoader:
    """Loads and parses all input data for the scheduler."""
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.curriculum: List[Lesson] = []
        self.rooms: Dict[str, Dict] = {}
        self.student_timetables: Dict[str, pd.DataFrame] = {}
        self.teacher_timetables: Dict[str, pd.DataFrame] = {}
        self.room_timetables: Dict[str, pd.DataFrame] = {}
        self.preplaced_slots: Dict[str, Set[Tuple[str, str]]] = defaultdict(set)
        
    def load_all(self, curriculum_file: str, room_file: str,
                 student_files: List[str] = None,
                 teacher_files: List[str] = None,
                 room_timetable_files: List[str] = None):
        """Load all data files."""
        self.load_curriculum(curriculum_file)
        self.load_rooms(room_file)
        self.load_timetables(
            student_files or [],
            teacher_files or [],
            room_timetable_files or []
        )
        
    def load_curriculum(self, filepath: str):
        """Load and parse curriculum data."""
        df = pd.read_csv(filepath)
        
        current_grade = None
        lesson_counter = 0
        
        for idx, row in df.iterrows():
            subject_id = str(row.get('subject_id', '')).strip()
            if subject_id in GRADE_LEVELS:
                current_grade = subject_id
                continue
            
            if pd.isna(row.get('periods_per_week')) or not row.get('periods_per_week'):
                continue
            
            teacher_ids = parse_teacher_ids(row.get('teacher', ''))
            if not teacher_ids:
                continue
                
            student_classes_raw = parse_student_classes(row.get('student_class', ''))
            if not student_classes_raw or not current_grade:
                continue
            
            grade_num = current_grade.replace('ม.', '')
            student_classes = [f"{grade_num}_{c}" for c in student_classes_raw]
            
            periods = int(float(row.get('periods_per_week', 1)))
            block_pattern = str(row.get('block_pattern', '1'))
            required_room = row.get('room') if pd.notna(row.get('room')) else None
            constraint = row.get('constraint') if pd.notna(row.get('constraint')) else None
            fixed_period = row.get('fixed_period') if pd.notna(row.get('fixed_period')) else None
            
            subject_name = str(row.get('subject_name', '')) if pd.notna(row.get('subject_name')) else ''
            if not subject_name:
                subject_name = subject_id
            
            lesson = Lesson(
                lesson_id=f"L{lesson_counter:04d}",
                subject_id=subject_id if subject_id else f"SUB{lesson_counter}",
                subject_name=subject_name,
                teacher_ids=teacher_ids,
                student_classes=student_classes,
                periods_per_week=periods,
                block_pattern=block_pattern,
                required_room=required_room,
                constraint=constraint,
                fixed_period=fixed_period
            )
            self.curriculum.append(lesson)
            lesson_counter += 1
            
        return len(self.curriculum)
        
    def load_rooms(self, filepath: str):
        """Load room data."""
        df = pd.read_csv(filepath)
        for _, row in df.iterrows():
            room_id = str(row['room_id']).strip()
            self.rooms[room_id] = {
                'note': row.get('note', ''),
                'tag': row.get('tag', '')
            }
        return len(self.rooms)
        
    def load_timetables(self, student_files: List[str], 
                        teacher_files: List[str],
                        room_files: List[str]):
        """Load existing timetables and extract pre-placed slots."""
        
        for filepath in student_files:
            filename = os.path.basename(filepath)
            match = re.search(r'student_(\d+_\d+)', filename)
            if match:
                class_id = match.group(1)
                df = self._load_timetable_csv(filepath)
                self.student_timetables[class_id] = df
                self._extract_preplaced_slots(df, f"student_{class_id}")
                
        for filepath in teacher_files:
            filename = os.path.basename(filepath)
            match = re.search(r'teacher_([A-Za-z]\d+)', filename)
            if match:
                teacher_id = match.group(1)
                df = self._load_timetable_csv(filepath)
                self.teacher_timetables[teacher_id] = df
                self._extract_preplaced_slots(df, f"teacher_{teacher_id}")
                
        for filepath in room_files:
            filename = os.path.basename(filepath)
            match = re.search(r'room_(.+)\.csv', filename)
            if match:
                room_id = match.group(1)
                if room_id != 'cleaned':
                    df = self._load_timetable_csv(filepath)
                    self.room_timetables[room_id] = df
                    self._extract_preplaced_slots(df, f"room_{room_id}")
                    
    def _load_timetable_csv(self, filepath: str) -> pd.DataFrame:
        """Load a timetable CSV file."""
        df = pd.read_csv(filepath, index_col=0)
        if len(df) > 0 and df.index[0] not in DAYS:
            df = df.iloc[1:]
        return df
    
    def _extract_preplaced_slots(self, df: pd.DataFrame, entity_id: str):
        """Extract pre-placed (occupied) slots from a timetable."""
        for day in df.index:
            if day not in DAYS:
                continue
            for period in df.columns:
                if period in ['Morning Break', 'Afternoon Break', '1']:
                    continue
                cell_value = df.loc[day, period]
                if is_slot_blocked(cell_value):
                    self.preplaced_slots[entity_id].add((day, period))
    
    def get_stats(self) -> Dict:
        """Get statistics about loaded data."""
        return {
            'lessons_count': len(self.curriculum),
            'rooms_count': len(self.rooms),
            'student_timetables_count': len(self.student_timetables),
            'teacher_timetables_count': len(self.teacher_timetables),
            'room_timetables_count': len(self.room_timetables),
            'preplaced_slots_count': sum(len(slots) for slots in self.preplaced_slots.values())
        }
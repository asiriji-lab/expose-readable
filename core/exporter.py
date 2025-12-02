"""
================================================================================
GA SCHEDULER - Schedule Exporter
================================================================================

Exports completed schedules to CSV files.
"""

import os
import pandas as pd
from typing import Dict, List, Tuple
from collections import defaultdict

from .models import (
    Lesson, TimeSlot, Chromosome,
    DAYS, ALL_COLUMNS
)
from .data_loader import DataLoader


class ScheduleExporter:
    """Exports completed schedules to CSV files."""
    
    def __init__(self, data_loader: DataLoader, chromosome: Chromosome,
                 output_dir: str):
        self.data = data_loader
        self.chromosome = chromosome
        self.output_dir = output_dir
        
        os.makedirs(output_dir, exist_ok=True)
        
        self.lesson_lookup = {lesson.lesson_id: lesson 
                             for lesson in data_loader.curriculum}
        
        # Stats
        self.exported_files = {
            'students': [],
            'teachers': [],
            'rooms': []
        }
        
    def export_all(self) -> Dict:
        """Export all timetables."""
        # Build assignment index
        assignments_by_teacher: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        assignments_by_student: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        assignments_by_room: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        
        for lesson_id, assignments in self.chromosome.genes.items():
            lesson = self.lesson_lookup.get(lesson_id)
            if not lesson:
                continue
            
            for slot, room in assignments:
                for teacher_id in lesson.teacher_ids:
                    assignments_by_teacher[teacher_id].append((slot, room, lesson))
                    
                for class_id in lesson.student_classes:
                    assignments_by_student[class_id].append((slot, room, lesson))
                    
                assignments_by_room[room].append((slot, room, lesson))
                
        # Export teacher timetables
        all_teachers = set(assignments_by_teacher.keys())
        for teacher_id in self.data.teacher_timetables.keys():
            all_teachers.add(teacher_id)
            
        for teacher_id in all_teachers:
            filepath = self._export_teacher_timetable(
                teacher_id, 
                assignments_by_teacher.get(teacher_id, [])
            )
            self.exported_files['teachers'].append(filepath)
            
        # Export student timetables
        all_students = set(assignments_by_student.keys())
        for class_id in self.data.student_timetables.keys():
            all_students.add(class_id)
            
        for class_id in all_students:
            filepath = self._export_student_timetable(
                class_id,
                assignments_by_student.get(class_id, [])
            )
            self.exported_files['students'].append(filepath)
            
        # Export room timetables
        all_rooms = set(assignments_by_room.keys()) | set(self.data.rooms.keys())
        for room_id in all_rooms:
            filepath = self._export_room_timetable(
                room_id,
                assignments_by_room.get(room_id, [])
            )
            self.exported_files['rooms'].append(filepath)
            
        return {
            'teachers_exported': len(self.exported_files['teachers']),
            'students_exported': len(self.exported_files['students']),
            'rooms_exported': len(self.exported_files['rooms']),
            'output_dir': self.output_dir
        }
        
    def _create_empty_timetable(self) -> pd.DataFrame:
        """Create empty timetable DataFrame."""
        df = pd.DataFrame('', index=DAYS, columns=ALL_COLUMNS)
        
        for day in DAYS:
            df.loc[day, '1'] = 'Homeroom'
            df.loc[day, 'Morning Break'] = 'Morning Break'
            df.loc[day, 'Afternoon Break'] = 'Afternoon Break'
            
        return df
    
    def _export_teacher_timetable(self, teacher_id: str,
                                  assignments: List[Tuple[TimeSlot, str, Lesson]]) -> str:
        """Export a teacher's timetable."""
        if teacher_id in self.data.teacher_timetables:
            df = self.data.teacher_timetables[teacher_id].copy()
        else:
            df = self._create_empty_timetable()
            
        preplaced = self.data.preplaced_slots.get(f"teacher_{teacher_id}", set())
        
        for slot, room, lesson in assignments:
            if (slot.day, slot.period) not in preplaced:
                if slot.day in df.index and slot.period in df.columns:
                    current = df.loc[slot.day, slot.period]
                    if pd.isna(current) or current == '':
                        classes = ', '.join(lesson.student_classes)
                        cell_value = f"{lesson.subject_name or lesson.subject_id} ({classes}) [{room}]"
                        df.loc[slot.day, slot.period] = cell_value
                    
        filepath = os.path.join(self.output_dir, f"teacher_{teacher_id}.csv")
        df.to_csv(filepath)
        return filepath
        
    def _export_student_timetable(self, class_id: str,
                                  assignments: List[Tuple[TimeSlot, str, Lesson]]) -> str:
        """Export a student class's timetable."""
        if class_id in self.data.student_timetables:
            df = self.data.student_timetables[class_id].copy()
        else:
            df = self._create_empty_timetable()
            self._add_student_standard_activities(df, class_id)
            
        preplaced = self.data.preplaced_slots.get(f"student_{class_id}", set())
        
        for slot, room, lesson in assignments:
            if (slot.day, slot.period) not in preplaced:
                if slot.day in df.index and slot.period in df.columns:
                    current = df.loc[slot.day, slot.period]
                    if pd.isna(current) or current == '':
                        teachers = ', '.join(lesson.teacher_ids)
                        cell_value = f"{lesson.subject_name or lesson.subject_id} ({teachers}) [{room}]"
                        df.loc[slot.day, slot.period] = cell_value
                    
        filepath = os.path.join(self.output_dir, f"student_{class_id}.csv")
        df.to_csv(filepath)
        return filepath
        
    def _add_student_standard_activities(self, df: pd.DataFrame, class_id: str):
        """Add standard activities for students."""
        grade = class_id.split('_')[0]
        
        if grade in ['1', '2', '3']:
            df.loc[:, '7'] = 'Lunch ม.ต้น'
        else:
            df.loc[:, '6'] = 'Lunch ม.ปลาย'
            
        df.loc['Wednesday', '9'] = 'ชุมนุม'
        df.loc['Wednesday', '10'] = 'ชุมนุม'
        
        if grade in ['1', '2', '3']:
            df.loc['Monday', '9'] = f'ลูกเสือม.{grade}'
            df.loc['Monday', '10'] = f'ลูกเสือม.{grade}'
            
        df.loc['Friday', '2'] = 'เสรีม.ต้น1' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย1'
        df.loc['Friday', '3'] = 'เสรีม.ต้น1' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย1'
        df.loc['Friday', '4'] = 'เสรีม.ต้น2' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย2'
        df.loc['Friday', '5'] = 'เสรีม.ต้น2' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย2'
        df.loc['Friday', '8'] = 'Bridging course'
        df.loc['Friday', '9'] = 'Bridging course'
        df.loc['Friday', '10'] = 'Bridging course'
        
    def _export_room_timetable(self, room_id: str,
                               assignments: List[Tuple[TimeSlot, str, Lesson]]) -> str:
        """Export a room's timetable."""
        if room_id in self.data.room_timetables:
            df = self.data.room_timetables[room_id].copy()
        else:
            df = self._create_empty_timetable()
            
        preplaced = self.data.preplaced_slots.get(f"room_{room_id}", set())
        
        for slot, room, lesson in assignments:
            if room == room_id and (slot.day, slot.period) not in preplaced:
                if slot.day in df.index and slot.period in df.columns:
                    current = df.loc[slot.day, slot.period]
                    if pd.isna(current) or current == '':
                        classes = ', '.join(lesson.student_classes)
                        teachers = ', '.join(lesson.teacher_ids)
                        cell_value = f"{lesson.subject_name or lesson.subject_id} ({classes}) - {teachers}"
                        df.loc[slot.day, slot.period] = cell_value
                    
        safe_room_id = room_id.replace('/', '-').replace('\\', '-')
        filepath = os.path.join(self.output_dir, f"room_{safe_room_id}.csv")
        df.to_csv(filepath)
        return filepath
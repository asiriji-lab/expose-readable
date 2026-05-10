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

from .models import Lesson, TimeSlot, Chromosome

# Avoid circular import by importing only for type hinting if needed
# from .scheduler import ScheduleManager hiding inside method or relying on passing instance

class ScheduleExporter:
    """Exports completed schedules to CSV files."""
    
    def __init__(self, schedule_manager, chromosome: Chromosome,
                 output_dir: str):
        self.manager = schedule_manager
        self.chromosome = chromosome
        self.output_dir = output_dir
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Build a lookup for lessons from the curriculum sheet in ScheduleManager
        # Assuming schedule_manager.sheets['curriculum'] is a DataFrame.
        # However, the GA usually passes Lesson objects. 
        # The GA (GeneticAlgorithm class) has self.lessons list of Lesson objects.
        # But here we only have schedule_manager.
        # If schedule_manager doesn't store Lesson objects, we might need them passed in.
        # Let's assume the user's previous code "schedule_manager.curriculum" meant a list of Lessons was attached to it?
        # A safer bet: The chromosome genes map lesson_id -> assignments.
        # We need to look up Lesson details (subject name, teachers) using lesson_id.
        # If ScheduleManager doesn't have Lesson objects, we can't do this easily unless we parse again or pass lessons.
        # However, looking at the previous user code: "for lesson in schedule_manager.curriculum". 
        # ScheduleManager.py shows `self.curriculum` is NOT defined in __init__.
        # But `integrated_genetic_algorithm.py` creates `self.lessons`.
        # Maybe we should require `lessons` map passed to __init__?
        # Strategies:
        # 1. Pass `lessons` list to __init__.
        # 2. Re-construct from `manager.sheets['curriculum']` (painful).
        # We will assume we can rely on `schedule_manager.sheets['curriculum']` dataframe for basic info if needed,
        # OR better, if this is called from integrated_genetic_algorithm, we can pass the lessons.
        # Let's check how it's called in integrated_genetic_algorithm.py...
        # Wait, the Exporter is initialized in `export_final_schedules` in `integrated_main.py` probably?
        # No, `integrated_main.py` calls `export_final_schedules` which calls `exporter`.
        # Actually `GeneticAlgorithm` calls `get_result_summary`.
        
        # Let's stick to what we can do. We will try to rely on what passed. 
        # But for now, let's fix the immediate syntax errors.
        # I will assume `schedule_manager` has a `curriculum` attribute or I'll use sheets.
        pass

    def export_all(self, lessons: List[Lesson]) -> Dict:
        """Export all timetables."""
        # We need lessons list here to look up details
        lesson_lookup = {l.lesson_id: l for l in lessons}
        
        # Build assignment index
        assignments_by_teacher: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        assignments_by_student: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        assignments_by_room: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        
        for lesson_id, assignments in self.chromosome.genes.items():
            lesson = lesson_lookup.get(lesson_id)
            if not lesson:
                continue
            
            for slot, room in assignments:
                for teacher_id in lesson.teacher_ids:
                    assignments_by_teacher[teacher_id].append((slot, room, lesson))
                    
                for class_id in lesson.student_classes:
                    assignments_by_student[class_id].append((slot, room, lesson))
                    
                assignments_by_room[room].append((slot, room, lesson))
        
        stats = {
            'teachers_exported': 0,
            'students_exported': 0,
            'rooms_exported': 0,
            'output_dir': self.output_dir
        }

        # Create subdirectories
        os.makedirs(os.path.join(self.output_dir, "teachers"), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "students"), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "rooms"), exist_ok=True)

        _SKIP_IDS = {'', 'nan', 'None', 'none'}

        # Export teacher timetables
        all_teachers = set(assignments_by_teacher.keys())
        all_teachers.update(self.manager.teacher_grids.keys())

        for teacher_id in all_teachers:
            if not teacher_id or str(teacher_id).strip() in _SKIP_IDS:
                continue
            safe_teacher_id = str(teacher_id).replace('/', '-').replace('\\', '-')
            self._export_grid(
                entity_type='teacher',
                entity_id=teacher_id,
                assignments=assignments_by_teacher.get(teacher_id, []),
                filename=os.path.join("teachers", f"teacher_{safe_teacher_id}.csv")
            )
            stats['teachers_exported'] += 1
            
        # Export student timetables
        all_students = set(assignments_by_student.keys())
        all_students.update(self.manager.student_grids.keys())
            
        for class_id in all_students:
            if not class_id or str(class_id).strip() in _SKIP_IDS:
                continue
            safe_class_id = str(class_id).replace('/', '-').replace('\\', '-')
            self._export_grid(
                entity_type='student',
                entity_id=class_id,
                assignments=assignments_by_student.get(class_id, []),
                filename=os.path.join("students", f"student_{safe_class_id}.csv")
            )
            stats['students_exported'] += 1
            
        # Export room timetables
        all_rooms = set(assignments_by_room.keys())
        all_rooms.update(self.manager.room_grids.keys())
        
        for room_id in all_rooms:
            if not room_id or str(room_id).strip() in _SKIP_IDS:
                continue
            safe_room_id = str(room_id).replace('/', '-').replace('\\', '-')
            self._export_grid(
                entity_type='room',
                entity_id=room_id,
                assignments=assignments_by_room.get(room_id, []),
                filename=os.path.join("rooms", f"room_{safe_room_id}.csv")
            )
            stats['rooms_exported'] += 1
            
        return stats
        
    def _create_empty_timetable(self) -> pd.DataFrame:
        """Create empty timetable DataFrame using Manager's template."""
        if self.manager.template_grid is not None:
             return self.manager.template_grid.copy()
        
        # Fallback if template not ready (unlikely)
        cols = [f"{p.label},{p.time}" for p in self.manager.periods]
        return pd.DataFrame(index=self.manager.weekdays, columns=cols)
    
    def _export_grid(self, entity_type: str, entity_id: str, 
                     assignments: List[Tuple[TimeSlot, str, Lesson]], 
                     filename: str):
        """Generic export for any entity grid."""
        
        # Get existing grid from Manager or create new
        if entity_type == 'teacher':
            grid = self.manager.teacher_grids.get(entity_id)
        elif entity_type == 'student':
            grid = self.manager.student_grids.get(entity_id)
        elif entity_type == 'room':
            grid = self.manager.room_grids.get(entity_id)
        else:
            grid = None
            
        if grid is None:
            df = self._create_empty_timetable()
        else:
            df = grid.copy()
            
        # Overlay GA assignments
        # Note: Manager grids might already have GA assignments if we applied them?
        # But if we are exporting from Chromosome, we assume we might want to overlay fresh.
        # If integrated_main applied solution to manager, then manager grids are FULL. 
        # In that case, we just dump the grid!
        # CHECK: Did we apply solution? Yes, integrated_main usually does.
        # But if we want to be safe, we overlay 'assignments' on top of `df`.
        # HOWEVER, if `df` is already the FULL schedule from manager, we don't need to re-loop assignments.
        # But `assignments` here comes from `chromosome`.
        # If `grid` comes from `manager`, and `manager` was updated with `_apply_solution_to_manager`,
        # then `grid` ALREADY contains the lessons. 
        # So we can just save `df`!
        #
        # BUT, `_apply_solution_to_manager` puts `subject_id` in the cell.
        # We might want formatted text like "Math (T01) [R1]".
        # The Manager holds `subject_id` strings usually.
        # If we want rich text, we need to reconstruct it from assignments.
        
        for slot, room, lesson in assignments:
            # slot.period_col is already the full column header ("2,08.05-08.55")
            target_col = slot.period_col if slot.period_col in df.columns else None

            if target_col and slot.day in df.index:
                # Construct pretty string
                if entity_type == 'student':
                     teachers = ','.join(lesson.teacher_ids)
                     val = f"{lesson.subject_name} ({teachers}) [{room}]"
                elif entity_type == 'teacher':
                     classes = ','.join(lesson.student_classes)
                     val = f"{lesson.subject_name} ({classes}) [{room}]"
                else: # room
                     val = f"{lesson.subject_name} ({','.join(lesson.student_classes)})"
                
                df.at[slot.day, target_col] = val
        
        filepath = os.path.join(self.output_dir, filename)
        df.to_csv(filepath, encoding='utf-8-sig')
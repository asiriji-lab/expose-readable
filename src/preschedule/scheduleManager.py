import pandas as pd
from typing import Dict, List, Optional, Any
from src.types import PeriodItemData

# ============================================
# Schedule Manager (Your State Class)
# ============================================

class ScheduleManager:
    def __init__(self):
        self.periods: List[PeriodItemData] = []
        self.weekdays: List[str] = ["MON", "TUE", "WED", "THU", "FRI"]

        self.template_grid: Optional[pd.DataFrame] = None

        self.student_grids: Dict[str, pd.DataFrame] = {}
        self.teacher_grids: Dict[str, pd.DataFrame] = {}
        self.room_grids: Dict[str, pd.DataFrame] = {}

        self.conflicts: List[Dict[str, Any]] = []

        self.sheets: Dict[str, pd.DataFrame] = {}

        # Curriculum lessons with fixed slots pre-placed in preschedule.
        # Each entry: {subject_id, subject_name, teacher_ids, student_classes,
        #              room, slots: [(day, period_label)], block_pattern}
        self.locked_lessons: List[Dict[str, Any]] = []

    def initialize_grids(self, periods: List[PeriodItemData]) -> str:
        """Creates the template DataFrame based on structured period data"""
        self.periods = periods
        column_headers = [f"{p.label},{p.time}" for p in self.periods]

        template_df = pd.DataFrame(index=self.weekdays, columns=column_headers)
        template_df[:] = None

        for p in self.periods:
            header = f"{p.label},{p.time}"
            label = p.label.strip()
            
            if not label.isdigit():
                template_df[header] = label
        
        self.template_grid = template_df
        
        print(f"  [State] Initialized grid template with {len(self.periods)} columns.")
        return "Grids structure initialized. Breaks and non-numeric slots filled."

    def _get_or_create_grid(self, entity_type: str, entity_id: str) -> pd.DataFrame:
        """Helper to fetch the correct DataFrame from RAM"""
        if entity_type == "student":
            store = self.student_grids
        elif entity_type == "teacher":
            store = self.teacher_grids
        elif entity_type == "room":
            store = self.room_grids
        else:
            raise ValueError("Invalid entity type")

        if entity_id not in store:
            store[entity_id] = self.template_grid.copy()
    
        return store[entity_id]

    def place_slot(self, day: str, period_col: str, subject_id: str, 
                   teacher_id: Optional[str], room_id: Optional[str], 
                   class_id: Optional[str], reason="sched") -> str:
        """
        Core Logic: Attempts to write to the RAM grids.
        Returns: "Success" or "Conflict: <details>"
        """
        occupied_msg = []
        s_grid, t_grid, r_grid = None, None, None

        # Get Grids and Check conflicts
        if class_id:
            s_grid = self._get_or_create_grid("student", class_id)
            if pd.notna(s_grid.at[day, period_col]):
                occupied_msg.append(f"Class {class_id} busy with {s_grid.at[day, period_col]}")
        if teacher_id:
            t_grid = self._get_or_create_grid("teacher", teacher_id)
            if pd.notna(t_grid.at[day, period_col]):
                occupied_msg.append(f"Teacher {teacher_id} busy with {t_grid.at[day, period_col]}")
        if room_id:
            r_grid = self._get_or_create_grid("room", room_id)
            if pd.notna(r_grid.at[day, period_col]):
                occupied_msg.append(f"Room {room_id} busy with {r_grid.at[day, period_col]}")

        # If Conflict, Log and Fail
        if occupied_msg:
            conflict_record = {
                "type": reason,
                "subject_id": subject_id,
                "class_id": class_id,
                "day": day,
                "period": period_col,
                "reason": "; ".join(occupied_msg)
            }
            self.conflicts.append(conflict_record)
            return f"CONFLICT: Could not schedule. {'; '.join(occupied_msg)}"

        # If Safe, Write to RAM (Commit State)
        if class_id:
            s_grid.at[day, period_col] = subject_id
        
        if teacher_id:
            # Include room info in teacher grid if available
            t_value = f"{class_id or 'NoStudentListed'} ({subject_id}) at {room_id or 'NoRoomListed'}"
            t_grid.at[day, period_col] = t_value
        
        if room_id:
            r_value = f"{class_id or 'NoStudentListed'} ({subject_id}) with {teacher_id or 'NoTeacherListed'}"
            r_grid.at[day, period_col] = r_value

        return "SUCCESS: Slot scheduled."

    def place_locked_lesson(
        self,
        day: str,
        period_col: str,
        subject_id: str,
        teacher_ids: List[str],
        student_classes: List[str],
        room_id: Optional[str],
    ) -> bool:
        """
        Mark all entity grids as occupied for a fixed/locked curriculum lesson.
        All student_classes, teacher_ids, and room are placed atomically.
        Returns True on success; logs a conflict and returns False if any slot is taken.
        """
        occupied_msgs: List[str] = []

        for cid in student_classes:
            g = self._get_or_create_grid("student", cid)
            if pd.notna(g.at[day, period_col]):
                occupied_msgs.append(f"Class {cid} busy with {g.at[day, period_col]}")

        for tid in teacher_ids:
            g = self._get_or_create_grid("teacher", tid)
            if pd.notna(g.at[day, period_col]):
                occupied_msgs.append(f"Teacher {tid} busy with {g.at[day, period_col]}")

        if room_id:
            g = self._get_or_create_grid("room", room_id)
            if pd.notna(g.at[day, period_col]):
                occupied_msgs.append(f"Room {room_id} busy with {g.at[day, period_col]}")

        if occupied_msgs:
            self.conflicts.append({
                "type": "locked_lesson",
                "subject_id": subject_id,
                "day": day,
                "period": period_col,
                "reason": "; ".join(occupied_msgs),
            })
            return False

        classes_str = ','.join(student_classes)
        teachers_str = ','.join(teacher_ids)

        for cid in student_classes:
            g = self._get_or_create_grid("student", cid)
            g.at[day, period_col] = subject_id

        for tid in teacher_ids:
            g = self._get_or_create_grid("teacher", tid)
            g.at[day, period_col] = f"{classes_str} ({subject_id}) at {room_id or 'NoRoomListed'}"

        if room_id:
            g = self._get_or_create_grid("room", room_id)
            g.at[day, period_col] = f"{classes_str} ({subject_id}) with {teachers_str}"

        return True

    def load_sheet_data(self, sheet_name: str, data: pd.DataFrame) -> str:
        """Loads a pandas DataFrame into the manager"""
        self.sheets[sheet_name] = data
        print(f"  [Data Load] Sheet '{sheet_name}' loaded successfully.")
        return f"Data {sheet_name} loaded into manager."
    
    def get_sheet_data(self, sheet_name: str) -> Optional[pd.DataFrame]:
        """Retrieves a loaded sheet's data by its name"""
        data = self.sheets.get(sheet_name)
        if data is None:
            print(f"  [Error] Data sheet '{sheet_name}' not found in manager.")
        return data
    
    def get_periods(self) -> List[PeriodItemData]:
        return self.periods

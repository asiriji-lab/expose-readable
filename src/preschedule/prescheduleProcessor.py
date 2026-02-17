import pandas as pd
from typing import Dict, List, Optional, Tuple
import re
from src.preschedule.scheduleManager import ScheduleManager
from src.types import PeriodItemData


class PrescheduleProcessor:
    """
    Stateless processor that orchestrates Tasks 1-5.
    All state is managed by ScheduleManager.
    """
    
    def __init__(self, schedule_manager: ScheduleManager):
        self.manager = schedule_manager
        self.weekdays = ["MON", "TUE", "WED", "THU", "FRI"]
        
        # Statistics tracked during processing (ephemeral, not state)
        self._stats = {
            'slots_placed': 0,
            'slots_failed': 0
        }
        
    def run_all_tasks(self, cleaned_data: Dict[str, pd.DataFrame]) -> Dict:
        """
        Execute all 5 tasks in sequence.
        Returns a summary report with statistics.
        """
        print("\n" + "="*80)
        print("STARTING PRESCHEDULE PROCESSING")
        print("="*80 + "\n")
        
        results = {}
        
        # Load all sheets into manager
        for sheet_name, df in cleaned_data.items():
            self.manager.load_sheet_data(sheet_name, df)
        
        # Task 1: Initialize Timetable Grids
        results['task1'] = self.task1_initialize_grids()
        
        # Task 2: Pre-Placement Allocation
        results['task2'] = self.task2_preplace_allocation()
        
        # Task 3: Mark Teacher Availability
        results['task3'] = self.task3_mark_teacher_availability()
        
        # Task 4: Schedule Elective Courses
        results['task4'] = self.task4_schedule_electives()
        
        # Task 5: Assign Scout Sessions
        results['task5'] = self.task5_assign_scout_sessions()
        
        # Generate final report
        results['summary'] = self._generate_summary()
        
        return results
    
    # ========================================================================
    # TASK 1: Initialize Timetable Grids
    # ========================================================================
    
    def task1_initialize_grids(self) -> Dict:
        """
        Step 1: Initialize period structure
        Step 2: Create entity timetables for students, teachers, rooms
        """
        print("\n--- TASK 1: Initialize Timetable Grids ---")
        
        # Step 1: Initialize Period Structure
        df_period = self.manager.get_sheet_data('period')
        if df_period is None:
            return {"status": "failed", "error": "PERIOD sheet not found"}
        
        periods = []
        for _, row in df_period.iterrows():
            periods.append(PeriodItemData(
                label=str(row['period_label']),
                time=str(row['period_time'])
            ))
        
        self.manager.initialize_grids(periods)
        print(f"✅ Initialized period structure with {len(periods)} periods")
        
        # Step 2a: Create Student Timetables
        df_student = self.manager.get_sheet_data('student')
        student_count = 0
        if df_student is not None:
            for class_id in df_student['class_id'].unique():
                self.manager._get_or_create_grid("student", class_id)
                student_count += 1
        print(f"✅ Created {student_count} student timetables")
        
        # Step 2b: Create Teacher Timetables
        df_teacher = self.manager.get_sheet_data('teacher')
        teacher_count = 0
        if df_teacher is not None:
            for teacher_id in df_teacher['teacher_id'].unique():
                self.manager._get_or_create_grid("teacher", teacher_id)
                teacher_count += 1
        print(f"✅ Created {teacher_count} teacher timetables")
        
        # Step 2c: Create Room Timetables
        df_room = self.manager.get_sheet_data('room')
        room_count = 0
        if df_room is not None:
            for room_id in df_room['room_id'].unique():
                self.manager._get_or_create_grid("room", room_id)
                room_count += 1
        print(f"✅ Created {room_count} room timetables")
        
        return {
            "status": "success",
            "periods": len(periods),
            "students": student_count,
            "teachers": teacher_count,
            "rooms": room_count
        }
    
    # ========================================================================
    # TASK 2: Pre-Placement Allocation
    # ========================================================================
    
    def task2_preplace_allocation(self) -> Dict:
        """
        Process all pre-placed slots from PREPLACE sheet.
        Parse period ranges and place them in timetables.
        All results stored in manager.conflicts automatically.
        """
        print("\n--- TASK 2: Pre-Placement Allocation ---")
        
        df_preplace = self.manager.get_sheet_data('preplace')
        if df_preplace is None:
            return {"status": "failed", "error": "PREPLACE sheet not found"}
        
        # Track stats for this task only (ephemeral)
        conflicts_before = len(self.manager.conflicts)
        slots_attempted = 0
        
        for idx, row in df_preplace.iterrows():
            slot_name = row.get('slot_name', '')
            periods_str = row.get('periods', '')
            apply_to = row.get('apply_to', '')
            
            if pd.isna(periods_str) or pd.isna(apply_to):
                continue
            
            # Parse period range into individual (day, period) slots
            parsed_slots = self._parse_period_range(str(periods_str))
            
            # Determine which entities this applies to
            affected_entities = self._resolve_apply_to(str(apply_to))
            
            # Place each slot for each affected entity
            for day, period_label in parsed_slots:
                period_col = self._find_period_column(period_label)
                print(f"[DEBUG] Placing activity {slot_name} on {day} slot {period_label}")
                if not period_col:
                    print(f"⚠️  Period label '{period_label}' not found")
                    continue
                
                for entity_type, entity_id in affected_entities:
                    # Manager handles all state updates and conflict logging
                    self.manager.place_slot(
                        day=day,
                        period_col=period_col,
                        subject_id=slot_name,
                        teacher_id=entity_id if entity_type == 'teacher' else None,
                        room_id=None,
                        class_id=entity_id if entity_type == 'student' else None,
                        reason='preplace'
                    )
                    slots_attempted += 1
        
        # Calculate stats from manager state
        conflicts_added = len(self.manager.conflicts) - conflicts_before
        slots_placed = slots_attempted - conflicts_added
        
        print(f"✅ Placed {slots_placed} pre-placement slots")
        print(f"⚠️  Found {conflicts_added} conflicts")
        
        return {
            "status": "success",
            "slots_attempted": slots_attempted,
            "slots_placed": slots_placed,
            "conflicts": conflicts_added
        }
    
    # ========================================================================
    # TASK 3: Mark Teacher Availability
    # ========================================================================
    
    def task3_mark_teacher_availability(self) -> Dict:
        """
        Mark UNAVAILABLE slots for teachers based on their constraints.
        - Internal teachers (Txxx): Use unavailable_slots
        - External teachers (Exxx): Mark all slots NOT in available_slots as UNAVAILABLE
        - If no information provided for a teacher, mark all slots as AVAILABLE (skip)
        All state changes handled by manager.
        """
        print("\n--- TASK 3: Mark Teacher Availability ---")
        
        df_teacher = self.manager.get_sheet_data('teacher')
        if df_teacher is None:
            return {"status": "failed", "error": "TEACHER sheet not found"}
        
        conflicts_before = len(self.manager.conflicts)
        internal_attempted = 0
        external_attempted = 0
        
        for _, row in df_teacher.iterrows():
            teacher_id = row['teacher_id']

            available_str = row.get('available_slots', '')
            unavailable_str = row.get('unavailable_slots', '')

            print(f"teacher {teacher_id} with available slots {available_str} and unavailable slots {unavailable_str}")
            
            if pd.isna(available_str) and pd.isna(unavailable_str):
                print(f"⚠️  Teacher {teacher_id} has no available or unavailable slots")
                continue

            is_external = teacher_id.startswith('E')
            
            if is_external:
                # External teacher: Mark ALL slots as UNAVAILABLE except available_slots
                if pd.isna(available_str) or str(available_str).strip() == '':
                    # No available slots means unavailable for all slots
                    available_slots = []
                else:
                    available_slots = self._parse_period_range(str(available_str))
                
                # Mark all slots as unavailable
                all_slots = self._get_all_time_slots()
                unavailable_slots = [slot for slot in all_slots if slot not in available_slots]
                
                for day, period_label in unavailable_slots:
                    period_col = self._find_period_column(period_label)
                    if period_col:
                        self.manager.place_slot(
                            day=day,
                            period_col=period_col,
                            subject_id="UNAVAILABLE",
                            teacher_id=teacher_id,
                            room_id=None,
                            class_id=None,
                            reason='constraint'
                        )
                        external_attempted += 1
            else:
                # Internal teacher: Mark specific unavailable_slots
                if pd.isna(unavailable_str) or str(unavailable_str).strip() == '':
                    continue
                
                unavailable_slots = self._parse_period_range(str(unavailable_str))
                
                for day, period_label in unavailable_slots:
                    period_col = self._find_period_column(period_label)
                    if period_col:
                        self.manager.place_slot(
                            day=day,
                            period_col=period_col,
                            subject_id="UNAVAILABLE",
                            teacher_id=teacher_id,
                            room_id=None,
                            class_id=None,
                            reason='constraint'
                        )
                        internal_attempted += 1
        
        conflicts_added = len(self.manager.conflicts) - conflicts_before
        internal_marked = internal_attempted - conflicts_added
        external_marked = external_attempted - conflicts_added
        
        print(f"✅ Marked {internal_marked} unavailable slots for internal teachers")
        print(f"✅ Marked {external_marked} unavailable slots for external teachers")
        
        return {
            "status": "success",
            "internal_marked": internal_marked,
            "external_marked": external_marked,
            "conflicts": conflicts_added
        }
    
    # ========================================================================
    # TASK 4: Schedule Elective Courses
    # ========================================================================
    
    def task4_schedule_electives(self) -> Dict:
        """
        Schedule elective courses into teacher and room timetables.
        Process dynamic elective slot columns (where value = 1).
        Manager handles all state updates.
        """
        print("\n--- TASK 4: Schedule Elective Courses ---")
        
        df_elective = self.manager.get_sheet_data('elective')
        if df_elective is None:
            return {"status": "failed", "error": "ELECTIVE sheet not found"}
        
        conflicts_before = len(self.manager.conflicts)
        slots_attempted = 0
        
        # Process each elective subject
        for idx, row in df_elective.iterrows():
            subject_id = row.get('subject_id', f'ELECTIVE_{idx}')
            subject_name = row.get('subject_name', '')
            teacher = row.get('teacher', None)
            room = row.get('room', None)
            
            # Find elective slot columns (columns not in static columns)
            static_cols = {'subject_id', 'subject_name', 'teacher', 'room'}
            elective_slot_cols = [col for col in df_elective.columns if col not in static_cols]
            
            # Check which slots this elective is offered in (value = 1)
            for slot_col in elective_slot_cols:
                if row.get(slot_col, 0) == 1:
                    # This elective is offered in this slot

                    parsed_slots = self._parse_period_range(slot_col)
                    
                    # Schedule in teacher and room timetables
                    for day, period_label in parsed_slots:
                        period_col = self._find_period_column(period_label)
                        if not period_col:
                            continue
                        
                        # Handle teacher as list or single value
                        teachers = teacher if isinstance(teacher, list) else ([teacher] if teacher else [])
                        rooms = room if isinstance(room, list) else ([room] if room else [])
                        
                        # Assume there is 1 teacher and 1 room for elective subject
                        self.manager.place_slot(
                            day=day,
                            period_col=period_col,
                            subject_id=subject_id,
                            teacher_id=teachers[0],
                            room_id=rooms[0],
                            class_id=None,
                            reason='elective'
                        )
                        slots_attempted += 1
        
        conflicts_added = len(self.manager.conflicts) - conflicts_before
        slots_scheduled = slots_attempted - conflicts_added
        
        print(f"✅ Scheduled {slots_scheduled} elective slots")
        print(f"⚠️  Found {conflicts_added} conflicts")
        
        return {
            "status": "success",
            "slots_attempted": slots_attempted,
            "slots_scheduled": slots_scheduled,
            "conflicts": conflicts_added
        }
    
    # ========================================================================
    # TASK 5: Assign Scout Sessions
    # ========================================================================
    
    def task5_assign_scout_sessions(self) -> Dict:
        """
        Assign scout sessions to teachers based on grade columns in SCOUT sheet.
        Manager handles all state updates.
        """
        print("\n--- TASK 5: Assign Scout Sessions ---")
        
        df_scout = self.manager.get_sheet_data('scout')
        if df_scout is None:
            return {"status": "skipped", "reason": "SCOUT sheet not found"}
        
        df_preplace = self.manager.get_sheet_data('preplace')
        if df_preplace is None:
            return {"status": "failed", "error": "PREPLACE sheet needed for scout slot mapping"}
        
        # Build mapping of scout slot names to periods
        scout_slots = {}
        for _, row in df_preplace.iterrows():
            slot_name = str(row.get('slot_name', ''))
            if 'ลูกเสือ' in slot_name or 'scout' in slot_name.lower():
                periods_str = row.get('periods', '')
                if not pd.isna(periods_str):
                    scout_slots[slot_name] = str(periods_str)
        
        if not scout_slots:
            print("⚠️  No scout slots found in PREPLACE sheet")
            return {"status": "skipped", "reason": "No scout slots defined"}
        
        conflicts_before = len(self.manager.conflicts)
        slots_attempted = 0
        
        # Process each grade column in SCOUT sheet
        for col in df_scout.columns:
            # Column name should be like "ลูกเสือม.1" or similar
            # Find matching scout slot in preplace
            matching_slot = None
            for slot_name in scout_slots.keys():
                if col in slot_name or slot_name in col:
                    matching_slot = slot_name
                    break
            
            if not matching_slot:
                print(f"⚠️  No matching scout slot found for grade column: {col}")
                continue
            
            periods_str = scout_slots[matching_slot]
            parsed_slots = self._parse_period_range(periods_str)
            
            # Get teacher list from the column (first row)
            if len(df_scout) > 0:
                teacher_value = df_scout[col].iloc[0]
                
                # Handle teacher as list or single value
                if pd.isna(teacher_value):
                    continue
                
                teachers = teacher_value if isinstance(teacher_value, list) else [teacher_value]
                
                # Assign to each teacher
                for teacher_id in teachers:
                    if pd.isna(teacher_id):
                        continue
                    
                    for day, period_label in parsed_slots:
                        period_col = self._find_period_column(period_label)
                        if not period_col:
                            continue
                        
                        self.manager.place_slot(
                            day=day,
                            period_col=period_col,
                            subject_id=matching_slot,
                            teacher_id=teacher_id,
                            room_id=None,
                            class_id=None,
                            reason='scout'
                        )
                        slots_attempted += 1
        
        conflicts_added = len(self.manager.conflicts) - conflicts_before
        slots_assigned = slots_attempted - conflicts_added
        
        print(f"✅ Assigned {slots_assigned} scout sessions")
        print(f"⚠️  Found {conflicts_added} conflicts")
        
        return {
            "status": "success",
            "slots_attempted": slots_attempted,
            "slots_assigned": slots_assigned,
            "conflicts": conflicts_added
        }

    
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    def _parse_period_range(self, period_string: str) -> List[Tuple[str, str]]:
        """
        Parse period range expressions into list of (day, period_label) tuples.
        
        Examples:
        - "MON_1" -> [("MON", "1")]
        - "MON_1-MON_3" -> [("MON", "1"), ("MON", "2"), ("MON", "3")]
        - "Everyday_4" -> [("MON", "4"), ("TUE", "4"), ..., ("FRI", "4")]
        - "TUE_2,THU_2" -> [("TUE", "2"), ("THU", "2")]
        """
        result = []
        ranges = [r.strip() for r in period_string.split(',')]
        for range_expr in ranges:
            if 'Everyday' in range_expr:
                # Extract period number
                parts = range_expr.split('_')
                if len(parts) >= 2:
                    period = parts[1]
                    for day in self.weekdays:
                        result.append((day, period))
            
            elif '-' in range_expr:
                # Range format: DAY_START-DAY_END
                try:
                    parts = range_expr.split('-')
                    if len(parts) != 2:
                        print(f"⚠️  Skipping invalid range format (expected 1 hyphen): {range_expr}")
                        continue
                        
                    start_part, end_part = parts
                except ValueError:
                    print(f"⚠️  Skipping invalid period range: {range_expr}")
                    continue

                start_parts = start_part.split('_')
                end_parts = end_part.split('_')
                
                if len(start_parts) >= 2 and len(end_parts) >= 2:
                    start_day, start_period = start_parts[0], start_parts[1]
                    end_day, end_period = end_parts[0], end_parts[1]
                    
                    # Same day range
                    if start_day == end_day:
                        try:
                            for p in range(int(start_period), int(end_period) + 1):
                                result.append((start_day, str(p)))
                        except ValueError:
                            print(f"⚠️  Invalid period range: {range_expr}")
            
            else:
                # Single slot: DAY_PERIOD
                parts = range_expr.split('_')
                if len(parts) >= 2:
                    day, period = parts[0], parts[1]
                    result.append((day, period))
        
        return result
    
    def _find_period_column(self, period_label: str) -> Optional[str]:
        """Find the period column header (label,time) for a given period label."""
        periods = self.manager.get_periods()
        for p in periods:
            if p.label == period_label:
                return f"{p.label},{p.time}"
        return None
    
    def _resolve_apply_to(self, apply_to: str) -> List[Tuple[str, str]]:
        """
        Resolve 'apply_to' value to list of (entity_type, entity_id) tuples.
        
        Examples:
        - "All" -> all students and internal teachers
        - "ม.1" -> all students in grade 1
        - "1/1" -> specific class
        - "1/1,1/2" -> multiple classes
        
        Note: Grade column is now standardized to "ม.X" format during cleaning.
        """
        entities = []
        
        if apply_to == "All":
            # All students
            df_student = self.manager.get_sheet_data('student')
            if df_student is not None:
                for class_id in df_student['class_id'].unique():
                    entities.append(('student', class_id))
            
            # All internal teachers
            df_teacher = self.manager.get_sheet_data('teacher')
            if df_teacher is not None:
                for teacher_id in df_teacher['teacher_id'].unique():
                    if teacher_id.startswith('T'):  # Internal only
                        entities.append(('teacher', teacher_id))
        
        elif '/' in apply_to:
            # Specific class or comma-separated classes
            class_ids = [c.strip() for c in apply_to.split(',')]
            for class_id in class_ids:
                entities.append(('student', class_id))
        
        else:
            # Grade level (e.g., "ม.1" or "ม.1,ม.2")
            grades = [g.strip() for g in apply_to.split(',')]
            df_student = self.manager.get_sheet_data('student')
            if df_student is not None:
                for grade in grades:
                    # Direct match since grades are now standardized to "ม.X" format
                    matching_classes = df_student[df_student['grade'] == grade]['class_id'].unique()
                    
                    if len(matching_classes) == 0:
                        print(f"⚠️ No classes found for grade '{grade}'")
                        print(f"   Available grades: {sorted(df_student['grade'].unique())}")
                    
                    for class_id in matching_classes:
                        entities.append(('student', class_id))
        
        return entities
    
    def _get_all_time_slots(self) -> List[Tuple[str, str]]:
        """Get all possible (day, period_label) combinations."""
        periods = self.manager.get_periods()
        slots = []
        for day in self.weekdays:
            for p in periods:
                # Only include numeric periods (skip breaks)
                if p.label.isdigit():
                    slots.append((day, p.label))
        return slots
    
    def _generate_summary(self) -> Dict:
        """Generate final summary report from manager state."""
        print("\n" + "="*80)
        print("PRESCHEDULE PROCESSING COMPLETE")
        print("="*80)
        
        # All statistics come from manager state
        total_conflicts = len(self.manager.conflicts)
        
        summary = {
            "total_students": len(self.manager.student_grids),
            "total_teachers": len(self.manager.teacher_grids),
            "total_rooms": len(self.manager.room_grids),
            "total_conflicts": total_conflicts,
            "conflict_breakdown": {}
        }
        
        # Breakdown conflicts by type from manager.conflicts
        conflict_types = {}
        for conflict in self.manager.conflicts:
            ctype = conflict.get('type', 'unknown')
            conflict_types[ctype] = conflict_types.get(ctype, 0) + 1
        
        summary['conflict_breakdown'] = conflict_types
        
        print(f"\n📊 Summary:")
        print(f"  - Student timetables: {summary['total_students']}")
        print(f"  - Teacher timetables: {summary['total_teachers']}")
        print(f"  - Room timetables: {summary['total_rooms']}")
        print(f"  - Total conflicts: {summary['total_conflicts']}")
        
        if conflict_types:
            print(f"\n⚠️  Conflicts by type:")
            for ctype, count in conflict_types.items():
                print(f"    - {ctype}: {count}")
        
        return summary
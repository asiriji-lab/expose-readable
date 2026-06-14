import ast
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Tuple
import re
from src.preschedule.scheduleManager import ScheduleManager
from src.types import PeriodItemData


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


def _parse_constraint_type(constraint_str: Any) -> Optional[str]:
    if constraint_str is None or (isinstance(constraint_str, float) and np.isnan(constraint_str)):
        return None
    s = str(constraint_str).upper().replace(' ', '')
    if not s or s in ('NAN', 'NONE'):
        return None
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

        # Task 6: Lock fixed curriculum lessons (MULTI_CLASS_TEAM with fixed_period)
        results['task6'] = self.task6_lock_fixed_curriculum_lessons()

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

        # subject_id -> {name, teacher, room, placed: [slot_str], failed: [(slot_str, reason)]}
        subject_results: Dict[str, Dict] = {}

        static_cols = {'subject_id', 'subject_name', 'teacher', 'room'}

        for idx, row in df_elective.iterrows():
            subject_id   = str(row.get('subject_id',   f'ELECTIVE_{idx}')).strip()
            subject_name = str(row.get('subject_name', '')).strip()
            teacher      = row.get('teacher', None)
            room         = row.get('room',    None)

            teachers = teacher if isinstance(teacher, list) else ([teacher] if teacher else [])
            rooms    = room    if isinstance(room,    list) else ([room]    if room    else [])
            teacher_id = teachers[0] if teachers else None
            room_id    = rooms[0]    if rooms    else None

            if subject_id not in subject_results:
                subject_results[subject_id] = {
                    'name': subject_name,
                    'teacher': teacher_id,
                    'room': room_id,
                    'placed': [],
                    'failed': [],
                }

            elective_slot_cols = [c for c in df_elective.columns if c not in static_cols]

            for slot_col in elective_slot_cols:
                if row.get(slot_col, 0) != 1:
                    continue
                for day, period_label in self._parse_period_range(slot_col):
                    period_col = self._find_period_column(period_label)
                    if not period_col:
                        continue
                    result = self.manager.place_slot(
                        day=day,
                        period_col=period_col,
                        subject_id=subject_id,
                        teacher_id=teacher_id,
                        room_id=room_id,
                        class_id=None,
                        reason='elective',
                    )
                    slots_attempted += 1
                    slot_label = f"{day} {period_label}"
                    if result.startswith("SUCCESS"):
                        subject_results[subject_id]['placed'].append(slot_label)
                    else:
                        subject_results[subject_id]['failed'].append((slot_label, result))

        for subj_id, info in subject_results.items():
            n_ok  = len(info['placed'])
            n_bad = len(info['failed'])
            icon  = "✅" if not n_bad else "⚠️ "
            print(f"  {icon} {subj_id} ({info['name']}) | "
                  f"teacher={info['teacher'] or '-'} room={info['room'] or '-'} | "
                  f"placed={n_ok} failed={n_bad}")
            if info['placed']:
                print(f"       slots : {', '.join(info['placed'])}")
            for slot_label, reason in info['failed']:
                print(f"       ❌ {slot_label}: {reason}")

        conflicts_added   = len(self.manager.conflicts) - conflicts_before
        slots_scheduled   = slots_attempted - conflicts_added
        print(f"\n✅ Scheduled {slots_scheduled} elective slots")
        if conflicts_added:
            print(f"⚠️  Found {conflicts_added} conflicts")

        return {
            "status": "success",
            "slots_attempted": slots_attempted,
            "slots_scheduled": slots_scheduled,
            "conflicts": conflicts_added,
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

        print(f"  Scout slot definitions ({len(scout_slots)}):")
        for sn, sp in scout_slots.items():
            print(f"    {sn} → {sp}")

        conflicts_before = len(self.manager.conflicts)
        slots_attempted  = 0

        # col -> {slot_name, periods: [slot_str], teachers: {tid: {placed:[],failed:[]}}}
        col_results: Dict[str, Dict] = {}

        for col in df_scout.columns:
            matching_slot = None
            for slot_name in scout_slots.keys():
                if col in slot_name or slot_name in col:
                    matching_slot = slot_name
                    break
            if not matching_slot:
                print(f"  ⚠️  No matching scout slot for column: {col}")
                continue

            parsed_slots = self._parse_period_range(scout_slots[matching_slot])
            col_results[col] = {'slot_name': matching_slot, 'teachers': {}}

            for idx, teacher_value in df_scout[col].items():
                if pd.isna(teacher_value):
                    continue
                teachers = teacher_value if isinstance(teacher_value, list) else [teacher_value]

                for teacher_id in teachers:
                    if pd.isna(teacher_id):
                        continue
                    teacher_id = str(teacher_id).strip()
                    if teacher_id not in col_results[col]['teachers']:
                        col_results[col]['teachers'][teacher_id] = {'placed': [], 'failed': []}

                    for day, period_label in parsed_slots:
                        period_col = self._find_period_column(period_label)
                        if not period_col:
                            continue
                        result = self.manager.place_slot(
                            day=day,
                            period_col=period_col,
                            subject_id=matching_slot,
                            teacher_id=teacher_id,
                            room_id=None,
                            class_id=None,
                            reason='scout',
                        )
                        slots_attempted += 1
                        slot_label = f"{day} {period_label}"
                        if result.startswith("SUCCESS"):
                            col_results[col]['teachers'][teacher_id]['placed'].append(slot_label)
                        else:
                            col_results[col]['teachers'][teacher_id]['failed'].append((slot_label, result))

        print(f"\n  Assignments by grade column:")
        for col, info in col_results.items():
            n_teachers = len(info['teachers'])
            print(f"  [{col}] → {info['slot_name']} | {n_teachers} teacher(s)")
            for tid, tinfo in info['teachers'].items():
                n_ok  = len(tinfo['placed'])
                n_bad = len(tinfo['failed'])
                icon  = "✅" if not n_bad else "⚠️ "
                slots_str = ", ".join(tinfo['placed']) if tinfo['placed'] else "none"
                print(f"    {icon} {tid}: placed={n_ok} failed={n_bad} | {slots_str}")
                for slot_label, reason in tinfo['failed']:
                    print(f"       ❌ {slot_label}: {reason}")

        conflicts_added = len(self.manager.conflicts) - conflicts_before
        slots_assigned  = slots_attempted - conflicts_added
        print(f"\n✅ Assigned {slots_assigned} scout sessions")
        if conflicts_added:
            print(f"⚠️  Found {conflicts_added} conflicts")

        return {
            "status": "success",
            "slots_attempted": slots_attempted,
            "slots_assigned":  slots_assigned,
            "conflicts":       conflicts_added,
        }

    
    
    # ========================================================================
    # TASK 6: Lock Fixed Curriculum Lessons
    # ========================================================================

    def task6_lock_fixed_curriculum_lessons(self) -> Dict:
        """
        Pre-place curriculum rows that have a fixed_period value.
        These rows are skipped by the GA (they already have their slot).
        Each placed lesson is stored in manager.locked_lessons so the
        JSON exporter can include them as normal editable lessons in the output.
        """
        print("\n--- TASK 6: Lock Fixed Curriculum Lessons ---")

        df_curriculum = self.manager.get_sheet_data('curriculum')
        if df_curriculum is None:
            return {"status": "skipped", "reason": "curriculum sheet not found"}

        locked_count = 0
        failed_count = 0
        locked_lesson_counter = 0

        for idx, row in df_curriculum.iterrows():
            fixed_period_raw = row.get('fixed_period')
            fp_str = str(fixed_period_raw).strip() if fixed_period_raw is not None else ''
            if fp_str in ('', 'nan', 'None'):
                continue

            constraint_type = _parse_constraint_type(row.get('constraint', ''))

            # Skip SUB_GROUP — the GA handles these via fixed_period as a slot hint.
            if constraint_type == 'SUB_GROUP':
                continue

            subject_id = str(row.get('subject_id', '')).strip()
            subject_name = str(row.get('subject_name', '')).strip()
            if not subject_id or subject_id == 'nan':
                continue

            teacher_ids = _parse_list_field(row.get('teacher'))
            student_classes = _parse_list_field(row.get('student_class'))
            if not student_classes:
                print(f"  [LOCKED] Row {idx} ({subject_id}): no student classes — skipped.")
                continue

            rooms = _parse_list_field(row.get('room'))
            room_id = rooms[0] if rooms else None

            ppw_raw = row.get('periods_per_week')
            try:
                ppw = int(float(ppw_raw)) if ppw_raw is not None else 1
            except (ValueError, TypeError):
                ppw = 1

            block_pattern = str(row.get('block_pattern', str(ppw))).strip()
            if not block_pattern or block_pattern == 'nan':
                block_pattern = str(ppw)

            # For non-MULTI_CLASS_TEAM rows, place each class independently.
            # For MULTI_CLASS_TEAM, place all classes together (one entry per slot).
            if constraint_type == 'MULTI_CLASS_TEAM':
                class_groups = [student_classes]
            else:
                class_groups = [[c] for c in student_classes]

            parsed_slots = self._parse_period_range(fp_str)
            if not parsed_slots:
                print(f"  [LOCKED] Row {idx} ({subject_id}): could not parse fixed_period '{fp_str}' — skipped.")
                continue

            for class_group in class_groups:
                placed_slot_labels: List[Tuple[str, str]] = []
                slot_failures: List[str] = []

                for day, period_label in parsed_slots:
                    period_col = self._find_period_column(period_label)
                    if not period_col:
                        print(f"  [LOCKED] Period '{period_label}' not found, skipping.")
                        continue

                    conflicts_before_slot = len(self.manager.conflicts)
                    ok = self.manager.place_locked_lesson(
                        day=day,
                        period_col=period_col,
                        subject_id=subject_id,
                        teacher_ids=teacher_ids,
                        student_classes=class_group,
                        room_id=room_id,
                    )
                    if ok:
                        placed_slot_labels.append((day, period_label))
                    else:
                        failed_count += 1
                        # Grab the reason from the conflict record just appended
                        new_conflicts = self.manager.conflicts[conflicts_before_slot:]
                        reason = new_conflicts[0]['reason'] if new_conflicts else "unknown"
                        slot_failures.append(f"{day} {period_label}: {reason}")

                classes_str  = ", ".join(class_group)
                teachers_str = ", ".join(teacher_ids) if teacher_ids else "-"
                slots_str    = ", ".join(f"{d} {p}" for d, p in placed_slot_labels) if placed_slot_labels else "none"

                if placed_slot_labels:
                    locked_lesson_counter += 1
                    self.manager.locked_lessons.append({
                        'lesson_id': f"LOCKED_{locked_lesson_counter:04d}",
                        'subject_id': subject_id,
                        'subject_name': subject_name,
                        'teacher_ids': teacher_ids,
                        'student_classes': class_group,
                        'room': room_id,
                        'slots': placed_slot_labels,
                        'block_pattern': block_pattern,
                        'constraint_type': constraint_type,
                    })
                    locked_count += 1
                    icon = "✅" if not slot_failures else "⚠️ "
                    print(f"  {icon} {subject_id} ({subject_name}) | "
                          f"classes=[{classes_str}] teachers=[{teachers_str}] room={room_id or '-'}")
                    print(f"       slots: {slots_str}")
                    for fail in slot_failures:
                        print(f"       ❌ {fail}")
                else:
                    print(f"  ❌ {subject_id} ({subject_name}) | classes=[{classes_str}] — all slots failed:")
                    for fail in slot_failures:
                        print(f"       ❌ {fail}")

        print(f"\n✅ Locked {locked_count} curriculum lesson(s) into grids.")
        if failed_count:
            print(f"⚠️  {failed_count} slot placement(s) failed (conflicts).")

        return {
            "status": "success",
            "locked": locked_count,
            "failed": failed_count,
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
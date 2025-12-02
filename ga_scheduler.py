"""
================================================================================
GENETIC ALGORITHM SCHOOL TIMETABLE COMPLETION SYSTEM
================================================================================

This module implements a Genetic Algorithm (GA) to complete partially-filled
school timetables while respecting pre-placed slots and various constraints.

Author: AI Assistant
Purpose: Complete student, teacher, and room timetables from curriculum data

ARCHITECTURE OVERVIEW:
---------------------
1. Data Loading: Parse curriculum, rooms, and existing timetables
2. Gene Representation: Each lesson assignment is a gene (slot, room)
3. Chromosome: Complete set of all lesson assignments for a schedule
4. Fitness Function: Evaluates constraint violations (lower is better)
5. Genetic Operators: Selection, Crossover, Mutation
6. Evolution: Iteratively improve population toward feasible solution

KEY CONSTRAINTS:
---------------
- Pre-placed slots are IMMUTABLE (never modified)
- No teacher conflicts (same teacher, same time slot)
- No student conflicts (same class, same time slot)
- No room conflicts (same room, same time slot)
- Block patterns must be respected (consecutive periods)
- Correct number of periods per subject per week
- Room assignments must use valid rooms from room_cleaned.csv

================================================================================
"""

import pandas as pd
import numpy as np
import random
import copy
import os
import re
import ast
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Set, Optional, Any
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')


# =============================================================================
# CONFIGURATION AND CONSTANTS
# =============================================================================

# Days of the week
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

# Teaching periods (excluding breaks, lunch, homeroom)
TEACHING_PERIODS = ['2', '3', '4', '5', '6', '7', '8', '9', '10']

# All columns in timetable CSVs
ALL_COLUMNS = ['1', '2', '3', 'Morning Break', '4', '5', '6', '7', '8', 'Afternoon Break', '9', '10']

# Slots that are always blocked (not available for regular teaching)
BLOCKED_KEYWORDS = [
    'Homeroom', 'Morning Break', 'Afternoon Break', 'Lunch',
    'ลูกเสือ', 'ชุมนุม', 'เสรี', 'Bridging course'
]

# Grade level mappings
GRADE_LEVELS = {
    'ม.1': ['1_1', '1_2', '1_3', '1_4'],
    'ม.2': ['2_1', '2_2', '2_3', '2_4'],
    'ม.3': ['3_1', '3_2', '3_3', '3_4'],
    'ม.4': ['4_1', '4_2', '4_3', '4_4', '4_5'],
    'ม.5': ['5_1', '5_2', '5_3', '5_4', '5_5'],
    'ม.6': ['6_1', '6_2', '6_3', '6_4', '6_5'],
}


# =============================================================================
# DATA CLASSES FOR STRUCTURED INFORMATION
# =============================================================================

@dataclass
class Lesson:
    """Represents a single lesson that needs to be scheduled."""
    lesson_id: str  # Unique identifier
    subject_id: str
    subject_name: str
    teacher_ids: List[str]  # Can be multiple teachers (team teaching)
    student_classes: List[str]  # Classes that take this lesson
    periods_per_week: int
    block_pattern: str  # '1', '2', '2-1', '2-2', etc.
    required_room: Optional[str] = None  # Specific room if required
    constraint: Optional[str] = None
    fixed_period: Optional[str] = None  # Pre-fixed time slot


@dataclass
class TimeSlot:
    """Represents a time slot in the schedule."""
    day: str
    period: str
    
    def __hash__(self):
        return hash((self.day, self.period))
    
    def __eq__(self, other):
        return self.day == other.day and self.period == other.period
    
    def __str__(self):
        return f"{self.day[:3]}_{self.period}"
    
    @staticmethod
    def from_string(s: str) -> 'TimeSlot':
        """Parse a string like 'MON_9' into a TimeSlot."""
        day_map = {'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday', 
                   'THU': 'Thursday', 'FRI': 'Friday'}
        parts = s.split('_')
        day = day_map.get(parts[0].upper(), parts[0])
        period = parts[1]
        return TimeSlot(day, period)


@dataclass
class Assignment:
    """Represents a scheduled lesson assignment."""
    lesson: Lesson
    time_slot: TimeSlot
    room: str
    is_preplaced: bool = False  # True if this was pre-placed and immutable


@dataclass
class Gene:
    """A gene represents the scheduling decision for a single lesson block."""
    lesson_id: str
    time_slots: List[TimeSlot]  # List of consecutive slots for block patterns
    room: str
    

# =============================================================================
# PARSER FUNCTIONS
# =============================================================================

def parse_student_classes(student_class_str: str) -> List[str]:
    """Parse student class string like '[1, 2, 3, 4]' into class identifiers."""
    if pd.isna(student_class_str) or not student_class_str:
        return []
    try:
        # Handle string representation of list
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
            # It's a list like "['T005', 'T010']"
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
    
    Returns: (total_periods, list_of_block_sizes)
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
    """
    Parse fixed period string like 'MON_9-MON_10' into list of (day, period) tuples.
    """
    if pd.isna(fixed_str) or not fixed_str:
        return []
    
    fixed_str = str(fixed_str).strip()
    result = []
    
    # Handle range format like 'MON_9-MON_10' or 'TUE_8-TUE_10'
    day_map = {'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday',
               'THU': 'Thursday', 'FRI': 'Friday'}
    
    # Split by '-' but be careful about day-period format
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
    
    # Check against blocked keywords
    for keyword in BLOCKED_KEYWORDS:
        if keyword.lower() in cell_str.lower():
            return True
    
    # Any non-empty value means the slot is occupied
    return True


# =============================================================================
# DATA LOADING CLASSES
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
                 student_files: List[str], teacher_files: List[str],
                 room_timetable_files: List[str]):
        """Load all data files."""
        self.load_curriculum(curriculum_file)
        self.load_rooms(room_file)
        self.load_timetables(student_files, teacher_files, room_timetable_files)
        
    def load_curriculum(self, filepath: str):
        """Load and parse curriculum data."""
        df = pd.read_csv(filepath)
        
        current_grade = None
        lesson_counter = 0
        
        for idx, row in df.iterrows():
            # Check for grade level marker
            subject_id = str(row.get('subject_id', '')).strip()
            if subject_id in GRADE_LEVELS:
                current_grade = subject_id
                continue
            
            # Skip empty rows
            if pd.isna(row.get('periods_per_week')) or not row.get('periods_per_week'):
                # Check if this is a continuation row (same subject, different classes)
                if pd.notna(row.get('teacher')) and current_grade:
                    # This is a continuation - handled in previous row processing
                    pass
                continue
            
            # Parse the lesson data
            teacher_ids = parse_teacher_ids(row.get('teacher', ''))
            if not teacher_ids:
                continue
                
            student_classes_raw = parse_student_classes(row.get('student_class', ''))
            if not student_classes_raw or not current_grade:
                continue
            
            # Convert class numbers to full class IDs
            grade_num = current_grade.replace('ม.', '')
            student_classes = [f"{grade_num}_{c}" for c in student_classes_raw]
            
            # Parse other fields
            periods = int(float(row.get('periods_per_week', 1)))
            block_pattern = str(row.get('block_pattern', '1'))
            required_room = row.get('room') if pd.notna(row.get('room')) else None
            constraint = row.get('constraint') if pd.notna(row.get('constraint')) else None
            fixed_period = row.get('fixed_period') if pd.notna(row.get('fixed_period')) else None
            
            # Get subject name
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
            
        print(f"Loaded {len(self.curriculum)} lessons from curriculum")
        
    def load_rooms(self, filepath: str):
        """Load room data."""
        df = pd.read_csv(filepath)
        for _, row in df.iterrows():
            room_id = str(row['room_id']).strip()
            self.rooms[room_id] = {
                'note': row.get('note', ''),
                'tag': row.get('tag', '')
            }
        print(f"Loaded {len(self.rooms)} rooms")
        
    def load_timetables(self, student_files: List[str], 
                        teacher_files: List[str],
                        room_files: List[str]):
        """Load existing timetables and extract pre-placed slots."""
        
        # Load student timetables
        for filepath in student_files:
            filename = os.path.basename(filepath)
            # Extract student class ID from filename (e.g., 'student_1_1.csv' -> '1_1')
            match = re.search(r'student_(\d+_\d+)', filename)
            if match:
                class_id = match.group(1)
                df = self._load_timetable_csv(filepath)
                self.student_timetables[class_id] = df
                self._extract_preplaced_slots(df, f"student_{class_id}")
                
        # Load teacher timetables
        for filepath in teacher_files:
            filename = os.path.basename(filepath)
            match = re.search(r'teacher_([A-Z]\d+)', filename)
            if match:
                teacher_id = match.group(1)
                df = self._load_timetable_csv(filepath)
                self.teacher_timetables[teacher_id] = df
                self._extract_preplaced_slots(df, f"teacher_{teacher_id}")
                
        # Load room timetables
        for filepath in room_files:
            filename = os.path.basename(filepath)
            match = re.search(r'room_(.+)\.csv', filename)
            if match:
                room_id = match.group(1)
                if room_id != 'cleaned':  # Skip room_cleaned.csv
                    df = self._load_timetable_csv(filepath)
                    self.room_timetables[room_id] = df
                    self._extract_preplaced_slots(df, f"room_{room_id}")
                    
        print(f"Loaded {len(self.student_timetables)} student timetables")
        print(f"Loaded {len(self.teacher_timetables)} teacher timetables")
        print(f"Loaded {len(self.room_timetables)} room timetables")
        
    def _load_timetable_csv(self, filepath: str) -> pd.DataFrame:
        """Load a timetable CSV file."""
        df = pd.read_csv(filepath, index_col=0)
        # Skip the time row (second row) - it's metadata
        if len(df) > 0 and not df.index[0] in DAYS:
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


# =============================================================================
# GENETIC ALGORITHM CORE
# =============================================================================

class Chromosome:
    """
    A chromosome represents a complete schedule solution.
    
    Structure:
    - genes: Dict mapping lesson_id to list of (TimeSlot, room) assignments
    - Each lesson may have multiple blocks based on its block_pattern
    """
    
    def __init__(self):
        self.genes: Dict[str, List[Tuple[TimeSlot, str]]] = {}
        self.fitness: float = float('inf')
        self.violations: Dict[str, int] = {}
        
    def copy(self) -> 'Chromosome':
        """Create a deep copy of this chromosome."""
        new_chrom = Chromosome()
        new_chrom.genes = copy.deepcopy(self.genes)
        new_chrom.fitness = self.fitness
        new_chrom.violations = copy.deepcopy(self.violations)
        return new_chrom


class GeneticScheduler:
    """
    Genetic Algorithm scheduler for completing school timetables.
    
    ALGORITHM OVERVIEW:
    1. Initialize population with random valid schedules
    2. Evaluate fitness (count constraint violations)
    3. Select parents using tournament selection
    4. Create offspring via crossover
    5. Apply mutation
    6. Replace population with elitism
    7. Repeat until solution found or max generations reached
    
    FITNESS FUNCTION:
    - Teacher conflict: +100 per violation
    - Student conflict: +100 per violation
    - Room conflict: +50 per violation
    - Block pattern violation: +30 per violation
    - Wrong period count: +20 per violation
    - Invalid room: +10 per violation
    """
    
    def __init__(self, data_loader: DataLoader, 
                 population_size: int = 100,
                 max_generations: int = 500,
                 mutation_rate: float = 0.1,
                 crossover_rate: float = 0.8,
                 elite_size: int = 5,
                 tournament_size: int = 5):
        
        self.data = data_loader
        self.population_size = population_size
        self.max_generations = max_generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.elite_size = elite_size
        self.tournament_size = tournament_size
        
        # Build available slots for each entity type
        self.available_slots = self._build_available_slots()
        
        # Build room list
        self.room_list = list(self.data.rooms.keys())
        
        # Current population
        self.population: List[Chromosome] = []
        self.best_chromosome: Optional[Chromosome] = None
        
    def _build_available_slots(self) -> Dict[str, List[TimeSlot]]:
        """Build list of available time slots (excluding pre-placed)."""
        all_slots = []
        for day in DAYS:
            for period in TEACHING_PERIODS:
                all_slots.append(TimeSlot(day, period))
        
        available = {'all': all_slots}
        
        # For each entity, remove their pre-placed slots
        for entity_id, blocked in self.data.preplaced_slots.items():
            entity_slots = [s for s in all_slots 
                          if (s.day, s.period) not in blocked]
            available[entity_id] = entity_slots
            
        return available
    
    def _get_available_slots_for_lesson(self, lesson: Lesson) -> List[TimeSlot]:
        """Get available slots considering all entities involved in a lesson."""
        # Start with all slots
        available = set(self.available_slots['all'])
        
        # Remove blocked slots for each teacher
        for teacher_id in lesson.teacher_ids:
            key = f"teacher_{teacher_id}"
            if key in self.available_slots:
                available &= set(self.available_slots[key])
                
        # Remove blocked slots for each student class
        for class_id in lesson.student_classes:
            key = f"student_{class_id}"
            if key in self.available_slots:
                available &= set(self.available_slots[key])
                
        return list(available)
    
    def _get_consecutive_slots(self, start_slot: TimeSlot, 
                               count: int) -> Optional[List[TimeSlot]]:
        """Get consecutive time slots starting from a given slot."""
        slots = [start_slot]
        current_period_idx = TEACHING_PERIODS.index(start_slot.period)
        
        for i in range(1, count):
            next_idx = current_period_idx + i
            if next_idx >= len(TEACHING_PERIODS):
                return None  # Can't get enough consecutive slots
            slots.append(TimeSlot(start_slot.day, TEACHING_PERIODS[next_idx]))
            
        return slots
    
    def _select_room_for_lesson(self, lesson: Lesson) -> str:
        """Select an appropriate room for a lesson."""
        if lesson.required_room:
            # Clean up required room string
            room = str(lesson.required_room).strip()
            if room.startswith('['):
                # It's a list, pick first one
                try:
                    rooms = ast.literal_eval(room)
                    return rooms[0] if rooms else random.choice(self.room_list)
                except:
                    pass
            if room in self.data.rooms:
                return room
                
        # Default: pick a random available room
        return random.choice(self.room_list)
    
    def initialize_population(self):
        """Create initial population of random valid chromosomes."""
        print("Initializing population...")
        
        for i in range(self.population_size):
            chromosome = self._create_random_chromosome()
            self.population.append(chromosome)
            
        print(f"Created {len(self.population)} initial chromosomes")
        
    def _create_random_chromosome(self) -> Chromosome:
        """Create a single random chromosome (schedule)."""
        chromosome = Chromosome()
        
        for lesson in self.data.curriculum:
            # Get available slots for this lesson
            available = self._get_available_slots_for_lesson(lesson)
            if not available:
                available = self.available_slots['all']
                
            # Parse block pattern
            total_periods, block_sizes = parse_block_pattern(lesson.block_pattern)
            
            # Select room
            room = self._select_room_for_lesson(lesson)
            
            # Assign slots for each block
            assignments = []
            used_days = set()
            
            for block_size in block_sizes:
                # Try to find consecutive slots on different days
                random.shuffle(available)
                
                assigned = False
                for slot in available:
                    if slot.day in used_days:
                        continue
                        
                    consecutive = self._get_consecutive_slots(slot, block_size)
                    if consecutive:
                        # Check all slots are available
                        all_available = all(s in available for s in consecutive)
                        if all_available:
                            for s in consecutive:
                                assignments.append((s, room))
                            used_days.add(slot.day)
                            assigned = True
                            break
                            
                if not assigned:
                    # Fallback: just pick any available slots
                    for _ in range(block_size):
                        if available:
                            slot = random.choice(available)
                            assignments.append((slot, room))
                            
            chromosome.genes[lesson.lesson_id] = assignments
            
        return chromosome
    
    def evaluate_fitness(self, chromosome: Chromosome) -> float:
        """
        Evaluate the fitness of a chromosome.
        Lower fitness = better solution.
        
        Penalty weights:
        - TEACHER_CONFLICT: 100 (most severe - teacher can't be in two places)
        - STUDENT_CONFLICT: 100 (equally severe - student can't be in two places)
        - ROOM_CONFLICT: 50 (serious but can sometimes be worked around)
        - BLOCK_VIOLATION: 30 (blocks should be consecutive)
        - PERIOD_COUNT_ERROR: 20 (should have correct number of periods)
        - INVALID_ROOM: 10 (should use valid rooms)
        """
        violations = defaultdict(int)
        
        # Track slot usage
        teacher_slots: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        student_slots: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        room_slots: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        
        for lesson in self.data.curriculum:
            assignments = chromosome.genes.get(lesson.lesson_id, [])
            
            # Check period count
            total_periods, _ = parse_block_pattern(lesson.block_pattern)
            if len(assignments) != total_periods:
                violations['period_count'] += abs(len(assignments) - total_periods)
                
            for slot, room in assignments:
                slot_key = (slot.day, slot.period)
                
                # Check teacher conflicts
                for teacher_id in lesson.teacher_ids:
                    if slot_key in teacher_slots[teacher_id]:
                        violations['teacher_conflict'] += 1
                    else:
                        teacher_slots[teacher_id][slot_key] = lesson.lesson_id
                        
                # Check student conflicts
                for class_id in lesson.student_classes:
                    if slot_key in student_slots[class_id]:
                        violations['student_conflict'] += 1
                    else:
                        student_slots[class_id][slot_key] = lesson.lesson_id
                        
                # Check room conflicts
                if slot_key in room_slots[room]:
                    violations['room_conflict'] += 1
                else:
                    room_slots[room][slot_key] = lesson.lesson_id
                    
                # Check valid room
                if room not in self.data.rooms:
                    violations['invalid_room'] += 1
                    
        # Check block pattern violations (consecutive periods)
        for lesson in self.data.curriculum:
            assignments = chromosome.genes.get(lesson.lesson_id, [])
            _, block_sizes = parse_block_pattern(lesson.block_pattern)
            
            # Group assignments by day
            by_day = defaultdict(list)
            for slot, room in assignments:
                by_day[slot.day].append(slot.period)
                
            # Check consecutiveness within each day
            for day, periods in by_day.items():
                periods_sorted = sorted(periods, key=lambda p: TEACHING_PERIODS.index(p) if p in TEACHING_PERIODS else 99)
                for i in range(len(periods_sorted) - 1):
                    try:
                        idx1 = TEACHING_PERIODS.index(periods_sorted[i])
                        idx2 = TEACHING_PERIODS.index(periods_sorted[i + 1])
                        if idx2 - idx1 != 1:
                            violations['block_violation'] += 1
                    except ValueError:
                        violations['block_violation'] += 1
                        
        # Calculate total fitness
        fitness = (
            violations['teacher_conflict'] * 100 +
            violations['student_conflict'] * 100 +
            violations['room_conflict'] * 50 +
            violations['block_violation'] * 30 +
            violations['period_count'] * 20 +
            violations['invalid_room'] * 10
        )
        
        chromosome.fitness = fitness
        chromosome.violations = dict(violations)
        
        return fitness
    
    def tournament_selection(self) -> Chromosome:
        """Select a parent using tournament selection."""
        tournament = random.sample(self.population, self.tournament_size)
        return min(tournament, key=lambda c: c.fitness)
    
    def crossover(self, parent1: Chromosome, parent2: Chromosome) -> Tuple[Chromosome, Chromosome]:
        """
        Perform crossover between two parents.
        Uses uniform crossover at the lesson level.
        """
        if random.random() > self.crossover_rate:
            return parent1.copy(), parent2.copy()
            
        child1 = Chromosome()
        child2 = Chromosome()
        
        for lesson in self.data.curriculum:
            if random.random() < 0.5:
                child1.genes[lesson.lesson_id] = copy.deepcopy(
                    parent1.genes.get(lesson.lesson_id, []))
                child2.genes[lesson.lesson_id] = copy.deepcopy(
                    parent2.genes.get(lesson.lesson_id, []))
            else:
                child1.genes[lesson.lesson_id] = copy.deepcopy(
                    parent2.genes.get(lesson.lesson_id, []))
                child2.genes[lesson.lesson_id] = copy.deepcopy(
                    parent1.genes.get(lesson.lesson_id, []))
                    
        return child1, child2
    
    def mutate(self, chromosome: Chromosome):
        """
        Apply mutation to a chromosome.
        Mutation types:
        1. Change time slot for a lesson
        2. Change room for a lesson
        3. Swap time slots between two lessons
        """
        for lesson in self.data.curriculum:
            if random.random() < self.mutation_rate:
                mutation_type = random.choice(['slot', 'room', 'swap'])
                
                if mutation_type == 'slot':
                    # Reassign slots for this lesson
                    available = self._get_available_slots_for_lesson(lesson)
                    if not available:
                        available = self.available_slots['all']
                        
                    total_periods, block_sizes = parse_block_pattern(lesson.block_pattern)
                    current_room = chromosome.genes.get(lesson.lesson_id, [])
                    room = current_room[0][1] if current_room else self._select_room_for_lesson(lesson)
                    
                    assignments = []
                    used_days = set()
                    
                    for block_size in block_sizes:
                        random.shuffle(available)
                        assigned = False
                        
                        for slot in available:
                            if slot.day in used_days:
                                continue
                            consecutive = self._get_consecutive_slots(slot, block_size)
                            if consecutive:
                                all_available = all(s in available for s in consecutive)
                                if all_available:
                                    for s in consecutive:
                                        assignments.append((s, room))
                                    used_days.add(slot.day)
                                    assigned = True
                                    break
                                    
                        if not assigned:
                            for _ in range(block_size):
                                if available:
                                    slot = random.choice(available)
                                    assignments.append((slot, room))
                                    
                    chromosome.genes[lesson.lesson_id] = assignments
                    
                elif mutation_type == 'room':
                    # Change room
                    new_room = random.choice(self.room_list)
                    if lesson.lesson_id in chromosome.genes:
                        chromosome.genes[lesson.lesson_id] = [
                            (slot, new_room) for slot, _ in chromosome.genes[lesson.lesson_id]
                        ]
                        
                elif mutation_type == 'swap':
                    # Swap with another lesson
                    other_lesson = random.choice(self.data.curriculum)
                    if other_lesson.lesson_id != lesson.lesson_id:
                        genes1 = chromosome.genes.get(lesson.lesson_id, [])
                        genes2 = chromosome.genes.get(other_lesson.lesson_id, [])
                        
                        # Only swap if same number of periods
                        if len(genes1) == len(genes2) and genes1 and genes2:
                            # Swap time slots but keep rooms
                            new_genes1 = [(genes2[i][0], genes1[i][1]) 
                                         for i in range(len(genes1))]
                            new_genes2 = [(genes1[i][0], genes2[i][1]) 
                                         for i in range(len(genes2))]
                            chromosome.genes[lesson.lesson_id] = new_genes1
                            chromosome.genes[other_lesson.lesson_id] = new_genes2
                            
    def evolve(self) -> Chromosome:
        """Run the genetic algorithm evolution."""
        print("\n" + "=" * 60)
        print("STARTING GENETIC ALGORITHM EVOLUTION")
        print("=" * 60)
        print(f"Population size: {self.population_size}")
        print(f"Max generations: {self.max_generations}")
        print(f"Mutation rate: {self.mutation_rate}")
        print(f"Crossover rate: {self.crossover_rate}")
        print("=" * 60 + "\n")
        
        # Initialize population
        self.initialize_population()
        
        # Evaluate initial population
        for chromosome in self.population:
            self.evaluate_fitness(chromosome)
            
        # Track best solution
        self.best_chromosome = min(self.population, key=lambda c: c.fitness)
        
        print(f"Initial best fitness: {self.best_chromosome.fitness}")
        print(f"Initial violations: {self.best_chromosome.violations}")
        
        # Evolution loop
        for generation in range(self.max_generations):
            # Sort population by fitness
            self.population.sort(key=lambda c: c.fitness)
            
            # Keep elite
            new_population = self.population[:self.elite_size]
            
            # Generate offspring
            while len(new_population) < self.population_size:
                parent1 = self.tournament_selection()
                parent2 = self.tournament_selection()
                
                child1, child2 = self.crossover(parent1, parent2)
                
                self.mutate(child1)
                self.mutate(child2)
                
                self.evaluate_fitness(child1)
                self.evaluate_fitness(child2)
                
                new_population.extend([child1, child2])
                
            self.population = new_population[:self.population_size]
            
            # Update best
            current_best = min(self.population, key=lambda c: c.fitness)
            if current_best.fitness < self.best_chromosome.fitness:
                self.best_chromosome = current_best.copy()
                
            # Progress report
            if generation % 50 == 0 or current_best.fitness == 0:
                print(f"Generation {generation}: Best fitness = {self.best_chromosome.fitness}")
                print(f"  Violations: {self.best_chromosome.violations}")
                
            # Early termination if solution found
            if self.best_chromosome.fitness == 0:
                print(f"\n✓ SOLUTION FOUND at generation {generation}!")
                break
                
        print("\n" + "=" * 60)
        print("EVOLUTION COMPLETE")
        print("=" * 60)
        print(f"Final best fitness: {self.best_chromosome.fitness}")
        print(f"Final violations: {self.best_chromosome.violations}")
        
        return self.best_chromosome


# =============================================================================
# OUTPUT GENERATION
# =============================================================================

class ScheduleExporter:
    """Exports the completed schedule to CSV files."""
    
    def __init__(self, data_loader: DataLoader, chromosome: Chromosome,
                 output_dir: str):
        self.data = data_loader
        self.chromosome = chromosome
        self.output_dir = output_dir
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Build lesson lookup
        self.lesson_lookup = {lesson.lesson_id: lesson 
                            for lesson in data_loader.curriculum}
        
    def export_all(self):
        """Export all timetables."""
        print("\nExporting schedules...")
        
        # Build assignment index
        assignments_by_teacher: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        assignments_by_student: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        assignments_by_room: Dict[str, List[Tuple[TimeSlot, str, Lesson]]] = defaultdict(list)
        
        for lesson_id, assignments in self.chromosome.genes.items():
            lesson = self.lesson_lookup[lesson_id]
            
            for slot, room in assignments:
                # Index by teacher
                for teacher_id in lesson.teacher_ids:
                    assignments_by_teacher[teacher_id].append((slot, room, lesson))
                    
                # Index by student class
                for class_id in lesson.student_classes:
                    assignments_by_student[class_id].append((slot, room, lesson))
                    
                # Index by room
                assignments_by_room[room].append((slot, room, lesson))
                
        # Export teacher timetables
        all_teachers = set(assignments_by_teacher.keys())
        for teacher_id, existing_df in self.data.teacher_timetables.items():
            all_teachers.add(teacher_id)
            
        for teacher_id in all_teachers:
            self._export_teacher_timetable(
                teacher_id, 
                assignments_by_teacher.get(teacher_id, [])
            )
            
        # Export student timetables
        all_students = set(assignments_by_student.keys())
        for class_id, existing_df in self.data.student_timetables.items():
            all_students.add(class_id)
            
        for class_id in all_students:
            self._export_student_timetable(
                class_id,
                assignments_by_student.get(class_id, [])
            )
            
        # Export room timetables
        all_rooms = set(assignments_by_room.keys()) | set(self.data.rooms.keys())
        for room_id in all_rooms:
            self._export_room_timetable(
                room_id,
                assignments_by_room.get(room_id, [])
            )
            
        print(f"Exported {len(all_teachers)} teacher timetables")
        print(f"Exported {len(all_students)} student timetables")
        print(f"Exported {len(all_rooms)} room timetables")
        
    def _create_empty_timetable(self) -> pd.DataFrame:
        """Create an empty timetable DataFrame."""
        columns = ALL_COLUMNS
        index = DAYS
        
        df = pd.DataFrame('', index=index, columns=columns)
        
        # Fill in standard blocked slots
        for day in DAYS:
            df.loc[day, '1'] = 'Homeroom'
            df.loc[day, 'Morning Break'] = 'Morning Break'
            df.loc[day, 'Afternoon Break'] = 'Afternoon Break'
            
        return df
    
    def _format_cell_value(self, lesson: Lesson, room: str, 
                          include_room: bool = True) -> str:
        """Format a cell value for display."""
        parts = []
        
        # Subject name or ID
        if lesson.subject_name:
            parts.append(lesson.subject_name)
        elif lesson.subject_id:
            parts.append(lesson.subject_id)
            
        # Add room if requested
        if include_room and room:
            parts.append(f"[{room}]")
            
        return ' '.join(parts) if parts else ''
    
    def _export_teacher_timetable(self, teacher_id: str,
                                  assignments: List[Tuple[TimeSlot, str, Lesson]]):
        """Export a single teacher's timetable."""
        # Start with existing timetable or create new one
        if teacher_id in self.data.teacher_timetables:
            df = self.data.teacher_timetables[teacher_id].copy()
        else:
            df = self._create_empty_timetable()
            
        # Get pre-placed slots to avoid modification
        preplaced = self.data.preplaced_slots.get(f"teacher_{teacher_id}", set())
        
        # Add new assignments
        for slot, room, lesson in assignments:
            if (slot.day, slot.period) not in preplaced:
                # Only modify if slot is empty
                current = df.loc[slot.day, slot.period] if slot.day in df.index and slot.period in df.columns else ''
                if pd.isna(current) or current == '':
                    classes = ', '.join(lesson.student_classes)
                    cell_value = f"{lesson.subject_name or lesson.subject_id} ({classes}) [{room}]"
                    df.loc[slot.day, slot.period] = cell_value
                    
        # Save
        filepath = os.path.join(self.output_dir, f"teacher_{teacher_id}.csv")
        df.to_csv(filepath)
        
    def _export_student_timetable(self, class_id: str,
                                  assignments: List[Tuple[TimeSlot, str, Lesson]]):
        """Export a single student class's timetable."""
        # Start with existing timetable or create new one
        if class_id in self.data.student_timetables:
            df = self.data.student_timetables[class_id].copy()
        else:
            df = self._create_empty_timetable()
            # Add standard student activities
            self._add_student_standard_activities(df, class_id)
            
        # Get pre-placed slots to avoid modification
        preplaced = self.data.preplaced_slots.get(f"student_{class_id}", set())
        
        # Add new assignments
        for slot, room, lesson in assignments:
            if (slot.day, slot.period) not in preplaced:
                # Only modify if slot is empty
                current = df.loc[slot.day, slot.period] if slot.day in df.index and slot.period in df.columns else ''
                if pd.isna(current) or current == '':
                    teachers = ', '.join(lesson.teacher_ids)
                    cell_value = f"{lesson.subject_name or lesson.subject_id} ({teachers}) [{room}]"
                    df.loc[slot.day, slot.period] = cell_value
                    
        # Save
        filepath = os.path.join(self.output_dir, f"student_{class_id}.csv")
        df.to_csv(filepath)
        
    def _add_student_standard_activities(self, df: pd.DataFrame, class_id: str):
        """Add standard activities for students based on grade level."""
        grade = class_id.split('_')[0]
        
        # Lunch times
        if grade in ['1', '2', '3']:  # ม.ต้น
            df.loc[:, '7'] = 'Lunch ม.ต้น'
        else:  # ม.ปลาย
            df.loc[:, '6'] = 'Lunch ม.ปลาย'
            
        # Wednesday club
        df.loc['Wednesday', '9'] = 'ชุมนุม'
        df.loc['Wednesday', '10'] = 'ชุมนุม'
        
        # Monday scouts (for ม.ต้น)
        if grade in ['1', '2', '3']:
            df.loc['Monday', '9'] = f'ลูกเสือม.{grade}'
            df.loc['Monday', '10'] = f'ลูกเสือม.{grade}'
            
        # Friday electives and bridging
        df.loc['Friday', '2'] = f'เสรีม.ต้น1' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย1'
        df.loc['Friday', '3'] = f'เสรีม.ต้น1' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย1'
        df.loc['Friday', '4'] = f'เสรีม.ต้น2' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย2'
        df.loc['Friday', '5'] = f'เสรีม.ต้น2' if grade in ['1', '2', '3'] else 'เสรีม.ปลาย2'
        df.loc['Friday', '8'] = 'Bridging course'
        df.loc['Friday', '9'] = 'Bridging course'
        df.loc['Friday', '10'] = 'Bridging course'
        
    def _export_room_timetable(self, room_id: str,
                               assignments: List[Tuple[TimeSlot, str, Lesson]]):
        """Export a single room's timetable."""
        # Start with existing timetable or create new one
        if room_id in self.data.room_timetables:
            df = self.data.room_timetables[room_id].copy()
        else:
            df = self._create_empty_timetable()
            
        # Get pre-placed slots to avoid modification
        preplaced = self.data.preplaced_slots.get(f"room_{room_id}", set())
        
        # Add new assignments
        for slot, room, lesson in assignments:
            if room == room_id and (slot.day, slot.period) not in preplaced:
                # Only modify if slot is empty
                current = df.loc[slot.day, slot.period] if slot.day in df.index and slot.period in df.columns else ''
                if pd.isna(current) or current == '':
                    classes = ', '.join(lesson.student_classes)
                    teachers = ', '.join(lesson.teacher_ids)
                    cell_value = f"{lesson.subject_name or lesson.subject_id} ({classes}) - {teachers}"
                    df.loc[slot.day, slot.period] = cell_value
                    
        # Save
        # Clean room_id for filename (replace problematic characters)
        safe_room_id = room_id.replace('/', '-').replace('\\', '-')
        filepath = os.path.join(self.output_dir, f"room_{safe_room_id}.csv")
        df.to_csv(filepath)


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def find_files(directory: str, pattern: str) -> List[str]:
    """Find all files matching a pattern in a directory."""
    import glob
    return glob.glob(os.path.join(directory, pattern))


def main():
    """Main entry point for the GA scheduler."""
    print("\n" + "=" * 70)
    print("  GENETIC ALGORITHM SCHOOL TIMETABLE COMPLETION SYSTEM")
    print("=" * 70 + "\n")
    
    # Configuration
    DATA_DIR = "timetable"
    OUTPUT_DIR = "completed_schedules"
    
    # GA Parameters - tuned for better convergence
    POPULATION_SIZE = 150
    MAX_GENERATIONS = 500
    MUTATION_RATE = 0.20
    CROSSOVER_RATE = 0.80
    ELITE_SIZE = 10
    TOURNAMENT_SIZE = 7
    
    # Find input files
    curriculum_file = os.path.join(DATA_DIR, "curriculum_cleaned.csv")
    room_file = os.path.join(DATA_DIR, "room_cleaned.csv")
    
    student_files = find_files(DATA_DIR, "student_*.csv")
    teacher_files = find_files(DATA_DIR, "teacher_*.csv")
    room_timetable_files = [f for f in find_files(DATA_DIR, "room_*.csv") 
                           if 'cleaned' not in f]
    
    print("Input files found:")
    print(f"  Curriculum: {curriculum_file}")
    print(f"  Rooms: {room_file}")
    print(f"  Student timetables: {len(student_files)} files")
    print(f"  Teacher timetables: {len(teacher_files)} files")
    print(f"  Room timetables: {len(room_timetable_files)} files")
    
    # Load data
    print("\nLoading data...")
    data_loader = DataLoader(DATA_DIR)
    data_loader.load_all(
        curriculum_file=curriculum_file,
        room_file=room_file,
        student_files=student_files,
        teacher_files=teacher_files,
        room_timetable_files=room_timetable_files
    )
    
    # Run genetic algorithm
    scheduler = GeneticScheduler(
        data_loader=data_loader,
        population_size=POPULATION_SIZE,
        max_generations=MAX_GENERATIONS,
        mutation_rate=MUTATION_RATE,
        crossover_rate=CROSSOVER_RATE,
        elite_size=ELITE_SIZE,
        tournament_size=TOURNAMENT_SIZE
    )
    
    best_solution = scheduler.evolve()
    
    # Export results
    exporter = ScheduleExporter(data_loader, best_solution, OUTPUT_DIR)
    exporter.export_all()
    
    print(f"\n✓ Completed schedules saved to: {OUTPUT_DIR}")
    print("\nDone!")
    
    return best_solution


if __name__ == "__main__":
    main()
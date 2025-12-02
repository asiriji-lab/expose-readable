"""
================================================================================
GA SCHEDULER - Data Models
================================================================================

Data classes and models for the scheduling system.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Set, Optional, Any
import copy


# =============================================================================
# CONSTANTS
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
# DATA CLASSES
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
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            'lesson_id': self.lesson_id,
            'subject_id': self.subject_id,
            'subject_name': self.subject_name,
            'teacher_ids': self.teacher_ids,
            'student_classes': self.student_classes,
            'periods_per_week': self.periods_per_week,
            'block_pattern': self.block_pattern,
            'required_room': self.required_room,
            'constraint': self.constraint,
            'fixed_period': self.fixed_period
        }


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
    
    def to_tuple(self) -> Tuple[str, str]:
        """Convert to tuple."""
        return (self.day, self.period)
    
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
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            'lesson_id': self.lesson.lesson_id,
            'subject_name': self.lesson.subject_name,
            'day': self.time_slot.day,
            'period': self.time_slot.period,
            'room': self.room,
            'is_preplaced': self.is_preplaced
        }


@dataclass
class Gene:
    """A gene represents the scheduling decision for a single lesson block."""
    lesson_id: str
    time_slots: List[TimeSlot]  # List of consecutive slots for block patterns
    room: str


# =============================================================================
# CHROMOSOME CLASS
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
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        genes_dict = {}
        for lesson_id, assignments in self.genes.items():
            genes_dict[lesson_id] = [
                {'day': slot.day, 'period': slot.period, 'room': room}
                for slot, room in assignments
            ]
        
        return {
            'fitness': self.fitness,
            'violations': self.violations,
            'genes': genes_dict
        }
    
    def get_assignments_for_entity(self, entity_type: str, entity_id: str,
                                   lessons: List[Lesson]) -> List[Tuple[TimeSlot, str, Lesson]]:
        """
        Get all assignments for a specific entity.
        
        Args:
            entity_type: 'teacher', 'student', or 'room'
            entity_id: The ID of the entity
            lessons: List of all lessons
            
        Returns:
            List of (TimeSlot, room, Lesson) tuples
        """
        lesson_lookup = {l.lesson_id: l for l in lessons}
        assignments = []
        
        for lesson_id, gene_assignments in self.genes.items():
            lesson = lesson_lookup.get(lesson_id)
            if not lesson:
                continue
                
            # Check if this entity is involved in the lesson
            is_involved = False
            if entity_type == 'teacher' and entity_id in lesson.teacher_ids:
                is_involved = True
            elif entity_type == 'student' and entity_id in lesson.student_classes:
                is_involved = True
            elif entity_type == 'room':
                for slot, room in gene_assignments:
                    if room == entity_id:
                        is_involved = True
                        break
            
            if is_involved:
                for slot, room in gene_assignments:
                    if entity_type != 'room' or room == entity_id:
                        assignments.append((slot, room, lesson))
        
        return assignments
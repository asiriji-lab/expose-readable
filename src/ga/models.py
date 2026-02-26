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

WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"]

# Values in a grid cell that mean "occupied but not a real lesson" —
# the GA should treat these as blocked and never overwrite them.
BLOCKED_CELL_KEYWORDS = [
    'UNAVAILABLE', 'Homeroom', 'Morning Break', 'Afternoon Break',
    'Lunch', 'ลูกเสือ', 'ชุมนุม', 'เสรี', 'Bridging', 'preplace', 'scout', 'elective',
    'constraint'
]

# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Lesson:
    """A single schedulable lesson unit parsed from the curriculum sheet."""
    lesson_id: str
    subject_id: str
    subject_name: str
    teacher_ids: List[str]          # one or more teacher IDs
    student_classes: List[str]      # one or more class_ids (e.g. "1/1")
    periods_per_week: int
    block_pattern: str              # "1", "2", "2-1", "1-1-1", etc.
    required_rooms: List[str]       # resolved room IDs (may be empty)
    fixed_period: Optional[str]     # raw fixed_period string if pre-fixed


@dataclass
class TimeSlot:
    """A single teaching slot identified by (day, period_col)."""
    day: str         # "MON" .. "FRI"
    period_col: str  # "2,08:30-09:20" — the full column header used in grids

    def __hash__(self):
        return hash((self.day, self.period_col))

    def __eq__(self, other):
        return self.day == other.day and self.period_col == other.period_col

    def __repr__(self):
        label = self.period_col.split(',')[0]
        return f"{self.day}_{label}"


@dataclass
class Chromosome:
    """Complete schedule solution: maps lesson_id -> list of (TimeSlot, room_id)."""
    genes: Dict[str, List[Tuple[TimeSlot, str]]] = field(default_factory=dict)
    fitness: float = float('inf')
    violations: Dict[str, int] = field(default_factory=dict)

    def copy(self) -> 'Chromosome':
        """Fast shallow copy — safe because gene tuples contain only immutable values."""
        c = Chromosome()
        # Shallow-copy each gene list; tuples inside are immutable so sharing is safe
        c.genes = {lid: list(slots) for lid, slots in self.genes.items()}
        c.fitness = self.fitness
        c.violations = dict(self.violations)
        return c

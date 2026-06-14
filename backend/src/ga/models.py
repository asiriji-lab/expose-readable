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

# Populated dynamically at GA init from period labels, preplace slot names,
# and elective subject IDs — see data_loader.build_blocked_keywords().
BLOCKED_CELL_KEYWORDS: list = []

# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Lesson:
    lesson_id: str
    subject_id: str
    subject_name: str
    teacher_ids: List[str]       # one or more teacher IDs
    student_classes: List[str]   # full class_ids e.g. ["1/1", "1/2"]
    periods_per_week: int
    block_pattern: str           # "1", "2", "2-1", "2-2", etc.
    required_rooms: List[str]    # resolved room IDs (hard constraint — must use)
    preferred_tags: List[str]    # tag-based soft preference (fallback to general if no match)
    fixed_period: Optional[str]
    # Constraint fields — populated from curriculum 'constraint' column
    constraint_type: Optional[str] = None          # TEAM | MULTI_CLASS_TEAM | SEPARATE_SLOT | SUB_GROUP | TEACHER_SPLIT
    constraint_group_id: Optional[str] = None      # links lessons that share a constraint group


@dataclass(frozen=True)
class TimeSlot:
    day: str         # "MON" .. "FRI"
    period_col: str  # full column header: "2,08.05-08.55"

    def __repr__(self):
        label = self.period_col.split(',')[0]
        return f"{self.day}_{label}"


@dataclass
class Chromosome:
    """Maps lesson_id -> list of (TimeSlot, room_id) assignments."""
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

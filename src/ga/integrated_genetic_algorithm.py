"""
================================================================================
INTEGRATED GA SCHEDULER - Genetic Algorithm with ScheduleManager
================================================================================

Genetic Algorithm that works with ScheduleManager state for integrated scheduling.
"""

import random
import copy
import pandas as pd
from typing import Dict, List, Tuple, Optional, Callable
from collections import defaultdict

from .models import Lesson, TimeSlot, Chromosome
from ..preschedule.scheduleManager import ScheduleManager


def parse_block_pattern(pattern: str) -> Tuple[int, List[int]]:
    """
    Parse block pattern string into total periods and block sizes.
    
    Examples:
    - '1' -> (1, [1])
    - '2' -> (2, [2])
    - '2-1' -> (3, [2, 1])
    - '2-2' -> (4, [2, 2])
    """
    if not pattern or pd.isna(pattern):
        return (1, [1])
    
    pattern = str(pattern).strip()
    
    if '-' in pattern:
        blocks = [int(x) for x in pattern.split('-')]
        total = sum(blocks)
        return (total, blocks)
    else:
        try:
            periods = int(float(pattern))
            return (periods, [periods])
        except:
            return (1, [1])


class GeneticAlgorithm:
    """
    Integrated Genetic Algorithm engine that works with ScheduleManager.
    
    This version:
    - Accepts ScheduleManager with preschedule state
    - Respects pre-placed slots and constraints
    - Updates ScheduleManager with optimized solution
    
    FITNESS FUNCTION WEIGHTS:
    - Teacher conflict: 100 (teacher can't be in two places)
    - Student conflict: 100 (student can't be in two classes)
    - Room conflict: 50 (room can't have two classes)
    - Block violation: 30 (blocks should be consecutive)
    - Period count error: 20 (correct number of periods)
    - Invalid room: 10 (use valid rooms)
    - Preplaced conflict: 200 (extremely high penalty for violating preplaced slots)
    """
    
    def __init__(self, 
                 schedule_manager: ScheduleManager,
                 population_size: int = 150,
                 max_generations: int = 500,
                 mutation_rate: float = 0.20,
                 crossover_rate: float = 0.80,
                 elite_size: int = 10,
                 tournament_size: int = 7,
                 progress_callback: Optional[Callable] = None):
        
        self.manager = schedule_manager
        self.days = schedule_manager.weekdays
        self.periods = schedule_manager.periods
        self.cleaned_data = schedule_manager.sheets

        self.population_size = population_size
        self.max_generations = max_generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.elite_size = elite_size
        self.tournament_size = tournament_size
        self.progress_callback = progress_callback
        
        # Parse curriculum into lessons
        self.lessons = self._parse_curriculum()
        
        # Get rooms from cleaned data
        self.rooms = self._parse_rooms()
        
        # Build preplaced slots from ScheduleManager
        self.preplaced_slots = self._extract_preplaced_slots()
        
        # Build available slots considering preplaced constraints
        self.available_slots = self._build_available_slots()
        
        # Population
        self.population: List[Chromosome] = []
        self.best_chromosome: Optional[Chromosome] = None
        
        # Statistics
        self.generation_stats: List[Dict] = []
        
        print(f"  [GA Init] Loaded {len(self.lessons)} lessons to schedule")
        print(f"  [GA Init] {len(self.rooms)} rooms available")
        print(f"  [GA Init] {len(self.preplaced_slots)} entities with preplaced slots")
        
    def _parse_curriculum(self) -> List[Lesson]:
        """Parse curriculum DataFrame into Lesson objects."""
        curriculum_df = self.cleaned_data.get('curriculum')
        if curriculum_df is None:
            return []
        
        lessons = []
        for idx, row in curriculum_df.iterrows():
            # Parse teacher IDs
            teacher_str = str(row.get('teacher', ''))
            if teacher_str.startswith('['):
                import ast
                teacher_ids = ast.literal_eval(teacher_str)
            else:
                teacher_ids = [teacher_str] if teacher_str != 'nan' else []
            
            # Parse student classes
            student_str = str(row.get('student_class', ''))
            if student_str.startswith('['):
                import ast
                student_classes = [str(c) for c in ast.literal_eval(student_str)]
            else:
                student_classes = [student_str] if student_str != 'nan' else []
            
            lesson = Lesson(
                lesson_id=f"L{idx}",
                subject_id=str(row.get('subject_id', '')),
                subject_name=str(row.get('subject_name', '')),
                teacher_ids=teacher_ids,
                student_classes=student_classes,
                periods_per_week=int(row.get('periods_per_week', 1)),
                block_pattern=str(row.get('block_pattern', '1')),
                required_room=row.get('room') if pd.notna(row.get('room')) else None,
                constraint=row.get('constraint') if pd.notna(row.get('constraint')) else None,
                fixed_period=row.get('fixed_period') if pd.notna(row.get('fixed_period')) else None
            )
            lessons.append(lesson)
        
        return lessons
    
    def _parse_rooms(self) -> Dict[str, Dict]:
        """Parse rooms from cleaned data."""
        room_df = self.cleaned_data.get('room')
        if room_df is None:
            return {}
        
        rooms = {}
        for _, row in room_df.iterrows():
            room_id = str(row.get('room_id', ''))
            if room_id:
                rooms[room_id] = {
                    'note': row.get('note', ''),
                    'tag': row.get('tag', '')
                }
        
        return rooms
    
    def _extract_preplaced_slots(self) -> Dict[str, set]:
        """Extract all preplaced slots from ScheduleManager grids."""
        preplaced = defaultdict(set)
        
        # Extract from student grids
        for class_id, grid in self.manager.student_grids.items():
            for day in grid.index:
                for col in grid.columns:
                    cell_value = grid.at[day, col]
                    if pd.notna(cell_value) and str(cell_value).strip():
                        # Extract period label from column (format: "label,time")
                        period_label = col.split(',')[0]
                        preplaced[f'student_{class_id}'].add((day, period_label))
        
        # Extract from teacher grids
        for teacher_id, grid in self.manager.teacher_grids.items():
            for day in grid.index:
                for col in grid.columns:
                    cell_value = grid.at[day, col]
                    if pd.notna(cell_value) and str(cell_value).strip():
                        period_label = col.split(',')[0]
                        preplaced[f'teacher_{teacher_id}'].add((day, period_label))
        
        # Extract from room grids
        for room_id, grid in self.manager.room_grids.items():
            for day in grid.index:
                for col in grid.columns:
                    cell_value = grid.at[day, col]
                    if pd.notna(cell_value) and str(cell_value).strip():
                        period_label = col.split(',')[0]
                        preplaced[f'room_{room_id}'].add((day, period_label))
        
        return preplaced
    
    def _build_available_slots(self) -> Dict[str, List[TimeSlot]]:
        """Build list of available time slots considering preplaced constraints."""
        
        all_slots = []
        for day in self.days:
            for period in self.periods:
                all_slots.append(TimeSlot(day, period))
        
        available = {'all': all_slots}
        
        # For each entity with preplaced slots, create available list
        for entity_id, blocked in self.preplaced_slots.items():
            entity_slots = [s for s in all_slots 
                          if (s.day, s.period) not in blocked]
            available[entity_id] = entity_slots
        
        return available
    
    def _get_available_slots_for_lesson(self, lesson: Lesson) -> List[TimeSlot]:
        """Get available slots for a lesson considering all constraints."""
        available = set(self.available_slots['all'])
        
        # Intersect with teacher availability
        for teacher_id in lesson.teacher_ids:
            key = f"teacher_{teacher_id}"
            if key in self.available_slots:
                available &= set(self.available_slots[key])
        
        # Intersect with student class availability
        for class_id in lesson.student_classes:
            key = f"student_{class_id}"
            if key in self.available_slots:
                available &= set(self.available_slots[key])
        
        return list(available)
    
    def _get_consecutive_slots(self, start_slot: TimeSlot, count: int) -> Optional[List[TimeSlot]]:
        """Get consecutive time slots."""
        if start_slot.period not in self.periods:
            return None
        
        slots = [start_slot]
        current_period_idx = self.periods.index(start_slot.period)
        
        for i in range(1, count):
            next_idx = current_period_idx + i
            if next_idx >= len(self.periods):
                return None
            slots.append(TimeSlot(start_slot.day, self.periods[next_idx]))
        
        return slots
    
    def _select_room_for_lesson(self, lesson: Lesson) -> str:
        """Select an appropriate room for a lesson."""
        if lesson.required_room and pd.notna(lesson.required_room):
            room = str(lesson.required_room).strip()
            if room.startswith('['):
                try:
                    import ast
                    rooms = ast.literal_eval(room)
                    return str(rooms[0]) if rooms else random.choice(list(self.rooms.keys()))
                except:
                    pass
            if room in self.rooms:
                return room
        
        return random.choice(list(self.rooms.keys())) if self.rooms else "DEFAULT_ROOM"
    
    def initialize_population(self):
        """Create initial population."""
        self.population = []
        
        for _ in range(self.population_size):
            chromosome = self._create_random_chromosome()
            self.population.append(chromosome)
    
    def _create_random_chromosome(self) -> Chromosome:
        """Create a random chromosome respecting constraints."""
        chromosome = Chromosome()
        
        for lesson in self.lessons:
            available = self._get_available_slots_for_lesson(lesson)
            if not available:
                available = self.available_slots['all']
            
            total_periods, block_sizes = parse_block_pattern(lesson.block_pattern)
            room = self._select_room_for_lesson(lesson)
            
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
        
        return chromosome
    
    def evaluate_fitness(self, chromosome: Chromosome) -> float:
        """Evaluate chromosome fitness."""
        violations = defaultdict(int)
        
        teacher_slots: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        student_slots: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        room_slots: Dict[str, Dict[Tuple[str, str], str]] = defaultdict(dict)
        
        for lesson in self.lessons:
            assignments = chromosome.genes.get(lesson.lesson_id, [])
            
            total_periods, _ = parse_block_pattern(lesson.block_pattern)
            if len(assignments) != total_periods:
                violations['period_count'] += abs(len(assignments) - total_periods)
            
            for slot, room in assignments:
                slot_key = (slot.day, slot.period)
                
                # Check if violating preplaced slots
                for teacher_id in lesson.teacher_ids:
                    key = f'teacher_{teacher_id}'
                    if key in self.preplaced_slots and slot_key in self.preplaced_slots[key]:
                        violations['preplaced_conflict'] += 1
                
                for class_id in lesson.student_classes:
                    key = f'student_{class_id}'
                    if key in self.preplaced_slots and slot_key in self.preplaced_slots[key]:
                        violations['preplaced_conflict'] += 1
                
                # Teacher conflicts
                for teacher_id in lesson.teacher_ids:
                    if slot_key in teacher_slots[teacher_id]:
                        violations['teacher_conflict'] += 1
                    else:
                        teacher_slots[teacher_id][slot_key] = lesson.lesson_id
                
                # Student conflicts
                for class_id in lesson.student_classes:
                    if slot_key in student_slots[class_id]:
                        violations['student_conflict'] += 1
                    else:
                        student_slots[class_id][slot_key] = lesson.lesson_id
                
                # Room conflicts
                if slot_key in room_slots[room]:
                    violations['room_conflict'] += 1
                else:
                    room_slots[room][slot_key] = lesson.lesson_id
                
                # Invalid room check
                if room not in self.rooms:
                    violations['invalid_room'] += 1
        
        # Check block violations
        for lesson in self.lessons:
            assignments = chromosome.genes.get(lesson.lesson_id, [])
            
            by_day = defaultdict(list)
            for slot, room in assignments:
                by_day[slot.day].append(slot.period)
            
            for day, periods in by_day.items():
                periods_sorted = sorted(
                    periods, 
                    key=lambda p: self.periods.index(p) if p in self.periods else 99
                )
                for i in range(len(periods_sorted) - 1):
                    try:
                        idx1 = self.periods.index(periods_sorted[i])
                        idx2 = self.periods.index(periods_sorted[i + 1])
                        if idx2 - idx1 != 1:
                            violations['block_violation'] += 1
                    except ValueError:
                        violations['block_violation'] += 1
        
        # Calculate fitness with weights
        fitness = (
            violations['preplaced_conflict'] * 200 +  # Highest priority
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
        """Tournament selection."""
        tournament = random.sample(self.population, self.tournament_size)
        return min(tournament, key=lambda c: c.fitness)
    
    def crossover(self, parent1: Chromosome, parent2: Chromosome) -> Tuple[Chromosome, Chromosome]:
        """Uniform crossover."""
        if random.random() > self.crossover_rate:
            return parent1.copy(), parent2.copy()
        
        child1 = Chromosome()
        child2 = Chromosome()
        
        for lesson in self.lessons:
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
        """Apply mutation."""
        for lesson in self.lessons:
            if random.random() < self.mutation_rate:
                mutation_type = random.choice(['slot', 'room', 'swap'])
                
                if mutation_type == 'slot':
                    available = self._get_available_slots_for_lesson(lesson)
                    if not available:
                        available = self.available_slots['all']
                    
                    total_periods, block_sizes = parse_block_pattern(lesson.block_pattern)
                    current = chromosome.genes.get(lesson.lesson_id, [])
                    room = current[0][1] if current else self._select_room_for_lesson(lesson)
                    
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
                    new_room = random.choice(list(self.rooms.keys())) if self.rooms else "DEFAULT_ROOM"
                    if lesson.lesson_id in chromosome.genes:
                        chromosome.genes[lesson.lesson_id] = [
                            (slot, new_room) for slot, _ in chromosome.genes[lesson.lesson_id]
                        ]
                
                elif mutation_type == 'swap':
                    other_lesson = random.choice(self.lessons)
                    if other_lesson.lesson_id != lesson.lesson_id:
                        genes1 = chromosome.genes.get(lesson.lesson_id, [])
                        genes2 = chromosome.genes.get(other_lesson.lesson_id, [])
                        
                        if len(genes1) == len(genes2) and genes1 and genes2:
                            new_genes1 = [(genes2[i][0], genes1[i][1]) 
                                         for i in range(len(genes1))]
                            new_genes2 = [(genes1[i][0], genes2[i][1]) 
                                         for i in range(len(genes2))]
                            chromosome.genes[lesson.lesson_id] = new_genes1
                            chromosome.genes[other_lesson.lesson_id] = new_genes2
    
    def evolve(self) -> Chromosome:
        """Run the genetic algorithm."""
        # Initialize
        self.initialize_population()
        
        # Evaluate initial population
        for chromosome in self.population:
            self.evaluate_fitness(chromosome)
        
        self.best_chromosome = min(self.population, key=lambda c: c.fitness)
        
        # Evolution loop
        for generation in range(self.max_generations):
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
            
            # Record stats
            stats = {
                'generation': generation,
                'best_fitness': self.best_chromosome.fitness,
                'violations': self.best_chromosome.violations.copy(),
                'avg_fitness': sum(c.fitness for c in self.population) / len(self.population)
            }
            self.generation_stats.append(stats)
            
            # Progress callback
            if self.progress_callback and generation % 10 == 0:
                self.progress_callback(generation, self.max_generations, stats)
            
            # Early termination
            if self.best_chromosome.fitness == 0:
                break
        
        # Apply best solution to ScheduleManager
        self._apply_solution_to_manager(self.best_chromosome)
        
        return self.best_chromosome
    
    def _apply_solution_to_manager(self, chromosome: Chromosome):
        """Apply the GA solution to ScheduleManager grids."""
        print("\n  [GA] Applying best solution to ScheduleManager...")
        
        # Create a lookup for lessons
        lesson_lookup = {lesson.lesson_id: lesson for lesson in self.lessons}
        
        applied_count = 0
        conflict_count = 0
        
        for lesson_id, assignments in chromosome.genes.items():
            lesson = lesson_lookup.get(lesson_id)
            if not lesson:
                continue
            
            for slot, room in assignments:
                # Use short day name (MON, TUE, etc.) as expected by ScheduleManager
                day = slot.day
                
                # Find the period column in the grid
                period_col = None
                for col in self.manager.template_grid.columns:
                    if col.startswith(f"{slot.period},"):
                        period_col = col
                        break
                
                if not period_col:
                    continue
                
                # Get class_id and teacher_id
                class_id = lesson.student_classes[0] if lesson.student_classes else None
                teacher_id = lesson.teacher_ids[0] if lesson.teacher_ids else None
                
                # Try to place the slot
                result = self.manager.place_slot(
                    day=full_day,
                    period_col=period_col,
                    subject_id=lesson.subject_id,
                    teacher_id=teacher_id,
                    room_id=room,
                    class_id=class_id,
                    reason="GA"
                )
                
                if "SUCCESS" in result:
                    applied_count += 1
                else:
                    conflict_count += 1
        
        print(f"  [GA] Applied {applied_count} assignments to ScheduleManager")
        if conflict_count > 0:
            print(f"  [GA] {conflict_count} assignments had conflicts (already occupied)")
    
    def get_result_summary(self) -> Dict:
        """Get summary of evolution results."""
        return {
            'final_fitness': self.best_chromosome.fitness if self.best_chromosome else None,
            'final_violations': self.best_chromosome.violations if self.best_chromosome else None,
            'generations_run': len(self.generation_stats),
            'solution_found': self.best_chromosome.fitness == 0 if self.best_chromosome else False,
            'parameters': {
                'population_size': self.population_size,
                'max_generations': self.max_generations,
                'mutation_rate': self.mutation_rate,
                'crossover_rate': self.crossover_rate,
                'elite_size': self.elite_size,
                'tournament_size': self.tournament_size
            }
        }

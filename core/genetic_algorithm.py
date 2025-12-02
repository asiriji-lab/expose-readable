"""
================================================================================
GA SCHEDULER - Genetic Algorithm Engine
================================================================================

Core genetic algorithm implementation for timetable optimization.
"""

import random
import copy
import ast
from typing import Dict, List, Tuple, Optional, Callable
from collections import defaultdict

from .models import (
    Lesson, TimeSlot, Chromosome,
    DAYS, TEACHING_PERIODS
)
from .data_loader import DataLoader, parse_block_pattern


class GeneticAlgorithm:
    """
    Genetic Algorithm engine for schedule optimization.
    
    FITNESS FUNCTION WEIGHTS:
    - Teacher conflict: 100 (teacher can't be in two places)
    - Student conflict: 100 (student can't be in two classes)
    - Room conflict: 50 (room can't have two classes)
    - Block violation: 30 (blocks should be consecutive)
    - Period count error: 20 (correct number of periods)
    - Invalid room: 10 (use valid rooms)
    """
    
    def __init__(self, 
                 data_loader: DataLoader,
                 population_size: int = 150,
                 max_generations: int = 500,
                 mutation_rate: float = 0.20,
                 crossover_rate: float = 0.80,
                 elite_size: int = 10,
                 tournament_size: int = 7,
                 progress_callback: Optional[Callable] = None):
        
        self.data = data_loader
        self.population_size = population_size
        self.max_generations = max_generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.elite_size = elite_size
        self.tournament_size = tournament_size
        self.progress_callback = progress_callback
        
        # Build available slots
        self.available_slots = self._build_available_slots()
        
        # Room list
        self.room_list = list(self.data.rooms.keys())
        
        # Population
        self.population: List[Chromosome] = []
        self.best_chromosome: Optional[Chromosome] = None
        
        # Statistics
        self.generation_stats: List[Dict] = []
        
    def _build_available_slots(self) -> Dict[str, List[TimeSlot]]:
        """Build list of available time slots."""
        all_slots = []
        for day in DAYS:
            for period in TEACHING_PERIODS:
                all_slots.append(TimeSlot(day, period))
        
        available = {'all': all_slots}
        
        for entity_id, blocked in self.data.preplaced_slots.items():
            entity_slots = [s for s in all_slots 
                          if (s.day, s.period) not in blocked]
            available[entity_id] = entity_slots
            
        return available
    
    def _get_available_slots_for_lesson(self, lesson: Lesson) -> List[TimeSlot]:
        """Get available slots for a lesson."""
        available = set(self.available_slots['all'])
        
        for teacher_id in lesson.teacher_ids:
            key = f"teacher_{teacher_id}"
            if key in self.available_slots:
                available &= set(self.available_slots[key])
                
        for class_id in lesson.student_classes:
            key = f"student_{class_id}"
            if key in self.available_slots:
                available &= set(self.available_slots[key])
                
        return list(available)
    
    def _get_consecutive_slots(self, start_slot: TimeSlot, 
                               count: int) -> Optional[List[TimeSlot]]:
        """Get consecutive time slots."""
        if start_slot.period not in TEACHING_PERIODS:
            return None
            
        slots = [start_slot]
        current_period_idx = TEACHING_PERIODS.index(start_slot.period)
        
        for i in range(1, count):
            next_idx = current_period_idx + i
            if next_idx >= len(TEACHING_PERIODS):
                return None
            slots.append(TimeSlot(start_slot.day, TEACHING_PERIODS[next_idx]))
            
        return slots
    
    def _select_room_for_lesson(self, lesson: Lesson) -> str:
        """Select an appropriate room for a lesson."""
        if lesson.required_room:
            room = str(lesson.required_room).strip()
            if room.startswith('['):
                try:
                    rooms = ast.literal_eval(room)
                    return rooms[0] if rooms else random.choice(self.room_list)
                except:
                    pass
            if room in self.data.rooms:
                return room
                
        return random.choice(self.room_list)
    
    def initialize_population(self):
        """Create initial population."""
        self.population = []
        
        for _ in range(self.population_size):
            chromosome = self._create_random_chromosome()
            self.population.append(chromosome)
            
    def _create_random_chromosome(self) -> Chromosome:
        """Create a random chromosome."""
        chromosome = Chromosome()
        
        for lesson in self.data.curriculum:
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
        
        for lesson in self.data.curriculum:
            assignments = chromosome.genes.get(lesson.lesson_id, [])
            
            total_periods, _ = parse_block_pattern(lesson.block_pattern)
            if len(assignments) != total_periods:
                violations['period_count'] += abs(len(assignments) - total_periods)
                
            for slot, room in assignments:
                slot_key = (slot.day, slot.period)
                
                for teacher_id in lesson.teacher_ids:
                    if slot_key in teacher_slots[teacher_id]:
                        violations['teacher_conflict'] += 1
                    else:
                        teacher_slots[teacher_id][slot_key] = lesson.lesson_id
                        
                for class_id in lesson.student_classes:
                    if slot_key in student_slots[class_id]:
                        violations['student_conflict'] += 1
                    else:
                        student_slots[class_id][slot_key] = lesson.lesson_id
                        
                if slot_key in room_slots[room]:
                    violations['room_conflict'] += 1
                else:
                    room_slots[room][slot_key] = lesson.lesson_id
                    
                if room not in self.data.rooms:
                    violations['invalid_room'] += 1
                    
        # Check block violations
        for lesson in self.data.curriculum:
            assignments = chromosome.genes.get(lesson.lesson_id, [])
            
            by_day = defaultdict(list)
            for slot, room in assignments:
                by_day[slot.day].append(slot.period)
                
            for day, periods in by_day.items():
                periods_sorted = sorted(
                    periods, 
                    key=lambda p: TEACHING_PERIODS.index(p) if p in TEACHING_PERIODS else 99
                )
                for i in range(len(periods_sorted) - 1):
                    try:
                        idx1 = TEACHING_PERIODS.index(periods_sorted[i])
                        idx2 = TEACHING_PERIODS.index(periods_sorted[i + 1])
                        if idx2 - idx1 != 1:
                            violations['block_violation'] += 1
                    except ValueError:
                        violations['block_violation'] += 1
                        
        # Calculate fitness
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
        """Tournament selection."""
        tournament = random.sample(self.population, self.tournament_size)
        return min(tournament, key=lambda c: c.fitness)
    
    def crossover(self, parent1: Chromosome, parent2: Chromosome) -> Tuple[Chromosome, Chromosome]:
        """Uniform crossover."""
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
        """Apply mutation."""
        for lesson in self.data.curriculum:
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
                    new_room = random.choice(self.room_list)
                    if lesson.lesson_id in chromosome.genes:
                        chromosome.genes[lesson.lesson_id] = [
                            (slot, new_room) for slot, _ in chromosome.genes[lesson.lesson_id]
                        ]
                        
                elif mutation_type == 'swap':
                    other_lesson = random.choice(self.data.curriculum)
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
                
        return self.best_chromosome
    
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
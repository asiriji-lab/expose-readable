"""
================================================================================
SIMULATED ANNEALING — Local Search for Timetable Scheduling
================================================================================

Applied as a "last mile" optimizer between GA epochs when the global best
fitness drops below a threshold. Effective at escaping shallow local optima
that GA cannot escape (requires passing through a temporarily worse state).

Move types:
  move_slot     — relocate one lesson block to a different (day, period)
  swap_slots    — exchange time slots between two lessons
  room_reassign — keep same time, try a different room for a violated lesson

Temperature schedule:
  T0   = max(current_fitness * 0.3, 50)
  T   *= cooling each iteration (default 0.95)
  Stop when T < 1e-6 or budget exhausted
================================================================================
"""

import math
import random
from typing import TYPE_CHECKING, List, Optional, Set, Tuple

from .models import Chromosome, TimeSlot

if TYPE_CHECKING:
    from .genetic_algorithm import GeneticAlgorithm


class SimulatedAnnealing:
    """Local search SA applied to a single chromosome."""

    def __init__(self, ga: "GeneticAlgorithm"):
        self.ga = ga

    # =========================================================================
    # PUBLIC API
    # =========================================================================

    def run(
        self,
        chromosome: Chromosome,
        budget: int = 300,
        T0: Optional[float] = None,
        cooling: float = 0.95,
    ) -> Chromosome:
        """
        Run SA on `chromosome`. Returns the best chromosome found.
        Does not modify the input — works on internal copies.
        """
        if T0 is None:
            T0 = max(chromosome.fitness * 0.3, 50.0)

        current = chromosome.copy()
        best    = current.copy()
        T       = T0

        for _ in range(budget):
            if T < 1e-6:
                break

            neighbor = self._make_move(current)
            if neighbor is None:
                T *= cooling
                continue

            self.ga.evaluate_fitness(neighbor)
            delta = neighbor.fitness - current.fitness

            if delta < 0 or random.random() < math.exp(-delta / T):
                current = neighbor
                if current.fitness < best.fitness:
                    best = current.copy()
                    if best.fitness == 0:
                        break

            T *= cooling

        return best

    # =========================================================================
    # MOVE SELECTION
    # =========================================================================

    def _make_move(self, chromosome: Chromosome) -> Optional[Chromosome]:
        """Pick and apply one random move. Returns modified copy or None if no move possible."""
        move = random.choices(
            ['move_slot', 'swap_slots', 'room_reassign'],
            weights=[0.40, 0.40, 0.20],
        )[0]

        if move == 'move_slot':
            return self._move_slot(chromosome)
        elif move == 'swap_slots':
            return self._swap_slots(chromosome)
        else:
            return self._room_reassign(chromosome)

    # =========================================================================
    # MOVE: move_slot
    # =========================================================================

    def _move_slot(self, chromosome: Chromosome) -> Optional[Chromosome]:
        """
        Pick a lesson (prefer violated), find an alternative (day, period) for
        one of its blocks and reassign it.
        """
        lesson = self._pick_lesson(chromosome, prefer_violated=True)
        if lesson is None:
            return None

        lid          = lesson.lesson_id
        assignments  = chromosome.genes.get(lid, [])
        if not assignments:
            return None

        # Pick a block index to move
        block_idx  = random.randrange(len(assignments))
        current_ts, room = assignments[block_idx]
        current_slot = (current_ts.day, current_ts.period_col)

        # Candidate slots: lesson's valid slots minus current slot
        available = [
            s for s in (self.ga._lesson_slots_cache[lid] or list(self.ga.all_slots))
            if s != current_slot
        ]
        if not available:
            return None

        new_slot = random.choice(available)
        neighbor = chromosome.copy()
        new_gene = list(neighbor.genes[lid])
        new_gene[block_idx] = (TimeSlot(new_slot[0], new_slot[1]), room)
        neighbor.genes[lid] = new_gene
        return neighbor

    # =========================================================================
    # MOVE: swap_slots
    # =========================================================================

    def _swap_slots(self, chromosome: Chromosome) -> Optional[Chromosome]:
        """
        Pick two lessons and swap their full slot assignments.
        Keeps rooms with their original lessons.
        """
        lessons = self.ga.lessons
        if len(lessons) < 2:
            return None

        a = self._pick_lesson(chromosome, prefer_violated=True)
        b = self._pick_lesson(chromosome, prefer_violated=False)
        if a is None or b is None or a.lesson_id == b.lesson_id:
            return None

        lid_a = a.lesson_id
        lid_b = b.lesson_id
        gene_a = chromosome.genes.get(lid_a, [])
        gene_b = chromosome.genes.get(lid_b, [])

        if not gene_a or not gene_b or len(gene_a) != len(gene_b):
            return None

        neighbor = chromosome.copy()
        # Swap time slots, keep each lesson's own rooms
        rooms_a = [rm for _, rm in gene_a]
        rooms_b = [rm for _, rm in gene_b]
        slots_a = [ts for ts, _ in gene_a]
        slots_b = [ts for ts, _ in gene_b]

        neighbor.genes[lid_a] = list(zip(slots_b, rooms_a))
        neighbor.genes[lid_b] = list(zip(slots_a, rooms_b))
        return neighbor

    # =========================================================================
    # MOVE: room_reassign
    # =========================================================================

    def _room_reassign(self, chromosome: Chromosome) -> Optional[Chromosome]:
        """
        Keep the same time slots for a lesson but assign a different room.
        Targets lessons with room_conflict or specialist_room violations.
        """
        lesson = self._pick_lesson(chromosome, prefer_violated=True)
        if lesson is None:
            return None

        lid = lesson.lesson_id
        if not chromosome.genes.get(lid):
            return None

        # Skip if room is fixed (required_rooms with only one option)
        if lesson.required_rooms and len(lesson.required_rooms) <= 1:
            return None

        new_room = self.ga._pick_room(lesson)
        neighbor = chromosome.copy()
        neighbor.genes[lid] = [(ts, new_room) for ts, _ in neighbor.genes[lid]]
        return neighbor

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _pick_lesson(self, chromosome: Chromosome, prefer_violated: bool):
        """
        Pick a lesson to mutate.
        prefer_violated=True: 70% chance to pick from lessons with wrong period count.
        """
        lessons = self.ga.lessons
        if not lessons:
            return None

        if prefer_violated and random.random() < 0.70:
            violated = [
                l for l in lessons
                if l.lesson_id not in self.ga._fixed_slots
                and len(chromosome.genes.get(l.lesson_id, [])) != self.ga._expected_periods[l.lesson_id]
            ]
            if violated:
                return random.choice(violated)

        candidates = [l for l in lessons if l.lesson_id not in self.ga._fixed_slots]
        return random.choice(candidates) if candidates else None

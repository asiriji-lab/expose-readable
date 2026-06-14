"""
================================================================================
SIMULATED ANNEALING — Local Search for Timetable Scheduling
================================================================================

Applied as a local optimizer between GA epochs when the search stagnates.
Conflict-directed: 80% of moves target lessons involved in teacher/student/room
violations, steering search toward the actual problem areas.

Move types:
  move_slot     — relocate one lesson block to a different (day, period)
  swap_slots    — exchange time slots between two lessons
  room_reassign — keep same time, try a different room for a violated lesson

Temperature schedule:
  T0    = (teacher_conflict + student_conflict + room_conflict) × 200, min 100
  cool  = (T_final / T0) ^ (1 / budget),  T_final = 20
  budget: 2000 iterations (default)
  Reheating: 150 consecutive rejects AND no improvement yet → T = T0 × 0.3
             (max 2 reheats per run)

Room awareness:
  _move_slot and _swap_slots re-pick room after changing time slot via
  _pick_room_aware, eliminating phantom room-conflict penalties.
================================================================================
"""

import math
import random
from collections import defaultdict
from typing import TYPE_CHECKING, Dict, List, Optional, Set, Tuple

from src.constants import NO_ROOM
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
        budget: int = 2000,
        T0: Optional[float] = None,
        cooling: Optional[float] = None,
    ) -> Chromosome:
        """
        Run SA on `chromosome`. Returns the best chromosome found.
        Does not modify the input — works on internal copies.
        """
        v = chromosome.violations or {}
        hard_count = (
            v.get('teacher_conflict', 0) +
            v.get('student_conflict', 0) +
            v.get('room_conflict', 0)
        )
        if T0 is None:
            T0 = max(hard_count * 200, 100.0)

        T_final = 20.0
        if cooling is None:
            cooling = (T_final / T0) ** (1.0 / budget) if T0 > T_final else 0.997

        current = chromosome.copy()
        best    = current.copy()
        T       = T0

        iters              = 0
        accepts            = 0
        improvements       = 0
        consecutive_rejects = 0
        reheat_count       = 0
        max_reheats        = 2
        reheat_threshold   = 150

        # Build conflict-directed lesson set and room occupation map once
        conflicted_lids = self._build_conflicted_lids(current)
        room_occ        = self._build_room_occ(current)

        for _ in range(budget):
            if T < 1e-6:
                break

            neighbor, moved_lids = self._make_move(current, room_occ, conflicted_lids)
            if neighbor is None:
                T *= cooling
                iters += 1
                consecutive_rejects += 1
                continue

            self.ga.evaluate_fitness(neighbor)
            delta = neighbor.fitness - current.fitness
            iters += 1

            if delta < 0 or random.random() < math.exp(-delta / T):
                # Update room_occ incrementally for accepted move
                for lid in (moved_lids or []):
                    self._update_occ(
                        room_occ,
                        current.genes.get(lid, []),
                        neighbor.genes.get(lid, []),
                    )
                current = neighbor
                accepts += 1
                consecutive_rejects = 0
                if current.fitness < best.fitness:
                    best = current.copy()
                    improvements += 1
                    # Refresh conflicted set to track current state
                    conflicted_lids = self._build_conflicted_lids(current)
                    if best.fitness == 0:
                        break
            else:
                consecutive_rejects += 1

            T *= cooling

            # Reheating: stuck with no improvement → reset T to T0 × 0.3
            if (consecutive_rejects >= reheat_threshold
                    and improvements == 0
                    and reheat_count < max_reheats):
                T = T0 * 0.3
                reheat_count += 1
                consecutive_rejects = 0
                conflicted_lids = self._build_conflicted_lids(current)
                print(f"      [SA] Reheat #{reheat_count}: T={T:.1f}")

        stop_reason = "T→0" if T < 1e-6 else "budget"
        print(
            f"    [SA] T0={T0:.1f}  cool={cooling:.5f}  Tf={T:.4f}"
            f"  iters={iters}/{budget} ({stop_reason})"
            f"  accepts={accepts}  improvements={improvements}"
            f"  reheats={reheat_count}"
            f"  fitness: {chromosome.fitness:.0f}→{best.fitness:.0f}"
        )
        return best

    # =========================================================================
    # MOVE SELECTION
    # =========================================================================

    def _make_move(
        self,
        chromosome: Chromosome,
        room_occ: Dict[Tuple[str, str], Set[str]],
        conflicted_lids: Set[str],
    ) -> Tuple[Optional[Chromosome], Optional[List[str]]]:
        """Pick and apply one move. Returns (neighbor, affected_lids) or (None, None)."""
        move = random.choices(
            ['move_slot', 'swap_slots', 'room_reassign'],
            weights=[0.40, 0.40, 0.20],
        )[0]

        if move == 'move_slot':
            result = self._move_slot(chromosome, room_occ, conflicted_lids)
            if result is None:
                return None, None
            neighbor, lid = result
            return neighbor, [lid]

        elif move == 'swap_slots':
            result = self._swap_slots(chromosome, room_occ, conflicted_lids)
            if result is None:
                return None, None
            neighbor, lid_a, lid_b = result
            return neighbor, [lid_a, lid_b]

        else:
            result = self._room_reassign(chromosome, room_occ, conflicted_lids)
            if result is None:
                return None, None
            neighbor, lid = result
            return neighbor, [lid]

    # =========================================================================
    # MOVE: move_slot
    # =========================================================================

    def _move_slot(
        self,
        chromosome: Chromosome,
        room_occ: Dict[Tuple[str, str], Set[str]],
        conflicted_lids: Set[str],
    ) -> Optional[Tuple[Chromosome, str]]:
        lesson = self._pick_lesson(chromosome, prefer_violated=True, conflicted_lids=conflicted_lids)
        if lesson is None:
            return None

        lid         = lesson.lesson_id
        assignments = chromosome.genes.get(lid, [])
        if not assignments:
            return None

        block_idx    = random.randrange(len(assignments))
        current_ts, _ = assignments[block_idx]
        current_slot = (current_ts.day, current_ts.period_col)

        available = [
            s for s in (self.ga._lesson_slots_cache[lid] or list(self.ga.all_slots))
            if s != current_slot
        ]
        if not available:
            return None

        new_slot = random.choice(available)
        neighbor = chromosome.copy()
        new_gene = list(neighbor.genes[lid])

        # Build new slot set (this block → new_slot, others unchanged)
        new_gene[block_idx] = (TimeSlot(new_slot[0], new_slot[1]), None)
        new_busy = frozenset((ts.day, ts.period_col) for ts, _ in new_gene)

        # Re-pick room using occ without this lesson's current contribution
        temp_occ = self._occ_without(room_occ, assignments)
        new_room = self.ga._pick_room_aware(lesson, new_busy, temp_occ)
        # Apply same room to ALL blocks (lesson uses one room across all its periods)
        neighbor.genes[lid] = [(ts, new_room) for ts, _ in new_gene]
        return neighbor, lid

    # =========================================================================
    # MOVE: swap_slots
    # =========================================================================

    def _swap_slots(
        self,
        chromosome: Chromosome,
        room_occ: Dict[Tuple[str, str], Set[str]],
        conflicted_lids: Set[str],
    ) -> Optional[Tuple[Chromosome, str, str]]:
        lessons = self.ga.lessons
        if len(lessons) < 2:
            return None

        a = self._pick_lesson(chromosome, prefer_violated=True,  conflicted_lids=conflicted_lids)
        b = self._pick_lesson(chromosome, prefer_violated=False, conflicted_lids=conflicted_lids)
        if a is None or b is None or a.lesson_id == b.lesson_id:
            return None

        lid_a  = a.lesson_id
        lid_b  = b.lesson_id
        gene_a = chromosome.genes.get(lid_a, [])
        gene_b = chromosome.genes.get(lid_b, [])

        if not gene_a or not gene_b or len(gene_a) != len(gene_b):
            return None

        slots_a = [ts for ts, _ in gene_a]
        slots_b = [ts for ts, _ in gene_b]

        # Remove both lessons from occ before picking new rooms
        temp_occ = self._occ_without(room_occ, gene_a)
        temp_occ = self._occ_without(temp_occ, gene_b)

        new_busy_a = frozenset((ts.day, ts.period_col) for ts in slots_b)
        new_busy_b = frozenset((ts.day, ts.period_col) for ts in slots_a)
        new_room_a = self.ga._pick_room_aware(a, new_busy_a, temp_occ)
        new_room_b = self.ga._pick_room_aware(b, new_busy_b, temp_occ)

        neighbor = chromosome.copy()
        neighbor.genes[lid_a] = [(ts, new_room_a) for ts in slots_b]
        neighbor.genes[lid_b] = [(ts, new_room_b) for ts in slots_a]
        return neighbor, lid_a, lid_b

    # =========================================================================
    # MOVE: room_reassign
    # =========================================================================

    def _room_reassign(
        self,
        chromosome: Chromosome,
        room_occ: Dict[Tuple[str, str], Set[str]],
        conflicted_lids: Set[str],
    ) -> Optional[Tuple[Chromosome, str]]:
        lesson = self._pick_lesson(chromosome, prefer_violated=True, conflicted_lids=conflicted_lids)
        if lesson is None:
            return None

        lid         = lesson.lesson_id
        assignments = chromosome.genes.get(lid, [])
        if not assignments:
            return None

        # Skip if room is fixed (required_rooms with only one option)
        if lesson.required_rooms and len(lesson.required_rooms) <= 1:
            return None

        busy_slots = frozenset((ts.day, ts.period_col) for ts, _ in assignments)
        temp_occ   = self._occ_without(room_occ, assignments)
        new_room   = self.ga._pick_room_aware(lesson, busy_slots, temp_occ)

        neighbor = chromosome.copy()
        neighbor.genes[lid] = [(ts, new_room) for ts, _ in assignments]
        return neighbor, lid

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _pick_lesson(
        self,
        chromosome: Chromosome,
        prefer_violated: bool,
        conflicted_lids: Optional[Set[str]] = None,
    ):
        """Pick a lesson. prefer_violated=True: 80% chance to target conflicting lessons."""
        lessons = self.ga.lessons
        if not lessons:
            return None

        candidates = [l for l in lessons if l.lesson_id not in self.ga._fixed_slots]
        if not candidates:
            return None

        if prefer_violated and conflicted_lids and random.random() < 0.80:
            conflicted = [l for l in candidates if l.lesson_id in conflicted_lids]
            if conflicted:
                return random.choice(conflicted)

        return random.choice(candidates)

    def _build_conflicted_lids(self, chromosome: Chromosome) -> Set[str]:
        """Find lessons involved in teacher, student, or room conflicts."""
        slot_map: Dict[Tuple, List] = defaultdict(list)
        for lid, assignments in chromosome.genes.items():
            for ts, room in assignments:
                slot_map[(ts.day, ts.period_col)].append((lid, room))

        conflicted: Set[str] = set()
        lid_teachers = self.ga._lid_teachers
        lid_classes  = self.ga._lid_classes

        for slot, entries in slot_map.items():
            # Room conflicts
            room_lids: Dict[str, List[str]] = defaultdict(list)
            for lid, room in entries:
                if room and room != NO_ROOM:
                    room_lids[room].append(lid)
            for room, lids in room_lids.items():
                if len(lids) > 1:
                    conflicted.update(lids)

            # Teacher conflicts
            teacher_lids: Dict[str, List[str]] = defaultdict(list)
            for lid, _ in entries:
                for tid in lid_teachers.get(lid, []):
                    teacher_lids[tid].append(lid)
            for tid, lids in teacher_lids.items():
                if len(lids) > 1:
                    conflicted.update(lids)

            # Student conflicts
            class_lids: Dict[str, List[str]] = defaultdict(list)
            for lid, _ in entries:
                for cls in lid_classes.get(lid, []):
                    class_lids[cls].append(lid)
            for cls, lids in class_lids.items():
                if len(lids) > 1:
                    conflicted.update(lids)

        return conflicted

    def _build_room_occ(
        self, chromosome: Chromosome
    ) -> Dict[Tuple[str, str], Set[str]]:
        """Build slot → set-of-rooms map from chromosome."""
        occ: Dict[Tuple[str, str], Set[str]] = defaultdict(set)
        for lid, assignments in chromosome.genes.items():
            for ts, room in assignments:
                if room and room != NO_ROOM:
                    occ[(ts.day, ts.period_col)].add(room)
        return occ

    def _occ_without(
        self,
        occ: Dict[Tuple[str, str], Set[str]],
        assignments: List,
    ) -> Dict[Tuple[str, str], Set[str]]:
        """
        Return shallow copy of occ with this lesson's room contributions removed.
        Does not mutate the input occ.
        """
        if not any(room and room != NO_ROOM for _, room in assignments):
            return occ

        result = dict(occ)
        for ts, room in assignments:
            if room and room != NO_ROOM:
                slot = (ts.day, ts.period_col)
                if slot in result:
                    new_set = set(result[slot])
                    new_set.discard(room)
                    result[slot] = new_set
        return result

    @staticmethod
    def _update_occ(
        occ: Dict[Tuple[str, str], Set[str]],
        old_assignments: List,
        new_assignments: List,
    ) -> None:
        """Update room_occ in place after an accepted move (old → new)."""
        for ts, room in old_assignments:
            if room and room != NO_ROOM:
                slot = (ts.day, ts.period_col)
                if slot in occ:
                    occ[slot].discard(room)

        for ts, room in new_assignments:
            if room and room != NO_ROOM:
                slot = (ts.day, ts.period_col)
                if slot not in occ:
                    occ[slot] = set()
                occ[slot].add(room)

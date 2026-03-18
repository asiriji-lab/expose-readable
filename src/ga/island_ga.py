"""
================================================================================
ISLAND GENETIC ALGORITHM
================================================================================

Distributed GA: N isolated sub-populations (islands) evolve independently and
periodically exchange their best individuals (migration).

Benefits:
  - Maintained diversity prevents premature convergence
  - Islands with different mutation rates explore different search-space regions
  - Ring topology limits migration "contamination" — a good solution spreads
    gradually rather than flooding all islands at once
================================================================================
"""

from typing import Any, Dict, List, Optional, Callable

from src.preschedule.scheduleManager import ScheduleManager
from .genetic_algorithm import GeneticAlgorithm
from .models import Chromosome


class IslandGeneticAlgorithm:
    """
    Island (Distributed) Genetic Algorithm for school timetable scheduling.

    Splits the population into n_islands independent GeneticAlgorithm instances,
    each with a different mutation rate (linear spread from 0.5× to 2.0× base).
    Every migration_interval generations the top n_migrants individuals from each
    island are sent to neighbouring islands (replacing their worst individuals).

    All other parameters (crossover_rate, tournament_size, elite_size, etc.) are
    shared across islands.
    """

    def __init__(
        self,
        schedule_manager: ScheduleManager,
        n_islands: int = 4,
        island_population_size: int = 125,
        migration_interval: int = 50,
        migration_rate: float = 0.1,
        topology: str = 'ring',
        max_generations: int = 500,
        mutation_rate: float = 0.015,
        crossover_rate: float = 0.9,
        tournament_size: int = 9,
        elite_size: int = 5,
        stagnation_limit: int = 50,
        block_crossover_rate: float = 0.5,
        catastrophic_after: int = 3,   # epochs with no global improvement → full island reset
        plateau_patience: int = 150,   # generations with no meaningful improvement → early stop
        min_improvement: float = 500,  # min fitness drop to count as "genuine" improvement for plateau stop
        min_gen_for_check: int = 4500, # plateau stop only fires after this generation
        progress_callback: Optional[Callable] = None,
    ):
        self.schedule_manager = schedule_manager
        self.n_islands = n_islands
        self.island_population_size = island_population_size
        self.migration_interval = migration_interval
        self.migration_rate = migration_rate
        self.topology = topology
        self.max_generations = max_generations
        self.base_mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.tournament_size = tournament_size
        self.elite_size = elite_size
        self.stagnation_limit = stagnation_limit
        self.block_crossover_rate = block_crossover_rate
        self.catastrophic_after = catastrophic_after
        # Plateau patience in epochs (convert from generations, min 1)
        self.plateau_patience_epochs = max(1, plateau_patience // migration_interval)
        self.min_improvement = min_improvement
        # min_gen_for_check in epochs (convert from generations, min 1)
        self.min_epoch_for_check = max(1, min_gen_for_check // migration_interval)
        self.progress_callback = progress_callback

        self.n_migrants: int = max(1, int(island_population_size * migration_rate))

        # Global best tracking
        self.best_chromosome: Optional[Chromosome] = None
        self.best_island_idx: int = 0
        self.generation_stats: List[Dict] = []

        # Global stagnation tracking (for catastrophic reset — resets on reset)
        self._global_stagnation: int = 0
        self._prev_best_fitness: float = float('inf')

        # Plateau tracking (for early stop — never resets on catastrophic reset)
        self._plateau_epochs: int = 0       # epochs since last genuine global improvement
        self._stopped_early: bool = False

        # Build islands — individual islands do NOT get the progress_callback;
        # IslandGA reports progress at the coarser epoch level instead.
        mutation_rates = self._spread_mutation_rates(mutation_rate, n_islands)
        self.islands: List[GeneticAlgorithm] = []
        for i, mr in enumerate(mutation_rates):
            island = GeneticAlgorithm(
                schedule_manager=schedule_manager,
                population_size=island_population_size,
                max_generations=max_generations,
                mutation_rate=mr,
                crossover_rate=crossover_rate,
                tournament_size=tournament_size,
                elite_size=elite_size,
                stagnation_limit=stagnation_limit,
                block_crossover_rate=block_crossover_rate,
                progress_callback=None,  # progress reported at epoch level by IslandGA
            )
            self.islands.append(island)

    # =========================================================================
    # PROPERTIES
    # =========================================================================

    @property
    def lessons(self):
        """Expose the shared lesson list (identical across all islands)."""
        return self.islands[0].lessons if self.islands else []

    # =========================================================================
    # HELPERS
    # =========================================================================

    @staticmethod
    def _spread_mutation_rates(base_rate: float, n_islands: int) -> List[float]:
        """Linear spread from 0.5× to 2.0× base_rate across n_islands."""
        if n_islands == 1:
            return [base_rate]
        lo, hi = 0.5 * base_rate, 2.0 * base_rate
        step = (hi - lo) / (n_islands - 1)
        return [lo + i * step for i in range(n_islands)]

    def _get_neighbors(self, island_idx: int) -> List[int]:
        """Return destination island indices for migration from island_idx."""
        if self.topology == 'ring':
            return [(island_idx + 1) % self.n_islands]
        elif self.topology == 'fully_connected':
            return [i for i in range(self.n_islands) if i != island_idx]
        else:
            raise ValueError(f"Unknown topology: {self.topology!r}")

    def _migrate(self, epoch: int) -> None:
        """
        Snapshot top n_migrants from each island, send to neighbours,
        replace their worst individuals.
        """
        emigrants: Dict[int, List[Chromosome]] = {}
        for i, island in enumerate(self.islands):
            sorted_pop = sorted(island.population, key=lambda c: c.fitness)
            emigrants[i] = [c.copy() for c in sorted_pop[:self.n_migrants]]

        for src_idx, migrants in emigrants.items():
            for dst_idx in self._get_neighbors(src_idx):
                dst = self.islands[dst_idx]
                dst.population.sort(key=lambda c: c.fitness, reverse=True)
                for j, migrant in enumerate(migrants):
                    if j < len(dst.population):
                        dst.population[j] = migrant.copy()

        gen_label = epoch * self.migration_interval
        print(f"  [Island GA] Migration at gen {gen_label}: "
              f"{self.n_migrants} migrants per island ({self.topology} topology)")

    def _update_global_best(self) -> None:
        """Scan all island best_chromosomes and update global best."""
        for i, island in enumerate(self.islands):
            if island.best_chromosome is None:
                continue
            if (self.best_chromosome is None or
                    island.best_chromosome.fitness < self.best_chromosome.fitness):
                self.best_chromosome = island.best_chromosome.copy()
                self.best_island_idx = i

    def _catastrophic_reset(self, epoch: int) -> None:
        """
        Fully reinitialize the worst-performing island when no global improvement
        has occurred for catastrophic_after consecutive epochs.
        """
        worst_idx = max(
            range(self.n_islands),
            key=lambda i: self.islands[i].best_chromosome.fitness,
        )
        island = self.islands[worst_idx]
        gen_label = epoch * self.migration_interval
        print(f"  [Island GA] *** Catastrophic reset: island {worst_idx} "
              f"at gen {gen_label} (global stagnation={self._global_stagnation} epochs) ***")

        island.initialize_population()
        for c in island.population:
            island.evaluate_fitness(c)
        island.best_chromosome = min(island.population, key=lambda c: c.fitness).copy()
        island._gens_without_improvement = 0
        island._current_generation = 0

        self._global_stagnation = 0

    # =========================================================================
    # MAIN EVOLUTION LOOP
    # =========================================================================

    def evolve(self) -> Chromosome:
        print("\n" + "=" * 60)
        print("  ISLAND GENETIC ALGORITHM EVOLUTION STARTING")
        print("=" * 60)
        print(f"  Islands      : {self.n_islands}")
        print(f"  Pop/island   : {self.island_population_size}  (total: {self.n_islands * self.island_population_size})")
        print(f"  Generations  : {self.max_generations}")
        print(f"  Migrate every: {self.migration_interval} gens  ({self.n_migrants} migrants/island)")
        print(f"  Topology     : {self.topology}")
        print(f"  Plateau stop : after {self.plateau_patience_epochs} epochs ({self.plateau_patience_epochs * self.migration_interval} gens) "
              f"with no meaningful improvement (>={self.min_improvement:.0f}), enabled after epoch {self.min_epoch_for_check} (gen {self.min_epoch_for_check * self.migration_interval})")
        mutation_rates = [isl.mutation_rate for isl in self.islands]
        for i, mr in enumerate(mutation_rates):
            print(f"  Island {i}      : mutation={mr:.4f}")
        print("=" * 60 + "\n")

        # ── Initialize & evaluate all islands ────────────────────────────────
        print("  Initializing islands...")
        for i, island in enumerate(self.islands):
            print(f"  [Island {i}] Initializing...")
            island.initialize_population()
            for c in island.population:
                island.evaluate_fitness(c)
            island.best_chromosome = min(island.population, key=lambda c: c.fitness).copy()
            print(f"  [Island {i}] Initial best fitness: {island.best_chromosome.fitness}")

        self._update_global_best()
        print(f"\n  Global initial best fitness: {self.best_chromosome.fitness}\n")

        # ── Epoch loop ────────────────────────────────────────────────────────
        n_epochs = self.max_generations // self.migration_interval
        remaining = self.max_generations % self.migration_interval

        for epoch in range(n_epochs):
            gen_end = (epoch + 1) * self.migration_interval

            island_bests = []
            for i, island in enumerate(self.islands):
                island.evolve_n_generations(self.migration_interval)
                island_bests.append(island.best_chromosome.fitness)

            self._update_global_best()

            improvement = self._prev_best_fitness - self.best_chromosome.fitness
            if improvement > 0:
                self._prev_best_fitness = self.best_chromosome.fitness
                self._global_stagnation = 0
            else:
                self._global_stagnation += 1

            # Plateau counter: only resets on *meaningful* improvement (>= min_improvement)
            if improvement >= self.min_improvement:
                self._plateau_epochs = 0    # genuine improvement → reset plateau counter
            else:
                self._plateau_epochs += 1   # counts across catastrophic resets

            epoch_stat = {
                'epoch':             epoch + 1,
                'generation':        gen_end,
                'best_fitness':      self.best_chromosome.fitness,
                'best_island':       self.best_island_idx,
                'island_bests':      island_bests,
                'violations':        self.best_chromosome.violations,
                'global_stagnation': self._global_stagnation,
                'plateau_epochs':    self._plateau_epochs,
            }
            self.generation_stats.append(epoch_stat)

            if self.progress_callback:
                self.progress_callback(gen_end, self.max_generations, epoch_stat)

            print(f"  [Epoch {epoch + 1:>3d} | Gen {gen_end:>4d}] "
                  f"Global best: {self.best_chromosome.fitness:.0f}  "
                  f"Island bests: {[f'{f:.0f}' for f in island_bests]}  "
                  f"GStag: {self._global_stagnation}  Plateau: {self._plateau_epochs}/{self.plateau_patience_epochs}")

            if self.best_chromosome.fitness == 0:
                print(f"\n  Perfect solution found at epoch {epoch + 1}!")
                break

            # Plateau early stop — only fires after min_epoch_for_check to allow early progress
            if (epoch + 1) >= self.min_epoch_for_check and self._plateau_epochs >= self.plateau_patience_epochs:
                self._stopped_early = True
                print(f"\n  ⏹  Plateau stop at epoch {epoch + 1} (gen {gen_end}): "
                      f"no meaningful improvement (>={self.min_improvement:.0f}) "
                      f"for {self.plateau_patience_epochs} epochs "
                      f"({self.plateau_patience_epochs * self.migration_interval} gens), "
                      f"best fitness = {self.best_chromosome.fitness:.0f}")
                break

            if self._global_stagnation >= self.catastrophic_after:
                self._catastrophic_reset(epoch + 1)

            if epoch < n_epochs - 1:
                self._migrate(epoch + 1)

        # ── Run remaining generations on the best island ─────────────────────
        if remaining > 0 and self.best_chromosome.fitness != 0:
            best_island = self.islands[self.best_island_idx]
            print(f"\n  Running {remaining} remaining gens on island {self.best_island_idx}...")
            best_island.evolve_n_generations(remaining)
            self._update_global_best()

        print("\n" + "=" * 60)
        print("  ISLAND EVOLUTION COMPLETE")
        print(f"  Final fitness  : {self.best_chromosome.fitness}")
        print(f"  Best island    : {self.best_island_idx}")
        print(f"  Final violations: {self.best_chromosome.violations}")

        # Unassigned slot detail (mirrors GeneticAlgorithm.evolve reporting)
        best_island = self.islands[self.best_island_idx]
        unassigned = []
        for lesson in best_island.lessons:
            assigned = len(self.best_chromosome.genes.get(lesson.lesson_id, []))
            expected = best_island._expected_periods[lesson.lesson_id]
            if assigned < expected:
                unassigned.append((lesson, assigned, expected))

        if unassigned:
            print(f"\n  Unassigned slots ({len(unassigned)} lessons):")
            for lesson, assigned, expected in unassigned:
                print(f"    {lesson.lesson_id} | {lesson.subject_id} | {lesson.subject_name} | "
                      f"classes={lesson.student_classes} | "
                      f"assigned={assigned}/{expected} | missing={expected - assigned}")
        else:
            print("\n  All lessons fully assigned.")
        print("=" * 60 + "\n")

        return self.best_chromosome

    # =========================================================================
    # APPLY SOLUTION
    # =========================================================================

    def apply_solution(self) -> None:
        """Delegate to the best island's GeneticAlgorithm.apply_solution()."""
        best_island = self.islands[self.best_island_idx]
        original = best_island.best_chromosome
        best_island.best_chromosome = self.best_chromosome
        best_island.apply_solution()
        best_island.best_chromosome = original

    # =========================================================================
    # RESULT SUMMARY
    # =========================================================================

    def get_result_summary(self) -> Dict[str, Any]:
        if not self.best_chromosome:
            return {}
        best_island = self.islands[self.best_island_idx]
        unassigned = []
        for lesson in best_island.lessons:
            assigned = len(self.best_chromosome.genes.get(lesson.lesson_id, []))
            expected = best_island._expected_periods[lesson.lesson_id]
            if assigned < expected:
                unassigned.append({
                    'lesson_id':        lesson.lesson_id,
                    'subject_id':       lesson.subject_id,
                    'subject_name':     lesson.subject_name,
                    'teacher_ids':      lesson.teacher_ids,
                    'student_classes':  lesson.student_classes,
                    'assigned_periods': assigned,
                    'expected_periods': expected,
                    'missing_periods':  expected - assigned,
                })
        return {
            'final_fitness':       self.best_chromosome.fitness,
            'generations_run':     self.max_generations,
            'solution_found':      self.best_chromosome.fitness == 0,
            'stopped_early':       self._stopped_early,
            'plateau_epochs':      self._plateau_epochs,
            'plateau_patience_epochs': self.plateau_patience_epochs,
            'final_violations':    self.best_chromosome.violations,
            'lessons_scheduled':   len(best_island.lessons),
            'n_islands':           self.n_islands,
            'best_island':         self.best_island_idx,
            'unassigned_lessons':  unassigned,
        }

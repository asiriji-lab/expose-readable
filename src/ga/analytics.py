"""
================================================================================
GA ANALYTICS COLLECTOR
================================================================================

Collects timing and convergence data during GA execution and writes
a structured analytics.json to the job outputs folder.

Data collected:
  - Per-generation phase timing (selection / crossover / mutation / fitness eval)
    sampled every `timing_sample_every` generations, all islands
  - Per-epoch convergence curve (global best + per-island bests)
  - Early-stop diagnostics (reason, generation, window metrics)
  - Overall wall-clock times (init phase, evolution phase)
================================================================================
"""

import json
import time
from typing import Any, Dict, List, Optional


class AnalyticsCollector:
    """Lightweight collector — zero overhead when not sampling."""

    def __init__(
        self,
        job_id: str = "",
        n_islands: int = 1,
        max_generations: int = 0,
        timing_sample_every: int = 20,
    ):
        self.job_id = job_id
        self.n_islands = n_islands
        self.max_generations = max_generations
        self.timing_sample_every = timing_sample_every

        # Wall-clock bookkeeping
        self._wall_start: float = time.perf_counter()
        self.init_wall_s: float = 0.0
        self.evolution_wall_s: float = 0.0

        # Convergence: one record per epoch
        self.convergence: List[Dict[str, Any]] = []

        # Timing: sampled per-generation records
        self.timing: List[Dict[str, Any]] = []

        # Restarts: one record per stagnation restart (always recorded, not sampled)
        self.restarts: List[Dict[str, Any]] = []

        # Epoch-level overhead: migration, SA, LNS, catastrophic reset
        self.epoch_timing: List[Dict[str, Any]] = []

        # Stop diagnostics
        self.stop: Dict[str, Any] = {}

    # =========================================================================
    # TIMING HELPERS
    # =========================================================================

    def mark_init_done(self) -> None:
        self.init_wall_s = time.perf_counter() - self._wall_start

    def mark_evolution_done(self) -> None:
        elapsed = time.perf_counter() - self._wall_start
        self.evolution_wall_s = elapsed - self.init_wall_s

    # =========================================================================
    # PER-GENERATION TIMING
    # =========================================================================

    def record_gen_timing(
        self,
        island_idx: int,
        generation: int,
        selection_s: float,
        crossover_s: float,
        mutation_s: float,
        fitness_eval_s: float,
        sort_s: float = 0.0,
        elite_copy_s: float = 0.0,
    ) -> None:
        if generation % self.timing_sample_every != 0:
            return
        self.timing.append({
            "island":         island_idx,
            "generation":     generation,
            "sort_s":         round(sort_s,          6),
            "elite_copy_s":   round(elite_copy_s,    6),
            "selection_s":    round(selection_s,     6),
            "crossover_s":    round(crossover_s,     6),
            "mutation_s":     round(mutation_s,      6),
            "fitness_eval_s": round(fitness_eval_s,  6),
            "total_s":        round(sort_s + elite_copy_s + selection_s + crossover_s + mutation_s + fitness_eval_s, 6),
        })

    # =========================================================================
    # CONVERGENCE
    # =========================================================================

    def record_epoch(
        self,
        epoch: int,
        generation: int,
        global_fitness: float,
        island_bests: List[float],
    ) -> None:
        self.convergence.append({
            "epoch":         epoch,
            "generation":    generation,
            "global_fitness": round(global_fitness, 2),
            "island_bests":  [round(f, 2) for f in island_bests],
        })

    # =========================================================================
    # STAGNATION RESTARTS
    # =========================================================================

    def record_restart(
        self,
        island_idx: int,
        generation: int,
        restart_s: float,
        n_kept: int,
        n_perturbed: int,
        n_fresh: int,
    ) -> None:
        self.restarts.append({
            "island":      island_idx,
            "generation":  generation,
            "restart_s":   round(restart_s, 6),
            "n_kept":      n_kept,
            "n_perturbed": n_perturbed,
            "n_fresh":     n_fresh,
        })

    # =========================================================================
    # EPOCH-LEVEL OVERHEAD
    # =========================================================================

    def record_epoch_timing(
        self,
        epoch: int,
        generation: int,
        migration_s: float = 0.0,
        sa_s: float = 0.0,
        lns_s: float = 0.0,
        catastrophic_reset_s: float = 0.0,
    ) -> None:
        self.epoch_timing.append({
            "epoch":                epoch,
            "generation":           generation,
            "migration_s":          round(migration_s,          6),
            "sa_s":                 round(sa_s,                 6),
            "lns_s":                round(lns_s,                6),
            "catastrophic_reset_s": round(catastrophic_reset_s, 6),
            "overhead_s":           round(migration_s + sa_s + lns_s + catastrophic_reset_s, 6),
        })

    # =========================================================================
    # STOP DIAGNOSTICS
    # =========================================================================

    def set_stop_reason(
        self,
        reason: str,          # "perfect_solution" | "window_stop" | "max_generations"
        generation: int,
        **kwargs: Any,        # window_improvement, min_improvement, window_size, etc.
    ) -> None:
        self.stop = {"reason": reason, "generation": generation, **kwargs}

    # =========================================================================
    # SERIALISE
    # =========================================================================

    def to_dict(self) -> Dict[str, Any]:
        total_wall = self.init_wall_s + self.evolution_wall_s
        return {
            "run_info": {
                "job_id":           self.job_id,
                "n_islands":        self.n_islands,
                "max_generations":  self.max_generations,
                "init_wall_s":      round(self.init_wall_s,      3),
                "evolution_wall_s": round(self.evolution_wall_s, 3),
                "total_wall_s":     round(total_wall,            3),
            },
            "stop":         self.stop,
            "convergence":  self.convergence,
            "timing":       self.timing,
            "restarts":     self.restarts,
            "epoch_timing": self.epoch_timing,
        }

    def write_json(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)

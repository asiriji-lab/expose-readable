#!/usr/bin/env python3
"""Plot GA analytics: convergence and timing."""

import json
from pathlib import Path
from collections import defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

DATA_PATH = Path(__file__).parent / "output/ga_results/analytics.json"
OUT_DIR = Path(__file__).parent / "output/ga_results"

with open(DATA_PATH) as f:
    data = json.load(f)

convergence = data["convergence"]
timing_raw = data["timing"]
stop_gen = data["stop"]["generation"]
n_islands = data["run_info"]["n_islands"]

generations = [c["generation"] for c in convergence]
global_fitness = [c["global_fitness"] for c in convergence]
island_bests = [[c["island_bests"][i] for c in convergence] for i in range(n_islands)]

timing_by_gen = defaultdict(lambda: defaultdict(float))
timing_keys = ["selection_s", "crossover_s", "mutation_s", "fitness_eval_s"]
for entry in timing_raw:
    g = entry["generation"]
    for k in timing_keys:
        timing_by_gen[g][k] += entry[k]

t_gens = sorted(timing_by_gen.keys())
t_arrays = {k: np.array([timing_by_gen[g][k] for g in t_gens]) for k in timing_keys}

COLORS = {
    "selection_s":    "#4C72B0",
    "crossover_s":    "#DD8452",
    "mutation_s":     "#55A868",
    "fitness_eval_s": "#C44E52",
}
LABELS = {
    "selection_s":    "Selection",
    "crossover_s":    "Crossover",
    "mutation_s":     "Mutation",
    "fitness_eval_s": "Fitness Eval",
}
ISLAND_COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"]

# ── Graph 1: Global fitness ───────────────────────────────────────────────────
fig1, ax1 = plt.subplots(figsize=(14, 6))
ax1.plot(generations, global_fitness, color="#1f77b4", linewidth=2, marker="o",
         markersize=3, label="Global Best Fitness")
ax1.axvline(stop_gen, color="red", linestyle="--", linewidth=1.2, alpha=0.7,
            label=f"Stop (gen {stop_gen})")
ax1.fill_between(generations, global_fitness, alpha=0.12, color="#1f77b4")
ax1.set_title("Global Best Fitness over Generation", fontsize=13, pad=10)
ax1.set_xlabel("Generation")
ax1.set_ylabel("Fitness (lower = better)")
ax1.legend(fontsize=9)
ax1.grid(True, alpha=0.3)
fig1.tight_layout()
p1 = OUT_DIR / "plot1_global_fitness.png"
fig1.savefig(p1, dpi=150, bbox_inches="tight")
print(f"Saved → {p1}")
plt.close(fig1)

# ── Graph 2: Island bests ─────────────────────────────────────────────────────
fig2, ax2 = plt.subplots(figsize=(14, 6))
for i in range(n_islands):
    ax2.plot(generations, island_bests[i], color=ISLAND_COLORS[i],
             linewidth=1.6, marker="o", markersize=2.5, label=f"Island {i}")
ax2.axvline(stop_gen, color="red", linestyle="--", linewidth=1.2, alpha=0.7,
            label=f"Stop (gen {stop_gen})")
ax2.set_title("Island Best Fitness over Generation", fontsize=13, pad=10)
ax2.set_xlabel("Generation")
ax2.set_ylabel("Fitness (lower = better)")
ax2.legend(fontsize=9)
ax2.grid(True, alpha=0.3)
fig2.tight_layout()
p2 = OUT_DIR / "plot2_island_bests.png"
fig2.savefig(p2, dpi=150, bbox_inches="tight")
print(f"Saved → {p2}")
plt.close(fig2)

# ── Graph 3: Stacked timing barchart ─────────────────────────────────────────
fig3, ax3 = plt.subplots(figsize=(14, 6))
bar_width = (t_gens[1] - t_gens[0]) * 0.85 if len(t_gens) > 1 else 15
bottoms = np.zeros(len(t_gens))
for k in timing_keys:
    ax3.bar(t_gens, t_arrays[k], bottom=bottoms, width=bar_width,
            color=COLORS[k], label=LABELS[k], alpha=0.9)
    bottoms += t_arrays[k]
ax3.axvline(stop_gen, color="red", linestyle="--", linewidth=1.2, alpha=0.7,
            label=f"Stop (gen {stop_gen})")
ax3.set_title("Detailed Timing per Generation (summed across 4 islands)", fontsize=13, pad=10)
ax3.set_xlabel("Generation")
ax3.set_ylabel("Wall time (s)")
ax3.legend(fontsize=9, loc="upper right")
ax3.grid(True, alpha=0.3, axis="y")
fig3.tight_layout()
p3 = OUT_DIR / "plot3_timing.png"
fig3.savefig(p3, dpi=150, bbox_inches="tight")
print(f"Saved → {p3}")
plt.close(fig3)

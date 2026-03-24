# How the Scheduling Algorithm Works

Schedool solves school timetabling — one of the classic "NP-hard" problems in computer science. That means there is no shortcut formula to find the perfect answer; the number of possible timetables is so astronomically large that you could never check them all. Instead, Schedool uses a **Genetic Algorithm (GA)** inspired by biological evolution: start with a population of candidate timetables, score them, keep the best ones, combine and mutate them, and repeat — gradually improving until a good (or perfect) solution emerges.

---

## Table of Contents

1. [The Pipeline: What Happens Before the GA Runs](#1-the-pipeline-what-happens-before-the-ga-runs)
2. [Core Concepts](#2-core-concepts)
3. [Standard Genetic Algorithm](#3-standard-genetic-algorithm)
4. [Island Genetic Algorithm](#4-island-genetic-algorithm)
5. [Stopping Criteria](#5-stopping-criteria)
6. [Reading the Logs](#6-reading-the-logs)

---

## 1. The Pipeline: What Happens Before the GA Runs

Before the GA even starts, the system runs a five-step **preschedule pipeline** that sets up the timetable grids and fills in everything that is already known:

| Step | Name | What it does |
|---|---|---|
| Task 1 | **Initialise Grids** | Creates blank timetable grids for every teacher, student class, and room based on the period structure. |
| Task 2 | **Pre-placement** | Fills in fixed slots — homeroom periods, morning/afternoon breaks, lunch, assemblies — from `preplace.csv`. These slots are locked and the GA never touches them. |
| Task 3 | **Mark Teacher Availability** | Marks which slots each teacher is unavailable for, based on `teacher.csv`. |
| Task 4 | **Schedule Electives** | Places elective courses (ชุมนุม/เสรี) into the grids from `elective.csv`. These are pre-assigned and also locked before the GA runs. |
| Task 5 | **Assign Scout Sessions** | Places scout sessions (ลูกเสือ) from `scout.csv`. Also locked before GA. |

After the preschedule, a **feasibility check** runs. It inspects the data to catch obvious impossibilities before spending time on the GA — for example, a teacher being assigned more lessons than they have free slots. Feasibility issues are reported as either `ERROR` (the GA cannot possibly solve this) or `WARNING` (the GA may still find a solution, but it will be hard).

Only after all of this does the GA start.

---

## 2. Core Concepts

### Chromosomes — Representing a Timetable

Each candidate timetable is called a **chromosome**. It is essentially a dictionary mapping every lesson to the time slots and room it is assigned to:

```
Chromosome = {
    "PHY101_T001_1_1" → [ (Monday, Period 2, RoomA101),
                           (Monday, Period 3, RoomA101) ],
    "MATH201_T002_2_1" → [ (Tuesday, Period 1, RoomB202) ],
    ...
}
```

A lesson with a `2-1` block pattern (two consecutive periods + one separate period) will have three entries: two periods on one day and one period on another.

### Lessons

A **lesson** is one row from the curriculum — a specific subject, taught by a specific teacher, to a specific class group, for a specific number of periods per week. The GA must schedule every lesson.

### Fitness Score — Lower is Better

Every chromosome is given a **fitness score** — the total penalty for all the constraint violations it contains. A **lower score is better**. A perfect timetable (no violations at all) has a score of **0**.

| Violation | Penalty per occurrence |
|---|---|
| Teacher booked in two places at the same time | 100 |
| Student class booked in two places at the same time | 100 |
| `SEPERATE_SLOT` group placed at the same time | 100 |
| `SUB_GROUP` group NOT placed at the same time | 100 |
| Block pattern broken (e.g. two periods not consecutive) | 80 |
| Room double-booked at the same time | 50 |
| Wrong number of periods scheduled for a lesson | 20 |
| Lesson placed in a room it is not allowed to use | 10 |

---

## 3. Standard Genetic Algorithm

The standard GA (`genetic_algorithm.py`) is used when you set `n_islands=1`. It is the simpler of the two modes — a single population evolving over time.

### Step 1 — Initialisation

Rather than starting with completely random timetables, the GA uses **greedy constructive initialisation**:

1. Shuffle the list of lessons randomly.
2. For each lesson, try to place it into an available slot that does not immediately conflict with already-placed lessons.
3. Multi-period blocks (e.g. two consecutive periods) are sorted to be placed first, so they claim the consecutive slots they need before single-period lessons fill the gaps.

This gives the first generation a big head start over pure random placement.

### Step 2 — Evaluation

Every chromosome in the population is scored by the fitness function. The one with the lowest score is the **best chromosome** for this generation.

### Step 3 — Selection (Tournament)

To choose a parent for producing the next generation, **tournament selection** is used:

1. Pick a small random group of chromosomes from the population (default: 9).
2. The one with the lowest fitness (fewest violations) wins and becomes a parent.

This naturally favours better solutions while still giving weaker ones a small chance — preserving diversity.

### Step 4 — Crossover

Two parent chromosomes are combined to produce children. Schedool uses **teacher-grouped crossover**:

1. All lessons are grouped by teacher.
2. For each teacher's group of lessons, the child inherits **all** of that teacher's lessons from one parent or the other — never a mix. This prevents a teacher ending up with an internally inconsistent schedule after crossover.
3. Optionally, within a single lesson, individual period-blocks can also be swapped between parents (controlled by `block_crossover_rate`).

This two-level approach is far more intelligent than a naive random gene swap.

### Step 5 — Mutation

After crossover, each lesson in a child chromosome may be mutated with probability `mutation_rate`. Four mutation operators exist, each chosen with a certain probability:

| Operator | Probability | What it does |
|---|---|---|
| **Targeted block** | 50% | Finds which specific slot of this lesson is currently causing a conflict, then moves only that slot to a conflict-free alternative. The rest of the lesson is untouched. |
| **Explore** | 20% | Like targeted block, but considers slots from across the whole timetable — helps escape deep local optima. |
| **Room change** | 20% | Keeps the same time slots but assigns the lesson to a different valid room. |
| **Full re-slot** | 10% | Completely re-assigns all slots for this lesson to random available slots. A low-probability "nuclear option" to escape badly stuck configurations. |

The key insight is **targeted mutation**: instead of blindly randomising a lesson, the algorithm surgically fixes the broken part while preserving everything that is already working.

### Step 6 — Elitism

The top `elite_size` chromosomes from each generation are always carried forward unchanged into the next generation. This guarantees that the best solution found so far is never lost.

### Step 7 — Stagnation Restart

If the best fitness does not improve for `stagnation_limit` consecutive generations (default: 50), the **bottom half** of the population is discarded and replaced with fresh randomly-generated chromosomes. The top half (the good solutions) are kept. This prevents the population from permanently getting stuck in a local optimum.

---

## 4. Island Genetic Algorithm

The Island GA (`island_ga.py`) is the default mode. Instead of one population, it runs **multiple independent populations (islands)** that occasionally share their best individuals.

### Why Islands?

A single population can get trapped in a **local optimum** — a solution that is better than all its neighbours, but not the global best. With multiple islands, each exploring a different part of the solution space, it is much harder for all of them to get stuck at the same local optimum simultaneously.

### How It Works

```
Island 0  →  Island 1
   ↑              ↓
Island 3  ←  Island 2
```

- Each island has its own population of `island_population_size` chromosomes (default: 125).
- Each island runs its own independent GA loop.
- Each island is given a **different mutation rate** — spread linearly from 0.5× to 2.0× the base `mutation_rate`. This means some islands are cautious (refining good solutions slowly) while others are aggressive (making big random changes to escape traps).
- Every `migration_interval` generations (default: 50), the top migrants from each island are **sent to the next island** in the ring. Migrants replace the weakest individuals in the receiving island.

One full cycle of all islands running for `migration_interval` generations is called an **epoch**.

### Migration in Detail

When migration happens:
1. Each island selects its top `n_migrants` chromosomes (where `n_migrants = island_population_size × migration_rate`).
2. Each island sends those migrants to its neighbour in the ring (0→1→2→3→0 by default).
3. The receiving island replaces its worst `n_migrants` individuals with the migrants.

Migration injects fresh genetic material from a different part of the search space without disrupting the whole population.

### Catastrophic Reset

If **no island makes any global improvement** for `catastrophic_after` consecutive epochs (default: 3 epochs = 150 generations), the island that has been stagnating the longest is **completely rebuilt from scratch** with a brand-new random population. This is a more aggressive intervention than the per-island stagnation restart in the standard GA.

---

## 5. Stopping Criteria

The algorithm can stop for five different reasons:

### 1. Perfect Solution Found
If the best fitness ever reaches **0**, every constraint is satisfied. The algorithm stops immediately and reports a perfect timetable.

### 2. Generation Limit Reached
If the algorithm runs for `max_generations` generations (default: 5,000 for the Island GA) without finding a perfect solution, it stops and returns the best solution found.

### 3. Island-Level Stagnation Restart
*(Standard GA and each island within the Island GA)*

If a single island's best fitness does not improve for `stagnation_limit` consecutive generations (default: 50), the bottom half of that island's population is discarded and replaced with fresh chromosomes. The algorithm does **not** stop — it keeps running with the refreshed island. This is a recovery mechanism, not a termination.

### 4. Catastrophic Reset
*(Island GA only)*

If no island makes global progress for `catastrophic_after` epochs (default: 3), the most-stagnated island is fully rebuilt. Again, the algorithm keeps running — this is not a stop condition, just a reset.

### 5. Sliding-Window Early Stop

This is the primary termination mechanism for long runs. The idea is simple: **if the solution has barely improved recently, continuing is unlikely to help — so stop early and save time.**

Here is how it works:

- A rolling window keeps track of the best fitness score over the last `window_size` generations (default: 1,000).
- Every generation, the algorithm compares the **oldest fitness value in the window** (from 1,000 generations ago) against the **current best fitness**.
- The difference is the **window improvement** — how much the fitness has dropped (improved) over that window.
- If the window improvement is **less than `min_improvement`** (default: 500 penalty points), the algorithm concludes the search has converged and **stops early**.

The window must be full before the check can fire — so the earliest possible early stop is at generation 1,000.

**Example:** If 1,000 generations ago the best fitness was 4,800, and today it is 4,400, the window improvement is 400. Since 400 < 500, the algorithm stops.

**In the Island GA**, the window tracks one entry per **epoch** (not per generation). The effective number of epochs is `window_size ÷ migration_interval`. This means the window still covers the same number of generations, just counted differently.

### Summary Table

| Stop Condition | Scope | What happens |
|---|---|---|
| `fitness == 0` | Global | Immediate stop — perfect timetable |
| Generation limit reached | Global | Stop — return best found |
| No improvement for 50 gens | Per island | Reseed bottom half (keep running) |
| No global improvement for 3 epochs | Global | Rebuild worst island (keep running) |
| Window improvement < 500 over last 1,000 gens | Global | Stop early — search has converged |

---

## 6. Reading the Logs

When the Island GA runs, each epoch prints a line like:

```
  [Epoch  12 | Gen  600] Global best: 3240  Island bests: ['3240', '3410', '3580', '3290']  GStag: 0  WinImprove: 860/500
```

| Field | Meaning |
|---|---|
| `Epoch N \| Gen N` | Which epoch and how many total generations have run |
| `Global best` | The best fitness score seen across all islands so far (lower = better) |
| `Island bests` | The best fitness score on each individual island this epoch |
| `GStag` | Global stagnation counter — how many epochs in a row with no global improvement |
| `WinImprove: X/Y` | **X** = how much the global best has improved over the last window. **Y** = the `min_improvement` threshold. When X drops below Y, the algorithm stops. `—` means the window is not yet full. |

When the window stop fires:
```
  ⏹  Window stop at epoch 47 (gen 2350): improvement over last 1000 gens (3240 → 2890) = 350 < 500
```

This means: over the last 1,000 generations the fitness only improved by 350 points, which is less than the 500-point threshold, so the algorithm stopped.

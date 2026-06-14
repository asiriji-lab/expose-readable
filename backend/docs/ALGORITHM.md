# How the Scheduling Algorithm Works

Schedool solves school timetabling — one of the classic "NP-hard" problems in computer science. That means there is no shortcut formula to find the perfect answer; the number of possible timetables is so astronomically large that you could never check them all. Instead, Schedool uses a **Genetic Algorithm (GA)** inspired by biological evolution: start with a population of candidate timetables, score them, keep the best ones, combine and mutate them, and repeat — gradually improving until a good (or perfect) solution emerges.

---

## Table of Contents

1. [The Pipeline: What Happens Before the GA Runs](#1-the-pipeline-what-happens-before-the-ga-runs)
2. [The Big Picture: What a GA Actually Is](#2-the-big-picture-what-a-ga-actually-is)
3. [Core Concepts](#3-core-concepts)
4. [Standard Genetic Algorithm](#4-standard-genetic-algorithm)
5. [Island Genetic Algorithm](#5-island-genetic-algorithm)
6. [Stopping Criteria](#6-stopping-criteria)
7. [Reading the Logs](#7-reading-the-logs)

---

## 1. The Pipeline: What Happens Before the GA Runs

Before the GA even starts, the system runs a six-step **preschedule pipeline** that sets up the timetable grids and fills in everything that is already known:

| Step | Name | What it does |
|---|---|---|
| Task 1 | **Initialise Grids** | Creates blank timetable grids for every teacher, student class, and room based on the period structure. |
| Task 2 | **Pre-placement** | Fills in fixed slots — homeroom periods, morning/afternoon breaks, lunch, assemblies — from `preplace.csv`. These slots are locked and the GA never touches them. |
| Task 3 | **Mark Teacher Availability** | Marks which slots each teacher is unavailable for, based on `teacher.csv`. Internal teachers (ID prefix `T`) have specific unavailable slots marked; external teachers (ID prefix `E`) have all slots marked unavailable except those listed as available. |
| Task 4 | **Schedule Electives** | Places elective courses (ชุมนุม/เสรี) into the grids from `elective.csv`. These are pre-assigned and also locked before the GA runs. |
| Task 5 | **Assign Scout Sessions** | Places scout sessions (ลูกเสือ) from `scout.csv`. Also locked before GA. |
| Task 6 | **Lock Fixed Curriculum Lessons** | Pre-places curriculum rows that have a `fixed_period` value (e.g. `MULTI_CLASS_TEAM` lessons with a prescribed slot). These are written into the grids and stored in `manager.locked_lessons`; the GA skips them entirely and the exporter treats them as normal editable lessons in the output. |

After the preschedule, a **feasibility check** runs. It inspects the data to catch obvious impossibilities before spending time on the GA — for example, a teacher being assigned more lessons than they have free slots. Feasibility issues are reported as either `ERROR` (the GA cannot possibly solve this) or `WARNING` (the GA may still find a solution, but it will be hard).

Only after all of this does the GA start.

---

## 2. The Big Picture: What a GA Actually Is

If you have never worked with a genetic algorithm before, here is the one-paragraph version:

> A GA maintains a pool of candidate solutions (the **population**). Each solution is evaluated and given a score. The worst solutions are discarded; the better ones are recombined ("mated") to produce new solutions that hopefully inherit the best traits of both parents. Some solutions are randomly tweaked (**mutated**) to prevent the search from getting stuck. This cycle — evaluate, select, recombine, mutate — repeats for many **generations**, and the population gradually drifts toward better and better solutions.

The biological metaphor is intentional. In biology:

| Biology | Schedool |
|---|---|
| Organism | A complete candidate timetable (`Chromosome`) |
| DNA / genome | The full assignment of every lesson to time slots and rooms (`genes` dict) |
| Gene | One lesson's placement: `genes["PHY101_T001_1_1"] = [(MON_P2, RoomA), (MON_P3, RoomA)]` |
| Population | The list of chromosomes currently being evolved (`self.population`) |
| Generation | One round: score everyone → select parents → mate → mutate → new population |
| Fitness | How good an organism is. In biology: higher = better. In Schedool: **lower = better** (it counts penalty points, so 0 = perfect) |
| Natural selection | Tournament selection: randomly pick several chromosomes, keep the best one as a parent |
| Mating / reproduction | Crossover: combine two parent chromosomes to produce two children |
| Mutation | Randomly tweaking a child's gene after crossover |
| Survival of the fittest | Elitism: always keep the top-scoring chromosomes unchanged into the next generation |

Understanding the table above is enough to follow the rest of this document.

---

## 3. Core Concepts

### Chromosomes — Representing a Timetable

Each candidate timetable is called a **chromosome**. In code, it is a `Chromosome` object (`src/ga/models.py`) whose core is a `genes` dict:

```python
@dataclass
class Chromosome:
    genes: Dict[str, List[Tuple[TimeSlot, str]]]
    # lesson_id  →  list of (TimeSlot, room_id)
```

In plain terms, a chromosome answers one question for every lesson: *"When does this lesson happen, and in which room?"*

```
Chromosome.genes = {
    "PHY101_T001_1_1" → [ (MON P2, RoomA101),
                           (MON P3, RoomA101) ],   ← two consecutive periods (a "2-block")
    "MATH201_T002_2_1" → [ (TUE P1, RoomB202) ],  ← one single period
    ...
}
```

A lesson with a `2-1` block pattern (two consecutive periods + one separate period) will have three entries: two periods on one day and one period on another.

### Lessons — What the GA Must Schedule

A **lesson** is one row from the curriculum (`Lesson` dataclass, `src/ga/models.py`):

```python
@dataclass
class Lesson:
    lesson_id: str           # unique key
    subject_id: str
    teacher_ids: List[str]   # one teacher, or multiple for team-teaching
    student_classes: List[str]  # e.g. ["1/1", "1/2"] for shared lessons
    periods_per_week: int
    block_pattern: str       # "1", "2", "2-1", "2-2", etc.
    required_rooms: List[str]
    preferred_tags: List[str]
    ...
```

The GA must schedule every lesson — every `Lesson` must appear in every `Chromosome`, with time slots and a room.

### Genes — One Lesson's Placement

Each entry in `Chromosome.genes` is a **gene**: the GA's current answer for where and when one particular lesson happens. The gene for a lesson with block pattern `2-1` has three `(TimeSlot, room)` tuples: two on the same day, consecutive, and one on a different day.

A `TimeSlot` is a `(day, period_col)` pair — e.g. `("MON", "2,08.05-08.55")`.

### Fitness Score — Lower is Better

Every chromosome is given a **fitness score** — the total penalty for all the constraint violations it contains. A **lower score is better**. A perfect timetable (no violations at all) has a score of **0**.

| Violation | Penalty per occurrence |
|---|---|
| Teacher booked in two places at the same time | 100 |
| Student class booked in two places at the same time | 100 |
| `SEPERATE_SLOT` group placed at the same time | 100 |
| `SUB_GROUP` group NOT placed at the same time | 100 |
| Block pattern broken (e.g. two periods not consecutive) | 80 |
| Lesson placed in another class's homeroom | 100 |
| Lesson placed in a specialist room it has no claim to | 80 |
| Room double-booked at the same time | 75 |
| Wrong number of periods scheduled for a lesson | 150 |

The fitness function (`evaluate_fitness` in `genetic_algorithm.py`) scans every chromosome gene-by-gene, counts every violation across all teachers, student groups, and rooms, and sums up the total penalty. This single number is what the GA optimises.

---

## 4. Standard Genetic Algorithm

The standard GA (`src/ga/genetic_algorithm.py`) is used when you set `n_islands=1`. It is the simpler of the two modes — a single population evolving over time.

### Step 1 — Initialisation

Rather than starting with completely random timetables, the GA uses **greedy constructive initialisation** (`_create_chromosome_greedy`):

1. Sort lessons by how constrained they are — lessons with fewer available slots go first. (A heavily constrained lesson placed last might find no room at all.)
2. For each lesson in that order, find the available time slots that don't conflict with lessons already placed in this chromosome, and assign the lesson there.
3. Multi-period blocks (e.g. two consecutive periods) are claimed first, so they get the consecutive slots they need before single-period lessons fill the gaps.

The population is seeded with **60% greedy chromosomes** (each using a slightly different lesson ordering so they aren't near-identical clones) and **40% fully random chromosomes** (for diversity). One special "pure greedy" chromosome — the single most-constrained-first ordering — is always included as the best possible starting point.

This gives the first generation a big head start over pure random placement.

### Step 2 — Evaluation

Every chromosome in the population is scored by `evaluate_fitness`. The one with the lowest score is the **best chromosome** for this generation. The global best (across all generations so far) is always tracked and never lost.

### Step 3 — Selection (Tournament)

To choose a parent for producing the next generation, **tournament selection** (`_tournament_select`) is used:

1. Randomly pick `tournament_size` chromosomes from the population (default: 5 in Island GA mode, 3 in single-GA mode).
2. The one with the lowest fitness (fewest violations) wins and becomes a parent.

A **larger tournament size** produces stronger selection pressure — good solutions win more often, bad ones rarely survive. A **smaller size** gives weaker solutions more of a chance, which preserves diversity. Both modes intentionally use a moderate-to-small tournament size: the Island GA uses 5 (down from an earlier default of 9, which caused premature convergence within each island), and the single GA uses 3 so it doesn't converge too fast without the diversity benefit of multiple islands.

### Step 4 — Crossover

Two parent chromosomes are combined to produce two children. Schedool uses **teacher-grouped crossover** (`_crossover`):

1. All lessons are grouped by teacher. For example, Teacher T001's three lessons form one group.
2. For each teacher group, the child inherits **all** of that teacher's lessons from one parent or the other — never a mix. The parent is chosen by a single coin flip per group.

This is much smarter than a naive random gene swap. If you naively mixed lessons from both parents at random, a teacher's schedule would be internally inconsistent — lessons from two different valid schedules combined would often conflict with each other. By always taking an entire teacher's schedule from one parent, the child starts from a consistent baseline.

3. Optionally, within a single lesson, individual period-blocks can also be swapped between parents (controlled by `block_crossover_rate`, default 50%). This allows finer-grained mixing: the child might inherit the Monday 2-block from parent 1 and the Friday 1-block from parent 2.

### Step 5 — Mutation

After crossover, each lesson in a child chromosome may be mutated with probability `mutation_rate`. Five mutation operators exist, each chosen with a certain probability (`_mutate`):

| Operator | Weight | What it does |
|---|---|---|
| **Targeted block** | 40% | Finds which specific period of this lesson is currently causing a conflict, then moves only that period block to a conflict-free alternative. The rest of the lesson is untouched. |
| **Explore** | 20% | Shifts one block of the lesson ±3 period positions on the same day — a small local hop that tries nearby slots without fully re-assigning the lesson. |
| **Swap blocker** | 15% | Instead of moving the lesson itself, finds the *other* lesson that is blocking the desired slot and moves that one instead. Fires only when exactly one entity (teacher, student group, or room) is causing the conflict — more disruptive situations are left alone. |
| **Room change** | 15% | Keeps the same time slots but assigns the lesson to a different valid room. |
| **Full re-slot** | 10% | Completely re-assigns all slots for this lesson to random available slots. A low-probability "nuclear option" to escape badly stuck configurations. |

The key insight is **targeted mutation**: instead of blindly randomising a lesson, the algorithm surgically fixes the broken part while preserving everything that is already working. Only the "full re-slot" operator is truly destructive, and it only fires 10% of the time.

### Step 6 — Elitism

The top `elite_size` chromosomes from each generation are always carried forward unchanged into the next generation (`evolve`, line: `new_pop = [c.copy() for c in self.population[:self.elite_size]]`). This guarantees that the best solution found so far is never accidentally lost through crossover or mutation.

### Step 7 — Stagnation Restart

If the best fitness does not improve for `stagnation_limit` consecutive generations (default: 150 for Island GA, 50 for the single-GA `GeneticAlgorithm` class directly), the population is refreshed (`_restart_bottom_half`).

The Island GA default was raised from 50 to 150 because 50 was equal to `migration_interval` — the island was restarting from scratch on literally every epoch, before migration had any chance to help. 150 gives each island three full migration cycles to try to improve before declaring it stuck.

- **Top 25%** — kept completely intact (the good solutions are preserved)
- **Next 25%** — copied and given three extra rounds of mutation to shake them loose from the local basin
- **Bottom 50%** — discarded and replaced with fresh chromosomes (half greedy, half random)

This prevents the population from permanently getting stuck in a local optimum — a solution that is better than all its immediate neighbours, but not the global best.

---

## 5. Island Genetic Algorithm

The Island GA (`src/ga/island_ga.py`) is the default mode. Instead of one population, it runs **multiple independent populations (islands)** that occasionally share their best individuals.

### Why Islands?

A single population can converge on a **local optimum** — a solution that is better than all its neighbours, but not the global best. Once a population is trapped there, normal mutation and crossover tend to produce the same-or-worse solutions, so the best score barely moves.

With multiple islands, each one explores a different region of the solution space. It is much harder for *all* of them to get trapped in the *same* local optimum simultaneously. When migrants arrive from another island, they inject different genetic material — slot combinations the receiving island had never considered — which can push the population out of its rut.

### How Islands Are Created

Each island is a full `GeneticAlgorithm` instance with its own separate population. All islands share the same lesson list, constraints, and most hyperparameters — but each island gets a **different mutation rate**, spread linearly from 0.5× to 2.0× the base `mutation_rate` (`_spread_mutation_rates`):

```
Island 0: mutation_rate = 0.5 × base  = 0.015  ← cautious refiner
Island 1: mutation_rate = 1.0 × base  = 0.030  ← balanced
Island 2: mutation_rate = 1.5 × base  = 0.045  ← exploratory
Island 3: mutation_rate = 2.0 × base  = 0.060  ← aggressive explorer
```

(With the default base `mutation_rate` of `0.03`.)

Cautious islands (low mutation) are good at refining an already-decent solution slowly and carefully. Aggressive islands (high mutation) make big random changes that can escape deep traps — but also destroy good solutions if left unchecked. Having a spread of both types means the system is simultaneously exploiting good solutions and exploring new regions.

### The Epoch Loop

One full cycle of all islands running for `migration_interval` generations (default: 50) is called an **epoch**. The outer loop runs epoch by epoch:

```
for each epoch:
    each island evolves independently for migration_interval generations
    update the global best fitness
    migrate: top n_migrants from each island → sent to the next island
```

### Migration in Detail

Every epoch, the top `n_migrants` chromosomes from each island are sent to the next island in a ring (`_migrate`):

```
Island 0  →  Island 1
   ↑              ↓
Island 3  ←  Island 2
```

When migration happens:
1. Each island snapshots its top `n_migrants` chromosomes (copies, so the source island is not changed).
2. Each island sends those migrants clockwise to its neighbour (0→1→2→3→0).
3. The receiving island sorts its population worst-first and replaces its weakest `n_migrants` individuals with the arrivals.

This injects fresh genetic material from a different part of the search space without disrupting the whole receiving population — only the weakest individuals are replaced.

`n_migrants = island_population_size × migration_rate` (default: 125 × 0.1 = 12 migrants per island per migration).

### Catastrophic Reset

If **no island makes any global improvement** for `catastrophic_after` consecutive epochs (default: 3 epochs = 150 generations), the worst-performing island is **completely rebuilt from scratch** (`_catastrophic_reset`):

1. Find the island with the highest (worst) best fitness.
2. Call `initialize_population()` on that island — it gets an entirely new random population.
3. Reset the global stagnation counter.

This is a more aggressive intervention than the per-island stagnation restart. It is triggered globally: all islands stagnating together is the signal. The reset island essentially becomes a fresh scout sent to explore a region of the search space that no one has visited.

---

## 6. Stopping Criteria

The algorithm can stop for five different reasons:

### 1. Perfect Solution Found

If the best fitness ever reaches **0**, every constraint is satisfied. The algorithm stops immediately and reports a perfect timetable.

### 2. Generation Limit Reached

If the algorithm runs for `max_generations` generations (default: 5,000 for the Island GA) without finding a perfect solution, it stops and returns the best solution found.

### 3. Island-Level Stagnation Restart

*(Standard GA and each island within the Island GA)*

If a single island's best fitness does not improve for `stagnation_limit` consecutive generations (default: **150** for Island GA, 50 for single-GA mode), the bottom half of that island's population is discarded and replaced with fresh chromosomes. The algorithm does **not** stop — it keeps running with the refreshed island. This is a recovery mechanism, not a termination.

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

**In the Island GA**, the window tracks one entry per **epoch** (not per generation). The effective number of epochs tracked is `window_size ÷ migration_interval`. This means the window still covers the same number of generations, just counted differently.

### Summary Table

| Stop Condition | Scope | What happens |
|---|---|---|
| `fitness == 0` | Global | Immediate stop — perfect timetable |
| Generation limit reached | Global | Stop — return best found |
| No improvement for 150 gens (Island GA) / 50 gens (single-GA) | Per island | Reseed bottom half (keep running) |
| No global improvement for 3 epochs | Global | Rebuild worst island (keep running) |
| Window improvement < 500 over last 1,000 gens | Global | Stop early — search has converged |

---

## 7. Reading the Logs

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

Three debug lines also print each epoch:

```
  [Debug] Violations : block_violation=2, teacher_conflict=1
  [Debug] Unassigned : none — all lessons fully placed
  [Debug] Mutations  : targeted=1820 swap=43/291 explore=712 full=182 room=0 | restarts=1
```

| Debug field | Meaning |
|---|---|
| `Violations` | Breakdown of which constraint types are still being violated in the global best |
| `Unassigned` | Lessons that could not be placed at all (0 means the GA placed everything) |
| `Mutations targeted=N` | How many targeted-block mutations fired across all islands this epoch |
| `swap=H/A` | Swap-blocker mutations: **H** hit (actually moved a blocker), **A** attempted |
| `explore=N` | Neighbourhood-shift mutations |
| `full=N` | Full-re-slot mutations |
| `room=N` | Room-change-only mutations |
| `restarts=N` | How many per-island stagnation restarts happened across all islands this epoch |

When the window stop fires:

```
  ⏹  Window stop at epoch 47 (gen 2350): improvement over last 1000 gens (3240 → 2890) = 350 < 500
```

This means: over the last 1,000 generations the fitness only improved by 350 points, which is less than the 500-point threshold, so the algorithm stopped.

# Configuration & GA Parameter Tuning

You can customise the genetic algorithm's behaviour by passing a `ga_params` JSON string when submitting a job. If you do not pass anything, the system uses the Island GA defaults listed below — the same settings used in `main.py`.

```bash
curl -X POST http://localhost:5000/api/v1/schedule \
  -F "curriculum=@curriculum.csv" \
  -F "room=@room.csv" \
  -F 'ga_params={"n_islands": 4, "max_generations": 3000, "mutation_rate": 0.02}'
```

---

## Table of Contents

1. [Choosing Island GA vs Standard GA](#1-choosing-island-ga-vs-standard-ga)
2. [Island GA Parameters](#2-island-ga-parameters)
3. [Standard GA Parameters](#3-standard-ga-parameters)
4. [Tuning Tips](#4-tuning-tips)

---

## 1. Choosing Island GA vs Standard GA

| Mode | When to use |
|---|---|
| **Island GA** (default, `n_islands ≥ 2`) | Most problems. Better exploration, more robust against local optima. |
| **Standard GA** (`n_islands=1`) | Simple or small timetables, or when you want faster per-generation speed. |

Set `n_islands=1` in `ga_params` to use the standard GA.

---

## 2. Island GA Parameters

These are used when `n_islands ≥ 2` (the default).

| Parameter | Default | Description |
|---|---|---|
| `n_islands` | `4` | Number of independent populations running in parallel. More islands = better exploration, higher CPU usage. |
| `island_population_size` | `125` | Number of chromosomes (candidate timetables) per island. Larger = more diversity, slower per generation. |
| `max_generations` | `5000` | Hard limit on total generations. The algorithm stops here if no other stopping condition fires first. |
| `migration_interval` | `50` | How many generations each island runs before sharing migrants with its neighbour. Lower = more frequent mixing. |
| `migration_rate` | `0.1` | Fraction of the population that migrates each interval. `0.1` means the top 10% of each island are sent to the next. |
| `topology` | `ring` | Migration pattern. `ring` sends migrants to the next island in a circle. `fully_connected` sends to all other islands. |
| `mutation_rate` | `0.015` | Base mutation probability. Each island uses a different rate spread linearly from `0.5×` to `2.0×` this value. |
| `crossover_rate` | `0.9` | Probability that two parents produce children via crossover (vs. copying a parent unchanged). |
| `tournament_size` | `9` | How many chromosomes compete in each tournament selection round. Larger = stronger selection pressure. |
| `elite_size` | `10` | How many of the best chromosomes are carried forward unchanged each generation (elitism). |
| `stagnation_limit` | `50` | If one island's best fitness does not improve for this many generations, the bottom half of that island is replaced with fresh random chromosomes. |
| `catastrophic_after` | `3` | If there is no **global** improvement for this many consecutive epochs, the most-stagnated island is completely rebuilt. |
| `min_improvement` | `500` | The minimum fitness improvement required over the look-back window to keep running. See below. |
| `window_size` | `1000` | The look-back window in generations for the sliding-window early stop. See below. |

### Sliding-window stop parameters

`window_size` and `min_improvement` together control when the algorithm decides to stop early:

> "If the best fitness has not improved by at least `min_improvement` penalty points over the last `window_size` generations, stop."

- **`window_size = 1000`** means the algorithm looks back 1,000 generations.
- **`min_improvement = 500`** means if the improvement over those 1,000 generations is less than 500 penalty points, stop.
- The earliest this can ever fire is after `window_size` generations.

To **run longer** (less aggressive stopping): increase `min_improvement` or `window_size`.
To **stop sooner** (more aggressive stopping): decrease `min_improvement` or `window_size`.

---

## 3. Standard GA Parameters

Used when `n_islands=1`.

| Parameter | Default | Description |
|---|---|---|
| `population_size` | `150` | Number of chromosomes in the population |
| `max_generations` | `500` | Hard generation limit |
| `mutation_rate` | `0.20` | Mutation probability per lesson |
| `crossover_rate` | `0.80` | Crossover probability |
| `tournament_size` | `7` | Tournament selection size |
| `elite_size` | `10` | Number of elites preserved each generation |
| `stagnation_limit` | `50` | Generations without improvement before reseeding bottom half |
| `min_improvement` | `500` | Same as Island GA — min improvement over the window |
| `window_size` | `1000` | Same as Island GA — look-back window in generations |

---

## 4. Tuning Tips

### The solution is not good enough (high fitness / many violations)

- Increase `max_generations` to give the algorithm more time.
- Increase `island_population_size` for more diversity.
- Increase `min_improvement` or `window_size` to prevent stopping too early.
- Check `unfilled_slots` in the result — if lessons cannot be placed, the constraints may be too tight.

### The algorithm stops too early

- Increase `window_size` (e.g. `2000`) so the window covers more generations.
- Increase `min_improvement` (e.g. `1000`) so the bar for "enough improvement" is higher.

### The algorithm is too slow

- Reduce `max_generations`.
- Reduce `island_population_size`.
- Reduce `n_islands` (e.g. from 4 to 2).

### The solution gets stuck and stops improving

- Reduce `stagnation_limit` so islands restart more aggressively.
- Reduce `catastrophic_after` so the global reset fires sooner.
- Increase `mutation_rate` slightly to encourage more exploration.

### Perfect solution (`fitness == 0`) is never found

This usually means the problem is genuinely over-constrained — the input data contains conflicts that make a perfect timetable mathematically impossible (or very unlikely). Things to check:

- A teacher is assigned more lessons than they have available slots.
- A class has more lessons than there are available periods in the week.
- `SEPERATE_SLOT` lessons that must not clash are all constrained to the same few available slots.
- Run the feasibility report (in the `result.feasibility` field of the API response) — `ERROR`-level issues mean the GA **cannot** reach fitness 0.

# Notes
Some notes I am collecting. 

- On Stopping Criteria
```
window_size = 1000 means the stop check looks at a sliding window of the last 1000 generations, not that it triggers at generation 1000.                                                                                                    
                      
Here's how it works:                                                                                                                                                                                                                               
1. Every generation, the best fitness is appended to a deque(maxlen=1000).                                                                                                                                                                  
2. The check only activates once the deque is full — i.e., after at least 1000 generations have passed.                                                                                                                                     
3. It then compares fitness[0] (the oldest value in the window) vs the current best fitness.                                                                                                                                                
4. If the improvement over those 1000 generations is less than 500, it stops early.                                                                                                                                                         
So in plain terms: "If the fitness hasn't improved by at least 500 over the last 1000 generations, stop." The earliest it can ever trigger is generation 1000, but it could trigger much later if improvement keeps exceeding 500 over any  
given 1000-gen window.
```

- What is "WinImprove"?
```
● WinImprove is displayed as X/Y where:

  - X — how much the global best fitness has dropped (improved) over the last window_epochs epochs. Calculated as oldest_fitness_in_window - current_best_fitness. Since fitness is a penalty score, a higher X = more improvement.
  - Y — the min_improvement threshold (500 by default).
  - — — shown instead of a number when the window isn't full yet (i.e., not enough epochs have passed).

  The stopping criteria fires when X < Y, meaning: "the fitness has improved by less than 500 over the last N epochs — stop."

  So while reading logs, if you see something like WinImprove: 120/500, that means only 120 fitness points were gained over the window and it's about to (or just did) stop early.

```

test test test

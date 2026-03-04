/**
 * Computes the Levenshtein (edit) distance between two strings.
 * Used for fuzzy "Did you mean?" suggestions.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Returns the closest match from `candidates` for `input` if its
 * Levenshtein distance is ≤ `threshold` (default 3). Otherwise null.
 */
export function fuzzyMatch(
  input: string,
  candidates: string[],
  threshold = 3
): string | null {
  const normalized = input.trim().toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;

  for (const c of candidates) {
    const dist = levenshtein(normalized, c.trim().toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }

  return bestDist <= threshold ? best : null;
}

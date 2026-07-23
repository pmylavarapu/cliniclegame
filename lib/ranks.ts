import type { Stats } from './types';

/**
 * Rank a player earns based on their lifetime record. The ladder is
 * intentionally medical-flavored so the title carries weight when it
 * appears in a share tweet ("Attending Praneet solved..."):
 *
 *   Student       — starting rank
 *   Intern        — 1 win
 *   Resident      — 5 wins
 *   Fellow        — 15 wins, at least one solve ≤ 8 guesses
 *   Attending     — 30 wins, at least one solve ≤ 6 guesses
 *   Chief Resident — 60 wins, at least one solve ≤ 5 guesses
 *   Chair          — 100 wins, at least one solve ≤ 4 guesses
 */
export type Rank = {
  key: string;
  label: string;
  minWins: number;
  bestUnder?: number;
};

export const RANKS: Rank[] = [
  { key: 'student', label: 'Student', minWins: 0 },
  { key: 'intern', label: 'Intern', minWins: 1 },
  { key: 'resident', label: 'Resident', minWins: 5 },
  { key: 'fellow', label: 'Fellow', minWins: 15, bestUnder: 8 },
  { key: 'attending', label: 'Attending', minWins: 30, bestUnder: 6 },
  { key: 'chief', label: 'Chief Resident', minWins: 60, bestUnder: 5 },
  { key: 'chair', label: 'Chair', minWins: 100, bestUnder: 4 },
];

export function currentRank(stats: Stats): Rank {
  const bestGuesses = fewestGuessesInAWin(stats);
  let earned: Rank = RANKS[0];
  for (const r of RANKS) {
    if (stats.wins < r.minWins) break;
    if (r.bestUnder !== undefined && (bestGuesses ?? Infinity) > r.bestUnder) break;
    earned = r;
  }
  return earned;
}

export function nextRank(stats: Stats): Rank | null {
  const cur = currentRank(stats);
  const idx = RANKS.findIndex((r) => r.key === cur.key);
  return idx >= 0 && idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

function fewestGuessesInAWin(stats: Stats): number | undefined {
  let best: number | undefined;
  for (const e of Object.values(stats.history)) {
    if (e.won && (best === undefined || e.guesses < best)) best = e.guesses;
  }
  return best;
}

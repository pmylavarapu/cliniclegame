import type { GameState, Stats } from './types';

// Bumped from v1 → v2 when we switched to Gemini embeddings + multi-word vocab.
// Any old v1 game state / stats is orphaned so users start clean.
const NS = 'clinicle:v2';
const GAME_KEY = (date: string) => `${NS}:game:${date}`;
const STATS_KEY = `${NS}:stats`;
const BUILD_KEY = `${NS}:build`;
const MIGRATED_KEY = `${NS}:migrated`;

// Injected by Vercel at build time. On the Claude API side we don't need this
// value ourselves — we only need it to CHANGE on every deploy so the client
// can detect a new build and clear its per-puzzle game state.
const BUILD_ID =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  'dev';

function migrateFromV1IfNeeded() {
  if (typeof localStorage === 'undefined') return;
  const seenBuild = localStorage.getItem(BUILD_KEY);
  const migratedV1 = localStorage.getItem(MIGRATED_KEY) === '1';
  const newBuild = seenBuild !== BUILD_ID;

  if (migratedV1 && !newBuild) return;

  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    // v1 keys are always wiped on first v2 access
    if (!migratedV1 && (k === 'clinicle:stats' || k.startsWith('clinicle:game:'))) {
      toRemove.push(k);
      continue;
    }
    // On a new build, wipe per-puzzle GAME state so testers get a fresh puzzle
    // to play. Stats/streaks (STATS_KEY) survive so we don't obliterate user
    // history every deploy.
    if (newBuild && k.startsWith(`${NS}:game:`)) {
      toRemove.push(k);
    }
  }
  for (const k of toRemove) localStorage.removeItem(k);
  localStorage.setItem(MIGRATED_KEY, '1');
  localStorage.setItem(BUILD_KEY, BUILD_ID);
}

export function loadGame(date: string): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  migrateFromV1IfNeeded();
  const raw = localStorage.getItem(GAME_KEY(date));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveGame(state: GameState) {
  if (typeof localStorage === 'undefined') return;
  migrateFromV1IfNeeded();
  localStorage.setItem(GAME_KEY(state.date), JSON.stringify(state));
}

export function loadStats(): Stats {
  if (typeof localStorage === 'undefined') return emptyStats();
  migrateFromV1IfNeeded();
  const raw = localStorage.getItem(STATS_KEY);
  if (!raw) return emptyStats();
  try { return { ...emptyStats(), ...JSON.parse(raw) }; } catch { return emptyStats(); }
}

export function saveStats(s: Stats) {
  if (typeof localStorage === 'undefined') return;
  migrateFromV1IfNeeded();
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

export function emptyStats(): Stats {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalGuesses: 0,
    totalHints: 0,
    history: {},
  };
}

export function recordCompletion(
  date: string,
  guesses: number,
  hints: number,
  won: boolean,
  gaveUp: boolean,
  timeMs?: number,
) {
  const s = loadStats();
  if (s.history[date]) return s;
  s.history[date] = { guesses, hints, won, gaveUp, timeMs };
  s.played += 1;
  s.totalGuesses += guesses;
  s.totalHints += hints;
  if (won) {
    s.wins += 1;
    if (s.lastPlayedDate && isYesterday(s.lastPlayedDate, date)) {
      s.currentStreak += 1;
    } else {
      s.currentStreak = 1;
    }
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  } else {
    s.currentStreak = 0;
  }
  s.lastPlayedDate = date;
  saveStats(s);
  return s;
}

/** Fastest solve in ms across all winning games, if any. */
export function fastestSolveMs(s: Stats): number | undefined {
  let best: number | undefined;
  for (const entry of Object.values(s.history)) {
    if (entry.won && typeof entry.timeMs === 'number') {
      if (best === undefined || entry.timeMs < best) best = entry.timeMs;
    }
  }
  return best;
}

/** { guessCount: numGamesWonInThatManyGuesses } — for the win-distribution histogram. */
export function guessDistribution(s: Stats): Map<number, number> {
  const dist = new Map<number, number>();
  for (const entry of Object.values(s.history)) {
    if (entry.won) {
      dist.set(entry.guesses, (dist.get(entry.guesses) ?? 0) + 1);
    }
  }
  return dist;
}

function isYesterday(prev: string, cur: string): boolean {
  const p = new Date(prev + 'T00:00:00Z').getTime();
  const c = new Date(cur + 'T00:00:00Z').getTime();
  return c - p === 24 * 3600 * 1000;
}

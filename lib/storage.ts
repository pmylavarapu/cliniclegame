import type { GameState, Stats } from './types';

// Bumped from v1 → v2 when we switched to Gemini embeddings + multi-word vocab.
// Any old v1 game state / stats is orphaned so users start clean.
const NS = 'clinicle:v2';
const GAME_KEY = (date: string) => `${NS}:game:${date}`;
const STATS_KEY = `${NS}:stats`;

function migrateFromV1IfNeeded() {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(`${NS}:migrated`) === '1') return;
  // Wipe v1 keys so old games and stats don't linger under the new scoring model.
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k === 'clinicle:stats' || k.startsWith('clinicle:game:'))) {
      toRemove.push(k);
    }
  }
  for (const k of toRemove) localStorage.removeItem(k);
  localStorage.setItem(`${NS}:migrated`, '1');
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

export function recordCompletion(date: string, guesses: number, hints: number, won: boolean, gaveUp: boolean) {
  const s = loadStats();
  if (s.history[date]) return s;
  s.history[date] = { guesses, hints, won, gaveUp };
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

function isYesterday(prev: string, cur: string): boolean {
  const p = new Date(prev + 'T00:00:00Z').getTime();
  const c = new Date(cur + 'T00:00:00Z').getTime();
  return c - p === 24 * 3600 * 1000;
}

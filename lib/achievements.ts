import type { GameState, Stats } from './types';

/**
 * A unlockable badge with a shareable one-liner. Achievements are stored
 * as a flat set of unlocked keys in localStorage under `clinicle:v2:ach`.
 * Nothing is persisted server-side.
 */
export type Achievement = {
  key: string;
  label: string;
  description: string;
  emoji: string;
  /** Tweet body used when the user taps 'Share' on the toast. */
  share: string;
};

/**
 * Check every achievement against the current game + stats snapshot.
 * Returns the achievements that just fired (were not already unlocked).
 * Caller is responsible for persisting the new unlocks.
 */
export function checkNewlyUnlocked(
  game: GameState,
  stats: Stats,
): Achievement[] {
  const unlocked = loadUnlocked();
  const newly: Achievement[] = [];
  const isFirstWin = stats.wins === 1;
  const noHints = game.hintsUsed === 0;
  const timeMs = game.timeMs ?? Infinity;

  const candidates: Array<Achievement | null> = [
    game.won && isFirstWin
      ? {
          key: 'first_solve',
          label: 'First solve',
          emoji: '🎉',
          description: 'You solved your first Clinicle.',
          share: "I just solved my first Clinicle! 🩺",
        }
      : null,
    game.won && noHints && !unlocked.has('no_hint_solve')
      ? {
          key: 'no_hint_solve',
          label: 'No-hint solve',
          emoji: '🧠',
          description: 'Solved a puzzle without a single hint.',
          share: 'Solved today\'s Clinicle without a hint. 🧠',
        }
      : null,
    game.won && game.guesses.length <= 5 && !unlocked.has('under_five')
      ? {
          key: 'under_five',
          label: 'Sniper',
          emoji: '🎯',
          description: 'Solved a puzzle in 5 guesses or fewer.',
          share: `Just sniped a Clinicle in ${game.guesses.length} guesses. 🎯`,
        }
      : null,
    game.won && timeMs <= 60_000 && !unlocked.has('sub_minute')
      ? {
          key: 'sub_minute',
          label: 'Sub-minute',
          emoji: '⚡',
          description: 'Solved a puzzle in under a minute.',
          share: 'Solved a Clinicle in under a minute. ⚡',
        }
      : null,
    stats.currentStreak >= 3 && !unlocked.has('streak_3')
      ? {
          key: 'streak_3',
          label: '3-day streak',
          emoji: '🔥',
          description: 'Solved 3 days in a row.',
          share: '3-day Clinicle streak 🔥',
        }
      : null,
    stats.currentStreak >= 7 && !unlocked.has('streak_7')
      ? {
          key: 'streak_7',
          label: 'Week streak',
          emoji: '🔥',
          description: 'A full week of Clinicle solves.',
          share: '7-day Clinicle streak 🔥🔥',
        }
      : null,
    stats.currentStreak >= 30 && !unlocked.has('streak_30')
      ? {
          key: 'streak_30',
          label: 'Month streak',
          emoji: '🔥',
          description: '30 straight solves.',
          share: '30-day Clinicle streak 🔥🔥🔥',
        }
      : null,
  ];

  for (const a of candidates) {
    if (a && !unlocked.has(a.key)) {
      newly.push(a);
      unlocked.add(a.key);
    }
  }

  if (newly.length) saveUnlocked(unlocked);
  return newly;
}

const KEY = 'clinicle:v2:ach';

export function loadUnlocked(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveUnlocked(s: Set<string>) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(Array.from(s)));
}

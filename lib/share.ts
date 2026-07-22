import type { GameState } from './types';

const SITE_URL = 'https://clinicle.app';

function bragTag(state: GameState): string {
  if (!state.won) return 'Beaten';
  const n = state.guesses.length - state.hintsUsed;
  if (n <= 3) return '🎯 Brilliant';
  if (n <= 6) return '🔥 Solid';
  if (n <= 12) return '💪 Made it';
  if (n <= 20) return '⏳ Grind';
  return '🐢 Marathon';
}

function scoreEmoji(rank: number | null): string {
  if (rank === 1) return '🟩';
  if (rank && rank <= 10) return '🟨';
  if (rank && rank <= 100) return '🟧';
  if (rank && rank <= 1000) return '🟫';
  return '⬜';
}

export function buildShareString(state: GameState, num: number): string {
  const bars = state.guesses.map((g) => scoreEmoji(g.rank));

  // Wrap at 10 for readable columns
  const grid: string[] = [];
  for (let i = 0; i < bars.length; i += 10) {
    grid.push(bars.slice(i, i + 10).join(''));
  }

  const title = `🩺 Clinicle #${num}`;
  const outcome = state.won
    ? `${bragTag(state)} · ${state.guesses.length}/? guesses`
    : `${bragTag(state)} · gave up`;
  const hintPart = state.hintsUsed > 0
    ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}`
    : '';

  return [
    `${title} — ${outcome}${hintPart}`,
    ...grid,
    `Play today: ${SITE_URL} #Clinicle`,
  ].join('\n');
}

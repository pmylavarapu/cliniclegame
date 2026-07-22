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

function starLine(difficulty?: number): string {
  if (!difficulty) return '';
  const filled = Math.max(1, Math.min(5, difficulty));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function formatTime(ms?: number): string | null {
  if (ms == null) return null;
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m === 0 ? `${s}s` : `${m}m${String(s).padStart(2, '0')}s`;
}

export function buildShareString(
  state: GameState,
  num: number,
  difficulty?: number,
): string {
  const bars = state.guesses.map((g) => scoreEmoji(g.rank));

  const grid: string[] = [];
  for (let i = 0; i < bars.length; i += 10) {
    grid.push(bars.slice(i, i + 10).join(''));
  }

  const stars = starLine(difficulty);
  const titleParts = [`🩺 Clinicle #${num}`];
  if (stars) titleParts.push(stars);
  const title = titleParts.join(' ');

  const timePart = formatTime(state.timeMs);
  const outcome = state.won
    ? `${bragTag(state)} · ${state.guesses.length}/? guesses${timePart ? ` · ${timePart}` : ''}`
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

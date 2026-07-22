import type { GameState } from './types';

export function buildShareString(state: GameState, num: number): string {
  const bars = state.guesses.map((g) => {
    if (g.rank === 1) return '🟩';
    if (g.rank && g.rank <= 100) return '🟨';
    if (g.rank && g.rank <= 1000) return '🟧';
    return '⬜';
  });

  const grid: string[] = [];
  for (let i = 0; i < bars.length; i += 10) grid.push(bars.slice(i, i + 10).join(''));

  const outcome = state.won ? `${state.guesses.length} guess${state.guesses.length === 1 ? '' : 'es'}` : 'gave up';
  const hintPart = state.hintsUsed > 0 ? ` (${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'})` : '';

  return `Clinicle #${num} — ${outcome}${hintPart}\n${grid.join('\n')}\nhttps://clinicle.app/`;
}

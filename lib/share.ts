import type { GameState } from './types';

const SITE_URL = 'https://clinicle.app';
const SITE_DISPLAY = 'clinicle.app';

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
  return ' ' + '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function formatTime(ms?: number): string | null {
  if (ms == null) return null;
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatHints(n: number): string {
  if (n === 0) return 'no hints';
  return n === 1 ? '1 hint' : `${n} hints`;
}

function formatGuesses(n: number): string {
  return n === 1 ? '1 guess' : `${n} guesses`;
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
  const time = formatTime(state.timeMs);

  // Build the "in TIME using N guesses and M hints" clause. Time and
  // hints are optional; guesses is always present.
  const parts: string[] = [];
  if (state.won && time) parts.push(`in ${time}`);
  parts.push(
    `using ${formatGuesses(state.guesses.length)}` +
      (state.hintsUsed > 0 ? ` and ${formatHints(state.hintsUsed)}` : ''),
  );

  const headline = state.won
    ? `I solved today's Clinicle #${num}${stars} ${parts.join(' ')}.`
    : `Today's Clinicle #${num}${stars} beat me ${parts.join(' ')}.`;

  const cta = `Can you beat me? Play today at ${SITE_DISPLAY}`;
  const tags = '@ClinicleGame @PraneetMylavarapu #Clinicle #MedTwitter';

  return [headline, '', ...grid, '', cta, '', tags].join('\n');
}

/** Full https:// form of the site URL, for use as the twitter intent `url` param. */
export function siteUrl(): string {
  return SITE_URL;
}

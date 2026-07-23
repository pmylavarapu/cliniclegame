// Compact encoding of a friend's result into URL params.
// Kept short so it fits nicely in a tweet: /challenge?d=2026-07-23&g=6&t=142&h=0&w=1

export type ChallengeParams = {
  date: string;
  guesses: number;
  timeS?: number;
  hints: number;
  won: boolean;
  from?: string;
};

export function buildChallengeUrl(params: ChallengeParams, origin: string): string {
  const u = new URL('/challenge/', origin);
  u.searchParams.set('d', params.date);
  u.searchParams.set('g', String(params.guesses));
  u.searchParams.set('h', String(params.hints));
  u.searchParams.set('w', params.won ? '1' : '0');
  if (params.timeS != null) u.searchParams.set('t', String(params.timeS));
  if (params.from) u.searchParams.set('from', params.from.slice(0, 40));
  return u.toString();
}

export function parseChallenge(sp: URLSearchParams): ChallengeParams | null {
  const d = sp.get('d');
  const g = sp.get('g');
  if (!d || !g) return null;
  const won = sp.get('w') !== '0';
  const hints = Number(sp.get('h') ?? '0') || 0;
  const timeS = sp.get('t') ? Number(sp.get('t')) : undefined;
  const from = sp.get('from') ?? undefined;
  return {
    date: d,
    guesses: Number(g),
    timeS,
    hints,
    won,
    from,
  };
}

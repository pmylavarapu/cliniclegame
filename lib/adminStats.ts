/**
 * Aggregate counters for the /admin dashboard. Writes go to Firestore
 * via the REST API (same pattern as lib/leaderboard.ts — no SDK, feature-
 * gated on env vars, silent no-op when not configured).
 *
 * Schema:
 *   stats/global           { pageviews, guesses, solves,
 *                            totalGuessCount, totalSolveTimeMs }
 *   stats/puzzles/{date}   same shape, per-puzzle
 *
 * `totalGuessCount` and `totalSolveTimeMs` are summed at write time;
 * averages are computed at read time in the /admin page as
 * (totalGuessCount / solves) and (totalSolveTimeMs / solves).
 *
 * Firestore security rules for these paths (append to your rules):
 *   match /stats/global {
 *     allow read: if true;
 *     allow create, update: if request.resource.data.diff(resource.data)
 *       .affectedKeys().hasOnly([
 *         'pageviews', 'guesses', 'solves',
 *         'totalGuessCount', 'totalSolveTimeMs'
 *       ]);
 *   }
 *   match /stats/puzzles/{date} {
 *     allow read: if true;
 *     allow create, update: if request.resource.data.diff(resource.data)
 *       .affectedKeys().hasOnly([
 *         'pageviews', 'guesses', 'solves',
 *         'totalGuessCount', 'totalSolveTimeMs'
 *       ]);
 *   }
 */

type Firestore = { projectId: string; apiKey: string };

function config(): Firestore | null {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;
  return { projectId, apiKey };
}

export function statsEnabled(): boolean {
  return config() != null;
}

type IntIncrement = { fieldPath: string; increment: { integerValue: string } };

async function commit(writes: object[]): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents:commit?key=${cfg.apiKey}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ writes }),
    });
  } catch {
    /* silent — game still works if telemetry fails */
  }
}

function fieldTransforms(cfg: Firestore, docPath: string, fields: IntIncrement[]) {
  return {
    transform: {
      document: `projects/${cfg.projectId}/databases/(default)/documents/${docPath}`,
      fieldTransforms: fields,
    },
  };
}

function increments(deltas: Record<string, number>): IntIncrement[] {
  return Object.entries(deltas)
    .filter(([, n]) => n !== 0)
    .map(([k, n]) => ({
      fieldPath: k,
      increment: { integerValue: String(n) },
    }));
}

async function bumpBoth(date: string, deltas: Record<string, number>): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  const fields = increments(deltas);
  if (!fields.length) return;
  await commit([
    fieldTransforms(cfg, 'stats/global', fields),
    fieldTransforms(cfg, `stats/puzzles/${date}`, fields),
  ]);
}

/** One-per-browser-session pageview per puzzle date. Called from PuzzleLoader. */
export async function recordPageview(date: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = `clinicle:pv:${date}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  await bumpBoth(date, { pageviews: 1 });
}

/** Called after every successful guess (excluding hints). */
export async function recordGuess(date: string): Promise<void> {
  await bumpBoth(date, { guesses: 1 });
}

/** Called once when the user wins. */
export async function recordSolveStats(
  date: string,
  guesses: number,
  timeMs: number,
): Promise<void> {
  await bumpBoth(date, {
    solves: 1,
    totalGuessCount: guesses,
    totalSolveTimeMs: Math.max(0, Math.round(timeMs)),
  });
}

/**
 * Read stats/global (or stats/puzzles/{date} if `date` given). Returns
 * null if not configured or the doc doesn't exist yet.
 */
export type StatsDoc = {
  pageviews: number;
  guesses: number;
  solves: number;
  totalGuessCount: number;
  totalSolveTimeMs: number;
};

function num(v: unknown): number {
  const s = (v as { integerValue?: string; doubleValue?: number } | undefined) ?? {};
  if (s.integerValue) return Number(s.integerValue);
  if (typeof s.doubleValue === 'number') return s.doubleValue;
  return 0;
}

export async function fetchStats(date?: string): Promise<StatsDoc | null> {
  const cfg = config();
  if (!cfg) return null;
  const path = date ? `stats/puzzles/${date}` : 'stats/global';
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${path}?key=${cfg.apiKey}`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const doc = await r.json();
    const f = (doc?.fields ?? {}) as Record<string, unknown>;
    return {
      pageviews: num(f.pageviews),
      guesses: num(f.guesses),
      solves: num(f.solves),
      totalGuessCount: num(f.totalGuessCount),
      totalSolveTimeMs: num(f.totalSolveTimeMs),
    };
  } catch {
    return null;
  }
}

/** List per-puzzle stats docs, ordered by date descending. */
export async function fetchAllPuzzleStats(): Promise<
  Array<{ date: string; stats: StatsDoc }>
> {
  const cfg = config();
  if (!cfg) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/stats/puzzles?key=${cfg.apiKey}&pageSize=300`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return [];
    const doc = await r.json();
    const docs = (doc?.documents ?? []) as Array<{
      name: string;
      fields?: Record<string, unknown>;
    }>;
    const out = docs.map((d) => {
      const date = d.name.split('/').pop() ?? '';
      const f = (d.fields ?? {}) as Record<string, unknown>;
      return {
        date,
        stats: {
          pageviews: num(f.pageviews),
          guesses: num(f.guesses),
          solves: num(f.solves),
          totalGuessCount: num(f.totalGuessCount),
          totalSolveTimeMs: num(f.totalSolveTimeMs),
        },
      };
    });
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out;
  } catch {
    return [];
  }
}

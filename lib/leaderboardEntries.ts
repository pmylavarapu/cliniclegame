/**
 * Per-puzzle + all-time leaderboards.
 *
 * Separate from lib/leaderboard.ts (which only tracks the anonymous
 * guess-count histogram for the "beat X% of players" percentile).
 *
 * Ranking rules (must match the fine print on /leaderboard):
 *   - Each hint counts as +3 guesses.
 *   - Each hint adds +30 seconds.
 *   - Give-ups never submit.
 *   - One entry per (uid, puzzleDate). First solve wins — server-side
 *     precondition currentDocument.exists = false.
 *   - All-time boards need >= 5 solves to appear.
 *
 * Firestore schema:
 *   /leaderboard_entries/{date}/entries/{uid}
 *     { name, guesses, hints, timeMs, adjGuesses, adjTimeMs, wonAt }
 *   /leaderboard_users/{uid}
 *     { name, solves, sumGuesses, sumHints, sumTimeMs, sumAdjGuesses, sumAdjTimeMs }
 *
 * Rules (append to firestore.rules):
 *   match /leaderboard_entries/{date}/entries/{uid} {
 *     allow read: if true;
 *     allow create: if request.resource.data.keys().hasOnly([
 *       'name','guesses','hints','timeMs','adjGuesses','adjTimeMs','wonAt'
 *     ]) && request.resource.data.name.size() <= 20;
 *   }
 *   match /leaderboard_users/{uid} {
 *     allow read: if true;
 *     allow create, update: if request.resource.data.diff(resource.data)
 *       .affectedKeys().hasOnly([
 *         'name','solves','sumGuesses','sumHints','sumTimeMs',
 *         'sumAdjGuesses','sumAdjTimeMs'
 *       ]);
 *   }
 */

const HINT_GUESS_PENALTY = 3;
const HINT_TIME_PENALTY_MS = 30_000;
const MAX_NAME_LEN = 20;
const MIN_SOLVES_ALLTIME = 5;
const TOP_N = 25;

type Firestore = { projectId: string; apiKey: string };

function config(): Firestore | null {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;
  return { projectId, apiKey };
}

export function leaderboardEntriesEnabled(): boolean {
  return config() != null;
}

export const HINT_PENALTY = {
  guesses: HINT_GUESS_PENALTY,
  timeMs: HINT_TIME_PENALTY_MS,
};
export const MIN_SOLVES = MIN_SOLVES_ALLTIME;

/* -------- identity (client-side, no auth) -------- */

const UID_KEY = 'clinicle:lb:uid';
const NAME_KEY = 'clinicle:lb:name';

function randomId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';
  let uid = localStorage.getItem(UID_KEY);
  if (!uid) {
    uid = randomId();
    localStorage.setItem(UID_KEY, uid);
  }
  return uid;
}

export function getStoredName(): string | null {
  if (typeof window === 'undefined') return null;
  const n = localStorage.getItem(NAME_KEY);
  return n && n.trim() ? n.trim() : null;
}

export function setStoredName(name: string): string {
  const cleaned = sanitizeName(name);
  if (!cleaned) return '';
  localStorage.setItem(NAME_KEY, cleaned);
  return cleaned;
}

// Strip control chars (via Unicode class), @/URL-ish characters, and
// collapse whitespace. Cap at MAX_NAME_LEN. Written with \u escapes so
// the source stays plain ASCII-safe.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F@<>/\\|]/g;

export function sanitizeName(raw: string): string {
  return raw
    .replace(UNSAFE_CHARS, '')
    .replace(/https?:/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LEN);
}

/* -------- ranking math -------- */

export function adjGuesses(guesses: number, hints: number): number {
  return guesses + HINT_GUESS_PENALTY * Math.max(0, hints);
}

export function adjTimeMs(timeMs: number, hints: number): number {
  return Math.max(0, Math.round(timeMs)) + HINT_TIME_PENALTY_MS * Math.max(0, hints);
}

/* -------- submit -------- */

export type SolveSubmission = {
  puzzleDate: string;
  guesses: number;
  hints: number;
  timeMs: number;
};

/**
 * Fire-and-forget submit. Silently no-ops if backend isn't configured or
 * this uid has already submitted for this puzzle. Idempotent per
 * (uid, date) on the server via currentDocument.exists = false.
 */
export async function submitLeaderboardEntry(
  s: SolveSubmission,
): Promise<'submitted' | 'skipped'> {
  const cfg = config();
  if (!cfg) return 'skipped';
  if (typeof window === 'undefined') return 'skipped';

  const uid = getOrCreateUserId();
  const name = getStoredName();
  if (!name) return 'skipped';

  const flagKey = `clinicle:lb:submitted:${s.puzzleDate}`;
  if (localStorage.getItem(flagKey)) return 'skipped';

  const aG = adjGuesses(s.guesses, s.hints);
  const aT = adjTimeMs(s.timeMs, s.hints);
  const wonAt = Date.now();

  const entryDoc = `projects/${cfg.projectId}/databases/(default)/documents/leaderboard_entries/${s.puzzleDate}/entries/${uid}`;
  const userDoc = `projects/${cfg.projectId}/databases/(default)/documents/leaderboard_users/${uid}`;

  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents:commit?key=${cfg.apiKey}`;

  // The per-puzzle entry is the only write that matters for today's board.
  // Send it in its own commit so any failure in the user-aggregate update
  // can't take it down with it.
  const entryCommit = {
    writes: [
      {
        update: {
          name: entryDoc,
          fields: {
            name: { stringValue: name },
            guesses: { integerValue: String(s.guesses) },
            hints: { integerValue: String(s.hints) },
            timeMs: { integerValue: String(Math.round(s.timeMs)) },
            adjGuesses: { integerValue: String(aG) },
            adjTimeMs: { integerValue: String(aT) },
            wonAt: { integerValue: String(wonAt) },
          },
        },
        currentDocument: { exists: false },
      },
    ],
  };

  // All-time aggregates: one transform-only write on the user doc.
  // Kept in a separate commit because combining update+updateMask+
  // updateTransforms alongside another write in a single REST commit
  // has returned 400 in this project's Firestore. Standalone transform
  // writes are the boring path that works.
  const userCounterCommit = {
    writes: [
      {
        transform: {
          document: userDoc,
          fieldTransforms: [
            { fieldPath: 'solves', increment: { integerValue: '1' } },
            { fieldPath: 'sumGuesses', increment: { integerValue: String(s.guesses) } },
            { fieldPath: 'sumHints', increment: { integerValue: String(s.hints) } },
            { fieldPath: 'sumTimeMs', increment: { integerValue: String(Math.round(s.timeMs)) } },
            { fieldPath: 'sumAdjGuesses', increment: { integerValue: String(aG) } },
            { fieldPath: 'sumAdjTimeMs', increment: { integerValue: String(aT) } },
          ],
        },
      },
    ],
  };

  // Name update: plain update-with-updateMask (upsert single field).
  // Only reason it's a separate commit is the same 400 gotcha above.
  const userNameCommit = {
    writes: [
      {
        update: {
          name: userDoc,
          fields: { name: { stringValue: name } },
        },
        updateMask: { fieldPaths: ['name'] },
      },
    ],
  };

  const post = async (label: string, body: object): Promise<Response> => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      // Loudly log the response body so we can see exactly why Firestore
      // rejected the write. Cloning the body so callers can still consume
      // it (they don't, but no reason to burn the body reader here).
      const clone = r.clone();
      let text = '';
      try {
        text = await clone.text();
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line no-console
      console.error(
        `[leaderboard] ${label} write failed:`,
        r.status,
        text.slice(0, 800),
        'sent body:',
        body,
      );
    }
    return r;
  };

  try {
    const entryResp = await post('entry', entryCommit);
    if (!entryResp.ok) return 'skipped';
    // Fire-and-forget the aggregates. Do not gate the local dedupe flag
    // on them: even if they fail (bad rules, schema drift), the
    // per-puzzle board still has the user.
    post('user-counter', userCounterCommit).catch(() => {});
    post('user-name', userNameCommit).catch(() => {});
    localStorage.setItem(flagKey, '1');
    return 'submitted';
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[leaderboard] submit threw:', e);
    return 'skipped';
  }
}

/* -------- read -------- */

export type LbEntry = {
  uid: string;
  name: string;
  guesses: number;
  hints: number;
  timeMs: number;
  adjGuesses: number;
  adjTimeMs: number;
  wonAt: number;
};

export type LbUser = {
  uid: string;
  name: string;
  solves: number;
  sumGuesses: number;
  sumHints: number;
  sumTimeMs: number;
  sumAdjGuesses: number;
  sumAdjTimeMs: number;
};

function n(f: unknown): number {
  const s = (f as { integerValue?: string; doubleValue?: number } | undefined) ?? {};
  if (s.integerValue) return Number(s.integerValue);
  if (typeof s.doubleValue === 'number') return s.doubleValue;
  return 0;
}
function str(f: unknown): string {
  return ((f as { stringValue?: string } | undefined)?.stringValue ?? '').toString();
}

export async function fetchPuzzleEntries(date: string): Promise<LbEntry[]> {
  const cfg = config();
  if (!cfg) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/leaderboard_entries/${date}/entries?key=${cfg.apiKey}&pageSize=300`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return [];
    const doc = await r.json();
    const docs = (doc?.documents ?? []) as Array<{ name: string; fields?: Record<string, unknown> }>;
    return docs.map((d) => {
      const uid = d.name.split('/').pop() ?? '';
      const f = (d.fields ?? {}) as Record<string, unknown>;
      return {
        uid,
        name: str(f.name),
        guesses: n(f.guesses),
        hints: n(f.hints),
        timeMs: n(f.timeMs),
        adjGuesses: n(f.adjGuesses) || n(f.guesses),
        adjTimeMs: n(f.adjTimeMs) || n(f.timeMs),
        wonAt: n(f.wonAt),
      };
    });
  } catch {
    return [];
  }
}

export async function fetchUsers(): Promise<LbUser[]> {
  const cfg = config();
  if (!cfg) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/leaderboard_users?key=${cfg.apiKey}&pageSize=1000`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return [];
    const doc = await r.json();
    const docs = (doc?.documents ?? []) as Array<{ name: string; fields?: Record<string, unknown> }>;
    return docs.map((d) => {
      const uid = d.name.split('/').pop() ?? '';
      const f = (d.fields ?? {}) as Record<string, unknown>;
      return {
        uid,
        name: str(f.name),
        solves: n(f.solves),
        sumGuesses: n(f.sumGuesses),
        sumHints: n(f.sumHints),
        sumTimeMs: n(f.sumTimeMs),
        sumAdjGuesses: n(f.sumAdjGuesses) || n(f.sumGuesses),
        sumAdjTimeMs: n(f.sumAdjTimeMs) || n(f.sumTimeMs),
      };
    });
  } catch {
    return [];
  }
}

/* -------- ranking helpers -------- */

export function topByFewestGuesses(entries: LbEntry[]): LbEntry[] {
  return [...entries]
    .sort((a, b) => a.adjGuesses - b.adjGuesses || a.adjTimeMs - b.adjTimeMs)
    .slice(0, TOP_N);
}

export function topByFastestTime(entries: LbEntry[]): LbEntry[] {
  return [...entries]
    .filter((e) => e.timeMs > 0)
    .sort((a, b) => a.adjTimeMs - b.adjTimeMs || a.adjGuesses - b.adjGuesses)
    .slice(0, TOP_N);
}

export function topByAvgGuesses(users: LbUser[]): Array<LbUser & { avg: number }> {
  return users
    .filter((u) => u.solves >= MIN_SOLVES_ALLTIME)
    .map((u) => ({ ...u, avg: u.sumAdjGuesses / u.solves }))
    .sort((a, b) => a.avg - b.avg || b.solves - a.solves)
    .slice(0, TOP_N);
}

export function topByAvgTime(users: LbUser[]): Array<LbUser & { avg: number }> {
  return users
    .filter((u) => u.solves >= MIN_SOLVES_ALLTIME && u.sumAdjTimeMs > 0)
    .map((u) => ({ ...u, avg: u.sumAdjTimeMs / u.solves }))
    .sort((a, b) => a.avg - b.avg || b.solves - a.solves)
    .slice(0, TOP_N);
}

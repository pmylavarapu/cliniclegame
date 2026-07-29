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

export type SubmitResult =
  | { kind: 'submitted' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'error'; status: number; body: string };

/**
 * Submit. Returns detailed status so the UI can surface Firestore errors
 * directly, without having to open DevTools.
 */
export async function submitLeaderboardEntry(
  s: SolveSubmission,
): Promise<SubmitResult> {
  const cfg = config();
  if (!cfg) return { kind: 'skipped', reason: 'no firebase config' };
  if (typeof window === 'undefined')
    return { kind: 'skipped', reason: 'ssr' };

  const uid = getOrCreateUserId();
  const name = getStoredName();
  if (!name) return { kind: 'skipped', reason: 'no name set' };

  const flagKey = `clinicle:lb:submitted:${s.puzzleDate}`;
  if (localStorage.getItem(flagKey))
    return { kind: 'skipped', reason: 'already submitted (local flag)' };

  const aG = adjGuesses(s.guesses, s.hints);
  const aT = adjTimeMs(s.timeMs, s.hints);
  const wonAt = Date.now();

  // Per-puzzle entry: use the dedicated createDocument endpoint (not
  // :commit). Simpler payload, no writes array, no update wrapper. The
  // documentId query param becomes the doc's ID under the parent
  // collection. First-solve-wins is enforced by the create-only Firestore
  // rule; an existing doc rejects create with 409.
  const entryParent = `projects/${cfg.projectId}/databases/(default)/documents/leaderboard_entries/${s.puzzleDate}`;
  const url = `https://firestore.googleapis.com/v1/${entryParent}/entries?documentId=${encodeURIComponent(uid)}&key=${cfg.apiKey}`;
  const body = {
    fields: {
      name: { stringValue: name },
      guesses: { integerValue: String(s.guesses) },
      hints: { integerValue: String(s.hints) },
      timeMs: { integerValue: String(Math.round(s.timeMs)) },
      adjGuesses: { integerValue: String(aG) },
      adjTimeMs: { integerValue: String(aT) },
      wonAt: { integerValue: String(wonAt) },
    },
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text().catch(() => '');
    if (r.ok) {
      localStorage.setItem(flagKey, '1');
      return { kind: 'submitted' };
    }
    // 409 = doc already exists — someone submitted for this uid+date
    // already. Treat as success from the user's perspective so we stop
    // re-prompting them.
    if (r.status === 409) {
      localStorage.setItem(flagKey, '1');
      return { kind: 'submitted' };
    }
    // eslint-disable-next-line no-console
    console.error(
      '[leaderboard] entry create failed:',
      r.status,
      text.slice(0, 800),
      'sent body:',
      JSON.stringify(body).slice(0, 800),
    );
    return { kind: 'error', status: r.status, body: text };
  } catch (e) {
    return { kind: 'error', status: 0, body: String(e) };
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
  avgGuesses: number;
  avgTimeMs: number;
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

/**
 * Aggregate all-time users by scanning per-puzzle entries across recent
 * dates. Replaces the older /leaderboard_users collection so we don't
 * need per-user counter writes on solve.
 */
export async function fetchUsers(recentDates: string[]): Promise<LbUser[]> {
  const cfg = config();
  if (!cfg) return [];
  const perDate = await Promise.all(recentDates.map((d) => fetchPuzzleEntries(d)));
  const acc = new Map<string, LbUser>();
  for (const dayEntries of perDate) {
    for (const e of dayEntries) {
      const u = acc.get(e.uid) ?? {
        uid: e.uid,
        name: e.name,
        solves: 0,
        sumGuesses: 0,
        sumHints: 0,
        sumTimeMs: 0,
        sumAdjGuesses: 0,
        sumAdjTimeMs: 0,
        avgGuesses: 0,
        avgTimeMs: 0,
      };
      u.name = e.name || u.name;
      u.solves += 1;
      u.sumGuesses += e.guesses;
      u.sumHints += e.hints;
      u.sumTimeMs += e.timeMs;
      u.sumAdjGuesses += e.adjGuesses;
      u.sumAdjTimeMs += e.adjTimeMs;
      acc.set(e.uid, u);
    }
  }
  for (const u of acc.values()) {
    u.avgGuesses = u.solves ? u.sumAdjGuesses / u.solves : 0;
    u.avgTimeMs = u.solves ? u.sumAdjTimeMs / u.solves : 0;
  }
  return [...acc.values()];
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
    .map((u) => ({ ...u, avg: u.avgGuesses }))
    .sort((a, b) => a.avg - b.avg || b.solves - a.solves)
    .slice(0, TOP_N);
}

export function topByAvgTime(users: LbUser[]): Array<LbUser & { avg: number }> {
  return users
    .filter((u) => u.solves >= MIN_SOLVES_ALLTIME && u.avgTimeMs > 0)
    .map((u) => ({ ...u, avg: u.avgTimeMs }))
    .sort((a, b) => a.avg - b.avg || b.solves - a.solves)
    .slice(0, TOP_N);
}

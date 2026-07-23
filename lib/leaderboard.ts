/**
 * Optional global "you beat X% of players" percentile via Firebase Firestore
 * REST API (no SDK — just fetch). Feature is silently disabled when the
 * required env vars aren't set.
 *
 * Setup (one-time, project owner):
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Enable Firestore (Native mode, "start in test mode" is fine for a
 *      week; then swap to the rules below).
 *   3. In Project settings → General → Your apps → Web app, grab:
 *        - Web API key (apiKey)
 *        - Project ID
 *   4. Add two Vercel env vars (Production + Preview):
 *        NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
 *        NEXT_PUBLIC_FIREBASE_API_KEY=<web-api-key>
 *   5. In Firestore rules, restrict writes to the leaderboard collection to
 *      a single `distribution` map field with numeric increments only:
 *
 *        rules_version = '2';
 *        service cloud.firestore {
 *          match /databases/{database}/documents {
 *            match /leaderboard/{date} {
 *              allow read: if true;
 *              // Only allow updates that increment a numeric field on
 *              // `distribution` by exactly 1.
 *              allow create, update: if request.resource.data.diff(
 *                resource.data
 *              ).affectedKeys().hasOnly(['distribution']);
 *            }
 *          }
 *        }
 *
 * Schema: one doc per date under /leaderboard/{YYYY-MM-DD} with the shape
 *   { distribution: { "1": n, "2": n, "3": n, ... }, total: n }
 * Each solve issues a Firestore commit with two integer-increment
 * transforms — one on the specific guess bucket, one on `total`.
 */

type Firestore = { projectId: string; apiKey: string };

function config(): Firestore | null {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;
  return { projectId, apiKey };
}

/** True if the leaderboard backend is configured. */
export function leaderboardEnabled(): boolean {
  return config() != null;
}

function docBase(cfg: Firestore, date: string): string {
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/leaderboard/${date}`;
}

/** Fire-and-forget increment of today's guess-count distribution. */
export async function recordSolve(
  date: string,
  guesses: number,
): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  const bucket = String(Math.max(1, Math.min(99, Math.round(guesses))));
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents:commit?key=${cfg.apiKey}`;
  const body = {
    writes: [
      {
        transform: {
          document: `projects/${cfg.projectId}/databases/(default)/documents/leaderboard/${date}`,
          fieldTransforms: [
            {
              fieldPath: `distribution.\`${bucket}\``,
              increment: { integerValue: '1' },
            },
            {
              fieldPath: 'total',
              increment: { integerValue: '1' },
            },
          ],
        },
      },
    ],
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    /* silent — the game still works without the counter */
  }
}

/** Read today's distribution. Returns null if backend isn't configured or fetch fails. */
export async function fetchDistribution(
  date: string,
): Promise<{ distribution: Record<string, number>; total: number } | null> {
  const cfg = config();
  if (!cfg) return null;
  try {
    const r = await fetch(`${docBase(cfg, date)}?key=${cfg.apiKey}`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const doc = await r.json();
    const fields = (doc?.fields ?? {}) as Record<string, unknown>;
    const distField = fields['distribution'] as
      | { mapValue?: { fields?: Record<string, { integerValue?: string; stringValue?: string }> } }
      | undefined;
    const distribution: Record<string, number> = {};
    const raw = distField?.mapValue?.fields ?? {};
    for (const [k, v] of Object.entries(raw)) {
      const n = Number((v as { integerValue?: string }).integerValue ?? 0);
      if (n > 0) distribution[k] = n;
    }
    const total = Object.values(distribution).reduce((s, n) => s + n, 0);
    return { distribution, total };
  } catch {
    return null;
  }
}

/**
 * Compute the percentile of a given guess count against the distribution.
 * Lower guess counts beat higher ones; ties count as beating half.
 * Returns 0-100 (higher = beat more players).
 */
export function computePercentile(
  distribution: Record<string, number>,
  yourGuesses: number,
): number {
  let below = 0;
  let equal = 0;
  let total = 0;
  for (const [k, n] of Object.entries(distribution)) {
    const bucket = Number(k);
    total += n;
    if (bucket > yourGuesses) below += n;
    else if (bucket === yourGuesses) equal += n;
  }
  if (total === 0) return 0;
  return Math.round(((below + equal / 2) / total) * 100);
}

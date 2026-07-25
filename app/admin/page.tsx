'use client';

import { useEffect, useState } from 'react';
import {
  fetchAllPuzzleStats,
  fetchStats,
  statsEnabled,
  type StatsDoc,
} from '@/lib/adminStats';

const ADMIN_PASSWORD = 'myadmin2026!';
const LS_KEY = 'clinicle:admin:ok';

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAuthed(localStorage.getItem(LS_KEY) === '1');
  }, []);

  const submitPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      localStorage.setItem(LS_KEY, '1');
      setAuthed(true);
      setError(null);
    } else {
      setError('Wrong password');
      setPw('');
    }
  };

  if (authed === null) return null;
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <h1 className="text-title-sm font-bold mb-2">Admin</h1>
        <p className="text-caption text-muted mb-4">
          Enter the admin password to view dashboard.
        </p>
        <form onSubmit={submitPw} className="flex flex-col gap-2">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            autoFocus
            className="h-11 px-3 border border-border-strong text-base outline-none focus:border-fg focus:ring-2 focus:ring-fg/10"
          />
          <button
            type="submit"
            className="h-11 bg-fg text-white text-ui font-semibold uppercase tracking-wider"
          >
            Sign in
          </button>
          {error && <p className="text-caption text-red-600">{error}</p>}
        </form>
      </div>
    );
  }

  return <Dashboard />;
}

type UpcomingRow = { date: string; secret: string; prompt: string; difficulty?: number };

function nextNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

function Dashboard() {
  const [global, setGlobal] = useState<StatsDoc | null | 'loading'>('loading');
  const [perPuzzle, setPerPuzzle] = useState<
    Array<{ date: string; stats: StatsDoc }> | 'loading'
  >('loading');
  const [upcoming, setUpcoming] = useState<UpcomingRow[] | 'loading'>('loading');

  useEffect(() => {
    (async () => {
      if (!statsEnabled()) {
        setGlobal(null);
        setPerPuzzle([]);
      } else {
        const [g, all] = await Promise.all([
          fetchStats(),
          fetchAllPuzzleStats(),
        ]);
        setGlobal(g ?? { pageviews: 0, guesses: 0, solves: 0, totalGuessCount: 0, totalSolveTimeMs: 0 });
        setPerPuzzle(all);
      }

      const dates = nextNDates(7);
      const rows = await Promise.all(
        dates.map(async (date) => {
          try {
            const r = await fetch(`/puzzles/${date}.json`, { cache: 'no-store' });
            if (!r.ok) return { date, secret: '(missing)', prompt: '' };
            const p = await r.json();
            return {
              date,
              secret: String(p.secret ?? ''),
              prompt: String(p.prompt ?? ''),
              difficulty: typeof p.difficulty === 'number' ? p.difficulty : undefined,
            };
          } catch {
            return { date, secret: '(error)', prompt: '' };
          }
        })
      );
      setUpcoming(rows);
    })();
  }, []);

  const signOut = () => {
    localStorage.removeItem(LS_KEY);
    location.reload();
  };

  if (global === 'loading' || perPuzzle === 'loading' || upcoming === 'loading') {
    return <p className="text-muted">Loading…</p>;
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-border">
        <h1 className="text-title-sm font-bold uppercase tracking-[0.06em]">
          Admin
        </h1>
        <button
          onClick={signOut}
          className="text-caption text-muted hover:text-fg underline"
        >
          Sign out
        </button>
      </div>

      <section className="mb-8">
        <h2 className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em] mb-3">
          Next 7 days
        </h2>
        <div className="border border-border-strong divide-y divide-border">
          {upcoming.map((row, i) => (
            <div key={row.date} className="p-3 sm:p-4">
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-eyebrow uppercase text-muted font-semibold tracking-[0.06em] tabular">
                    {row.date}
                  </span>
                  {i === 0 && (
                    <span className="text-caption text-muted">today</span>
                  )}
                  {i === 1 && (
                    <span className="text-caption text-muted">tomorrow</span>
                  )}
                </div>
                {typeof row.difficulty === 'number' && (
                  <span className="text-caption text-muted tabular">
                    difficulty {row.difficulty}
                  </span>
                )}
              </div>
              <div className="text-base font-semibold mb-1">{row.secret || '—'}</div>
              {row.prompt && (
                <p className="text-caption text-muted leading-relaxed">{row.prompt}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {!global ? (
        <section className="mb-8">
          <p className="text-caption text-muted">
            Firebase not configured. Set{' '}
            <code>NEXT_PUBLIC_FIREBASE_PROJECT_ID</code> and{' '}
            <code>NEXT_PUBLIC_FIREBASE_API_KEY</code> in Vercel env vars to see
            stats.
          </p>
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em] mb-3">
            Global (all time)
          </h2>
          <StatGrid s={global} />
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em]">
            By puzzle ({perPuzzle.length})
          </h2>
        </div>
        {perPuzzle.length === 0 ? (
          <p className="text-caption text-muted">No per-puzzle data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-caption tabular">
              <thead>
                <tr className="text-eyebrow uppercase text-muted font-semibold tracking-[0.06em] border-b border-border">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-right py-2 pr-4">Views</th>
                  <th className="text-right py-2 pr-4">Guesses</th>
                  <th className="text-right py-2 pr-4">Solves</th>
                  <th className="text-right py-2 pr-4">Solve %</th>
                  <th className="text-right py-2 pr-4">Avg guesses/solve</th>
                  <th className="text-right py-2">Avg solve time</th>
                </tr>
              </thead>
              <tbody>
                {perPuzzle.map(({ date, stats }) => (
                  <tr key={date} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-semibold">{date}</td>
                    <td className="py-2 pr-4 text-right">{fmt(stats.pageviews)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(stats.guesses)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(stats.solves)}</td>
                    <td className="py-2 pr-4 text-right">
                      {stats.pageviews > 0
                        ? Math.round((stats.solves / stats.pageviews) * 100) + '%'
                        : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {stats.solves > 0
                        ? (stats.totalGuessCount / stats.solves).toFixed(1)
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {stats.solves > 0
                        ? formatMs(stats.totalSolveTimeMs / stats.solves)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 text-caption text-muted">
        Unique-user counts, geography, device breakdowns:{' '}
        <a
          href="https://console.firebase.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:underline"
        >
          Firebase → Analytics
        </a>
        .
      </p>
    </div>
  );
}

function StatGrid({ s }: { s: StatsDoc }) {
  const avgGuesses = s.solves > 0 ? s.totalGuessCount / s.solves : 0;
  const avgTimeMs = s.solves > 0 ? s.totalSolveTimeMs / s.solves : 0;
  const solveRate = s.pageviews > 0 ? Math.round((s.solves / s.pageviews) * 100) : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatCard label="Page views" value={fmt(s.pageviews)} />
      <StatCard label="Guesses" value={fmt(s.guesses)} />
      <StatCard label="Solves" value={fmt(s.solves)} />
      <StatCard label="Solve rate" value={s.pageviews > 0 ? `${solveRate}%` : '—'} />
      <StatCard
        label="Avg guesses / solve"
        value={s.solves > 0 ? avgGuesses.toFixed(1) : '—'}
      />
      <StatCard
        label="Avg solve time"
        value={s.solves > 0 ? formatMs(avgTimeMs) : '—'}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border-strong p-4">
      <div className="text-eyebrow uppercase text-muted font-semibold tracking-[0.06em]">
        {label}
      </div>
      <div className="text-title-sm font-bold tabular mt-1">{value}</div>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

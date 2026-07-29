'use client';

import { useEffect, useMemo, useState } from 'react';
import PageShell from '@/components/PageShell';
import {
  fetchAllPuzzleStats,
  fetchCountryStats,
  fetchStats,
  statsEnabled,
  type StatsDoc,
} from '@/lib/adminStats';
import { today } from '@/lib/scores';

type PuzzleRow = { date: string; stats: StatsDoc };
type CountryRow = { country: string; stats: StatsDoc };

const MIN_SOLVES = 3;

export default function StatsPage() {
  const [todayDoc, setTodayDoc] = useState<StatsDoc | null | 'loading'>('loading');
  const [globalDoc, setGlobalDoc] = useState<StatsDoc | null | 'loading'>('loading');
  const [puzzles, setPuzzles] = useState<PuzzleRow[] | 'loading'>('loading');
  const [countries, setCountries] = useState<CountryRow[] | 'loading'>('loading');
  const [date, setDate] = useState('');

  useEffect(() => {
    const d = today();
    setDate(d);
    (async () => {
      if (!statsEnabled()) {
        setTodayDoc(null);
        setGlobalDoc(null);
        setPuzzles([]);
        setCountries([]);
        return;
      }
      const [t, g, p, c] = await Promise.all([
        fetchStats(d),
        fetchStats(),
        fetchAllPuzzleStats(),
        fetchCountryStats(),
      ]);
      setTodayDoc(t);
      setGlobalDoc(g);
      setPuzzles(p);
      setCountries(c);
    })();
  }, []);

  const puzzleRows = useMemo(() => {
    if (puzzles === 'loading') return [];
    return puzzles
      .filter((p) => p.stats.solves >= 1)
      .slice(0, 30);
  }, [puzzles]);

  const countryRows = useMemo(() => {
    if (countries === 'loading') return [];
    return countries.filter((c) => c.stats.solves >= MIN_SOLVES);
  }, [countries]);

  const countryByAvgGuesses = useMemo(
    () =>
      [...countryRows]
        .map((c) => ({ ...c, avg: c.stats.totalGuessCount / c.stats.solves }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 25),
    [countryRows]
  );

  const countryByAvgTime = useMemo(
    () =>
      [...countryRows]
        .map((c) => ({ ...c, avg: c.stats.totalSolveTimeMs / c.stats.solves }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 25),
    [countryRows]
  );

  if (!statsEnabled()) {
    return (
      <PageShell eyebrow="Community" title="Stats">
        <p className="text-muted">
          Stats are disabled — Firebase env vars aren&apos;t set on this
          deployment.
        </p>
      </PageShell>
    );
  }

  const loading =
    todayDoc === 'loading' ||
    globalDoc === 'loading' ||
    puzzles === 'loading' ||
    countries === 'loading';

  if (loading) {
    return (
      <PageShell eyebrow="Community" title="Stats">
        <p className="text-muted">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Community" title="Stats">
      <p className="text-caption text-muted mb-6">
        Anonymous aggregate stats. No individual scores, no handles, no login.
      </p>

      <section className="mb-8">
        <h2 className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em] mb-3">
          Today · {date}
        </h2>
        {todayDoc && todayDoc.solves > 0 ? (
          <StatGrid s={todayDoc} />
        ) : (
          <p className="text-caption text-muted">No solves yet today.</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em] mb-3">
          All time
        </h2>
        {globalDoc && globalDoc.solves > 0 ? (
          <StatGrid s={globalDoc} />
        ) : (
          <p className="text-caption text-muted">Nothing here yet.</p>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em]">
            By country
          </h2>
          <span className="text-caption text-muted">
            min {MIN_SOLVES} solves to appear
          </span>
        </div>
        {countryRows.length === 0 ? (
          <p className="text-caption text-muted">
            No country breakdown yet.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <MiniBoard
              title="Fewest avg guesses"
              rows={countryByAvgGuesses.map((c, i) => ({
                rank: i + 1,
                label: countryLabel(c.country),
                metric: c.avg.toFixed(1),
                note: `${c.stats.solves} solves`,
              }))}
            />
            <MiniBoard
              title="Fastest avg time"
              rows={countryByAvgTime.map((c, i) => ({
                rank: i + 1,
                label: countryLabel(c.country),
                metric: fmtMs(c.avg),
                note: `${c.stats.solves} solves`,
              }))}
            />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em]">
            Recent puzzles ({puzzleRows.length})
          </h2>
        </div>
        {puzzleRows.length === 0 ? (
          <p className="text-caption text-muted">No puzzle stats yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-caption tabular">
              <thead>
                <tr className="text-eyebrow uppercase text-muted font-semibold tracking-[0.06em] border-b border-border">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-right py-2 pr-4">Solves</th>
                  <th className="text-right py-2 pr-4">Avg guesses</th>
                  <th className="text-right py-2">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {puzzleRows.map(({ date: d, stats: s }) => (
                  <tr key={d} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-semibold">{d}</td>
                    <td className="py-2 pr-4 text-right">{s.solves.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">
                      {(s.totalGuessCount / s.solves).toFixed(1)}
                    </td>
                    <td className="py-2 text-right">
                      {fmtMs(s.totalSolveTimeMs / s.solves)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function StatGrid({ s }: { s: StatsDoc }) {
  const avgGuesses = s.solves > 0 ? s.totalGuessCount / s.solves : 0;
  const avgTimeMs = s.solves > 0 ? s.totalSolveTimeMs / s.solves : 0;
  const solveRate = s.pageviews > 0 ? Math.round((s.solves / s.pageviews) * 100) : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Card label="Page views" value={s.pageviews.toLocaleString()} />
      <Card label="Solves" value={s.solves.toLocaleString()} />
      <Card label="Solve rate" value={s.pageviews > 0 ? `${solveRate}%` : '—'} />
      <Card
        label="Avg guesses"
        value={s.solves > 0 ? avgGuesses.toFixed(1) : '—'}
      />
      <Card
        label="Avg solve time"
        value={s.solves > 0 ? fmtMs(avgTimeMs) : '—'}
      />
      <Card label="Total guesses" value={s.guesses.toLocaleString()} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border-strong p-4">
      <div className="text-eyebrow uppercase text-muted font-semibold tracking-[0.06em]">
        {label}
      </div>
      <div className="text-title-sm font-bold tabular mt-1">{value}</div>
    </div>
  );
}

function MiniBoard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ rank: number; label: string; metric: string; note: string }>;
}) {
  return (
    <section className="border border-border-strong">
      <header className="px-3 py-2 border-b border-border">
        <h3 className="text-ui font-bold uppercase tracking-wider">{title}</h3>
      </header>
      {rows.length === 0 ? (
        <p className="p-4 text-caption text-muted">No data yet.</p>
      ) : (
        <table className="w-full text-caption">
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank} className="border-b border-border/50">
                <td className="py-1.5 pl-3 pr-2 text-right w-8 tabular text-muted">
                  {r.rank}
                </td>
                <td className="py-1.5 px-2 font-semibold">{r.label}</td>
                <td className="py-1.5 px-2 text-right tabular font-semibold">
                  {r.metric}
                </td>
                <td className="py-1.5 pr-3 pl-2 text-right tabular text-muted whitespace-nowrap">
                  {r.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function countryLabel(iso2: string): string {
  const flag = flagFor(iso2);
  return flag ? `${flag} ${iso2}` : iso2;
}

function flagFor(iso2: string): string {
  if (!/^[A-Z]{2}$/.test(iso2)) return '';
  const codePoints = [...iso2].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

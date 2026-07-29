'use client';

import { useEffect, useMemo, useState } from 'react';
import PageShell from '@/components/PageShell';
import NamePrompt from '@/components/NamePrompt';
import {
  HINT_PENALTY,
  MIN_SOLVES,
  fetchPuzzleEntries,
  fetchUsers,
  getOrCreateUserId,
  getStoredName,
  leaderboardEntriesEnabled,
  sanitizeName,
  setStoredName,
  submitLeaderboardEntry,
  topByAvgGuesses,
  topByAvgTime,
  topByFastestTime,
  topByFewestGuesses,
  type LbEntry,
  type LbUser,
} from '@/lib/leaderboardEntries';
import { today } from '@/lib/scores';
import { loadGame } from '@/lib/storage';

type Tab = 'today' | 'alltime';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('today');
  const [entries, setEntries] = useState<LbEntry[] | 'loading'>('loading');
  const [users, setUsers] = useState<LbUser[] | 'loading'>('loading');
  const [uid, setUid] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [date, setDate] = useState<string>('');
  const [pendingSolve, setPendingSolve] = useState<{
    guesses: number;
    hints: number;
    timeMs: number;
  } | null>(null);
  const [pendingNameOpen, setPendingNameOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'submitting' | 'submitted' | 'failed'
  >('idle');
  const [submitError, setSubmitError] = useState<string>('');

  const refresh = async (d: string) => {
    if (!leaderboardEntriesEnabled()) {
      setEntries([]);
      setUsers([]);
      return;
    }
    const [e, u] = await Promise.all([fetchPuzzleEntries(d), fetchUsers()]);
    setEntries(e);
    setUsers(u);
  };

  useEffect(() => {
    const d = today();
    setDate(d);
    setUid(getOrCreateUserId());
    setName(getStoredName() ?? '');

    // Detect a solved-but-not-submitted game for today.
    if (typeof window !== 'undefined') {
      const game = loadGame(d);
      const submittedFlag = localStorage.getItem(`clinicle:lb:submitted:${d}`);
      if (
        game &&
        game.won &&
        !game.gaveUp &&
        !submittedFlag &&
        leaderboardEntriesEnabled()
      ) {
        setPendingSolve({
          guesses: game.guesses.length,
          hints: game.hintsUsed,
          timeMs: game.timeMs ?? 0,
        });
      }
    }

    refresh(d);
  }, []);

  const doSubmit = async () => {
    if (!pendingSolve) return;
    if (!getStoredName()) {
      setPendingNameOpen(true);
      return;
    }
    setSubmitStatus('submitting');
    setSubmitError('');
    const r = await submitLeaderboardEntry({
      puzzleDate: date,
      guesses: pendingSolve.guesses,
      hints: pendingSolve.hints,
      timeMs: pendingSolve.timeMs,
    });
    if (r.kind === 'submitted') {
      setSubmitStatus('submitted');
      setPendingSolve(null);
      await refresh(date);
    } else if (r.kind === 'error') {
      setSubmitStatus('failed');
      setSubmitError(`HTTP ${r.status}\n${r.body}`);
    } else {
      setSubmitStatus('failed');
      setSubmitError(`skipped: ${r.reason}`);
    }
  };

  const fewestGuesses = useMemo(
    () => (entries === 'loading' ? [] : topByFewestGuesses(entries)),
    [entries]
  );
  const fastestTime = useMemo(
    () => (entries === 'loading' ? [] : topByFastestTime(entries)),
    [entries]
  );
  const avgGuesses = useMemo(
    () => (users === 'loading' ? [] : topByAvgGuesses(users)),
    [users]
  );
  const avgTime = useMemo(
    () => (users === 'loading' ? [] : topByAvgTime(users)),
    [users]
  );

  const isYou = (rowUid: string): boolean => !!uid && rowUid === uid;

  const saveName = () => {
    const cleaned = sanitizeName(nameDraft);
    if (!cleaned) {
      setEditingName(false);
      return;
    }
    setStoredName(cleaned);
    setName(cleaned);
    setEditingName(false);
  };

  if (!leaderboardEntriesEnabled()) {
    return (
      <PageShell eyebrow="Community" title="Leaderboard">
        <p className="text-muted">
          Leaderboard is disabled — Firebase env vars aren&apos;t set on this
          deployment.
        </p>
      </PageShell>
    );
  }

  const loading = entries === 'loading' || users === 'loading';

  return (
    <PageShell eyebrow="Community" title="Leaderboard">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div className="flex gap-1">
          <TabBtn active={tab === 'today'} onClick={() => setTab('today')}>
            Today
          </TabBtn>
          <TabBtn active={tab === 'alltime'} onClick={() => setTab('alltime')}>
            All time
          </TabBtn>
        </div>
        <div className="text-caption text-muted">
          {name ? (
            <>
              You are{' '}
              {editingName ? (
                <span className="inline-flex items-center gap-1 align-baseline">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    autoFocus
                    maxLength={20}
                    className="h-7 px-2 border border-border-strong text-caption outline-none focus:border-fg"
                  />
                  <button
                    type="button"
                    onClick={saveName}
                    className="text-caption text-fg hover:underline"
                  >
                    save
                  </button>
                </span>
              ) : (
                <>
                  <span className="font-semibold text-fg">{name}</span>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(name);
                      setEditingName(true);
                    }}
                    className="text-link hover:underline"
                  >
                    change
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              No handle set yet — solve today&apos;s puzzle to be prompted for
              one.
            </>
          )}
        </div>
      </div>

      {pendingSolve && submitStatus !== 'submitted' && (
        <div className="mb-4 p-3 border border-border-strong bg-surface-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-caption">
            <span className="font-semibold text-fg">
              You solved today&apos;s puzzle
            </span>{' '}
            in {pendingSolve.guesses} guesses
            {pendingSolve.hints > 0 && ` (+${pendingSolve.hints} hints)`}
            {pendingSolve.timeMs > 0 && ` · ${fmtMs(pendingSolve.timeMs)}`}
            {' '}but haven&apos;t submitted it to the leaderboard yet.
          </div>
          <button
            type="button"
            onClick={doSubmit}
            disabled={submitStatus === 'submitting'}
            className="h-9 px-4 bg-fg text-white text-ui font-semibold uppercase tracking-wider disabled:opacity-50"
          >
            {submitStatus === 'submitting' ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}
      {submitStatus === 'failed' && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 text-red-700 text-caption">
          <div className="font-semibold mb-1">Submit failed.</div>
          <pre className="whitespace-pre-wrap break-all text-[11px] leading-snug max-h-40 overflow-auto">
            {submitError || '(no error details)'}
          </pre>
        </div>
      )}
      {submitStatus === 'submitted' && (
        <div className="mb-4 p-3 border border-border-strong bg-surface-2 text-caption">
          Submitted — you should see yourself highlighted below.
        </div>
      )}

      <NamePrompt
        open={pendingNameOpen}
        initial={getStoredName() ?? ''}
        onSubmit={async (n) => {
          setPendingNameOpen(false);
          setName(n);
          await doSubmit();
        }}
        onSkip={() => setPendingNameOpen(false)}
      />

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : tab === 'today' ? (
        <>
          <p className="text-caption text-muted mb-3 tabular">
            Today: {date} · {Array.isArray(entries) ? entries.length : 0}{' '}
            {Array.isArray(entries) && entries.length === 1 ? 'solve' : 'solves'}
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <Board
              title="Fewest guesses"
              subtitle="tiebreak: fastest time"
              cols={[
                { label: '#', className: 'w-10 text-right' },
                { label: 'Handle', className: '' },
                { label: 'Guesses', className: 'text-right tabular' },
                { label: 'Time', className: 'text-right tabular' },
              ]}
              rows={fewestGuesses.map((e, i) => ({
                key: e.uid,
                isYou: isYou(e.uid),
                cells: [
                  String(i + 1),
                  e.name || '—',
                  fmtGuesses(e.guesses, e.hints),
                  fmtMs(e.timeMs),
                ],
              }))}
            />
            <Board
              title="Fastest time"
              subtitle="tiebreak: fewest guesses"
              cols={[
                { label: '#', className: 'w-10 text-right' },
                { label: 'Handle', className: '' },
                { label: 'Time', className: 'text-right tabular' },
                { label: 'Guesses', className: 'text-right tabular' },
              ]}
              rows={fastestTime.map((e, i) => ({
                key: e.uid,
                isYou: isYou(e.uid),
                cells: [
                  String(i + 1),
                  e.name || '—',
                  fmtMs(e.timeMs),
                  fmtGuesses(e.guesses, e.hints),
                ],
              }))}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-caption text-muted mb-3">
            All-time averages across every puzzle you&apos;ve solved. Minimum{' '}
            {MIN_SOLVES} solves to appear.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <Board
              title="Best avg guesses"
              subtitle={`min ${MIN_SOLVES} solves`}
              cols={[
                { label: '#', className: 'w-10 text-right' },
                { label: 'Handle', className: '' },
                { label: 'Avg', className: 'text-right tabular' },
                { label: 'Solves', className: 'text-right tabular' },
              ]}
              rows={avgGuesses.map((u, i) => ({
                key: u.uid,
                isYou: isYou(u.uid),
                cells: [
                  String(i + 1),
                  u.name || '—',
                  u.avg.toFixed(1),
                  String(u.solves),
                ],
              }))}
            />
            <Board
              title="Best avg time"
              subtitle={`min ${MIN_SOLVES} solves`}
              cols={[
                { label: '#', className: 'w-10 text-right' },
                { label: 'Handle', className: '' },
                { label: 'Avg', className: 'text-right tabular' },
                { label: 'Solves', className: 'text-right tabular' },
              ]}
              rows={avgTime.map((u, i) => ({
                key: u.uid,
                isYou: isYou(u.uid),
                cells: [
                  String(i + 1),
                  u.name || '—',
                  fmtMs(u.avg),
                  String(u.solves),
                ],
              }))}
            />
          </div>
        </>
      )}

      <p className="mt-8 text-caption text-muted">
        Hints carry a penalty on every board: each hint counts as{' '}
        <span className="font-semibold text-fg">
          +{HINT_PENALTY.guesses} guesses
        </span>{' '}
        and{' '}
        <span className="font-semibold text-fg">
          +{Math.round(HINT_PENALTY.timeMs / 1000)}s
        </span>
        . Solves that used the &ldquo;give up&rdquo; button don&apos;t appear
        at all.
      </p>
    </PageShell>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-9 px-4 text-ui font-semibold uppercase tracking-wider transition-colors',
        active
          ? 'bg-fg text-white'
          : 'text-muted hover:text-fg',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

type Row = { key: string; isYou: boolean; cells: string[] };
type Col = { label: string; className: string };

function Board({
  title,
  subtitle,
  cols,
  rows,
}: {
  title: string;
  subtitle: string;
  cols: Col[];
  rows: Row[];
}) {
  return (
    <section className="border border-border-strong">
      <header className="px-3 py-2 border-b border-border">
        <h3 className="text-ui font-bold uppercase tracking-wider">{title}</h3>
        <p className="text-caption text-muted">{subtitle}</p>
      </header>
      {rows.length === 0 ? (
        <p className="p-4 text-caption text-muted">No solves yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-caption">
            <thead>
              <tr className="text-eyebrow uppercase text-muted font-semibold tracking-[0.06em] border-b border-border">
                {cols.map((c) => (
                  <th key={c.label} className={`text-left py-2 px-3 ${c.className}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className={[
                    'border-b border-border/50',
                    r.isYou ? 'bg-primary/5 font-semibold' : '',
                  ].join(' ')}
                >
                  {r.cells.map((v, i) => (
                    <td key={i} className={`py-1.5 px-3 ${cols[i].className}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function fmtMs(ms: number): string {
  if (!ms || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function fmtGuesses(g: number, hints: number): string {
  if (!hints) return String(g);
  return `${g} (+${hints}h)`;
}

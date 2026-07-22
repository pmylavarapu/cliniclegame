'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Guess, Puzzle } from '@/lib/types';
import { decodeScores, normalizeGuess, scoreFromStored } from '@/lib/scores';
import {
  loadGame,
  saveGame,
  recordCompletion,
  loadStats,
  fastestSolveMs,
} from '@/lib/storage';
import { buildShareString } from '@/lib/share';
import ShareMenu from './ShareMenu';
import GuessDistribution from './GuessDistribution';
import NextPuzzleCountdown from './NextPuzzleCountdown';

type Props = {
  puzzle: Puzzle;
  vocab: string[];
};

export default function PuzzleGame({ puzzle, vocab }: Props) {
  const vocabIndex = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < vocab.length; i++) m.set(vocab[i], i);
    return m;
  }, [vocab]);

  const topMap = useMemo(() => {
    const m = new Map<string, { rank: number; score: number }>();
    puzzle.top1000.forEach(([w, s], i) => m.set(w, { rank: i + 1, score: s }));
    return m;
  }, [puzzle]);

  const scores = useMemo(() => decodeScores(puzzle.scores), [puzzle]);

  const nearestScore = puzzle.top1000[0]?.[1] ?? 0;
  const thousandthScore =
    puzzle.top1000[puzzle.top1000.length - 1]?.[1] ?? 0;
  const vocabSize = vocab.length;

  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [won, setWon] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finalTimeMs, setFinalTimeMs] = useState<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    const g = loadGame(puzzle.date);
    if (g) {
      setGuesses(g.guesses);
      setHintsUsed(g.hintsUsed);
      setGaveUp(g.gaveUp);
      setWon(g.won);
      setStartedAt(g.startedAt ?? Date.now());
      setFinalTimeMs(g.timeMs);
    } else {
      setStartedAt(Date.now());
    }
  }, [puzzle.date]);

  useEffect(() => {
    if (startedAt == null) return;
    saveGame({
      date: puzzle.date,
      guesses,
      hintsUsed,
      gaveUp,
      won,
      startedAt,
      timeMs: finalTimeMs,
    });
  }, [puzzle.date, guesses, hintsUsed, gaveUp, won, startedAt, finalTimeMs]);

  const gameOver = won || gaveUp;

  useEffect(() => {
    if (gameOver && !savedRef.current) {
      savedRef.current = true;
      const t = won && startedAt != null && finalTimeMs == null
        ? Date.now() - startedAt
        : finalTimeMs;
      if (t !== undefined && finalTimeMs == null) setFinalTimeMs(t);
      recordCompletion(puzzle.date, guesses.length, hintsUsed, won, gaveUp, t);
    }
  }, [gameOver, puzzle.date, guesses.length, hintsUsed, won, gaveUp, startedAt, finalTimeMs]);

  const submitGuess = (raw: string, isHint = false) => {
    setError(null);
    const w = normalizeGuess(raw);
    if (!w) return;
    if (guesses.some((g) => g.word === w)) {
      setError(`Already guessed "${w}"`);
      flashInput();
      return;
    }
    const idx = vocabIndex.get(w);
    if (idx === undefined) {
      setError(`"${w}" is not in the vocabulary`);
      flashInput();
      return;
    }
    const top = topMap.get(w);
    const score = top ? top.score : scoreFromStored(scores[idx] ?? 0);
    const rank = top ? top.rank : null;
    const g: Guess = { word: w, score, rank, isHint, order: guesses.length + 1 };
    const next = [...guesses, g];
    setGuesses(next);
    setLastAdded(w);
    setInput('');
    if (rank === 1) setWon(true);
  };

  const flashInput = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const useHint = () => {
    if (gameOver) return;
    const bestRank = guesses.reduce(
      (min, g) => (g.rank && g.rank < min ? g.rank : min),
      Infinity,
    );
    const target = Math.max(1, bestRank === Infinity ? 300 : Math.floor(bestRank / 2));
    for (let r = target; r >= 1; r--) {
      const [w] = puzzle.top1000[r - 1];
      if (!guesses.some((g) => g.word === w)) {
        setHintsUsed((h) => h + 1);
        submitGuess(w, true);
        return;
      }
    }
  };

  const giveUp = () => {
    if (gameOver) return;
    if (!confirm('Reveal the answer and end the game?')) return;
    const secret = puzzle.secret;
    if (!guesses.some((g) => g.word === secret)) {
      const top = topMap.get(secret);
      if (top) {
        const g: Guess = {
          word: secret,
          score: top.score,
          rank: top.rank,
          isHint: false,
          order: guesses.length + 1,
        };
        setGuesses((prev) => [...prev, g]);
      }
    }
    setGaveUp(true);
  };

  const sorted = useMemo(() => {
    return [...guesses].sort((a, b) => b.score - a.score);
  }, [guesses]);

  const currentGuess = guesses[guesses.length - 1];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitGuess(input);
  };

  const dateLabel = formatDate(puzzle.date);

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-caption mb-4">
          <span className="text-eyebrow uppercase text-muted font-bold tracking-[0.06em]">
            Guess the diagnosis
          </span>
          <span className="text-border-strong">·</span>
          <span className="font-semibold text-fg tabular">
            Puzzle {puzzle.num}
          </span>
          <span className="text-border-strong">·</span>
          <span className="tabular text-muted">{dateLabel}</span>
          {puzzle.difficulty ? (
            <>
              <span className="text-border-strong">·</span>
              <span className="inline-flex items-center gap-1.5">
                <DifficultyStars value={puzzle.difficulty} />
                <span className="text-caption font-semibold text-fg">
                  {difficultyLabel(puzzle.difficulty)}
                </span>
              </span>
            </>
          ) : null}
        </div>
        <p className="text-title sm:text-title-lg font-bold text-fg tracking-tight leading-snug mb-4">
          {puzzle.prompt}
        </p>
        <p className="text-caption sm:text-body text-fg-soft">
          Type any medical word or phrase. Closer meanings score higher —{' '}
          <span className="font-semibold text-fg">heart attack</span>{' '}
          scores near{' '}
          <span className="font-semibold text-fg">myocardial infarction</span>,
          but far from{' '}
          <span className="font-semibold text-fg">arthritis</span>. Rank 1 wins.
        </p>
      </div>

      {!gameOver && (
        <form onSubmit={onSubmit} className="mb-4">
          <div className="flex items-stretch gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a word or phrase"
              className="flex-1 min-w-0 h-12 sm:h-14 px-4 sm:px-5 text-body sm:text-lede rounded-full bg-surface-2 border border-transparent outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15 transition-all placeholder:text-muted font-medium"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="h-12 sm:h-14 px-5 sm:px-7 rounded-full bg-primary text-white text-ui font-bold hover:brightness-110 active:scale-[0.98] transition-[transform,filter]"
            >
              Guess
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={useHint}
              className="inline-flex items-center h-9 px-4 rounded-full bg-surface-2 text-ui font-semibold text-fg hover:bg-hint/10 hover:text-hint transition-colors"
            >
              Hint
            </button>
            <button
              type="button"
              onClick={giveUp}
              className="inline-flex items-center h-9 px-4 rounded-full bg-surface-2 text-ui font-semibold text-fg hover:bg-danger/10 hover:text-danger transition-colors"
            >
              Give up
            </button>
            <span className="ml-auto text-caption text-muted tabular">
              {guesses.length} guess{guesses.length === 1 ? '' : 'es'}
              {hintsUsed > 0 &&
                ` · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}`}
            </span>
          </div>
          {error && (
            <div className="mt-3 text-caption text-red-600 font-medium animate-in">
              {error}
            </div>
          )}
        </form>
      )}

      {gameOver && (
        <WinBanner
          puzzle={puzzle}
          won={won}
          guesses={guesses}
          hintsUsed={hintsUsed}
          gaveUp={gaveUp}
          timeMs={finalTimeMs}
        />
      )}

      {sorted.length > 0 && (
        <section className="mt-8 sm:mt-10">
          {currentGuess && !gameOver && (
            <div className="mb-4">
              <div className="text-eyebrow uppercase text-muted font-bold mb-2">
                Your last guess
              </div>
              <GuessRow guess={currentGuess} isCurrent />
            </div>
          )}
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-eyebrow uppercase text-muted font-bold">
              All guesses (best first)
            </h2>
          </div>
          <GuessTableHeader />
          {sorted.map((g) => (
            <GuessRow
              key={g.order}
              guess={g}
              recent={g.word === lastAdded}
            />
          ))}
        </section>
      )}

      {guesses.length === 0 && !gameOver && (
        <div className="mt-10 py-12 rounded-2xl bg-surface-2 text-center">
          <p className="text-title-sm text-fg font-bold">
            Make your first guess
          </p>
          <p className="text-body text-muted mt-1.5">
            Try something broad — an organ, a symptom, a body system.
          </p>
        </div>
      )}
    </div>
  );
}

function difficultyLabel(value: number): string {
  const clamped = Math.max(1, Math.min(5, value));
  return ['Easy', 'Light', 'Medium', 'Hard', 'Brutal'][clamped - 1];
}

function DifficultyStars({ value }: { value: number }) {
  const clamped = Math.max(1, Math.min(5, value));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Difficulty ${clamped} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={
            n <= clamped
              ? 'text-fg text-[13px] leading-none'
              : 'text-border-strong text-[13px] leading-none'
          }
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const ROW_GRID =
  'grid grid-cols-[3.25rem_1fr_3.5rem_3.5rem] sm:grid-cols-[4rem_1fr_4rem_4.5rem] gap-2 sm:gap-3 items-center';

function GuessTableHeader() {
  return (
    <div
      className={`${ROW_GRID} px-3 sm:px-4 pb-2 text-eyebrow uppercase text-muted font-bold`}
    >
      <div>Rank</div>
      <div>Guess</div>
      <div className="text-right">Score</div>
      <div className="text-right">%tile</div>
    </div>
  );
}

function GuessRow({
  guess,
  isCurrent,
  recent,
}: {
  guess: Guess;
  /** Show the "current guess" highlight (ring + ring-offset). */
  isCurrent?: boolean;
  recent?: boolean;
}) {
  const inTop = guess.rank !== null;
  const percentile = inTop ? Math.max(0, 1000 - guess.rank!) / 10 : 0;

  // Row background — the whole card tints by rank.
  // rank 1  → solid green fill
  // rank N  → warm-orange, opacity scales with closeness (0.55 down to 0.06)
  // no rank → very subtle gray
  let bgStyle: React.CSSProperties;
  let fgClass: string;
  if (guess.rank === 1) {
    bgStyle = { background: 'rgb(var(--hot-r) var(--hot-g) var(--hot-b))' };
    fgClass = 'text-white';
  } else if (inTop) {
    const alpha = Math.max(0.06, 0.55 * (1 - (guess.rank! - 1) / 999));
    bgStyle = { background: `rgb(var(--warm-r) var(--warm-g) var(--warm-b) / ${alpha})` };
    fgClass = 'text-fg';
  } else {
    bgStyle = { background: 'rgb(var(--surface-2))' };
    fgClass = 'text-fg';
  }

  const dimClass = guess.rank === 1 ? 'opacity-100' : 'opacity-70';

  return (
    <div
      style={bgStyle}
      className={[
        ROW_GRID,
        'px-3 sm:px-4 py-3 rounded-xl mb-1.5 transition-transform',
        isCurrent ? 'ring-2 ring-fg/80 ring-offset-2 ring-offset-bg' : '',
        recent ? 'animate-in' : '',
      ].join(' ')}
    >
      <div
        className={`tabular text-ui font-bold ${fgClass} ${dimClass}`}
      >
        {guess.rank ? `#${guess.rank}` : '—'}
      </div>
      <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
        <span className={`tabular text-caption font-semibold ${fgClass} opacity-60`}>
          {guess.order}.
        </span>
        <span
          className={`text-lede font-bold truncate max-w-full ${fgClass}`}
        >
          {guess.word}
        </span>
        {guess.isHint && (
          <span
            className={[
              'text-eyebrow uppercase font-bold px-1.5 py-0.5 rounded',
              guess.rank === 1
                ? 'bg-white/25 text-white'
                : 'bg-fg/10 text-fg-soft',
            ].join(' ')}
          >
            hint
          </span>
        )}
      </div>
      <div
        className={`tabular text-ui font-bold text-right ${fgClass}`}
      >
        {guess.score.toFixed(1)}
      </div>
      <div
        className={`tabular text-caption font-semibold text-right ${fgClass} ${dimClass}`}
      >
        {inTop ? `${percentile.toFixed(1)}%` : '—'}
      </div>
    </div>
  );
}

function WinBanner({
  puzzle,
  won,
  guesses,
  hintsUsed,
  gaveUp,
  timeMs,
}: {
  puzzle: Puzzle;
  won: boolean;
  guesses: Guess[];
  hintsUsed: number;
  gaveUp: boolean;
  timeMs?: number;
}) {
  const stats = loadStats();
  const bestMs = fastestSolveMs(stats);
  const shareText = buildShareString(
    { date: puzzle.date, guesses, hintsUsed, gaveUp, won, timeMs },
    puzzle.num,
    puzzle.difficulty,
  );

  return (
    <div
      className={[
        'mt-4 mb-8 rounded-2xl p-6 sm:p-8 animate-in',
        won ? 'bg-hot text-white' : 'bg-surface-2 text-fg',
      ].join(' ')}
    >
      <div
        className={[
          'text-eyebrow uppercase font-bold mb-3',
          won ? 'text-white/80' : 'text-muted',
        ].join(' ')}
      >
        {won ? 'Solved' : 'Revealed'}
      </div>
      <div className="text-title-xl font-bold tracking-tight mb-2">
        {won
          ? `${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`
          : 'Answer revealed'}
      </div>
      <div
        className={[
          'text-body mb-6',
          won ? 'text-white/85' : 'text-muted',
        ].join(' ')}
      >
        The diagnosis was{' '}
        <span
          className={[
            'font-bold',
            won ? 'text-white' : 'text-fg',
          ].join(' ')}
        >
          {puzzle.secret}
        </span>
        {hintsUsed > 0 && (
          <>
            {' '}
            · {hintsUsed} hint{hintsUsed === 1 ? '' : 's'}
          </>
        )}
        {won && timeMs !== undefined && (
          <>
            {' '}
            · <span className="tabular">{formatDuration(timeMs)}</span>
            {bestMs !== undefined && bestMs < timeMs && (
              <>
                {' '}
                · best <span className="tabular">{formatDuration(bestMs)}</span>
              </>
            )}
            {bestMs !== undefined && bestMs === timeMs && stats.wins > 1 && (
              <> · 🎉 new best</>
            )}
          </>
        )}
      </div>

      {won && (
        <div className="mb-6">
          <GuessDistribution
            stats={stats}
            today={{ guesses: guesses.length, won }}
            variant="oncolor"
          />
        </div>
      )}

      <div
        className={[
          'mb-6 py-4 rounded-2xl',
          won ? 'bg-white/15' : 'bg-white',
        ].join(' ')}
      >
        <NextPuzzleCountdown variant={won ? 'oncolor' : 'default'} />
      </div>
      <div
        className={[
          'grid grid-cols-4 gap-2 mb-6 rounded-xl overflow-hidden',
          won ? 'bg-white/15' : 'bg-white',
        ].join(' ')}
      >
        <Stat label="Played" value={stats.played} on={won ? 'dark' : 'light'} />
        <Stat
          label="Win %"
          value={stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}
          on={won ? 'dark' : 'light'}
        />
        <Stat label="Streak" value={stats.currentStreak} on={won ? 'dark' : 'light'} />
        <Stat label="Best" value={stats.maxStreak} on={won ? 'dark' : 'light'} />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText.replace(/https?:\/\/[^\s]+/g, '').trim(),
          )}&url=${encodeURIComponent(
            typeof window !== 'undefined'
              ? window.location.origin + '/'
              : 'https://clinicle.app',
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full text-ui font-bold hover:brightness-110 active:scale-[0.98] transition-[transform,filter]',
            won ? 'bg-white text-fg' : 'bg-fg text-white',
          ].join(' ')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Post on X
        </a>
        <div className="flex-1">
          <ShareMenu
            text={shareText}
            title={`Clinicle #${puzzle.num}`}
            variant={won ? 'oncolor' : 'default'}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  on,
}: {
  label: string;
  value: number | string;
  on: 'light' | 'dark';
}) {
  return (
    <div className="px-2 py-4 text-center">
      <div
        className={[
          'tabular text-title font-bold leading-none',
          on === 'dark' ? 'text-white' : 'text-fg',
        ].join(' ')}
      >
        {value}
      </div>
      <div
        className={[
          'text-eyebrow uppercase mt-2 font-bold',
          on === 'dark' ? 'text-white/70' : 'text-muted',
        ].join(' ')}
      >
        {label}
      </div>
    </div>
  );
}

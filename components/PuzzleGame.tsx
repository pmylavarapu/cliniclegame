'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Guess, Puzzle } from '@/lib/types';
import { decodeScores, normalizeGuess, scoreFromStored } from '@/lib/scores';
import { loadGame, saveGame, recordCompletion, loadStats } from '@/lib/storage';
import { buildShareString } from '@/lib/share';

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

  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [won, setWon] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    const g = loadGame(puzzle.date);
    if (g) {
      setGuesses(g.guesses);
      setHintsUsed(g.hintsUsed);
      setGaveUp(g.gaveUp);
      setWon(g.won);
    }
  }, [puzzle.date]);

  useEffect(() => {
    saveGame({ date: puzzle.date, guesses, hintsUsed, gaveUp, won });
  }, [puzzle.date, guesses, hintsUsed, gaveUp, won]);

  const gameOver = won || gaveUp;

  useEffect(() => {
    if (gameOver && !savedRef.current) {
      savedRef.current = true;
      recordCompletion(puzzle.date, guesses.length, hintsUsed, won, gaveUp);
    }
  }, [gameOver, puzzle.date, guesses.length, hintsUsed, won, gaveUp]);

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

  const bestGuess = sorted[0];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitGuess(input);
  };

  return (
    <div>
      <section className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted mb-2">
          <span>Puzzle</span>
          <span className="tabular text-fg-soft font-medium">#{puzzle.num}</span>
          <span className="mx-1 h-1 w-1 rounded-full bg-border-strong" />
          <span className="tabular">{puzzle.date}</span>
        </div>
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight leading-tight mb-3">
          Guess the diagnosis
        </h1>
        <p className="text-fg-soft leading-relaxed">
          Enter medical terms — the closer their meaning is to today&rsquo;s secret
          diagnosis, the higher the score. Rank 1 wins.
        </p>
        <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">
            Prompt
          </div>
          <div className="text-fg leading-relaxed">{puzzle.prompt}</div>
        </div>
      </section>

      {!gameOver && (
        <form onSubmit={onSubmit} className="mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter a medical term…"
                className="w-full h-11 pl-9 pr-3 rounded-lg border border-border bg-surface text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow placeholder:text-muted"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 sm:flex-none h-11 px-5 rounded-lg bg-primary text-primary-fg font-medium shadow-card hover:brightness-110 active:brightness-95 transition-[filter,transform] active:translate-y-px"
              >
                Guess
              </button>
              <button
                type="button"
                onClick={useHint}
                title="Reveal a mid-ranked word"
                className="h-11 px-3.5 rounded-lg border border-border bg-surface text-fg-soft font-medium hover:text-fg hover:border-border-strong transition-colors"
              >
                Hint
              </button>
              <button
                type="button"
                onClick={giveUp}
                title="Give up and reveal the answer"
                className="h-11 px-3.5 rounded-lg border border-border bg-surface text-fg-soft font-medium hover:text-fg hover:border-border-strong transition-colors"
              >
                Give up
              </button>
            </div>
          </div>
          <div className="mt-2 h-5 flex items-center gap-3 text-xs text-muted">
            <span className="tabular">
              {guesses.length} guess{guesses.length === 1 ? '' : 'es'}
            </span>
            {hintsUsed > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-border-strong" />
                <span className="tabular">
                  {hintsUsed} hint{hintsUsed === 1 ? '' : 's'}
                </span>
              </>
            )}
            {error && (
              <span className="ml-auto text-red-600 dark:text-red-400 animate-in">
                {error}
              </span>
            )}
          </div>
        </form>
      )}

      {gameOver && (
        <WinBanner
          puzzle={puzzle}
          won={won}
          guesses={guesses}
          hintsUsed={hintsUsed}
          gaveUp={gaveUp}
        />
      )}

      {bestGuess && !gameOver && (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5 px-1">
            Best so far
          </div>
          <GuessRow guess={bestGuess} highlighted />
        </div>
      )}

      {sorted.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
              Guesses
            </div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
              Score
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-card">
            <ul className="divide-y divide-border">
              {sorted.map((g) => (
                <li key={g.order}>
                  <GuessRow guess={g} recent={g.word === lastAdded} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {guesses.length === 0 && !gameOver && (
        <div className="mt-8 rounded-xl border border-dashed border-border-strong px-6 py-10 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">🩺</div>
          <p className="text-fg font-medium">Make your first guess</p>
          <p className="text-muted text-sm mt-1">
            Try a general term like <span className="text-fg-soft">infection</span>{' '}
            or <span className="text-fg-soft">tumor</span> to gauge the field.
          </p>
        </div>
      )}
    </div>
  );
}

function GuessRow({
  guess,
  highlighted,
  recent,
}: {
  guess: Guess;
  highlighted?: boolean;
  recent?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, guess.score));
  const isWinner = guess.rank === 1;
  const barClass = isWinner
    ? 'from-hot/25 to-hot/10'
    : guess.rank
      ? 'from-warm/25 to-warm/5'
      : 'from-cold/60 to-cold/20';
  const rankBadge = isWinner
    ? 'bg-hot text-white'
    : guess.rank
      ? 'bg-warm/15 text-warm dark:text-warm'
      : 'bg-surface-2 text-muted';

  return (
    <div
      className={[
        'group relative flex items-center h-12 px-3',
        highlighted
          ? 'rounded-xl border border-border bg-surface shadow-card'
          : '',
        recent ? 'animate-in' : '',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barClass} rounded-r-md transition-[width] duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex-1 flex items-center justify-between text-sm gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`tabular inline-flex items-center justify-center h-6 min-w-[2rem] px-1.5 rounded-md text-[11px] font-semibold ${rankBadge}`}
          >
            {guess.rank ? guess.rank : '—'}
          </span>
          <span className="truncate font-medium text-fg">
            {guess.word}
            {guess.isHint && (
              <span className="ml-1.5 align-middle text-[10px] uppercase tracking-wider text-hint font-semibold">
                hint
              </span>
            )}
          </span>
        </div>
        <span className="tabular text-fg-soft font-medium">
          {guess.score.toFixed(1)}
        </span>
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
}: {
  puzzle: Puzzle;
  won: boolean;
  guesses: Guess[];
  hintsUsed: number;
  gaveUp: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const stats = loadStats();
  const share = () => {
    const s = buildShareString(
      { date: puzzle.date, guesses, hintsUsed, gaveUp, won },
      puzzle.num,
    );
    navigator.clipboard.writeText(s).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-elevated animate-in">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted mb-1.5">
        {won ? (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-hot" />
            <span>Solved</span>
          </>
        ) : (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-warm" />
            <span>Revealed</span>
          </>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-semibold tracking-tight mb-1">
        {won
          ? `Solved in ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`
          : 'Answer revealed'}
      </div>
      <div className="text-sm text-muted mb-5">
        The diagnosis was{' '}
        <span className="font-semibold text-fg">{puzzle.secret}</span>
        {hintsUsed > 0 && (
          <>
            {' '}
            · {hintsUsed} hint{hintsUsed === 1 ? '' : 's'} used
          </>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-5">
        <Stat label="Played" value={stats.played} />
        <Stat
          label="Win %"
          value={stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}
        />
        <Stat label="Streak" value={stats.currentStreak} />
        <Stat label="Max" value={stats.maxStreak} />
      </div>
      <button
        onClick={share}
        className="w-full h-11 rounded-lg bg-primary text-primary-fg font-medium shadow-card hover:brightness-110 active:brightness-95 transition-[filter,transform] active:translate-y-px"
      >
        {copied ? 'Copied to clipboard' : 'Share result'}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2.5 text-center">
      <div className="tabular text-lg sm:text-xl font-semibold text-fg leading-none">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted mt-1.5">
        {label}
      </div>
    </div>
  );
}

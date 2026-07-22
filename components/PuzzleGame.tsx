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
      <p className="text-fg leading-relaxed mb-3">
        Today is puzzle <span className="font-semibold">#{puzzle.num}</span>. Guess
        medical terms. The closer you get to the secret diagnosis, the higher your
        score will be. Guess the secret word to win.
      </p>
      <p className="text-fg leading-relaxed mb-6">
        <span className="font-semibold">Prompt:</span> {puzzle.prompt}
      </p>

      {!gameOver && (
        <form onSubmit={onSubmit} className="mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a guess"
              className="flex-1 min-w-0 h-11 border border-border rounded-lg px-3.5 text-base bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow placeholder:text-muted"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 sm:flex-none h-11 px-5 rounded-lg bg-primary text-white font-medium shadow-card hover:brightness-110 active:brightness-95 active:translate-y-px transition-[filter,transform]"
              >
                Guess
              </button>
              <button
                type="button"
                onClick={useHint}
                className="h-11 px-4 rounded-lg bg-hint text-white font-medium shadow-card hover:brightness-110 active:brightness-95 active:translate-y-px transition-[filter,transform]"
              >
                Hint
              </button>
              <button
                type="button"
                onClick={giveUp}
                className="h-11 px-4 rounded-lg bg-danger text-white font-medium shadow-card hover:brightness-110 active:brightness-95 active:translate-y-px transition-[filter,transform]"
              >
                Give Up
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
              <span className="ml-auto text-red-600 animate-in">{error}</span>
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
          <div className="rounded-xl border border-border bg-white shadow-card overflow-hidden">
            <GuessRow guess={bestGuess} />
          </div>
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
          <div className="rounded-xl border border-border bg-white overflow-hidden shadow-card">
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
        <p className="text-muted text-sm mt-6 text-center">
          Enter your first guess to start.
        </p>
      )}
    </div>
  );
}

function GuessRow({ guess, recent }: { guess: Guess; recent?: boolean }) {
  const pct = Math.max(0, Math.min(100, guess.score));
  const isWinner = guess.rank === 1;
  const barClass = isWinner
    ? 'from-hot/40 to-hot/15'
    : guess.rank
      ? 'from-warm/35 to-warm/10'
      : 'from-cold/70 to-cold/30';
  const rankBadge = isWinner
    ? 'bg-hot text-white'
    : guess.rank
      ? 'bg-warm/15 text-[rgb(var(--warm))]'
      : 'bg-surface-2 text-muted';

  return (
    <div
      className={[
        'relative flex items-center h-12 px-3',
        recent ? 'animate-in' : '',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barClass} transition-[width] duration-500 ease-out`}
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
        <span className="tabular text-fg font-medium">
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
    <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-card animate-in">
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
      <div className="text-lg font-semibold mb-1">
        {won
          ? `Solved in ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`
          : 'Answer revealed'}
      </div>
      <div className="text-sm text-muted mb-4">
        The diagnosis was{' '}
        <span className="font-semibold text-fg">{puzzle.secret}</span>
        {hintsUsed > 0 && (
          <>
            {' '}
            · {hintsUsed} hint{hintsUsed === 1 ? '' : 's'} used
          </>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
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
        className="w-full h-11 rounded-lg bg-primary text-white font-medium shadow-card hover:brightness-110 active:brightness-95 active:translate-y-px transition-[filter,transform]"
      >
        {copied ? 'Copied to clipboard' : 'Share result'}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2.5 text-center">
      <div className="tabular text-lg font-semibold text-fg leading-none">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted mt-1.5">
        {label}
      </div>
    </div>
  );
}

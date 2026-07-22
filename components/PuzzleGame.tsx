'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Guess, Puzzle } from '@/lib/types';
import { decodeScores, normalizeGuess, scoreFromStored } from '@/lib/scores';
import { loadGame, saveGame, recordCompletion, loadStats } from '@/lib/storage';
import { buildShareString } from '@/lib/share';
import ShareMenu from './ShareMenu';

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

  const dateLabel = formatDate(puzzle.date);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 pb-3 mb-6 border-b border-border">
        <div className="flex items-baseline gap-3">
          <span className="text-eyebrow uppercase text-muted font-semibold">
            Puzzle
          </span>
          <span className="tabular text-title-lg font-semibold text-fg leading-none">
            No.&nbsp;{puzzle.num}
          </span>
        </div>
        <span className="tabular text-caption text-muted">{dateLabel}</span>
      </div>

      <p className="text-lede text-fg-soft mb-6">
        The nearest diagnosis has a SimScore of{' '}
        <span className="font-medium text-fg tabular">
          {nearestScore.toFixed(3)}
        </span>{' '}
        and the thousandth nearest is{' '}
        <span className="font-medium text-fg tabular">
          {thousandthScore.toFixed(3)}
        </span>
        . There are{' '}
        <span className="tabular text-fg font-medium">
          {vocabSize.toLocaleString()}
        </span>{' '}
        diagnoses in the vocabulary.
      </p>

      <figure className="mb-8 pl-4 border-l-2 border-fg">
        <figcaption className="text-eyebrow uppercase text-muted font-semibold mb-1.5">
          Prompt
        </figcaption>
        <blockquote className="text-body text-fg leading-relaxed">
          {puzzle.prompt}
        </blockquote>
      </figure>

      {!gameOver && (
        <form onSubmit={onSubmit} className="mb-2">
          <div className="flex items-stretch rounded-md border border-border-strong bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a guess"
              className="flex-1 min-w-0 h-12 px-4 text-body bg-transparent outline-none placeholder:text-muted"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-r-[5px] bg-primary text-white text-ui font-medium hover:brightness-110 active:brightness-95 transition-[filter]"
            >
              Guess
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={useHint}
              className="text-eyebrow uppercase font-semibold text-muted hover:text-hint transition-colors"
            >
              Hint
            </button>
            <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
            <button
              type="button"
              onClick={giveUp}
              className="text-eyebrow uppercase font-semibold text-muted hover:text-danger transition-colors"
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
            <div className="mt-2 text-caption text-red-600 animate-in">
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
        />
      )}

      {sorted.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-eyebrow uppercase text-muted font-semibold">
              Your guesses
            </h2>
            {bestGuess && !gameOver && (
              <span className="text-eyebrow uppercase text-muted font-semibold">
                Best so far
              </span>
            )}
          </div>
          <GuessTableHeader />
          {bestGuess && !gameOver && (
            <>
              <GuessRow guess={bestGuess} isBest />
              <div className="h-px bg-fg/70 my-1" />
            </>
          )}
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
        <div className="mt-10 py-10 border border-dashed border-border rounded-md text-center">
          <p className="text-body text-fg font-medium">Make your first guess</p>
          <p className="text-caption text-muted mt-1">
            Try a broad term to see which region of medicine we&rsquo;re in.
          </p>
        </div>
      )}
    </div>
  );
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

function GuessTableHeader() {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_5rem_6rem] sm:grid-cols-[3rem_1fr_6rem_8rem] gap-3 px-1 pb-2.5 border-b border-fg/70 text-eyebrow uppercase text-muted font-semibold">
      <div>#</div>
      <div>Guess</div>
      <div className="text-right">SimScore</div>
      <div className="text-right">Closeness</div>
    </div>
  );
}

function GuessRow({
  guess,
  isBest,
  recent,
}: {
  guess: Guess;
  isBest?: boolean;
  recent?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, guess.score));
  const inTop = guess.rank !== null;
  const percentile = inTop ? Math.max(0, 1000 - guess.rank!) / 10 : 0;

  const percentileFillColor = guess.rank === 1
    ? 'bg-hot'
    : inTop
      ? 'bg-warm'
      : 'bg-border-strong';

  return (
    <div
      className={[
        'group grid grid-cols-[2.5rem_1fr_5rem_6rem] sm:grid-cols-[3rem_1fr_6rem_8rem] gap-3 items-center px-1 py-2.5 border-b border-border text-ui hover:bg-surface-2/60 transition-colors',
        recent ? 'animate-in' : '',
      ].join(' ')}
    >
      <div className="tabular text-muted">{guess.rank ?? '—'}</div>
      <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
        <span
          className={[
            'font-medium truncate max-w-full',
            isBest ? 'text-link' : 'text-fg',
          ].join(' ')}
        >
          {guess.word}
        </span>
        {guess.isHint && (
          <span className="text-eyebrow uppercase text-hint font-semibold">
            hint
          </span>
        )}
      </div>
      <div className="tabular text-fg text-right font-medium">
        {guess.score.toFixed(3)}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <div
          className="relative h-1.5 w-14 sm:w-24 rounded-full bg-surface-2 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${percentileFillColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tabular text-caption text-muted min-w-[3rem] text-right">
          {inTop ? `${percentile.toFixed(1)}` : '—'}
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
  const stats = loadStats();
  const shareText = buildShareString(
    { date: puzzle.date, guesses, hintsUsed, gaveUp, won },
    puzzle.num,
  );

  return (
    <div className="mt-4 mb-8 rounded-md border border-border bg-white p-6 sm:p-7 shadow-card animate-in">
      <div className="flex items-center gap-2 text-eyebrow uppercase text-muted mb-3 font-semibold">
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
      <div className="text-title-lg font-semibold text-fg tracking-tight mb-2">
        {won
          ? `Solved in ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`
          : 'Answer revealed'}
      </div>
      <div className="text-body text-muted mb-6">
        The diagnosis was{' '}
        <span className="font-semibold text-fg">{puzzle.secret}</span>
        {hintsUsed > 0 && (
          <>
            {' '}
            · {hintsUsed} hint{hintsUsed === 1 ? '' : 's'} used
          </>
        )}
      </div>
      <div className="grid grid-cols-4 divide-x divide-border border-y border-border mb-6">
        <Stat label="Played" value={stats.played} />
        <Stat
          label="Win %"
          value={stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}
        />
        <Stat label="Streak" value={stats.currentStreak} />
        <Stat label="Max" value={stats.maxStreak} />
      </div>
      <ShareMenu text={shareText} title={`Clinicle #${puzzle.num}`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="tabular text-title font-semibold text-fg leading-none">
        {value}
      </div>
      <div className="text-eyebrow uppercase text-muted mt-2 font-semibold">
        {label}
      </div>
    </div>
  );
}

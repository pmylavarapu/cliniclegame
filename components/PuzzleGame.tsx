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

  return (
    <div>
      <p className="text-fg leading-relaxed mb-4">
        Today is puzzle <span className="font-bold">#{puzzle.num}</span>. The
        nearest diagnosis has a SimScore of{' '}
        <span className="font-bold tabular">{nearestScore.toFixed(3)}</span> and
        the thousandth nearest has a SimScore of{' '}
        <span className="font-bold tabular">{thousandthScore.toFixed(3)}</span>.
        There are <span className="tabular">{vocabSize.toLocaleString()}</span>{' '}
        diagnoses in the vocabulary.
      </p>
      <p className="text-fg leading-relaxed mb-6">
        <span className="font-bold">Prompt:</span> {puzzle.prompt}
      </p>

      {!gameOver && (
        <form onSubmit={onSubmit} className="mb-2">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a guess"
              className="flex-1 min-w-0 h-12 border border-border-strong rounded-md px-4 text-base bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow placeholder:text-muted"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="h-12 px-8 rounded-md bg-primary text-white text-base font-semibold shadow-card hover:brightness-110 active:brightness-95 active:translate-y-px transition-[filter,transform]"
            >
              Guess
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={useHint}
              className="h-8 px-3 rounded-md border border-border text-fg-soft hover:text-hint hover:border-hint/40 hover:bg-hint/5 transition-colors font-semibold uppercase tracking-wide"
            >
              Hint
            </button>
            <button
              type="button"
              onClick={giveUp}
              className="h-8 px-3 rounded-md border border-border text-fg-soft hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-colors font-semibold uppercase tracking-wide"
            >
              Give up
            </button>
            <span className="ml-auto text-muted tabular">
              {guesses.length} guess{guesses.length === 1 ? '' : 'es'}
              {hintsUsed > 0 && ` · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}`}
            </span>
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600 animate-in">{error}</div>
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
        <div className="mt-8">
          <GuessTableHeader />
          {bestGuess && !gameOver && (
            <>
              <GuessRow guess={bestGuess} isBest />
              <div className="border-b border-border my-1" />
            </>
          )}
          {sorted.map((g) => (
            <GuessRow
              key={g.order}
              guess={g}
              recent={g.word === lastAdded}
            />
          ))}
        </div>
      )}

      {guesses.length === 0 && !gameOver && (
        <p className="text-muted text-sm mt-10 text-center">
          Enter your first guess to start.
        </p>
      )}
    </div>
  );
}

function GuessTableHeader() {
  return (
    <div className="grid grid-cols-[3rem_1fr_5.5rem_7.5rem] sm:grid-cols-[3rem_1fr_6rem_9rem] gap-3 px-1 pb-2 border-b border-border text-fg font-bold text-sm">
      <div>#</div>
      <div>Guess</div>
      <div className="text-right">SimScore</div>
      <div>Closeness</div>
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
  const percentile = inTop
    ? Math.max(0, 1000 - guess.rank!) / 10
    : 0;
  const percentileLabel = inTop ? `${percentile.toFixed(1)}th percentile` : 'cold';

  const barColor = guess.rank === 1
    ? 'bg-hot'
    : inTop
      ? 'bg-warm'
      : 'bg-cold';
  const barBg = 'bg-surface-2';

  return (
    <div
      className={[
        'grid grid-cols-[3rem_1fr_5.5rem_7.5rem] sm:grid-cols-[3rem_1fr_6rem_9rem] gap-3 items-center px-1 py-2.5 border-b border-border text-sm',
        recent ? 'animate-in' : '',
      ].join(' ')}
    >
      <div className="tabular text-fg-soft">{guess.rank ?? '—'}</div>
      <div className="min-w-0">
        <span
          className={[
            'font-semibold truncate inline-block max-w-full align-middle',
            isBest ? 'text-link' : 'text-fg',
          ].join(' ')}
        >
          {guess.word}
        </span>
        {guess.isHint && (
          <span className="ml-1.5 align-middle text-[10px] uppercase tracking-wider text-hint font-bold">
            hint
          </span>
        )}
      </div>
      <div className="tabular text-fg text-right font-semibold">
        {guess.score.toFixed(3)}
      </div>
      <div>
        <div
          className={`relative h-6 rounded border ${
            inTop ? 'border-closeness/40' : 'border-border'
          } ${barBg} overflow-hidden`}
          title={percentileLabel}
        >
          <div
            aria-hidden="true"
            className={`absolute inset-y-0 left-0 ${barColor} opacity-70`}
            style={{ width: `${pct}%` }}
          />
          <div className="relative h-full flex items-center justify-center text-[10px] tabular font-semibold text-closeness">
            {percentileLabel}
          </div>
        </div>
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
    <div className="mt-4 mb-8 rounded-md border border-border bg-white p-5 shadow-card animate-in">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
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
      <div className="text-lg font-bold mb-1">
        {won
          ? `Solved in ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`
          : 'Answer revealed'}
      </div>
      <div className="text-sm text-muted mb-4">
        The diagnosis was{' '}
        <span className="font-bold text-fg">{puzzle.secret}</span>
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
        className="w-full h-11 rounded-md bg-primary text-white font-semibold shadow-card hover:brightness-110 active:brightness-95 active:translate-y-px transition-[filter,transform]"
      >
        {copied ? 'Copied to clipboard' : 'Share result'}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-surface-2 px-2 py-2.5 text-center">
      <div className="tabular text-lg font-bold text-fg leading-none">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted mt-1.5 font-semibold">
        {label}
      </div>
    </div>
  );
}

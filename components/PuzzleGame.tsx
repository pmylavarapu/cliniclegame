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
    const bestRank = guesses.reduce((min, g) => (g.rank && g.rank < min ? g.rank : min), Infinity);
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
        const g: Guess = { word: secret, score: top.score, rank: top.rank, isHint: false, order: guesses.length + 1 };
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
        Today is puzzle <span className="font-semibold">#{puzzle.num}</span>. Guess medical terms. The closer you get to the secret diagnosis, the higher your score will be. Guess the secret word to win.
      </p>
      <p className="text-fg leading-relaxed mb-6">
        <span className="font-semibold">Prompt:</span> {puzzle.prompt}
      </p>

      {!gameOver && (
        <form onSubmit={onSubmit} className="flex gap-2 mb-4">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a guess"
            className="flex-1 min-w-0 border border-border rounded px-3 py-2 text-base outline-none focus:border-primary"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button type="submit" className="px-4 py-2 rounded bg-primary text-white font-medium hover:opacity-90 transition-opacity">Guess</button>
          <button type="button" onClick={useHint} className="px-4 py-2 rounded bg-hint text-white font-medium hover:opacity-90 transition-opacity">Hint</button>
          <button type="button" onClick={giveUp} className="px-4 py-2 rounded bg-danger text-white font-medium hover:opacity-90 transition-opacity">Give Up</button>
        </form>
      )}

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      {gameOver && <WinBanner puzzle={puzzle} won={won} guesses={guesses} hintsUsed={hintsUsed} gaveUp={gaveUp} />}

      {bestGuess && !gameOver && <GuessRow guess={bestGuess} highlighted />}

      <div className="mt-2 divide-y divide-border border-t border-b border-border">
        {sorted.map((g) => (
          <GuessRow key={g.order} guess={g} recent={g.word === lastAdded} />
        ))}
      </div>

      {guesses.length === 0 && !gameOver && (
        <p className="text-muted text-sm mt-6 text-center">Enter your first guess to start.</p>
      )}
    </div>
  );
}

function GuessRow({ guess, highlighted, recent }: { guess: Guess; highlighted?: boolean; recent?: boolean }) {
  const pct = Math.max(0, Math.min(100, guess.score));
  const barColor =
    guess.rank === 1 ? 'bg-hot' : guess.rank ? 'bg-warm' : 'bg-cold';
  const label = guess.rank ? `${guess.rank}.` : '';
  return (
    <div className={`relative flex items-center h-11 px-3 ${highlighted ? 'border-y border-border bg-white' : ''} ${recent ? 'ring-1 ring-primary/40' : ''}`}>
      <div className={`absolute inset-y-0 left-0 ${barColor} opacity-90`} style={{ width: `${pct}%` }} />
      <div className="relative flex-1 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 min-w-0">
          {label && <span className="tabular text-fg font-medium min-w-[2.25rem]">{label}</span>}
          <span className="truncate font-medium">
            {guess.word}
            {guess.isHint && <span className="ml-1 text-xs text-hint">(hint)</span>}
          </span>
        </div>
        <span className="tabular text-fg font-medium">{guess.score.toFixed(1)}</span>
      </div>
    </div>
  );
}

function WinBanner({ puzzle, won, guesses, hintsUsed, gaveUp }: { puzzle: Puzzle; won: boolean; guesses: Guess[]; hintsUsed: number; gaveUp: boolean }) {
  const [copied, setCopied] = useState(false);
  const stats = loadStats();
  const share = () => {
    const s = buildShareString({ date: puzzle.date, guesses, hintsUsed, gaveUp, won }, puzzle.num);
    navigator.clipboard.writeText(s).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="mb-6 rounded-lg border border-border p-4 bg-white">
      <div className="text-lg font-semibold mb-1">
        {won ? `Solved in ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}` : 'Answer revealed'}
      </div>
      <div className="text-sm text-muted mb-3">
        The diagnosis was <span className="font-semibold text-fg">{puzzle.secret}</span>
        {hintsUsed > 0 && <> · {hintsUsed} hint{hintsUsed === 1 ? '' : 's'} used</>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center mb-4">
        <Stat label="Played" value={stats.played} />
        <Stat label="Win %" value={stats.played ? Math.round((stats.wins / stats.played) * 100) : 0} />
        <Stat label="Streak" value={stats.currentStreak} />
        <Stat label="Max streak" value={stats.maxStreak} />
      </div>
      <button onClick={share} className="w-full py-2 rounded bg-primary text-white font-medium hover:opacity-90 transition-opacity">
        {copied ? 'Copied!' : 'Share result'}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="tabular text-xl font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

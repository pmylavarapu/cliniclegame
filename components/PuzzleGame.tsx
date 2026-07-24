'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Guess, Puzzle } from '@/lib/types';
import {
  decodeScores,
  normalizeGuess,
  pluralVariants,
  scoreFromStored,
} from '@/lib/scores';
import {
  loadGame,
  saveGame,
  recordCompletion,
  loadStats,
  fastestSolveMs,
} from '@/lib/storage';
import { buildShareString } from '@/lib/share';

import { checkNewlyUnlocked, type Achievement } from '@/lib/achievements';
import { recordGuess, recordSolveStats } from '@/lib/adminStats';
import {
  computePercentile,
  fetchDistribution,
  leaderboardEnabled,
  recordSolve,
} from '@/lib/leaderboard';
import ShareMenu from './ShareMenu';
import GuessDistribution from './GuessDistribution';
import NextPuzzleCountdown from './NextPuzzleCountdown';
import AchievementToast from './AchievementToast';

type Props = {
  puzzle: Puzzle;
  vocab: string[];
  /**
   * Optional abbreviation → canonical full-form map. When a user's guess
   * matches a key here (case-normalized), the guess is silently rewritten
   * to the full form before scoring so PE = pulmonary embolism, etc.
   */
  aliases?: Record<string, string>;
  /**
   * Curated-only vocabulary pool used for autocorrect suggestions.
   * Prevents autocorrect from suggesting fragments like 'thromb' or
   * eponym stubs like 'calot'. Falls back to full vocab if absent.
   */
  cleanVocab?: string[];
};

export default function PuzzleGame({
  puzzle,
  vocab,
  aliases = {},
  cleanVocab,
}: Props) {
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

  // word -> Set of near-synonym words. Direct pairs only, so the check
  // stays symmetric without transitive chaining.
  const synonymsOf = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [w, ns] of Object.entries(puzzle.synonyms ?? {})) {
      m.set(w, new Set(ns));
    }
    return m;
  }, [puzzle]);

  const scores = useMemo(() => decodeScores(puzzle.scores), [puzzle]);

  // Rank-based percentile within the top-1000:
  //   rank 1    → 100  (perfect)
  //   rank 1000 → 10   (edge of the neighborhood)
  //   below top → null → rendered as "<10"
  // Rescales the whole vocab into a scale where "you're in the ballpark" =
  // 10%+ and unrelated words are "<10", instead of pretending vocab
  // percentile is meaningful when Gemini's baseline puts everything above
  // the 80th percentile.
  const percentileForRank = (rank: number | null): number | null => {
    if (rank == null || rank < 1) return null;
    if (rank > 1000) return null;
    return 100 - ((rank - 1) * 90) / 999;
  };

  const rank10Score = puzzle.top1000[9]?.[1] ?? 0;
  const rank1000Score = puzzle.top1000[999]?.[1] ?? 0;

  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [won, setWon] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finalTimeMs, setFinalTimeMs] = useState<number | undefined>(undefined);
  const [freshAchievements, setFreshAchievements] = useState<Achievement[]>([]);
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
      const nextStats = recordCompletion(
        puzzle.date,
        guesses.length,
        hintsUsed,
        won,
        gaveUp,
        t,
      );
      // Only surface achievement toasts for real wins, not give-ups.
      if (won) {
        const gs = {
          date: puzzle.date,
          guesses,
          hintsUsed,
          gaveUp,
          won,
          timeMs: t,
        };
        const fresh = checkNewlyUnlocked(gs, nextStats);
        if (fresh.length) setFreshAchievements(fresh);
        recordSolveStats(puzzle.date, guesses.length, t ?? 0);
      }
    }
  }, [gameOver, puzzle.date, guesses, hintsUsed, won, gaveUp, startedAt, finalTimeMs]);

  const submitGuess = (raw: string, isHint = false) => {
    setError(null);
    setSuggestion(null);
    let w = normalizeGuess(raw);
    if (!w) return;
    // Transparent abbreviation expansion: user types 'pe', 'lad', 'itp'
    // and it becomes the full-form vocab entry silently.
    const expansion = aliases[w];
    if (expansion) w = expansion;
    if (guesses.some((g) => g.word === w)) {
      setError(`Already guessed "${w}"`);
      flashInput();
      return;
    }
    let idx = vocabIndex.get(w);
    // If the exact form isn't in vocab, silently try plural/singular
    // variants ('varicose vein' → 'varicose veins', 'hearts' → 'heart')
    // before falling through to the autocorrect suggestion.
    if (idx === undefined) {
      for (const alt of pluralVariants(w)) {
        const j = vocabIndex.get(alt);
        if (j !== undefined) {
          if (guesses.some((g) => g.word === alt)) {
            setError(`Already guessed "${alt}"`);
            flashInput();
            return;
          }
          w = alt;
          idx = j;
          break;
        }
      }
    }
    if (idx === undefined) {
      const near = nearestVocabWord(w, cleanVocab ?? vocab);
      if (near) setSuggestion(near);
      setError(`"${w}" is not in the vocabulary`);
      flashInput();
      return;
    }
    // Semantic dedup: if this word is a near-synonym of a prior guess,
    // block and tell the user which one it collides with. Symmetric check.
    if (!isHint) {
      const mine = synonymsOf.get(w);
      const prior = guesses.find((g) => {
        if (mine?.has(g.word)) return true;
        const theirs = synonymsOf.get(g.word);
        return theirs?.has(w) ?? false;
      });
      if (prior) {
        setError(`"${w}" means the same as "${prior.word}" – try something else`);
        flashInput();
        return;
      }
    }
    const top = topMap.get(w);
    const score = top ? top.score : scoreFromStored(scores[idx] ?? 0);
    const rank = top ? top.rank : null;
    const g: Guess = { word: w, score, rank, isHint, order: guesses.length + 1 };
    const next = [...guesses, g];
    setGuesses(next);
    setLastAdded(w);
    setInput('');
    if (!isHint) recordGuess(puzzle.date);
    if (rank === 1) setWon(true);
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    const s = suggestion;
    setInput(s);
    setSuggestion(null);
    setError(null);
    submitGuess(s);
  };

  const flashInput = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const useHint = () => {
    if (gameOver) return;
    // Prefer the curated hint pool (excludes obscure Latin fragments like
    // 'valgus', 'venular') and fall back to the full top-1000 if a puzzle
    // doesn't ship one.
    const pool: [string, number, number][] =
      puzzle.hints && puzzle.hints.length
        ? puzzle.hints
        : puzzle.top1000.map(([w, s], i) => [w, s, i + 1]);
    const bestRank = guesses.reduce(
      (min, g) => (g.rank && g.rank < min ? g.rank : min),
      Infinity,
    );
    const targetRank = Math.max(
      1,
      bestRank === Infinity ? 300 : Math.floor(bestRank / 2),
    );
    // Walk the pool from the entry closest to (and no greater than)
    // targetRank downward toward rank 1 until we find something ungessed.
    let startIdx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i][2] > targetRank) {
        startIdx = i - 1;
        break;
      }
    }
    if (startIdx < 0) startIdx = 0;
    for (let i = startIdx; i >= 0; i--) {
      const w = pool[i][0];
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
  const displayPuzzleNum = puzzleNumberFromDate(puzzle.date);

  return (
    <div>
      <p className="mb-2 text-body sm:text-title-sm text-fg font-bold">
        Today is puzzle #{String(displayPuzzleNum).padStart(3, '0')}.
      </p>
      <p className="mb-5 sm:mb-6 text-caption sm:text-body text-muted leading-relaxed">
        Guess medical terms. The closer you get to the secret diagnosis,
        the higher your score will be. Guess the secret word to win.
      </p>
      <div className="mb-6 border border-border-strong p-4 sm:p-7">
        <div className="text-eyebrow uppercase text-muted font-semibold tracking-[0.1em] mb-4">
          Prompt
        </div>
        <p className="text-lede sm:text-title-md text-fg leading-[1.55]">
          {puzzle.prompt}
        </p>
      </div>

      {!gameOver && (
        <form onSubmit={onSubmit} className="mb-4">
          <div className="flex items-stretch flex-wrap gap-3">
            <div className="basis-full sm:basis-0 flex-1 min-w-0 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter a guess"
                className="w-full h-12 px-4 text-base  bg-white border border-border-strong outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 transition-all placeholder:text-muted"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="send"
              />
            </div>
            <button
              type="submit"
              className="flex-[2] sm:flex-none sm:min-w-[12rem] h-12 px-10 bg-fg text-white text-ui font-semibold uppercase tracking-wider hover:bg-fg/90 active:scale-[0.98] transition-[transform,background]"
            >
              Guess
            </button>
            <button
              type="button"
              onClick={useHint}
              className="flex-1 sm:flex-none sm:min-w-[6rem] h-12 px-4 bg-white text-fg text-ui font-semibold uppercase tracking-wider border border-border-strong hover:bg-surface-2 active:scale-[0.98] transition-[transform,background]"
            >
              Hint
            </button>
            <button
              type="button"
              onClick={giveUp}
              className="flex-1 sm:flex-none sm:min-w-[6rem] h-12 px-4 bg-white text-fg text-ui font-semibold uppercase tracking-wider border border-border-strong hover:bg-surface-2 active:scale-[0.98] transition-[transform,background]"
            >
              Give Up
            </button>
          </div>
          {guesses.length > 0 && (
            <div className="mt-2 text-right">
              <span className="text-caption text-muted tabular">
                {guesses.length} guess{guesses.length === 1 ? '' : 'es'}
                {hintsUsed > 0 &&
                  ` · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}`}
              </span>
            </div>
          )}
          {error && (
            <div className="mt-3 text-caption text-red-600 font-medium animate-in">
              {error}
              {suggestion && (
                <>
                  {' '}
                  Did you mean{' '}
                  <button
                    type="button"
                    onClick={acceptSuggestion}
                    className="underline underline-offset-2 font-bold text-primary hover:text-primary/80"
                  >
                    {suggestion}
                  </button>
                  ?
                </>
              )}
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

      {freshAchievements.length > 0 && (
        <AchievementToast
          achievements={freshAchievements}
          onDismiss={() => setFreshAchievements([])}
        />
      )}

      {sorted.length > 0 && (
        <section className="mt-8 sm:mt-10">
          {currentGuess && !gameOver && (
            <div className="mb-6 sm:mb-12">
              <div className="text-eyebrow uppercase text-muted font-bold mb-2">
                Your last guess
              </div>
              <GuessRow
                guess={currentGuess}
                isCurrent
                percentile={percentileForRank(currentGuess.rank)}
              />
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
              percentile={percentileForRank(g.rank)}
            />
          ))}
        </section>
      )}

      {guesses.length === 0 && !gameOver && (
        <div className="mt-6 py-5 px-4 sm:px-6  bg-surface-2 flex items-start gap-4">
          <div className="shrink-0 h-10 w-10 rounded-full bg-white flex items-center justify-center text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c1 .8 1.5 1.6 2 3.3h4c.5-1.7 1-2.5 2-3.3A7 7 0 0 0 12 2Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-body text-fg font-bold">Make your first guess</p>
            <p className="text-caption text-muted mt-1">
              Try something broad — an organ, a symptom, a body system.
            </p>
            <p className="text-caption text-muted mt-1">
              Closer meanings score higher —{' '}
              <span className="font-semibold text-fg">heart attack</span>{' '}
              scores near{' '}
              <span className="font-semibold text-fg">cardiomyopathy</span>, but
              far from <span className="font-semibold text-fg">arthritis</span>. Rank 1 wins.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Return the vocab word closest to `w` by Levenshtein distance, if it's
// close enough to plausibly be a typo. Two-pass: cheap length + first-letter
// prefilter, then full DP on the survivors. Threshold scales with length so
// short words don't match anything.
function nearestVocabWord(w: string, vocab: string[]): string | null {
  const n = w.length;
  if (n < 3) return null;
  const maxDist = n >= 6 ? 2 : 1;
  const first = w[0];
  let best: string | null = null;
  let bestDist = maxDist + 1;
  for (const v of vocab) {
    if (Math.abs(v.length - n) > maxDist) continue;
    if (v[0] !== first) continue;
    // Skip fragment-style suggestions: a strict prefix of the input
    // (e.g. 'thromb' when the user typed 'thrombus') is almost always
    // a broken combining-form, not a helpful autocorrect.
    if (v.length < n && w.startsWith(v)) continue;
    const d = levenshtein(w, v, bestDist);
    if (d < bestDist) {
      bestDist = d;
      best = v;
      if (d === 1) break;
    }
  }
  return bestDist <= maxDist ? best : null;
}

// Levenshtein with an early-exit cap. Returns cap+1 (or higher) when the
// true distance exceeds cap – callers only need to know "close enough".
function levenshtein(a: string, b: string, cap: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > cap) return cap + 1;
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

function difficultyLabel(value: number): string {
  const clamped = Math.max(1, Math.min(5, value));
  // 1-2 = Easy, 3 = Medium, 4-5 = Hard.
  return clamped <= 2 ? 'Easy' : clamped === 3 ? 'Medium' : 'Hard';
}

function difficultyColor(value: number): string {
  const clamped = Math.max(1, Math.min(5, value));
  // Green for easy, orange for medium, red for hard.
  if (clamped <= 2) return 'text-hot';
  if (clamped === 3) return 'text-warm';
  return 'text-red-500';
}

function DifficultyStars({ value }: { value: number }) {
  const clamped = Math.max(1, Math.min(5, value));
  const color = difficultyColor(clamped);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Difficulty ${clamped} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={
            n <= clamped
              ? `${color} text-[13px] leading-none`
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

// Puzzle #1 = 2026-07-24 (day the new schedule launched)
function puzzleNumberFromDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const puzzleDate = Date.UTC(y, m - 1, d);
  const epoch = Date.UTC(2026, 6, 24);
  const days = Math.round((puzzleDate - epoch) / 86_400_000);
  return Math.max(1, days + 1);
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
  'grid grid-cols-[2.5rem_1fr_3.25rem_3rem] sm:grid-cols-[4rem_1fr_4rem_4.5rem] gap-1.5 sm:gap-3 items-center';

function GuessTableHeader() {
  return (
    <div
      className={`${ROW_GRID} px-3 sm:px-4 pb-2 text-eyebrow uppercase text-muted font-bold`}
    >
      <div>Rank</div>
      <div>Guess</div>
      <div className="text-right">Sim Score</div>
      <div className="text-right">%tile</div>
    </div>
  );
}

function ReferenceBar({
  rank10,
  rank1000,
}: {
  rank10: number;
  rank1000: number;
}) {
  return (
    <p className="mt-3 text-caption text-muted leading-relaxed">
      For reference, the 10th closest word has a similarity score of{' '}
      <span className="tabular font-semibold text-fg">
        {rank10.toFixed(1)}
      </span>{' '}
      and the 1000th closest word has a similarity score of{' '}
      <span className="tabular font-semibold text-fg">
        {rank1000.toFixed(1)}
      </span>
      .
    </p>
  );
}

function GuessRow({
  guess,
  isCurrent,
  recent,
  percentile,
}: {
  guess: Guess;
  /** Show the "current guess" highlight (ring + ring-offset). */
  isCurrent?: boolean;
  recent?: boolean;
  /** Rank-based percentile (10-100) if in top-1000, else null → "<10%". */
  percentile: number | null;
}) {
  const inTop = guess.rank !== null;

  // Row background – heat map from green (near the answer) through yellow
  // and orange to pale peach (edge of the top-1000), then a subtle gray
  // for cold guesses. HSL interpolation across rank so the top of the
  // list reads visibly hotter than the middle.
  let bgStyle: React.CSSProperties;
  let fgClass: string;
  if (guess.rank === 1) {
    bgStyle = { background: 'rgb(var(--hot-r) var(--hot-g) var(--hot-b))' };
    fgClass = 'text-white';
  } else if (inTop) {
    // p ∈ [0,1] where rank 2 → ~1 (green) and rank 1000 → 0 (pale orange).
    const p = Math.max(0, (1000 - guess.rank!) / 999);
    const hue = 25 + (120 - 25) * p;        // orange (25°) → green (120°)
    const sat = 75 + 15 * p;                 // 75% → 90%
    const light = 96 - 28 * p;               // pale (96%) → bright (68%)
    bgStyle = { background: `hsl(${hue} ${sat}% ${light}%)` };
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
        'px-3 sm:px-4 py-1 mb-0.5 transition-transform leading-tight',
        isCurrent ? 'ring-2 ring-fg/80 ring-offset-2 ring-offset-bg' : '',
        recent ? 'animate-in' : '',
      ].join(' ')}
    >
      <div
        className={`tabular text-ui font-bold ${fgClass} ${dimClass}`}
      >
        {guess.rank ? `#${guess.rank}` : '-'}
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
      <div className={`text-right ${fgClass}`}>
        {isCurrent && (
          <div
            className={`text-[9px] uppercase font-bold tracking-[0.06em] leading-none mb-0.5 ${fgClass} opacity-60`}
          >
            Sim Score
          </div>
        )}
        <div className="tabular text-ui font-bold">
          {guess.score.toFixed(1)}
        </div>
      </div>
      <div className={`text-right ${fgClass} ${dimClass}`}>
        {isCurrent && (
          <div
            className={`text-[9px] uppercase font-bold tracking-[0.06em] leading-none mb-0.5 ${fgClass} opacity-60`}
          >
            %tile
          </div>
        )}
        <div className="tabular text-caption font-semibold">
          {formatPercentile(percentile)}
        </div>
      </div>
    </div>
  );
}

function formatPercentile(pct: number | null): string {
  if (pct == null) return '<10%';
  if (pct >= 99) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(0)}%`;
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
        'mt-4 mb-8  p-6 sm:p-8 animate-in',
        won ? 'bg-hot text-white' : 'bg-surface-2 text-fg',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center justify-between mb-3',
        ].join(' ')}
      >
        <div
          className={[
            'text-eyebrow uppercase font-bold',
            won ? 'text-white/80' : 'text-muted',
          ].join(' ')}
        >
          {won ? 'Solved' : 'Revealed'}
        </div>
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

      {puzzle.ai_result && <AiScoreLine ai={puzzle.ai_result} userGuesses={guesses.length} userWon={won} won={won} />}
      {won && <GlobalPercentile date={puzzle.date} yourGuesses={guesses.length} onColor={won} />}

      <div
        className={[
          'mb-6 py-4 ',
          won ? 'bg-white/15' : 'bg-white',
        ].join(' ')}
      >
        <NextPuzzleCountdown variant={won ? 'oncolor' : 'default'} />
      </div>
      <div
        className={[
          'grid grid-cols-4 gap-2 mb-6  overflow-hidden',
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
              : 'https://www.cliniclegame.app/',
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'flex-1 w-full inline-flex items-center justify-center gap-2 h-14 sm:h-12 text-ui font-bold hover:brightness-110 active:scale-[0.98] transition-[transform,filter]',
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

function GlobalPercentile({
  date,
  yourGuesses,
  onColor,
}: {
  date: string;
  yourGuesses: number;
  onColor: boolean;
}) {
  const [state, setState] = useState<
    | { kind: 'off' }
    | { kind: 'loading' }
    | { kind: 'ready'; pct: number; total: number }
  >(() => (leaderboardEnabled() ? { kind: 'loading' } : { kind: 'off' }));
  const submitted = useRef(false);

  useEffect(() => {
    if (!leaderboardEnabled()) return;
    if (submitted.current) return;
    submitted.current = true;
    // Fire-and-forget record, then read the current distribution
    (async () => {
      await recordSolve(date, yourGuesses);
      // Small delay so our own write is reflected
      await new Promise((r) => setTimeout(r, 400));
      const d = await fetchDistribution(date);
      if (!d || d.total < 3) {
        setState({ kind: 'off' });
        return;
      }
      setState({
        kind: 'ready',
        pct: computePercentile(d.distribution, yourGuesses),
        total: d.total,
      });
    })();
  }, [date, yourGuesses]);

  if (state.kind !== 'ready') return null;

  return (
    <div
      className={[
        'mb-6  px-4 py-3 flex items-center justify-between gap-3',
        onColor ? 'bg-white/15 text-white' : 'bg-white text-fg',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg leading-none" aria-hidden="true">
          🌎
        </span>
        <span className="text-caption font-semibold truncate">
          You beat {state.pct}% of players today
        </span>
      </div>
      <div
        className={[
          'text-caption tabular font-semibold shrink-0',
          onColor ? 'text-white/85' : 'text-muted',
        ].join(' ')}
      >
        {state.total.toLocaleString()} solves
      </div>
    </div>
  );
}

function AiScoreLine({
  ai,
  userGuesses,
  userWon,
  won,
}: {
  ai: NonNullable<Puzzle['ai_result']>;
  userGuesses: number;
  userWon: boolean;
  won: boolean;
}) {
  const aiWon = ai.won;
  let verdict = 'You tied Claude';
  let emoji = '🤝';
  if (userWon && !aiWon) {
    verdict = 'You beat Claude — it gave up';
    emoji = '🏆';
  } else if (userWon && aiWon) {
    if (userGuesses < ai.guesses) {
      verdict = `You beat Claude by ${ai.guesses - userGuesses} guess${ai.guesses - userGuesses === 1 ? '' : 'es'}`;
      emoji = '🏆';
    } else if (userGuesses > ai.guesses) {
      verdict = `Claude beat you by ${userGuesses - ai.guesses} guess${userGuesses - ai.guesses === 1 ? '' : 'es'}`;
      emoji = '🤖';
    }
  } else if (!userWon && aiWon) {
    verdict = `Claude solved it in ${ai.guesses}`;
    emoji = '🤖';
  } else if (!userWon && !aiWon) {
    verdict = 'Neither of you got it';
    emoji = '😅';
  }

  const aiScore = ai.won ? `${ai.guesses} guesses` : 'gave up';
  return (
    <div
      className={[
        'mb-6  px-4 py-3 flex items-center justify-between gap-3',
        won ? 'bg-white/15 text-white' : 'bg-white text-fg',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg leading-none" aria-hidden="true">
          {emoji}
        </span>
        <span className="text-caption font-semibold truncate">{verdict}</span>
      </div>
      <div
        className={[
          'text-caption tabular font-semibold shrink-0',
          won ? 'text-white/85' : 'text-muted',
        ].join(' ')}
      >
        Claude: {aiScore}
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

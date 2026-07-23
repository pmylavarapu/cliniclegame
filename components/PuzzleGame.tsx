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
import { currentRank } from '@/lib/ranks';
import { checkNewlyUnlocked, type Achievement } from '@/lib/achievements';
import { buildChallengeUrl } from '@/lib/challenge';
import ShareMenu from './ShareMenu';
import GuessDistribution from './GuessDistribution';
import NextPuzzleCountdown from './NextPuzzleCountdown';
import AchievementToast from './AchievementToast';
import ShareImageButton from './ShareImageButton';

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
      const rankBefore = currentRank(loadStats());
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
        const fresh = checkNewlyUnlocked(gs, nextStats, rankBefore);
        if (fresh.length) setFreshAchievements(fresh);
      }
    }
  }, [gameOver, puzzle.date, guesses, hintsUsed, won, gaveUp, startedAt, finalTimeMs]);

  const submitGuess = (raw: string, isHint = false) => {
    setError(null);
    setSuggestion(null);
    let w = normalizeGuess(raw);
    if (!w) return;
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
      const near = nearestVocabWord(w, vocab);
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

  return (
    <div>
      <p className="mb-5 text-body text-muted leading-relaxed">
        Guess medical terms. The closer you get to the secret diagnosis,
        the higher your score will be. Guess the secret word to win.
      </p>
      <div className="mb-6 rounded-2xl bg-primary/5 ring-1 ring-primary/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-caption mb-3">
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
                <span
                  className={`text-caption font-semibold ${difficultyColor(puzzle.difficulty)}`}
                >
                  {difficultyLabel(puzzle.difficulty)}
                </span>
              </span>
            </>
          ) : null}
        </div>
        <figure className="border-l-[3px] border-primary pl-4 sm:pl-5">
          <figcaption className="text-eyebrow uppercase text-muted font-bold tracking-[0.06em] mb-1.5">
            Guess the diagnosis
          </figcaption>
          <blockquote className="text-lede sm:text-title-sm font-medium text-fg leading-relaxed">
            {puzzle.prompt}
          </blockquote>
        </figure>
        <ReferenceBar rank10={rank10Score} rank1000={rank1000Score} />
      </div>

      {!gameOver && (
        <form onSubmit={onSubmit} className="mb-4">
          <div className="flex items-stretch flex-wrap gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a word or phrase"
              className="basis-full sm:basis-0 flex-1 min-w-0 h-10 sm:h-11 px-4 text-base sm:text-body rounded-full bg-surface-2 border border-transparent outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15 transition-all placeholder:text-muted font-medium"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="h-10 sm:h-11 px-4 rounded-full bg-primary text-white text-caption font-bold hover:brightness-110 active:scale-[0.98] transition-[transform,filter]"
            >
              Guess
            </button>
            <button
              type="button"
              onClick={useHint}
              className="h-10 sm:h-11 px-3.5 rounded-full bg-surface-2 text-caption font-semibold text-fg hover:bg-hint/10 hover:text-hint transition-colors"
            >
              Hint
            </button>
            <button
              type="button"
              onClick={giveUp}
              className="h-10 sm:h-11 px-3.5 rounded-full bg-surface-2 text-caption font-semibold text-fg hover:bg-danger/10 hover:text-danger transition-colors"
            >
              Give up
            </button>
          </div>
          <div className="mt-2 text-right">
            <span className="text-caption text-muted tabular">
              {guesses.length} guess{guesses.length === 1 ? '' : 'es'}
              {hintsUsed > 0 &&
                ` · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}`}
            </span>
          </div>
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
            <div className="mb-4">
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
        <div className="mt-10 py-12 rounded-2xl bg-surface-2 text-center">
          <p className="text-title-sm text-fg font-bold">
            Make your first guess
          </p>
          <p className="text-body text-muted mt-1.5">
            Try something broad – an organ, a symptom, a body system.
          </p>
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
        'px-3 sm:px-4 py-3 rounded-xl mb-1.5 transition-transform',
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
      <div
        className={`tabular text-ui font-bold text-right ${fgClass}`}
      >
        {guess.score.toFixed(1)}
      </div>
      <div
        className={`tabular text-caption font-semibold text-right ${fgClass} ${dimClass}`}
      >
        {formatPercentile(percentile)}
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
  const rank = currentRank(stats);
  const shareText = buildShareString(
    { date: puzzle.date, guesses, hintsUsed, gaveUp, won, timeMs },
    puzzle.num,
    puzzle.difficulty,
  );
  const challengeUrl =
    typeof window !== 'undefined'
      ? buildChallengeUrl(
          {
            date: puzzle.date,
            guesses: guesses.length,
            timeS: timeMs != null ? Math.round(timeMs / 1000) : undefined,
            hints: hintsUsed,
            won,
          },
          window.location.origin,
        )
      : '';
  const challengeTweet = `Beat me at today's Clinicle #${puzzle.num}${
    won ? ` — I got it in ${guesses.length}` : ''
  }.`;

  return (
    <div
      className={[
        'mt-4 mb-8 rounded-2xl p-6 sm:p-8 animate-in',
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
        {won && (
          <div
            className={[
              'text-eyebrow uppercase font-bold',
              won ? 'text-white/80' : 'text-muted',
            ].join(' ')}
            title={`Your rank: ${rank.label}`}
          >
            {rank.label}
          </div>
        )}
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
            shareText.replace(/https?:\/\/[^\s]+/g, '').trim() +
              '\n\n@ClinicleGame @PraneetMylavarapu',
          )}&url=${encodeURIComponent(
            typeof window !== 'undefined'
              ? window.location.origin + '/'
              : 'https://clinicle.app',
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'flex-1 w-full flex items-center justify-center gap-2 h-12 rounded-full text-ui font-bold hover:brightness-110 active:scale-[0.98] transition-[transform,filter]',
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
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <ShareImageButton
            puzzle={puzzle}
            guesses={guesses}
            won={won}
            timeMs={timeMs}
            streak={stats.currentStreak}
            rank={rank}
            variant={won ? 'oncolor' : 'default'}
          />
        </div>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            challengeTweet + '\n\n@ClinicleGame',
          )}&url=${encodeURIComponent(challengeUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'flex-1 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-ui font-bold hover:brightness-110 active:scale-[0.98] transition-[transform,filter]',
            won ? 'bg-white/20 text-white' : 'bg-primary text-white',
          ].join(' ')}
        >
          Challenge a friend
        </a>
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

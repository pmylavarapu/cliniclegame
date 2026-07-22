export type TopEntry = [word: string, score: number];

export type Puzzle = {
  date: string;
  num: number;
  prompt: string;
  secret: string;
  top1000: TopEntry[];
  scores: string;
  /** 1–5 stars, computed at precompute time from top-neighbor cosine spread. */
  difficulty?: number;
};

export type PuzzleIndex = {
  latest: string;
  dates: string[];
};

export type Guess = {
  word: string;
  score: number;
  rank: number | null;
  isHint?: boolean;
  order: number;
};

export type GameState = {
  date: string;
  guesses: Guess[];
  hintsUsed: number;
  gaveUp: boolean;
  won: boolean;
  /** Milliseconds elapsed from first render to solve/give-up. */
  timeMs?: number;
  /** Epoch ms of the first render for the current puzzle (not persisted after solve). */
  startedAt?: number;
};

export type HistoryEntry = {
  guesses: number;
  hints: number;
  won: boolean;
  gaveUp: boolean;
  /** Milliseconds to solve (only present for wins). */
  timeMs?: number;
};

export type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  totalGuesses: number;
  totalHints: number;
  lastPlayedDate?: string;
  history: Record<string, HistoryEntry>;
};

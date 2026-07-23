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
  /**
   * Symmetric near-synonym adjacency map among the top-1000, computed at
   * precompute time. Direct pairs only — no transitive merging — so
   * "colitis" pairs with "ulcerative colitis" without dragging in every
   * -itis. Used to reject a second guess that means the same as an earlier
   * one. Words with no near-synonyms are absent from the map.
   */
  synonyms?: Record<string, string[]>;
  /**
   * Hint-eligible subset of the top-1000 (curated vocab only). Each entry
   * is [word, score, rank_in_top1000]. Keeps obscure Latin morphemes like
   * 'valgus'/'venular' out of the hint stream while still allowing them
   * as guesses.
   */
  hints?: [word: string, score: number, rank: number][];
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

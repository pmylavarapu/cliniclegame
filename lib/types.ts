export type TopEntry = [word: string, score: number];

export type Puzzle = {
  date: string;
  num: number;
  prompt: string;
  secret: string;
  top1000: TopEntry[];
  scores: string;
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
};

export type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  totalGuesses: number;
  totalHints: number;
  lastPlayedDate?: string;
  history: Record<string, { guesses: number; hints: number; won: boolean; gaveUp: boolean }>;
};

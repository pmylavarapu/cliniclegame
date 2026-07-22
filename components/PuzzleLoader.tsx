'use client';

import { useEffect, useState } from 'react';
import PuzzleGame from './PuzzleGame';
import type { Puzzle, PuzzleIndex } from '@/lib/types';
import { today } from '@/lib/scores';

type Props = { requestedDate?: string };

export default function PuzzleLoader({ requestedDate }: Props) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [vocab, setVocab] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const idx = await fetch('/index.json').then((r) => {
          if (!r.ok) throw new Error('index.json missing');
          return r.json() as Promise<PuzzleIndex>;
        });
        let date = requestedDate ?? today();
        if (!idx.dates.includes(date)) {
          const fallback = idx.latest;
          if (!requestedDate) {
            setNotice(`Today's puzzle isn't out yet — showing #${fallback}`);
          } else {
            setError(`No puzzle for ${requestedDate}`);
            return;
          }
          date = fallback;
        }
        const [p, v] = await Promise.all([
          fetch(`/puzzles/${date}.json`).then((r) => r.json() as Promise<Puzzle>),
          fetch('/vocab.json').then((r) => r.json() as Promise<string[]>),
        ]);
        setPuzzle(p);
        setVocab(v);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    })();
  }, [requestedDate]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
        {error}
      </div>
    );
  }
  if (!puzzle || !vocab) return <PuzzleSkeleton />;

  return (
    <>
      {notice && (
        <div className="mb-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-fg-soft">
          {notice}
        </div>
      )}
      <PuzzleGame puzzle={puzzle} vocab={vocab} />
    </>
  );
}

function PuzzleSkeleton() {
  return (
    <div className="animate-in">
      <div className="mb-6">
        <div className="skeleton h-3 w-32 mb-3" />
        <div className="skeleton h-7 w-64 mb-3" />
        <div className="skeleton h-4 w-full mb-1.5" />
        <div className="skeleton h-4 w-4/5 mb-4" />
        <div className="skeleton h-20 w-full rounded-xl" />
      </div>
      <div className="skeleton h-11 w-full mb-4 rounded-lg" />
      <div className="skeleton h-12 w-full mb-2 rounded-lg" />
      <div className="skeleton h-12 w-full mb-2 rounded-lg" />
      <div className="skeleton h-12 w-full rounded-lg" />
    </div>
  );
}

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

  if (error) return <div className="text-red-600">{error}</div>;
  if (!puzzle || !vocab) return <div className="text-muted animate-pulse">Loading puzzle…</div>;

  return (
    <>
      {notice && <div className="mb-3 text-xs text-muted">{notice}</div>}
      <PuzzleGame puzzle={puzzle} vocab={vocab} />
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import PuzzleGame from './PuzzleGame';
import type { Puzzle, PuzzleIndex } from '@/lib/types';
import { today } from '@/lib/scores';
import { recordPageview } from '@/lib/adminStats';

type Props = { requestedDate?: string };

export default function PuzzleLoader({ requestedDate }: Props) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [vocab, setVocab] = useState<string[] | null>(null);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [cleanVocab, setCleanVocab] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Cache-bust every deploy — otherwise a CDN or browser can pair a
        // fresh puzzle JSON with a stale vocab (or vice versa) and score
        // out-of-range indices, which the frontend falls back to 0 →
        // renders as "-30". VERCEL_GIT_COMMIT_SHA is injected at build.
        const v =
          process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
          process.env.NEXT_PUBLIC_BUILD_ID ||
          'dev';
        const bust = `?v=${v}`;
        const noCache: RequestInit = { cache: 'no-store' };

        const idx = await fetch(`/index.json${bust}`, noCache).then((r) => {
          if (!r.ok) throw new Error('index.json missing');
          return r.json() as Promise<PuzzleIndex>;
        });
        let date = requestedDate ?? today();
        if (!idx.dates.includes(date)) {
          const fallback = idx.latest;
          if (!requestedDate) {
            setNotice(`Today's puzzle isn't out yet – showing #${fallback}`);
          } else {
            setError(`No puzzle for ${requestedDate}`);
            return;
          }
          date = fallback;
        }
        const [p, vocabList, a, c] = await Promise.all([
          fetch(`/puzzles/${date}.json${bust}`, noCache).then((r) => r.json() as Promise<Puzzle>),
          fetch(`/vocab.json${bust}`, noCache).then((r) => r.json() as Promise<string[]>),
          fetch(`/abbreviations.json${bust}`, noCache)
            .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}))
            .catch(() => ({})),
          fetch(`/clean_vocab.json${bust}`, noCache)
            .then((r) => (r.ok ? (r.json() as Promise<string[]>) : null))
            .catch(() => null),
        ]);
        setPuzzle(p);
        setVocab(vocabList);
        setAliases(a);
        setCleanVocab(c);
        recordPageview(date);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    })();
  }, [requestedDate]);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-caption">
        {error}
      </div>
    );
  }
  if (!puzzle || !vocab) return <PuzzleSkeleton />;

  return (
    <>
      {notice && (
        <div className="mb-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-caption text-muted">
          {notice}
        </div>
      )}
      <PuzzleGame
        puzzle={puzzle}
        vocab={vocab}
        aliases={aliases}
        cleanVocab={cleanVocab ?? undefined}
      />
    </>
  );
}

function PuzzleSkeleton() {
  return (
    <div className="animate-in">
      <div className="skeleton h-4 w-11/12 mb-2" />
      <div className="skeleton h-4 w-full mb-2" />
      <div className="skeleton h-4 w-2/3 mb-5" />
      <div className="skeleton h-4 w-full mb-1.5" />
      <div className="skeleton h-4 w-4/5 mb-6" />
      <div className="skeleton h-12 w-full mb-4 rounded-md" />
      <div className="skeleton h-10 w-full mb-2 rounded-md" />
      <div className="skeleton h-10 w-full mb-2 rounded-md" />
      <div className="skeleton h-10 w-full rounded-md" />
    </div>
  );
}

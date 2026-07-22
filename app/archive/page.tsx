'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PuzzleIndex } from '@/lib/types';

export default function ArchivePage() {
  const [idx, setIdx] = useState<PuzzleIndex | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/index.json')
      .then((r) => r.json() as Promise<PuzzleIndex>)
      .then(setIdx)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
        {err}
      </div>
    );
  }
  if (!idx) {
    return (
      <div className="animate-in">
        <div className="skeleton h-7 w-32 mb-3" />
        <div className="skeleton h-4 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...idx.dates].sort().reverse();

  return (
    <div className="animate-in">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.14em] text-muted mb-2">
          Archive
        </div>
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight leading-tight mb-1.5">
          Past puzzles
        </h1>
        <p className="text-fg-soft">
          {sorted.length} puzzle{sorted.length === 1 ? '' : 's'} available.
          Pick any day to play.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sorted.map((d, i) => (
          <Link
            key={d}
            href={`/?date=${d}`}
            className="group rounded-lg border border-border bg-surface px-3 py-2.5 hover:border-primary hover:shadow-card hover:-translate-y-px transition-all"
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted">
              #{sorted.length - i}
            </div>
            <div className="tabular font-medium text-fg group-hover:text-primary transition-colors">
              {d}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

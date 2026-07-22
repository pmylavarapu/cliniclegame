'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PuzzleIndex } from '@/lib/types';
import PageShell from '@/components/PageShell';

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
      <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-caption">
        {err}
      </div>
    );
  }
  if (!idx) {
    return (
      <div className="animate-in">
        <div className="skeleton h-4 w-24 mb-3" />
        <div className="skeleton h-8 w-40 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...idx.dates].sort().reverse();

  return (
    <PageShell eyebrow="Past puzzles" title="Archive">
      <p className="not-prose text-body text-fg-soft mb-6">
        {sorted.length} puzzle{sorted.length === 1 ? '' : 's'} available. Pick
        any day to play.
      </p>
      <div className="not-prose grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sorted.map((d, i) => (
          <Link
            key={d}
            href={`/?date=${d}`}
            className="group rounded-md border border-border bg-white px-3 py-2.5 hover:border-primary hover:shadow-card hover:-translate-y-px transition-all"
          >
            <div className="text-eyebrow uppercase text-muted font-semibold">
              #{sorted.length - i}
            </div>
            <div className="tabular text-ui font-medium text-fg group-hover:text-primary transition-colors mt-0.5">
              {d}
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

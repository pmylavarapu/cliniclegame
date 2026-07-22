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
        <div className="skeleton h-14 w-full mb-2 rounded-md" />
        <div className="skeleton h-14 w-full mb-2 rounded-md" />
        <div className="skeleton h-14 w-full rounded-md" />
      </div>
    );
  }

  const sorted = [...idx.dates].sort().reverse();

  return (
    <div className="animate-in">
      <div className="flex items-baseline justify-between gap-4 pb-3 mb-6 border-b border-border">
        <div className="flex items-baseline gap-3">
          <span className="text-eyebrow uppercase text-muted font-semibold">
            Section
          </span>
          <h1 className="text-title-lg font-semibold text-fg tracking-tight leading-none">
            Archive
          </h1>
        </div>
        <span className="tabular text-caption text-muted">
          {sorted.length} puzzles
        </span>
      </div>
      <ul className="divide-y divide-border border-b border-border">
        {sorted.map((d, i) => (
          <li key={d}>
            <Link
              href={`/?date=${d}`}
              className="group flex items-baseline justify-between py-3.5 hover:bg-surface-2/50 -mx-2 px-2 rounded-md transition-colors"
            >
              <div className="flex items-baseline gap-4">
                <span className="tabular text-eyebrow uppercase text-muted font-semibold w-10">
                  #{sorted.length - i}
                </span>
                <span className="text-ui font-medium text-fg group-hover:text-primary transition-colors">
                  {formatDate(d)}
                </span>
              </div>
              <span className="tabular text-caption text-muted group-hover:text-fg transition-colors">
                Play →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

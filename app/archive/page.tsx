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
      <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
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
            <div key={i} className="skeleton h-16 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...idx.dates].sort().reverse();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Archive</h1>
      <p className="text-muted text-sm mb-6">Play any past puzzle.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sorted.map((d, i) => (
          <Link
            key={d}
            href={`/?date=${d}`}
            className="group rounded-md border border-border bg-white px-3 py-2.5 hover:border-primary hover:shadow-card hover:-translate-y-px transition-all"
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-semibold">
              #{sorted.length - i}
            </div>
            <div className="tabular font-semibold text-fg group-hover:text-primary transition-colors">
              {d}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

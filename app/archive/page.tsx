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

  if (err) return <div className="text-red-600">{err}</div>;
  if (!idx) return <div className="text-muted animate-pulse">Loading…</div>;

  const sorted = [...idx.dates].sort().reverse();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Archive</h1>
      <p className="text-muted text-sm mb-6">Play any past puzzle.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sorted.map((d, i) => (
          <Link
            key={d}
            href={`/?date=${d}`}
            className="border border-border rounded px-3 py-2 hover:border-primary transition-colors"
          >
            <div className="text-xs text-muted">#{sorted.length - i}</div>
            <div className="tabular font-medium">{d}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

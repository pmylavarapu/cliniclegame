'use client';

import { useEffect, useState } from 'react';

type Props = {
  variant?: 'default' | 'oncolor';
};

/** Live countdown to the next puzzle (UTC midnight). */
export default function NextPuzzleCountdown({ variant = 'default' }: Props) {
  const [remaining, setRemaining] = useState<number>(() => msUntilNextPuzzle());

  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilNextPuzzle()), 1000);
    return () => clearInterval(id);
  }, []);

  const onColor = variant === 'oncolor';
  const labelClass = onColor ? 'text-white/80' : 'text-muted';
  const timeClass = onColor ? 'text-white' : 'text-fg';

  return (
    <div className="text-center">
      <div className={`text-eyebrow uppercase font-bold ${labelClass} mb-2`}>
        Next puzzle in
      </div>
      <div
        className={`tabular text-title-lg font-bold tracking-tight ${timeClass}`}
      >
        {formatHms(remaining)}
      </div>
    </div>
  );
}

function msUntilNextPuzzle(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0,
    ),
  );
  return Math.max(0, next.getTime() - now.getTime());
}

function formatHms(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

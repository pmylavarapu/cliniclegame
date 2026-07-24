'use client';

import { useEffect, useState } from 'react';

type Props = {
  variant?: 'default' | 'oncolor';
};

/** Live countdown to the next puzzle (midnight in America/Los_Angeles). */
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
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const h = Number(parts.hour === '24' ? 0 : parts.hour);
  const m = Number(parts.minute);
  const s = Number(parts.second);
  const secondsToMidnight = 24 * 3600 - (h * 3600 + m * 60 + s);
  return Math.max(0, secondsToMidnight * 1000);
}

function formatHms(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

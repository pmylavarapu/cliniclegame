'use client';

import type { Stats } from '@/lib/types';
import { guessDistribution } from '@/lib/storage';

type Props = {
  stats: Stats;
  today?: { guesses: number; won: boolean };
  variant?: 'default' | 'oncolor';
};

/** Wordle-style solve-count histogram. */
export default function GuessDistribution({
  stats,
  today,
  variant = 'default',
}: Props) {
  const dist = guessDistribution(stats);
  if (dist.size === 0 && !today?.won) return null;

  const entries = Array.from(dist.entries()).sort((a, b) => a[0] - b[0]);
  const maxCount = Math.max(1, ...Array.from(dist.values()));

  const onColor = variant === 'oncolor';
  const rowLabel = onColor ? 'text-white/80' : 'text-muted';
  const barBg = onColor ? 'bg-white/25' : 'bg-fg';
  const barText = onColor ? 'text-fg' : 'text-white';

  return (
    <div>
      <div
        className={[
          'text-eyebrow uppercase font-bold mb-3',
          onColor ? 'text-white/80' : 'text-muted',
        ].join(' ')}
      >
        Guess distribution
      </div>
      <div className="space-y-1.5">
        {entries.map(([count, wins]) => {
          const isToday = today?.won && today.guesses === count;
          const widthPct = Math.max(8, Math.round((wins / maxCount) * 100));
          return (
            <div key={count} className="flex items-center gap-3">
              <div
                className={`tabular font-bold w-4 text-caption ${rowLabel}`}
              >
                {count}
              </div>
              <div className="flex-1 relative">
                <div
                  className={[
                    'h-6 rounded-md flex items-center justify-end pr-2',
                    isToday && !onColor
                      ? 'bg-hot text-white'
                      : isToday && onColor
                        ? 'bg-white text-fg'
                        : `${barBg} ${barText}`,
                  ].join(' ')}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="tabular text-caption font-bold">{wins}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

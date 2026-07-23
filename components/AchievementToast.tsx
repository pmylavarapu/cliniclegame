'use client';

import { useEffect, useState } from 'react';
import type { Achievement } from '@/lib/achievements';

const SITE_URL = 'https://clinicle.app';

type Props = {
  achievements: Achievement[];
  onDismiss: () => void;
};

/**
 * Sliding toast for freshly-unlocked achievements. Cycles through the
 * queue one at a time — user taps Next (or auto-advances) — and each has
 * its own share button with a pre-filled tweet.
 */
export default function AchievementToast({ achievements, onDismiss }: Props) {
  const [idx, setIdx] = useState(0);
  const cur = achievements[idx];

  useEffect(() => setIdx(0), [achievements]);

  if (!cur) return null;

  const next = () => {
    if (idx + 1 < achievements.length) setIdx(idx + 1);
    else onDismiss();
  };

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    cur.share + '\n\n@ClinicleGame',
  )}&url=${encodeURIComponent(SITE_URL)}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none animate-in"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-fg text-white shadow-2xl p-4 flex items-start gap-3">
        <div className="text-[28px] leading-none">{cur.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-eyebrow uppercase text-white/60 font-bold tracking-[0.06em] mb-0.5">
            Achievement unlocked
          </div>
          <div className="text-ui font-bold">{cur.label}</div>
          <div className="text-caption text-white/75 mt-0.5">{cur.description}</div>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={tweetHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-8 px-3 rounded-full bg-white text-fg text-caption font-bold hover:brightness-95 active:scale-95 transition-[transform,filter]"
            >
              Share
            </a>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center h-8 px-3 rounded-full text-caption font-semibold text-white/80 hover:text-white transition-colors"
            >
              {idx + 1 < achievements.length ? 'Next' : 'Dismiss'}
            </button>
            {achievements.length > 1 && (
              <span className="ml-auto text-caption text-white/50 tabular">
                {idx + 1}/{achievements.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

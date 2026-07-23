'use client';

import { useEffect, useState } from 'react';
import { loadStats } from '@/lib/storage';

/**
 * Small streak pill in the header. Reads current streak from local storage
 * on mount and re-reads on tab focus (users may have just completed a
 * puzzle in another tab). Hides itself if streak is 0 so the header stays
 * clean for first-time visitors.
 */
export default function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    const read = () => setStreak(loadStats().currentStreak);
    read();
    const onFocus = () => read();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes(':stats')) read();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (!streak || streak <= 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full bg-warm/10 text-warm text-caption font-bold tabular"
      title={`${streak}-day streak`}
      aria-label={`${streak}-day streak`}
    >
      <FlameIcon />
      {streak}
    </span>
  );
}

function FlameIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2s4 4 4 8a4 4 0 1 1-8 0c0-2 1-3 1-3s-2 1-3 4a5 5 0 1 0 10 0c0-5-4-9-4-9z" />
    </svg>
  );
}

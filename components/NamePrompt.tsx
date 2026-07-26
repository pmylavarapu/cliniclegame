'use client';

import { useEffect, useState } from 'react';
import { sanitizeName, setStoredName } from '@/lib/leaderboardEntries';

type Props = {
  open: boolean;
  initial?: string;
  onSubmit: (name: string) => void;
  onSkip: () => void;
};

export default function NamePrompt({ open, initial, onSubmit, onSkip }: Props) {
  const [name, setName] = useState(initial ?? '');

  useEffect(() => {
    if (open) setName(initial ?? '');
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onSkip();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onSkip]);

  if (!open) return null;

  const cleaned = sanitizeName(name);

  const submit = () => {
    if (!cleaned) return;
    const stored = setStoredName(cleaned);
    onSubmit(stored);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/40 backdrop-blur-sm p-4"
      onClick={onSkip}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-sm bg-bg border border-border-strong shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-title-sm font-bold mb-1">Pick a handle</h2>
        <p className="text-caption text-muted mb-4">
          Shown on the leaderboard next to your solve. You can change it
          any time from the leaderboard page. No account needed.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. drmoose"
          maxLength={20}
          autoFocus
          className="w-full h-11 px-3 border border-border-strong text-base outline-none focus:border-fg focus:ring-2 focus:ring-fg/10"
        />
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onSkip}
            className="h-10 px-3 text-caption text-muted hover:text-fg"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!cleaned}
            className="h-10 px-4 bg-fg text-white text-ui font-semibold uppercase tracking-wider disabled:opacity-40"
          >
            Save & submit
          </button>
        </div>
      </div>
    </div>
  );
}

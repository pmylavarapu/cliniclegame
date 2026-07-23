'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { parseChallenge, type ChallengeParams } from '@/lib/challenge';
import { loadStats } from '@/lib/storage';
import PageShell from '@/components/PageShell';

/**
 * A friend hit /challenge?d=...&g=... — show a landing card with their
 * result and a big CTA to play today's puzzle. If the current user has
 * already solved that same puzzle date, show the head-to-head compare.
 */
export default function ChallengeClient() {
  const [challenge, setChallenge] = useState<ChallengeParams | null>(null);
  const [myEntry, setMyEntry] = useState<{
    guesses: number;
    won: boolean;
    timeMs?: number;
    hints: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = parseChallenge(new URLSearchParams(window.location.search));
    setChallenge(c);
    if (!c) return;
    const mine = loadStats().history[c.date];
    if (mine) {
      setMyEntry({
        guesses: mine.guesses,
        won: mine.won,
        timeMs: mine.timeMs,
        hints: mine.hints,
      });
    }
  }, []);

  if (!challenge) {
    return (
      <PageShell eyebrow="Challenge" title="No challenge here">
        <p>
          This page needs a challenge link — the kind a friend generates from
          their win screen. Head to today&apos;s puzzle instead.
        </p>
        <p>
          <Link
            href="/"
            className="inline-flex h-11 items-center px-5 rounded-full bg-primary text-white text-ui font-bold no-underline hover:brightness-110"
          >
            Play today
          </Link>
        </p>
      </PageShell>
    );
  }

  const friendLabel = challenge.from
    ? `${challenge.from} `
    : 'A friend ';
  const settled = myEntry != null;
  const iWon = myEntry?.won ?? false;
  const iBeat = settled && iWon && myEntry!.guesses < challenge.guesses;
  const iTied = settled && iWon && myEntry!.guesses === challenge.guesses;

  return (
    <PageShell
      eyebrow="Challenge"
      title={
        !settled
          ? `${friendLabel}challenged you`
          : iBeat
            ? 'You beat the challenge'
            : iTied
              ? 'You tied it'
              : 'They still lead'
      }
    >
      <div className="rounded-2xl bg-surface-2 p-5 sm:p-6 my-4">
        <div className="text-eyebrow uppercase text-muted font-bold mb-2">
          {settled ? 'Head to head' : 'The challenge'}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-caption text-muted mb-1">
              {challenge.from ?? 'Friend'}
            </div>
            <div className="text-title font-bold tabular text-fg">
              {challenge.won ? `${challenge.guesses} guesses` : 'gave up'}
            </div>
            {challenge.timeS != null && challenge.won ? (
              <div className="text-caption text-muted tabular">
                {formatSeconds(challenge.timeS)}
              </div>
            ) : null}
            {challenge.hints > 0 ? (
              <div className="text-caption text-muted">
                {challenge.hints} hint{challenge.hints === 1 ? '' : 's'}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-caption text-muted mb-1">You</div>
            {settled ? (
              <>
                <div className="text-title font-bold tabular text-fg">
                  {myEntry!.won ? `${myEntry!.guesses} guesses` : 'gave up'}
                </div>
                {myEntry!.timeMs != null && myEntry!.won ? (
                  <div className="text-caption text-muted tabular">
                    {formatSeconds(Math.round(myEntry!.timeMs / 1000))}
                  </div>
                ) : null}
                {myEntry!.hints > 0 ? (
                  <div className="text-caption text-muted">
                    {myEntry!.hints} hint{myEntry!.hints === 1 ? '' : 's'}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-body text-muted italic">not played yet</div>
            )}
          </div>
        </div>
        <div className="mt-4 text-caption text-muted">
          Puzzle date: {challenge.date}
        </div>
      </div>

      <p>
        <Link
          href="/"
          className="inline-flex h-12 items-center px-6 rounded-full bg-primary text-white text-ui font-bold no-underline hover:brightness-110"
        >
          {settled ? 'Play today' : `Play ${challenge.date}`}
        </Link>
      </p>
    </PageShell>
  );
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${String(r).padStart(2, '0')}s` : `${s}s`;
}

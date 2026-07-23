'use client';

import { useState } from 'react';
import type { Guess, Puzzle } from '@/lib/types';
import type { Rank } from '@/lib/ranks';

type Props = {
  puzzle: Puzzle;
  guesses: Guess[];
  won: boolean;
  timeMs?: number;
  streak: number;
  rank: Rank;
  variant?: 'default' | 'oncolor';
};

/**
 * Render a 1200×630 Twitter-card sized PNG of the current result and
 * hand it to the user via download OR the native share sheet if it's
 * available. All rendering is client-side Canvas — no server round-trip.
 */
export default function ShareImageButton({
  puzzle,
  guesses,
  won,
  timeMs,
  streak,
  rank,
  variant = 'default',
}: Props) {
  const onColor = variant === 'oncolor';
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const blob = await renderPng({
        puzzle,
        guesses,
        won,
        timeMs,
        streak,
        rank,
      });
      // Prefer native share if available and the platform accepts image files.
      const file = new File([blob], `clinicle-${puzzle.num}.png`, {
        type: 'image/png',
      });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: `Clinicle #${puzzle.num}`,
            text: `Clinicle #${puzzle.num}`,
          });
          return;
        } catch {
          /* user cancelled — fall through to download */
        }
      }
      // Fallback: download the PNG.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clinicle-${puzzle.num}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={[
        'w-full h-12 rounded-lg text-ui font-bold inline-flex items-center justify-center gap-2 transition-[transform,filter] active:scale-[0.98] hover:brightness-110 disabled:opacity-60 disabled:cursor-wait',
        onColor ? 'bg-white/20 text-white' : 'bg-surface-2 text-fg',
      ].join(' ')}
      aria-busy={busy}
    >
      <ImageIcon />
      {busy ? 'Preparing...' : 'Download image'}
    </button>
  );
}

async function renderPng(input: {
  puzzle: Puzzle;
  guesses: Guess[];
  won: boolean;
  timeMs?: number;
  streak: number;
  rank: Rank;
}): Promise<Blob> {
  const { puzzle, guesses, won, timeMs, streak, rank } = input;
  const dpr = 2;
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Background: warm blue gradient when won, muted gray when revealed.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  if (won) {
    bg.addColorStop(0, '#0a84ff');
    bg.addColorStop(1, '#5856d6');
  } else {
    bg.addColorStop(0, '#3a3a3c');
    bg.addColorStop(1, '#1c1c1e');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const family =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Inter, sans-serif';

  // Header row: brand + puzzle number
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 22px ${family}`;
  ctx.textAlign = 'left';
  ctx.fillText('CLINICLE', 60, 72);
  ctx.textAlign = 'right';
  ctx.fillText(`#${puzzle.num}  ·  ${puzzle.date}`, W - 60, 72);

  // Big number: guess count (if won) or "REVEALED"
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.font = `800 180px ${family}`;
  if (won) {
    ctx.fillText(`${guesses.length}`, 60, 240);
    ctx.font = `600 32px ${family}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(
      `guess${guesses.length === 1 ? '' : 'es'}${
        timeMs != null ? `  ·  ${formatDuration(timeMs)}` : ''
      }`,
      70,
      285,
    );
  } else {
    ctx.font = `800 96px ${family}`;
    ctx.fillText('REVEALED', 60, 220);
    ctx.font = `600 32px ${family}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Answer: ${puzzle.secret}`, 60, 265);
  }

  // Rank + streak strip
  ctx.font = `600 24px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const chips: string[] = [];
  chips.push(rank.label);
  if (streak > 0) chips.push(`🔥 ${streak}-day streak`);
  if (puzzle.difficulty) chips.push(`${'★'.repeat(puzzle.difficulty)}`);
  drawChips(ctx, chips, 60, 340, family);

  // Emoji grid — up to 8 rows of the guess journey (winning rows only)
  const gridRows = buildEmojiGrid(guesses);
  const cell = 46;
  const gridStartY = 400;
  ctx.font = `36px ${family}`;
  gridRows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const x = 60 + c * cell;
      const y = gridStartY + r * cell;
      // Draw a rounded rect background so the color reads clearly on the
      // gradient (emoji rendering varies by platform).
      const color = tileColor(row[c]);
      roundRect(ctx, x, y, cell - 6, cell - 6, 8);
      ctx.fillStyle = color;
      ctx.fill();
    }
  });

  // Right-side CTA
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `600 26px ${family}`;
  ctx.fillText('Play at clinicle.app', W - 60, H - 60);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    ),
  );
}

type Tile = 'hot' | 'warm' | 'mid' | 'cold' | 'miss';

function buildEmojiGrid(guesses: Guess[]): Tile[][] {
  // One row per guess, showing five colored cells that decay from the
  // guess's rank. Very tight guesses (rank <= 10) → all hot. Very cold
  // → all miss.
  const rows: Tile[][] = [];
  for (const g of guesses) {
    if (g.rank == null) {
      rows.push(['miss', 'miss', 'miss', 'miss', 'miss']);
      continue;
    }
    const rank = g.rank;
    const t: Tile[] = [];
    for (let i = 0; i < 5; i++) {
      const thresh = [1, 25, 100, 500, 1000][i];
      if (rank <= thresh) {
        t.push(i === 0 ? 'hot' : i <= 1 ? 'warm' : i <= 2 ? 'mid' : 'cold');
      } else {
        t.push('miss');
      }
    }
    // Ensure the exact-hit row is all hot.
    if (rank === 1) rows.push(['hot', 'hot', 'hot', 'hot', 'hot']);
    else rows.push(t);
  }
  // Cap to fit vertically.
  return rows.slice(-8);
}

function tileColor(t: Tile): string {
  switch (t) {
    case 'hot':
      return 'rgba(52,199,89,0.95)';
    case 'warm':
      return 'rgba(255,204,0,0.92)';
    case 'mid':
      return 'rgba(255,149,0,0.88)';
    case 'cold':
      return 'rgba(255,159,10,0.7)';
    case 'miss':
      return 'rgba(255,255,255,0.14)';
  }
}

function drawChips(
  ctx: CanvasRenderingContext2D,
  chips: string[],
  x: number,
  y: number,
  family: string,
) {
  ctx.font = `700 22px ${family}`;
  let cx = x;
  for (const chip of chips) {
    const padX = 16;
    const w = ctx.measureText(chip).width + padX * 2;
    const h = 36;
    roundRect(ctx, cx, y - 26, w, h, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(chip, cx + padX, y);
    cx += w + 10;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

# Gamification & virality backlog

Ideas discussed but not built. All feasible without redesigning the daily-puzzle
model. Group A is static-only; Group B needs a small backend (edge function +
KV/D1 or similar). Group C is content work.

## A. Static-only, buildable anytime

- **Achievement / milestone popups.** Client-side unlocks driven off local
  `Stats`. Candidates: first 1-guess win, first solve in <30s, 7 / 30 / 100
  day streak, 10 no-hint solves in a row, "perfect week" (all 7 days solved),
  50 / 100 / 500 total solves, 5 solves with 5★ difficulty. Each unlock is
  its own shareable moment. Requires: `docs/achievements.md` spec, small
  `useAchievements()` hook, unlock toast component, dedupe in `Stats`.
- **Weekly / monthly heat-map** on a stats page: color intensity per day,
  hover for that day's guess count / time / difficulty. Same shape as
  Wordle's calendar view.
- **Practice / random puzzle mode.** Skip today's puzzle without consuming
  the streak; play a random past puzzle for warm-up. Requires an
  "archive-lite" surface even after we hid the Archive nav.
- **Sound effects + haptics** on warm/hot guesses. Native Vibration API on
  mobile; a tiny WebAudio ping on desktop. Off by default with a toggle.

## B. Needs a tiny backend (edge function + KV store)

- **Global daily stats.** "42% of players solved today" and a distribution
  of guess counts across all players. One `POST /api/complete` per user per
  day, one `GET /api/stats/:date` for the page. Storage per day: a small
  bucketed counter (guess-count histogram + `hints_used` sum). Fits in
  Cloudflare Workers / Vercel KV / D1 free tier for a very long time.
- **Personal daily rank.** "#147 of 4,382 today" — derived from the same
  endpoint. Requires appending completed rows with a monotonic sequence
  per date.
- **Referral / friend battles.** Share a link with a specific date + track
  who beat whom. Needs a lightweight signed URL (session token) so we can
  attribute the second player's result back to the inviter. Optional
  private leaderboard tag per group of friends.
- **Server-side share images.** Generate an OG image per completed game
  (grid + brag tag + difficulty) so tweets link-previewed via Slack /
  iMessage render a bespoke card. Small edge function using satori/resvg.

## C. Content-shaped, needs an LLM tagging pass at build time

- **"Guess your specialty"** — after ~10 puzzles, infer
  "You're a 🫀 cardiologist" / "🧠 neurologist" from category performance.
  Requires each puzzle to carry a specialty tag; add a tagging step in the
  pipeline that asks an LLM to categorize each `secret` into a fixed
  taxonomy (cardiology, neurology, ID, endo, GI, heme/onc, derm, ophtho,
  ENT, MSK, GU/renal, obgyn, psych, pulm, emergency, other).
- **Per-puzzle emoji tag** (🫀 🧠 🩹 🦴 🫁 …) rendered in the header and
  woven into the share string. Same tagging pass produces both.
- **Category-specific achievements** — "Cardiology master (25 solves)" once
  categories exist.

## Recently shipped (2026-07-22)

- Solve-count distribution histogram in the win banner (Wordle-style).
- Puzzle difficulty stars (auto-computed at precompute time from
  nearest-neighbor cosine spread; 1–5 stars), rendered in the intro header
  and woven into the share string.
- Solve time tracker (per-puzzle), personal best surfaced in the win
  banner and included in the share string.
- Live countdown to the next puzzle (UTC midnight).
- Progress reset on model swap (v2 storage namespace).
- Bold Apple-inspired UI: full-row color tinting, iOS system palette,
  larger pill controls.
- Viral share flow: brag tag + hashtag, X/Twitter primary CTA, OG /
  Twitter card meta.

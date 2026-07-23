"""Have Claude play each puzzle blind and record its result in the puzzle JSON.

For every puzzle JSON in public/puzzles/, spin up an agent loop:
  • Show Claude the prompt (no answer, no top1000)
  • Claude proposes a guess
  • Score it against the puzzle (cosine to secret)
  • Feed back the score + rank + best-so-far list
  • Repeat until Claude solves, gives up, or hits the guess cap

The full transcript + final score is written to the puzzle JSON under
`ai_result`:

    "ai_result": {
      "won": true,
      "guesses": 7,
      "hints": 0,
      "timeS": 0,          # AI plays turn-by-turn, no wall-clock
      "final_guess": "myocardial infarction"
    }

Frontend consumes ai_result to show "You beat the AI" / "The AI beat you"
on the win banner.

Env:
  ANTHROPIC_API_KEY    required
  AI_MODEL             default "claude-opus-4-8"
  AI_GUESS_CAP         default 15
  AI_FORCE_REPLAY      if set to "1", replay puzzles that already have
                       ai_result. Otherwise skip them.
  DATE_START, DATE_END inclusive; defaults to whole public/puzzles/

Rate limit: sleeps 1s between API calls to stay well under any per-minute
budget.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PUB = ROOT / "public"
PUZZLES = PUB / "puzzles"
EMB = DATA / "embeddings"

MODEL = os.environ.get("AI_MODEL", "claude-opus-4-8")
GUESS_CAP = int(os.environ.get("AI_GUESS_CAP", "15"))
FORCE = os.environ.get("AI_FORCE_REPLAY") == "1"


def _load_vocab():
    words = [w.strip() for w in (EMB / "vocab.words").read_text().splitlines() if w.strip()]
    vecs = np.load(EMB / "vocab.npy")
    return words, vecs, {w: i for i, w in enumerate(words)}


def _score_guess(
    guess: str,
    secret_vec: np.ndarray,
    vecs: np.ndarray,
    idx_map: dict[str, int],
    aliases: dict[str, str],
) -> tuple[float | None, int | None, str]:
    """Return (display_score, rank_in_top1000_or_None, normalized_word).

    display_score is the same rescaled metric the frontend shows.
    """
    g = re.sub(r"[^a-z0-9 '\-]", " ", guess.lower())
    g = re.sub(r"\s+", " ", g).strip()
    if not g:
        return None, None, ""
    g = aliases.get(g, g)
    if g not in idx_map:
        return None, None, g
    v = vecs[idx_map[g]]
    cos = float(v @ secret_vec)
    return cos, None, g  # rank left for caller to compute if needed


def _agent_prompt(
    puzzle_num: int,
    clue: str,
    history: list[dict],
) -> list[dict]:
    """Build a fresh Messages payload from the current game state."""
    system = (
        "You are a competitive Clinicle player. Clinicle is a daily medical-"
        "diagnosis word game like Semantle. You are given a clue and must "
        "guess the single medical diagnosis (or the exact term) it describes. "
        "Each guess returns a similarity score (roughly 0-100, higher = "
        "closer semantically). The exact answer scores 100. Use each score "
        "to steer your next guess toward the target concept. Respond with a "
        "single word or short phrase only — no explanation, no reasoning, "
        "just the guess. Multi-word medical terms are fine (e.g. 'myocardial "
        "infarction'). Do NOT repeat guesses."
    )
    lines = [f"Clue: {clue}"]
    if history:
        lines.append("\nYour guesses so far:")
        for h in history:
            score_str = (
                f"{h['score']:.1f}"
                if h.get("score") is not None
                else "(not in vocab)"
            )
            lines.append(f"  - {h['word']} → {score_str}")
    lines.append("\nYour next guess (word or short phrase only):")
    return [
        {"role": "user", "content": "\n".join(lines)},
    ], system


def play_puzzle(client, puzzle: dict, vecs, idx_map, aliases) -> dict:
    secret = puzzle["secret"]
    secret_idx = idx_map.get(secret)
    if secret_idx is None:
        return {"won": False, "guesses": 0, "hints": 0, "timeS": 0, "final_guess": ""}
    secret_vec = vecs[secret_idx]

    # Rescale like the frontend does
    all_sims = vecs @ secret_vec
    p50 = float(np.median(all_sims))
    denom = max(1e-3, 1.0 - p50)

    def rescale(cos: float) -> float:
        return max(-30.0, min(100.0, (cos - p50) / denom * 100.0))

    clue = puzzle.get("prompt", "").strip() or "(no clue)"
    history: list[dict] = []
    for turn in range(GUESS_CAP):
        messages, system = _agent_prompt(puzzle["num"], clue, history)
        # Simple retry loop for transient API errors
        for attempt in range(4):
            try:
                resp = client.messages.create(
                    model=MODEL,
                    max_tokens=64,
                    system=system,
                    messages=messages,
                )
                break
            except Exception as e:  # noqa: BLE001
                wait = 2 ** attempt
                print(f"    API error ({e.__class__.__name__}); retrying in {wait}s", file=sys.stderr)
                time.sleep(wait)
        else:
            print(f"    giving up on turn {turn+1}", file=sys.stderr)
            break

        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        # Take just the first line, strip quotes/period
        guess_raw = text.splitlines()[0].strip().strip('"\'').rstrip('.').strip()
        cos, _, normalized = _score_guess(guess_raw, secret_vec, vecs, idx_map, aliases)
        score = rescale(cos) if cos is not None else None
        entry = {"word": normalized or guess_raw, "raw": guess_raw, "score": score, "cos": cos}
        history.append(entry)
        won = normalized == secret
        print(f"    #{turn+1}: {guess_raw!r} → {score if score is None else round(score,1)} {'✓ WON' if won else ''}")
        if won:
            return {
                "won": True,
                "guesses": turn + 1,
                "hints": 0,
                "timeS": 0,
                "final_guess": secret,
            }
        time.sleep(1)  # be nice to the API

    return {
        "won": False,
        "guesses": GUESS_CAP,
        "hints": 0,
        "timeS": 0,
        "final_guess": history[-1]["word"] if history else "",
    }


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set; skipping AI play.", file=sys.stderr)
        sys.exit(0)

    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    _, vecs, idx_map = _load_vocab()
    aliases_path = PUB / "abbreviations.json"
    aliases = json.loads(aliases_path.read_text()) if aliases_path.exists() else {}

    d0 = os.environ.get("DATE_START")
    d1 = os.environ.get("DATE_END")

    puzzle_files = sorted(PUZZLES.glob("*.json"))
    if d0:
        puzzle_files = [p for p in puzzle_files if p.stem >= d0]
    if d1:
        puzzle_files = [p for p in puzzle_files if p.stem <= d1]

    print(f"Playing {len(puzzle_files)} puzzles with {MODEL}")
    n_played = n_skipped = 0
    for pf in puzzle_files:
        p = json.loads(pf.read_text())
        if p.get("ai_result") and not FORCE:
            n_skipped += 1
            continue
        print(f"\n{pf.stem}: {p['secret']} — {p.get('prompt', '')[:80]}...")
        result = play_puzzle(client, p, vecs, idx_map, aliases)
        p["ai_result"] = result
        pf.write_text(json.dumps(p, separators=(",", ":")))
        n_played += 1
        print(f"  → {result}")

    print(f"\nDone. Played {n_played}, skipped {n_skipped} (already had ai_result).")


if __name__ == "__main__":
    main()

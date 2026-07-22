"""For each scheduled date, precompute the puzzle JSON the frontend loads.

Reads:
  data/schedule.json
  data/prompts.json
  data/embeddings/vocab.npy + vocab.words

Writes:
  public/vocab.json                 (once per run)
  public/puzzles/YYYY-MM-DD.json    (one per date in range)
  public/index.json                 (list of available dates + latest)

Puzzle JSON schema:
  {
    "date": "YYYY-MM-DD",
    "num": <int>,
    "prompt": "...",
    "secret": "diagnosis",
    "top1000": [["word", 87.34], ...],
    "scores": "<base64 Uint16 array>"
  }

Score encoding: stored = round((similarity_percent + 30) * 100), clamped to [0, 65535].
Decode: similarity_percent = stored / 100 - 30.
Rationale: SapBERT cosine can be slightly negative on medical/common word pairs;
30-pt offset gives 5-6k range for negatives while keeping resolution.

Env:
  DATE_START, DATE_END (inclusive, YYYY-MM-DD). Defaults: today .. today+30.
  MIN_TOP_SIM        minimum cosine similarity for the top neighbor of a
                     candidate secret. Below this the target is considered
                     weakly embedded and the date is skipped (Gemini embeddings
                     produce cosines in [-1, 1]; default 0.55 catches obviously
                     out-of-distribution words like Japanese loanwords).
"""
from __future__ import annotations

import base64
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PUB = ROOT / "public"
PUZZLES = PUB / "puzzles"
EMB = DATA / "embeddings"

TOP_N = 1000
MIN_TOP_SIM = float(os.environ.get("MIN_TOP_SIM", "0.55"))


def parse_date(s: str | None, default: date) -> date:
    if not s:
        return default
    return date.fromisoformat(s)


def encode_scores(arr: np.ndarray) -> str:
    # arr: float32, similarity in percent (roughly -30..100)
    q = np.clip(np.round((arr + 30) * 100), 0, 65535).astype(np.uint16)
    return base64.b64encode(q.tobytes()).decode("ascii")


def main() -> None:
    schedule = json.loads((DATA / "schedule.json").read_text())
    prompts = json.loads((DATA / "prompts.json").read_text()) if (DATA / "prompts.json").exists() else {}

    vocab = (EMB / "vocab.words").read_text().splitlines()
    vecs = np.load(EMB / "vocab.npy")
    if vecs.shape[0] != len(vocab):
        raise SystemExit(f"vocab/vecs size mismatch: {vecs.shape[0]} vs {len(vocab)}")

    word_to_idx = {w: i for i, w in enumerate(vocab)}

    today = date.today()
    d0 = parse_date(os.environ.get("DATE_START"), today)
    d1 = parse_date(os.environ.get("DATE_END"), today + timedelta(days=30))

    print(f"Precomputing {(d1 - d0).days + 1} puzzles from {d0} to {d1}")

    PUZZLES.mkdir(parents=True, exist_ok=True)
    # Ship vocab.json once (frontend caches it)
    (PUB / "vocab.json").write_text(json.dumps(vocab))

    all_dates: list[str] = []
    if (PUB / "index.json").exists():
        try:
            all_dates = json.loads((PUB / "index.json").read_text()).get("dates", [])
        except Exception:
            pass
    existing = set(all_dates)

    d = d0
    n = 0
    latest = None
    while d <= d1:
        iso = d.isoformat()
        dx = schedule.get(iso)
        if not dx:
            print(f"  {iso}: no scheduled diagnosis; skipping", file=sys.stderr)
            d += timedelta(days=1)
            continue
        if dx not in word_to_idx:
            print(f"  {iso}: '{dx}' not in vocab; skipping", file=sys.stderr)
            d += timedelta(days=1)
            continue

        sec_idx = word_to_idx[dx]
        sec_vec = vecs[sec_idx]
        sims = (vecs @ sec_vec)  # cosine (L2-normalized)

        # Quality gate: reject weakly-embedded targets. Rank 1 is always the
        # word itself (sim = 1.0); rank 2 is its nearest true neighbor.
        order = np.argsort(-sims)
        second_best = float(sims[order[1]]) if len(order) > 1 else 0.0
        if second_best < MIN_TOP_SIM:
            print(
                f"  {iso}: '{dx}' weakly embedded (top-neighbor cosine "
                f"{second_best:.3f} < {MIN_TOP_SIM}); skipping",
                file=sys.stderr,
            )
            d += timedelta(days=1)
            continue

        sims_pct = sims * 100.0
        top_idx = order[:TOP_N]
        top1000 = [[vocab[i], float(round(sims_pct[i], 2))] for i in top_idx]

        # Difficulty stars (1 = easy … 5 = hard). A target with a very close
        # nearest neighbor (near-synonym) is easier to find; an isolated
        # target (top neighbor far away in cosine space) is harder.
        # Rank-2 similarity is the signal since rank-1 is the word itself.
        # Thresholds are calibrated to the observed distribution across the
        # current schedule (p20 ≈ 0.918, p50 ≈ 0.949, p80 ≈ 0.972).
        nearest = float(sims[order[1]]) if len(order) > 1 else 0.0
        if nearest >= 0.97:
            difficulty = 1
        elif nearest >= 0.95:
            difficulty = 2
        elif nearest >= 0.93:
            difficulty = 3
        elif nearest >= 0.91:
            difficulty = 4
        else:
            difficulty = 5

        num = _puzzle_num(iso)
        payload = {
            "date": iso,
            "num": num,
            "prompt": prompts.get(dx, ""),
            "secret": dx,
            "difficulty": difficulty,
            "top1000": top1000,
            "scores": encode_scores(sims_pct.astype(np.float32)),
        }
        (PUZZLES / f"{iso}.json").write_text(json.dumps(payload, separators=(",", ":")))
        n += 1
        latest = iso
        if iso not in existing:
            all_dates.append(iso)
        d += timedelta(days=1)

    all_dates = sorted(set(all_dates))
    if not latest and all_dates:
        latest = max(all_dates)
    (PUB / "index.json").write_text(json.dumps({"latest": latest, "dates": all_dates}))
    print(f"Precomputed {n} puzzles. Index has {len(all_dates)} dates.")


def _puzzle_num(iso: str) -> int:
    # Puzzle number = days since 2026-01-01
    epoch = date(2026, 1, 1)
    return (date.fromisoformat(iso) - epoch).days + 1


if __name__ == "__main__":
    main()

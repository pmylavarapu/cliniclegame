"""Assign each diagnosis to a date. Deterministic, no repeats within 365 days.

Reads:  data/diagnoses.txt  data/schedule_start.txt (optional, default 2026-01-01)
Writes: data/schedule.json    {"YYYY-MM-DD": "diagnosis", ...}

Guarantees no repeat within max(365, len(diagnoses)) days (uses a seeded shuffle;
if diagnoses > 365, that naturally means 1+ year without repeat).
"""
from __future__ import annotations

import json
import random
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
# Prefer the puzzle-eligible subset (see scripts/build_top_diagnoses.py)
# so schedule picks only clinically prominent conditions. Fall back to the
# full diagnosis list if the top file hasn't been generated yet.
COMMON_500 = DATA / "diagnoses_common500.txt"
TOP_DIAGNOSES = DATA / "diagnoses_top.txt"
FULL_DIAGNOSES = DATA / "diagnoses.txt"
# Prefer the hand-curated common-500 subset when it's available so puzzle
# targets stay in the most-recognizable pool. Fall back to the top-1000
# auto-curated list, then the full diagnoses file.
if COMMON_500.exists():
    DIAGNOSES = COMMON_500
elif TOP_DIAGNOSES.exists():
    DIAGNOSES = TOP_DIAGNOSES
else:
    DIAGNOSES = FULL_DIAGNOSES
OUT = DATA / "schedule.json"
START_FILE = DATA / "schedule_start.txt"

SEED = 20260101
DEFAULT_START = date(2026, 1, 1)
HORIZON_DAYS = 365 * 3  # schedule 3 years out


def load_diagnoses() -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for line in DIAGNOSES.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        w = line.lower()
        if not re.match(r"^[a-z][a-z\-']{1,29}$", w):
            continue
        if w in seen:
            continue
        seen.add(w)
        out.append(w)
    return out


def load_start() -> date:
    if START_FILE.exists():
        s = START_FILE.read_text().strip()
        return date.fromisoformat(s)
    return DEFAULT_START


def main() -> None:
    dx = load_diagnoses()
    print(f"{len(dx)} unique diagnoses (from {DIAGNOSES.name})")
    if len(dx) < 365:
        # Common-500 pool is intentionally smaller; allow it, just note the
        # repeat cycle to the operator so it's not a surprise.
        print(
            f"NOTE: pool is smaller than 365 — diagnoses will repeat every "
            f"{len(dx)} days."
        )

    rnd = random.Random(SEED)
    pool = dx.copy()
    rnd.shuffle(pool)

    start = load_start()
    schedule: dict[str, str] = {}
    idx = 0
    epoch = 0
    for i in range(HORIZON_DAYS):
        if idx >= len(pool):
            epoch += 1
            rnd2 = random.Random(SEED + epoch)
            pool = dx.copy()
            rnd2.shuffle(pool)
            idx = 0
        d = start + timedelta(days=i)
        schedule[d.isoformat()] = pool[idx]
        idx += 1

    OUT.write_text(json.dumps(schedule, indent=2) + "\n")
    print(f"Wrote {len(schedule)} scheduled puzzles → {OUT.relative_to(ROOT)}")
    print(f"First: {min(schedule)} → {schedule[min(schedule)]}")
    print(f"Last:  {max(schedule)} → {schedule[max(schedule)]}")


if __name__ == "__main__":
    main()

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
DIAGNOSES = DATA / "diagnoses.txt"
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
    print(f"{len(dx)} unique diagnoses")
    if len(dx) < 365:
        raise SystemExit(f"Need >=365 diagnoses for no-repeat-per-year guarantee (got {len(dx)})")

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

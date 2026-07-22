"""Generate one flavor prompt per diagnosis via Claude.

Reads: data/diagnoses.txt (or a subset via env DX_SUBSET=file)
Writes: data/prompts.json  {"diagnosis": "one-sentence prompt", ...}

Cached — only calls the API for diagnoses missing from prompts.json.

Env:
  ANTHROPIC_API_KEY  required
  ANTHROPIC_MODEL    optional (default claude-haiku-4-5-20251001)
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DIAGNOSES = DATA / "diagnoses.txt"
OUT = DATA / "prompts.json"

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

SYSTEM = """You write one-sentence flavor prompts for a medical-guessing word game (like Semantle for diagnoses).

Rules for each prompt:
- Exactly ONE sentence, 15-35 words.
- Educational, factually correct, and interesting to a general reader.
- Must NOT mention the diagnosis name, any part of its stem, or an unambiguous eponym.
- Do not mention body parts or organ systems so obvious they trivialize the answer (use "an organ" or "a tissue" instead).
- Prefer clues about presentation, epidemiology, cultural depiction, complications, transmission, or history of medicine.
- Neutral clinical tone. No emojis, no first-person, no direct questions.
- Return the sentence only — no quotes, no lists, no preamble."""

USER_TEMPLATE = "Write one flavor prompt for the diagnosis: {dx}"


def load_diagnoses() -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for line in DIAGNOSES.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        w = line.lower()
        if re.match(r"^[a-z][a-z\-']{1,29}$", w) and w not in seen:
            seen.add(w)
            out.append(w)
    return out


def load_existing() -> dict[str, str]:
    if OUT.exists():
        try:
            return json.loads(OUT.read_text())
        except Exception:
            return {}
    return {}


def generate_one(client, dx: str) -> str:
    resp = client.messages.create(
        model=MODEL,
        max_tokens=256,
        system=SYSTEM,
        messages=[{"role": "user", "content": USER_TEMPLATE.format(dx=dx)}],
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    text = text.strip('"').strip()
    return text


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)

    subset_file = os.environ.get("DX_SUBSET")
    if subset_file:
        wanted = [l.strip() for l in Path(subset_file).read_text().splitlines() if l.strip()]
    else:
        wanted = load_diagnoses()

    prompts = load_existing()
    missing = [d for d in wanted if d not in prompts]
    print(f"{len(wanted)} diagnoses, {len(prompts)} already have prompts, {len(missing)} to generate")

    for i, dx in enumerate(missing):
        for attempt in range(3):
            try:
                p = generate_one(client, dx)
                prompts[dx] = p
                print(f"[{i+1}/{len(missing)}] {dx} — {p[:80]}...")
                break
            except Exception as e:
                print(f"  attempt {attempt+1} for {dx} failed: {e}", file=sys.stderr)
                time.sleep(2 ** attempt)
        else:
            print(f"  GIVING UP on {dx}", file=sys.stderr)
            continue
        if (i + 1) % 25 == 0:
            OUT.write_text(json.dumps(prompts, indent=2, sort_keys=True) + "\n")

    OUT.write_text(json.dumps(prompts, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {len(prompts)} prompts → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

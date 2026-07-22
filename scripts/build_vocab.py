"""Assemble the guess vocabulary — single-word medical + common English.

Output: data/vocab.txt (one word per line, sorted, unique)
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DIAGNOSES = DATA / "diagnoses.txt"
OUT = DATA / "vocab.txt"

WORD_RE = re.compile(r"^[a-z][a-z\-']{1,29}$")

COMMON_ENGLISH_SOURCES = [
    ("https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt", 10_000),
    ("https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt", 20_000),
]

MEDICAL_SEED_SOURCES = [
    "https://raw.githubusercontent.com/glutanimate/wordlist-medicalterms-en/master/wordlist.txt",
]


def load_diagnoses() -> set[str]:
    words: set[str] = set()
    for line in DIAGNOSES.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        w = line.lower()
        if WORD_RE.match(w):
            words.add(w)
    return words


def fetch_lines(url: str) -> list[str]:
    print(f"  fetching {url}")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    return [l.strip() for l in r.text.splitlines()]


def load_common_english() -> set[str]:
    words: set[str] = set()
    for url, _limit in COMMON_ENGLISH_SOURCES:
        try:
            for line in fetch_lines(url):
                w = line.lower().strip()
                if WORD_RE.match(w):
                    words.add(w)
        except Exception as e:
            print(f"  WARN: {url}: {e}", file=sys.stderr)
    return words


def load_medical_seed() -> set[str]:
    words: set[str] = set()
    for url in MEDICAL_SEED_SOURCES:
        try:
            for line in fetch_lines(url):
                # some medical wordlists include phrases; keep only single tokens
                for tok in re.split(r"\s+", line.lower()):
                    tok = tok.strip(".,;:()[]{}\"'")
                    if WORD_RE.match(tok):
                        words.add(tok)
        except Exception as e:
            print(f"  WARN: {url}: {e}", file=sys.stderr)
    return words


BAD_WORDS = {"fuck", "shit", "damn", "bitch", "cunt", "nigger", "faggot", "retard", "retarded"}


def main() -> None:
    print("Loading diagnoses...")
    dx = load_diagnoses()
    print(f"  {len(dx)} single-word diagnoses")

    print("Loading common English...")
    en = load_common_english()
    print(f"  {len(en)} English words")

    print("Loading medical seed vocabulary...")
    med = load_medical_seed()
    print(f"  {len(med)} medical words")

    dx = {w for w in dx if 2 <= len(w) <= 30} - BAD_WORDS
    en = {w for w in en if 2 <= len(w) <= 30} - BAD_WORDS
    med = {w for w in med if 2 <= len(w) <= 30} - BAD_WORDS

    max_vocab = int(os.environ.get("VOCAB_CAP", "50000"))
    core = dx | en
    remaining_budget = max(0, max_vocab - len(core))
    extra_med = sorted(med - core, key=lambda w: (len(w), w))[:remaining_budget]
    combined = core | set(extra_med)

    print(f"Total unique vocab: {len(combined)} (cap {max_vocab})")
    OUT.write_text("\n".join(sorted(combined)) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

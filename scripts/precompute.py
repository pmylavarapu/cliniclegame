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
    "difficulty": <int 1-3>,
    "top1000": [["word", 87.34], ...],
    "scores": "<base64 Uint16 array>",
    "synonyms": {"word": ["neighbor1", "neighbor2"], ...},
    "hints": [["word", 87.34, rank_in_top1000], ...]
  }

Hints: the subset of top1000 that is safe to suggest as a hint — words
that appear in one of the hand-curated files (diagnoses, adjuncts,
multiword medical, abbreviations, procedures, drugs). Filters out obscure
Latin morphemes and eponym fragments like 'valgus', 'venular', 'cirsoid'
that make sense as guesses but shouldn't be volunteered to a novice.

Synonyms: symmetric adjacency map among top-1000 words with pairwise cosine
≥ SYNONYM_SIM. Direct pairs only — no transitive merging — so "colitis"
and "ulcerative colitis" pair without dragging in every -itis. The frontend
uses this to reject a second guess that means the same as an earlier one
("heart attack" → "myocardial infarction"). Words with no near-synonyms
are absent from the map.

Score encoding: stored = round((display_percent + 30) * 100), clamped to [0, 65535].
Decode: display_percent = stored / 100 - 30.
The +30 offset preserves a small negative range for "colder than the median
vocab word" guesses.

Displayed score is NOT raw cosine — Gemini embeddings have a very high
baseline cosine (~0.75-0.85 between arbitrary English strings), so raw
scores would squash into 75-100 and lose all variance for the user.
Instead we anchor the median vocab similarity for this puzzle to 0 and
the exact-match similarity (1.0) to 100:
    display = (sim - p50) / (1 - p50) * 100
so a random guess lands near 0 and a true near-synonym stays near the top.

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
# Cosine threshold at or above which two top-1000 words are treated as
# semantic synonyms. Calibrated on Gemini embeddings so that heart-attack ↔
# MI (~0.95) and colitis ↔ ulcerative colitis (~0.97) pair, but colitis ↔
# crohns (~0.91) and takotsubo ↔ cardiomyopathy (~0.89) stay distinct.
SYNONYM_SIM = float(os.environ.get("SYNONYM_SIM", "0.94"))


def parse_date(s: str | None, default: date) -> date:
    if not s:
        return default
    return date.fromisoformat(s)


def encode_scores(arr: np.ndarray) -> str:
    # arr: float32, similarity in percent (roughly -30..100)
    q = np.clip(np.round((arr + 30) * 100), 0, 65535).astype(np.uint16)
    return base64.b64encode(q.tobytes()).decode("ascii")


def _shared_prefix_len(a: str, b: str) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def _morph_related(a: str, b: str) -> bool:
    """True when a and b look like morphological variants of the same
    underlying concept.

    Cosine alone can't distinguish 'blood' vs 'bleeding' (0.95, related
    physiology but not the same term) from 'bruise' vs 'bruising' (0.99,
    genuinely the same word). A stem-overlap gate cuts the first without
    losing the second.

    Rules:
      1. Reduce each word to its last whitespace-separated token
         ('ulcerative colitis' → 'colitis').
      2. If the cores match exactly → morph-related.
      3. If the cores share a 5-character prefix → morph-related.
      4. Otherwise → not morph-related.
    """
    ca = a.split()[-1]
    cb = b.split()[-1]
    if ca == cb:
        return True
    return _shared_prefix_len(ca, cb) >= 5


def synonym_map(
    words: list[str], vecs: np.ndarray, threshold: float
) -> dict[str, list[str]]:
    """Symmetric adjacency map of near-synonyms among `words`.

    For each word W, lists all OTHER words X where:
      • cosine(W, X) ≥ threshold, AND
      • W and X share a morphological stem (see _morph_related).

    The stem gate is what stops loose associations like blood ↔ bleeding
    from clustering while keeping bruise ↔ bruising and colitis ↔
    ulcerative colitis. No transitive merging.
    """
    n = len(words)
    if n == 0:
        return {}
    sims = vecs @ vecs.T
    np.fill_diagonal(sims, -1.0)
    out: dict[str, list[str]] = {}
    for i in range(n):
        js = np.where(sims[i] >= threshold)[0]
        if len(js) == 0:
            continue
        neighbors = [
            words[int(j)] for j in js if _morph_related(words[i], words[int(j)])
        ]
        if neighbors:
            out[words[i]] = neighbors
    return out


def load_hint_pool() -> set[str]:
    """Union of the hand-curated vocab files. Words in this set are
    considered safe to suggest as a hint. Words outside — obscure Latin
    morphemes, eponym fragments — stay guessable but won't be volunteered.
    """
    import re
    files = [
        "diagnoses.txt",
        "diagnoses_top.txt",
        "adjuncts.txt",
        "multiword_medical.txt",
        "procedures.txt",
        "drugs.txt",
    ]
    out: set[str] = set()
    for fname in files:
        p = DATA / fname
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            w = re.sub(r"\s+", " ", s.lower()).strip()
            if w:
                out.add(w)
    # Abbreviations: file is 'abbr|expansion'; only the abbr is a vocab entry.
    p = DATA / "abbreviations.txt"
    if p.exists():
        for line in p.read_text().splitlines():
            s = line.strip()
            if not s or s.startswith("#") or "|" not in s:
                continue
            abbr = s.split("|", 1)[0].strip().lower()
            if abbr:
                out.add(abbr)
    return out


def main() -> None:
    schedule = json.loads((DATA / "schedule.json").read_text())
    prompts = json.loads((DATA / "prompts.json").read_text()) if (DATA / "prompts.json").exists() else {}
    hint_pool_vocab = load_hint_pool()

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

        # Rescale similarities so the puzzle's median-vocab guess sits at 0
        # and the exact-match sits at 100. Without this, Gemini's high
        # baseline cosine squashes every guess into ~75-90 and the score
        # loses all discriminating power. See module docstring.
        p50 = float(np.median(sims))
        denom = max(1e-3, 1.0 - p50)
        display = (sims - p50) / denom * 100.0
        display = np.clip(display, -30.0, 100.0)

        sims_pct = display  # legacy name; downstream uses this for storage
        top_idx = order[:TOP_N]
        top1000 = [[vocab[i], float(round(sims_pct[i], 2))] for i in top_idx]

        top_words = [vocab[i] for i in top_idx]
        top_vecs = vecs[top_idx]
        synonyms = synonym_map(top_words, top_vecs, SYNONYM_SIM)

        # Hint pool: subset of top1000 restricted to curated vocab so hints
        # never surface obscure Latin fragments. Rank 1 is the secret itself
        # and is always eligible (that's how "give up" reveals the answer).
        hints: list[list[object]] = []
        for i, (w, s) in enumerate(top1000):
            if w in hint_pool_vocab or i == 0:
                hints.append([w, s, i + 1])

        # Difficulty stars (1-5). Buckets by rank-2 cosine similarity
        # (rank-1 is the word itself). Frontend collapses to 3 labels for
        # color: 1-2 = Easy (green), 3 = Medium (orange), 4-5 = Hard (red).
        # Thresholds calibrated to the observed schedule distribution
        # (p20 ≈ 0.918, p50 ≈ 0.949, p80 ≈ 0.972).
        nearest = float(sims[order[1]]) if len(order) > 1 else 0.0
        if nearest >= 0.97:
            difficulty = 1
        elif nearest >= 0.95:
            difficulty = 2
        elif nearest >= 0.92:
            difficulty = 3
        elif nearest >= 0.89:
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
            "synonyms": synonyms,
            "hints": hints,
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

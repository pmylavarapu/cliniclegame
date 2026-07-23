"""Embed the guess vocabulary with Google Gemini embeddings.

Output: data/embeddings/vocab.npy   float32, L2-normalized, shape (N, D)
        data/embeddings/vocab.words  aligned phrase list

Cached — re-runs skip phrases already embedded.

Env:
  GOOGLE_API_KEY (required)       Google AI Studio API key
  GEMINI_EMBED_MODEL              default "gemini-embedding-001"
  GEMINI_EMBED_DIM                default 768 (256 | 768 | 1536 | 3072)
  EMBED_BATCH                     default 100 (max the API accepts per call)
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import numpy as np
from tqdm import tqdm

MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
DIM = int(os.environ.get("GEMINI_EMBED_DIM", "768"))
BATCH = int(os.environ.get("EMBED_BATCH", "100"))
# Free tier is 100 RPM. Pace conservatively below that.
RPM = int(os.environ.get("EMBED_RPM", "90"))
MIN_INTERVAL = 60.0 / RPM
TASK_TYPE = "SEMANTIC_SIMILARITY"

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EMB = DATA / "embeddings"
VOCAB = DATA / "vocab.txt"
ABBREVIATIONS = DATA / "abbreviations.txt"


def load_abbreviation_map() -> dict[str, str]:
    """Return {abbreviation: 'abbreviation (full expansion)'}.

    The value is the string sent to the embedding model — putting both
    the short form and the expansion in the same input steers the vector
    toward the true meaning while keeping the abbreviation's own token
    influence in play. The stored vocab word remains the abbreviation.
    """
    out: dict[str, str] = {}
    if not ABBREVIATIONS.exists():
        return out
    for line in ABBREVIATIONS.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "|" not in s:
            continue
        abbr, expansion = s.split("|", 1)
        abbr = abbr.strip().lower()
        expansion = expansion.strip()
        if abbr and expansion:
            out[abbr] = f"{abbr.upper()} ({expansion})"
    return out

EMB.mkdir(parents=True, exist_ok=True)


def load_vocab() -> list[str]:
    return [l.strip() for l in VOCAB.read_text().splitlines() if l.strip()]


def load_cache() -> tuple[list[str], np.ndarray] | tuple[list[str], None]:
    words_file = EMB / "vocab.words"
    vecs_file = EMB / "vocab.npy"
    if not words_file.exists() or not vecs_file.exists():
        return [], None
    words = [l.strip() for l in words_file.read_text().splitlines() if l.strip()]
    vecs = np.load(vecs_file)
    if vecs.shape[0] != len(words):
        print(
            f"WARN: cache word/vec size mismatch ({len(words)} vs {vecs.shape[0]}); "
            "discarding cache",
            file=sys.stderr,
        )
        return [], None
    return words, vecs


def _parse_retry_delay(err: Exception) -> float | None:
    """Extract retryDelay (seconds) from a Google API RESOURCE_EXHAUSTED error."""
    import re

    s = str(err)
    m = re.search(r"'retryDelay':\s*'(\d+(?:\.\d+)?)s'", s)
    if m:
        return float(m.group(1))
    m = re.search(r"retry in ([\d.]+)s", s)
    if m:
        return float(m.group(1))
    return None


def embed_batch(client, phrases: list[str]) -> np.ndarray:
    from google.genai import types

    last_err: Exception | None = None
    for attempt in range(8):
        try:
            resp = client.models.embed_content(
                model=MODEL,
                contents=phrases,
                config=types.EmbedContentConfig(
                    task_type=TASK_TYPE,
                    output_dimensionality=DIM,
                ),
            )
            arr = np.asarray(
                [e.values for e in resp.embeddings], dtype=np.float32
            )
            norms = np.linalg.norm(arr, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            return arr / norms
        except Exception as e:  # noqa: BLE001
            last_err = e
            hinted = _parse_retry_delay(e)
            # Honor server hint if present; otherwise exponential backoff
            wait = (hinted + 2.0) if hinted is not None else min(120.0, 2 ** (attempt + 1))
            print(
                f"  batch failed (attempt {attempt + 1}/8): {type(e).__name__}: "
                f"{str(e)[:200]}...; sleeping {wait:.1f}s",
                file=sys.stderr,
            )
            time.sleep(wait)
    raise RuntimeError(f"embedding batch failed after retries: {last_err}")


def main() -> None:
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit(
            "GOOGLE_API_KEY (or GEMINI_API_KEY) is required. "
            "Get one at https://aistudio.google.com/app/apikey"
        )

    from google import genai

    client = genai.Client(api_key=api_key)

    vocab = load_vocab()
    print(f"Vocab size: {len(vocab)}")

    abbr_map = load_abbreviation_map()
    print(f"Abbreviations: {len(abbr_map)} (always re-embedded)")

    cached_words, cached_vecs = load_cache()
    cached_set = set(cached_words)
    # Abbreviations always re-embed so we don't ship a cached English
    # embedding for something like "lad" instead of the medical meaning.
    to_embed = [w for w in vocab if w not in cached_set or w in abbr_map]
    print(f"Cached: {len(cached_words)}   To embed: {len(to_embed)}")

    # Drop any stale cached rows we're about to re-embed so they don't
    # collide during the reindex step at the end.
    if abbr_map:
        keep = [i for i, w in enumerate(cached_words) if w not in abbr_map]
        if len(keep) != len(cached_words):
            cached_words = [cached_words[i] for i in keep]
            if cached_vecs is not None:
                cached_vecs = cached_vecs[keep]
            print(f"Dropped {len(cached_set) - len(keep)} stale abbrev rows from cache")

    if to_embed:
        print(f"Model: {MODEL}   dim: {DIM}   batch: {BATCH}   pacing: {RPM} RPM")
        new_vecs: list[np.ndarray] = []
        last_call = 0.0
        cache_words = list(cached_words)
        cache_vecs_stack: list[np.ndarray] = [cached_vecs] if cached_vecs is not None else []
        try:
            for i in tqdm(range(0, len(to_embed), BATCH), desc="embed"):
                elapsed = time.time() - last_call
                if elapsed < MIN_INTERVAL:
                    time.sleep(MIN_INTERVAL - elapsed)
                batch = to_embed[i : i + BATCH]
                # Substitute expansion text for known abbreviations so
                # cosine reflects the medical meaning, not the bare
                # 2-3 letter surface form.
                batch_send = [abbr_map.get(w, w) for w in batch]
                vecs_batch = embed_batch(client, batch_send)
                last_call = time.time()
                new_vecs.append(vecs_batch)
                # Incrementally checkpoint every ~50 batches so we don't lose
                # progress if the run is interrupted or hits the daily quota.
                if (len(new_vecs) % 50) == 0:
                    cur_new = np.vstack(new_vecs)
                    stack = cache_vecs_stack + [cur_new]
                    cur_all = np.vstack(stack)
                    cur_words = cache_words + to_embed[: (i + BATCH)]
                    np.save(EMB / "vocab.npy", cur_all)
                    (EMB / "vocab.words").write_text("\n".join(cur_words) + "\n")
        except Exception:
            # Save whatever we've collected before re-raising
            if new_vecs:
                partial = np.vstack(new_vecs)
                stack = cache_vecs_stack + [partial]
                cur_all = np.vstack(stack)
                cur_words = cache_words + to_embed[: len(cur_all) - len(cache_words)]
                np.save(EMB / "vocab.npy", cur_all)
                (EMB / "vocab.words").write_text("\n".join(cur_words) + "\n")
                print(
                    f"\n  saved partial checkpoint: {len(cur_words)} phrases embedded",
                    file=sys.stderr,
                )
            raise
        new_arr = np.vstack(new_vecs) if new_vecs else np.zeros((0, DIM), dtype=np.float32)
        if cached_vecs is not None and cached_vecs.shape[1] != new_arr.shape[1]:
            print(
                f"WARN: cached dim {cached_vecs.shape[1]} != new dim {new_arr.shape[1]}; "
                "discarding cache",
                file=sys.stderr,
            )
            cached_words, cached_vecs = [], None
        all_words = list(cached_words) + to_embed
        all_vecs = (
            np.vstack([cached_vecs, new_arr]) if cached_vecs is not None else new_arr
        )
    else:
        all_words, all_vecs = cached_words, cached_vecs

    # Reindex to match vocab.txt order
    word_to_row = {w: i for i, w in enumerate(all_words)}
    order = [word_to_row[w] for w in vocab if w in word_to_row]
    vecs = all_vecs[order]

    print(f"Shape: {vecs.shape}")
    np.save(EMB / "vocab.npy", vecs)
    (EMB / "vocab.words").write_text("\n".join(vocab) + "\n")
    print(f"Wrote {EMB / 'vocab.npy'} and {EMB / 'vocab.words'}")


if __name__ == "__main__":
    main()

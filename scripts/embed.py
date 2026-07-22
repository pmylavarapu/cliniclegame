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
TASK_TYPE = "SEMANTIC_SIMILARITY"

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EMB = DATA / "embeddings"
VOCAB = DATA / "vocab.txt"

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


def embed_batch(client, phrases: list[str]) -> np.ndarray:
    from google.genai import types

    last_err: Exception | None = None
    for attempt in range(6):
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
            wait = min(60.0, 2**attempt)
            print(
                f"  batch failed (attempt {attempt + 1}/6): {e}; retrying in {wait}s",
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

    cached_words, cached_vecs = load_cache()
    cached_set = set(cached_words)
    to_embed = [w for w in vocab if w not in cached_set]
    print(f"Cached: {len(cached_words)}   To embed: {len(to_embed)}")

    if to_embed:
        print(f"Model: {MODEL}   dim: {DIM}   batch: {BATCH}")
        new_vecs: list[np.ndarray] = []
        for i in tqdm(range(0, len(to_embed), BATCH), desc="embed"):
            batch = to_embed[i : i + BATCH]
            new_vecs.append(embed_batch(client, batch))
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

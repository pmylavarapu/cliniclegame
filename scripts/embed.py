"""Embed the guess vocabulary with SapBERT (biomedical concept encoder).

Output: data/embeddings/vocab.npy   float32, L2-normalized, shape (N, 768)
        data/embeddings/vocab.words  aligned phrase list

SapBERT (Liu et al., 2021) is a PubMedBERT variant contrastively fine-tuned
on UMLS synonym pairs, so it clusters clinical concepts by identity/
relatedness far more tightly than a general-purpose text embedder. That
is exactly the axis a game like Clinicle scores on — "MI ↔ heart attack"
sits at cosine ~0.9, while "MI ↔ myopathy" (only textually similar) is
far lower.

Cached — re-runs skip phrases already present in vocab.words. If the
cached vectors have a different dimension than the current model, the
whole cache is discarded upfront so we don't ship a mixed-dim file.

Env:
  SAPBERT_MODEL   default 'cambridgeltl/SapBERT-from-PubMedBERT-fulltext'
  EMBED_BATCH     default 64  (larger uses more RAM; smaller runs slower)
  EMBED_MAX_LEN   default 64  (medical concept phrases are short)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
from tqdm import tqdm

MODEL = os.environ.get("SAPBERT_MODEL", "cambridgeltl/SapBERT-from-PubMedBERT-fulltext")
BATCH = int(os.environ.get("EMBED_BATCH", "64"))
MAX_LEN = int(os.environ.get("EMBED_MAX_LEN", "64"))

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EMB = DATA / "embeddings"
VOCAB = DATA / "vocab.txt"
ABBREVIATIONS = DATA / "abbreviations.txt"

EMB.mkdir(parents=True, exist_ok=True)


def load_abbreviation_map() -> dict[str, str]:
    """Return {abbreviation: 'ABBR (full expansion)'} — the string we
    actually embed for abbreviations, so cosine reflects the medical
    meaning rather than the bare 2–3 letter surface form.
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


def load_vocab() -> list[str]:
    return [l.strip() for l in VOCAB.read_text().splitlines() if l.strip()]


def load_cache(expected_dim: int | None) -> tuple[list[str], np.ndarray] | tuple[list[str], None]:
    words_file = EMB / "vocab.words"
    vecs_file = EMB / "vocab.npy"
    if not words_file.exists() or not vecs_file.exists():
        return [], None
    words = [l.strip() for l in words_file.read_text().splitlines() if l.strip()]
    vecs = np.load(vecs_file)
    if vecs.shape[0] != len(words):
        print(
            f"WARN: cache word/vec size mismatch ({len(words)} vs {vecs.shape[0]}); discarding",
            file=sys.stderr,
        )
        return [], None
    if expected_dim is not None and vecs.shape[1] != expected_dim:
        print(
            f"Cached embeddings are dim {vecs.shape[1]}, current model produces dim "
            f"{expected_dim}; discarding cache (will re-embed everything).",
            file=sys.stderr,
        )
        return [], None
    return words, vecs


def _encode_batch(model, tokenizer, phrases: list[str], device):
    import torch

    enc = tokenizer(
        phrases,
        padding=True,
        truncation=True,
        max_length=MAX_LEN,
        return_tensors="pt",
    ).to(device)
    with torch.no_grad():
        out = model(**enc)
    # SapBERT convention: [CLS] token embedding, then L2-normalize.
    cls = out.last_hidden_state[:, 0, :].cpu().numpy().astype(np.float32)
    norms = np.linalg.norm(cls, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return cls / norms


def main() -> None:
    import torch
    from transformers import AutoModel, AutoTokenizer

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Model: {MODEL}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModel.from_pretrained(MODEL).to(device).eval()
    dim = model.config.hidden_size

    vocab = load_vocab()
    print(f"Vocab size: {len(vocab)}   dim: {dim}   batch: {BATCH}   max_len: {MAX_LEN}")

    abbr_map = load_abbreviation_map()
    print(f"Abbreviations: {len(abbr_map)} (always re-embedded)")

    cached_words, cached_vecs = load_cache(expected_dim=dim)
    cached_set = set(cached_words)
    to_embed = [w for w in vocab if w not in cached_set or w in abbr_map]
    print(f"Cached: {len(cached_words)}   To embed: {len(to_embed)}")

    if abbr_map and cached_words:
        keep = [i for i, w in enumerate(cached_words) if w not in abbr_map]
        if len(keep) != len(cached_words):
            cached_words = [cached_words[i] for i in keep]
            if cached_vecs is not None:
                cached_vecs = cached_vecs[keep]
            print(f"Dropped {len(cached_set) - len(keep)} stale abbrev rows from cache")

    if to_embed:
        new_vecs: list[np.ndarray] = []
        cache_words = list(cached_words)
        cache_vecs_stack: list[np.ndarray] = (
            [cached_vecs] if cached_vecs is not None else []
        )
        try:
            for i in tqdm(range(0, len(to_embed), BATCH), desc="embed"):
                batch = to_embed[i : i + BATCH]
                # Substitute expansion text for known abbreviations so
                # SapBERT sees the medical concept, not the 2-3 letter form.
                batch_send = [abbr_map.get(w, w) for w in batch]
                vecs_batch = _encode_batch(model, tokenizer, batch_send, device)
                new_vecs.append(vecs_batch)
                # Checkpoint every 20 batches so a mid-run kill keeps most work.
                if (len(new_vecs) % 20) == 0:
                    cur_new = np.vstack(new_vecs)
                    stack = cache_vecs_stack + [cur_new]
                    cur_all = np.vstack(stack)
                    cur_words = cache_words + to_embed[: (i + BATCH)]
                    np.save(EMB / "vocab.npy", cur_all)
                    (EMB / "vocab.words").write_text("\n".join(cur_words) + "\n")
        except Exception:
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
        new_arr = (
            np.vstack(new_vecs) if new_vecs else np.zeros((0, dim), dtype=np.float32)
        )
        all_words = list(cached_words) + to_embed
        all_vecs = (
            np.vstack([cached_vecs, new_arr]) if cached_vecs is not None else new_arr
        )
    else:
        all_words, all_vecs = cached_words, cached_vecs

    # Reindex to match vocab.txt order.
    word_to_row = {w: i for i, w in enumerate(all_words)}
    order = [word_to_row[w] for w in vocab if w in word_to_row]
    vecs = all_vecs[order]

    print(f"Shape: {vecs.shape}")
    np.save(EMB / "vocab.npy", vecs)
    (EMB / "vocab.words").write_text("\n".join(vocab) + "\n")
    print(f"Wrote {EMB / 'vocab.npy'} and {EMB / 'vocab.words'}")


if __name__ == "__main__":
    main()

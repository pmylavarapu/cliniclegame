"""Embed the guess vocabulary with SapBERT.

Output: data/embeddings/vocab.npy   float32, L2-normalized, shape (N, D)
        data/embeddings/vocab.words  aligned word list

Cached — re-runs skip words already embedded.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import torch
from tqdm import tqdm

MODEL_NAME = os.environ.get("SAPBERT_MODEL", "cambridgeltl/SapBERT-from-PubMedBERT-fulltext")
BATCH = int(os.environ.get("EMBED_BATCH", "128"))

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EMB = DATA / "embeddings"
VOCAB = DATA / "vocab.txt"

EMB.mkdir(parents=True, exist_ok=True)


def load_vocab() -> list[str]:
    return [l.strip() for l in VOCAB.read_text().splitlines() if l.strip()]


def encode(model, tokenizer, words: list[str], device: str) -> np.ndarray:
    from transformers import AutoTokenizer  # noqa: F401

    vecs: list[np.ndarray] = []
    model.eval()
    for i in tqdm(range(0, len(words), BATCH), desc="embed"):
        batch = words[i : i + BATCH]
        enc = tokenizer(batch, padding=True, truncation=True, max_length=32, return_tensors="pt").to(device)
        with torch.no_grad():
            out = model(**enc)
            # SapBERT convention: use [CLS] token
            cls = out.last_hidden_state[:, 0, :]
            cls = torch.nn.functional.normalize(cls, dim=-1)
        vecs.append(cls.cpu().numpy().astype(np.float32))
    return np.vstack(vecs)


def main() -> None:
    from transformers import AutoModel, AutoTokenizer

    words = load_vocab()
    print(f"Vocab size: {len(words)}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")
    print(f"Loading {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME).to(device)

    print("Encoding...")
    vecs = encode(model, tokenizer, words, device)
    print(f"Shape: {vecs.shape}")

    np.save(EMB / "vocab.npy", vecs)
    (EMB / "vocab.words").write_text("\n".join(words) + "\n")
    print(f"Wrote {EMB / 'vocab.npy'} and {EMB / 'vocab.words'}")


if __name__ == "__main__":
    main()

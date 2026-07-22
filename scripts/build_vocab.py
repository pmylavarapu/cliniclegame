"""Assemble the guess vocabulary — MeSH concepts + curated diagnoses + common English + adjuncts.

Output: data/vocab.txt (one phrase per line, sorted, unique)

Sources:
  - MeSH descriptor names + entry terms (fetched from NLM if not cached)
    Includes anatomy (heart, lung, kidney), physiology, and clinical concepts.
  - data/diagnoses.txt (curated list; multi-word ok)
  - Common English top-N (for adjectives, cold guesses, and everyday vocab
    that gets used to describe symptoms: sharp, dull, throbbing, sudden…)
  - data/adjuncts.txt (optional) — hand-curated medical-adjacent words that
    aren't in MeSH or the English top-N. Edit freely.

With semantic embeddings (Gemini), extra vocabulary is safe — words unrelated
to the target correctly rank low. Be permissive; err on the side of inclusion.

Cache:
  data/mesh_desc.xml   MeSH DescriptorRecordSet XML (~350MB, one-time download)

Env:
  MESH_YEAR       default "2025"
  MESH_URL        override the download URL entirely
  VOCAB_CAP       default 80000
  ENGLISH_CAP     default 15000 (top-N common English to include)
"""
from __future__ import annotations

import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DIAGNOSES = DATA / "diagnoses.txt"
ADJUNCTS = DATA / "adjuncts.txt"
MESH_CACHE = DATA / "mesh_desc.xml"
OUT = DATA / "vocab.txt"

MESH_YEAR = os.environ.get("MESH_YEAR", "2025")
MESH_URL = os.environ.get(
    "MESH_URL",
    f"https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/desc{MESH_YEAR}.xml",
)

VOCAB_CAP = int(os.environ.get("VOCAB_CAP", "80000"))
ENGLISH_CAP = int(os.environ.get("ENGLISH_CAP", "15000"))
ENGLISH_URL = (
    "https://raw.githubusercontent.com/first20hours/google-10000-english/"
    "master/google-10000-english.txt"
)

# Names / eponyms / non-medical strays that leaked in via the old scraped source.
# Kept as a small explicit denylist; MeSH-derived vocab shouldn't contain most of these
# but we double-check anyway.
DENYLIST = {
    "vasey", "cabot's", "cabot", "sudek", "brocki", "brock", "sinskey",
    "turck's", "turck", "kent's", "kent", "sinistr", "tachy-",
    "blaubok", "peyotl", "tanya", "takaki", "akiyami", "tao",
    "yukon", "turismo", "cardoons", "cardoon", "tournay",
    "fuck", "shit", "damn", "bitch", "cunt",
    "nigger", "faggot", "retard", "retarded",
}

PHRASE_RE = re.compile(r"^[a-z0-9][a-z0-9 '\-]{1,58}[a-z0-9]$")


def normalize(s: str) -> str:
    s = s.strip().lower()
    # Strip anything that isn't letters/digits/space/apostrophe/hyphen
    s = re.sub(r"[^a-z0-9 '\-]", " ", s)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def acceptable(s: str) -> bool:
    if not s:
        return False
    if s in DENYLIST:
        return False
    if not PHRASE_RE.match(s):
        return False
    # Drop bare 1-2 character tokens that aren't real words
    if len(s) < 3:
        return False
    # Drop pure punctuation fragments
    if s.replace("-", "").replace("'", "").replace(" ", "") == "":
        return False
    return True


def download_mesh(url: str, dest: Path) -> None:
    print(f"  downloading {url}")
    print(f"  → {dest}   (this is a large file, may take several minutes)")
    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        written = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                f.write(chunk)
                written += len(chunk)
                if total:
                    pct = written * 100 // total
                    print(f"\r  {written // (1024 * 1024)} MB / {total // (1024 * 1024)} MB ({pct}%)", end="", file=sys.stderr)
        print(file=sys.stderr)


def parse_mesh(path: Path) -> set[str]:
    """Extract descriptor names + concept entry terms from MeSH XML."""
    print(f"  parsing {path}")
    words: set[str] = set()
    # Stream-parse to keep memory reasonable on the 350MB file
    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag != "DescriptorRecord":
            continue
        # DescriptorName
        for dn in elem.findall("DescriptorName/String"):
            if dn.text:
                w = normalize(dn.text)
                if acceptable(w):
                    words.add(w)
        # Concept Term list (synonyms / entry terms)
        for term in elem.findall("ConceptList/Concept/TermList/Term/String"):
            if term.text:
                w = normalize(term.text)
                if acceptable(w):
                    words.add(w)
        elem.clear()
    return words


def load_diagnoses() -> set[str]:
    return _load_curated(DIAGNOSES)


def load_adjuncts() -> set[str]:
    return _load_curated(ADJUNCTS)


def _load_curated(path: Path) -> set[str]:
    words: set[str] = set()
    if not path.exists():
        return words
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        w = normalize(line)
        if acceptable(w):
            words.add(w)
    return words


def load_common_english() -> set[str]:
    print(f"  fetching {ENGLISH_URL}")
    r = requests.get(ENGLISH_URL, timeout=60)
    r.raise_for_status()
    words: set[str] = set()
    for line in r.text.splitlines()[:ENGLISH_CAP]:
        w = normalize(line)
        if acceptable(w):
            words.add(w)
    return words


def main() -> None:
    print("Loading MeSH descriptors + entry terms...")
    if not MESH_CACHE.exists():
        try:
            download_mesh(MESH_URL, MESH_CACHE)
        except Exception as e:
            raise SystemExit(
                f"\nFailed to download MeSH from {MESH_URL}: {e}\n"
                f"Download it manually and place at {MESH_CACHE}, then re-run.\n"
                f"Alternate URL patterns: nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/desc{MESH_YEAR}.xml"
            )
    mesh = parse_mesh(MESH_CACHE)
    print(f"  {len(mesh)} MeSH phrases")

    print("Loading curated diagnoses...")
    dx = load_diagnoses()
    print(f"  {len(dx)} diagnoses")

    print("Loading medical adjuncts...")
    adj = load_adjuncts()
    print(f"  {len(adj)} adjuncts")

    print(f"Loading top {ENGLISH_CAP} common English words...")
    try:
        en = load_common_english()
        print(f"  {len(en)} English words")
    except Exception as e:
        print(f"  WARN: skipping common English: {e}", file=sys.stderr)
        en = set()

    combined = mesh | dx | adj | en
    if VOCAB_CAP and len(combined) > VOCAB_CAP:
        # Prefer shorter phrases when capping (more likely to be well-known concepts)
        combined = set(sorted(combined, key=lambda w: (len(w), w))[:VOCAB_CAP])

    print(f"Total unique vocab: {len(combined)} (cap {VOCAB_CAP})")
    OUT.write_text("\n".join(sorted(combined)) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

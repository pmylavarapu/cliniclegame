"""Produce data/diagnoses_top.txt — the puzzle-eligible subset of diagnoses.

Not every entry in data/diagnoses.txt makes a good daily puzzle target. The
"Additional single-word conditions (recognizable / eponyms)" section, in
particular, contains everything from real diseases to bare eponym surnames
to plainly non-diagnostic words ("aeroplane", "walking", "wax"). Puzzle
selection should draw from a cleaner pool.

This script:
  1. Takes every entry from the clinically-organized sections (Cardiovascular,
     Respiratory, ..., "More single-word conditions", "Rare-but-guessable").
  2. From the noisy "Additional" section, admits only entries that either
     match a canonical medical suffix (-itis, -osis, -oma, -pathy, -emia,
     -algia, ...) OR are on a small hand-curated allowlist of common
     conditions.
  3. Applies an explicit denylist for known junk.

Output: data/diagnoses_top.txt (one diagnosis per line, sorted).
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SRC = DATA / "diagnoses.txt"
OUT = DATA / "diagnoses_top.txt"

NOISY_SECTION = "Additional single-word conditions (recognizable / eponyms)"

MED_SUFFIXES = re.compile(
    r"(itis|osis|oma|pathy|emia|aemia|uria|algia|ectomy|plasia|phobia|mania|"
    r"otomy|rrhea|pnea|phagia|esthesia|paresis|plegia|trophy|trophia|cele|"
    r"ptosis|stenosis|sclerosis|dynia|rhagia|penia|cytosis|philia|scopy|"
    r"gnosia|opsia|opia|oscopy|iasis|osmia|geusia|oedema|itisis|ism)$"
)

DENY = {
    # Non-diagnostic words that slipped into the additional section
    "aeroplane", "walking", "water", "wax", "wet", "wind", "yeast", "yellow",
    "nightmare", "normal", "node", "nodule", "boil", "bedwetting", "wound",
    "weakness", "vomiting", "belching", "west", "wheat", "ostium",
    "ossification", "ocular", "organic", "occult", "occupational",
    "nutritional", "nonspecific", "normocephalic", "normocytic", "vitamin",
    # Bare adjectives — not diagnoses on their own
    "vertebral", "vestibular", "venereal", "viral", "visceral", "vocal",
    "vulvar", "varus", "vascular", "vasovagal", "velopharyngeal", "venous",
    "orthostatic", "antisocial", "borderline", "breech", "basilar",
    "bacillary", "atopic", "atrial", "amyloid", "aphthous", "allergic",
    # Eponym-only surnames — hard puzzle targets, unfair without disease suffix
    "achilles", "bells", "becker", "babinski", "bordetella", "botulinum",
    "brocas", "brugada", "biotinidase", "boxers", "bowlegs",
    "aeroembolism", "aerophagia", "adenoids", "alveolitis", "avulsion",
    "ankylosis", "bronchospasm",
}

# Common conditions worth including even though they don't match a suffix.
ALLOW = {
    "abscess", "asthma", "gout", "flu", "angina", "anemia", "anaphylaxis",
    "angioedema", "aneurysm", "babesiosis", "bronchiolitis", "bronchitis",
    "bronchiectasis", "burnout", "callus", "cataract", "cellulitis",
    "chalazion", "cholera", "concussion", "contusion", "croup", "dandruff",
    "dehydration", "diphtheria", "edema", "embolism", "fasciitis",
    "flatulence", "frostbite", "gangrene", "glaucoma", "goiter", "halitosis",
    "hangover", "headache", "heartburn", "hemorrhoid", "hernia", "herpes",
    "hiccup", "hoarseness", "indigestion", "insomnia", "jaundice",
    "keratitis", "laryngitis", "leukemia", "lipoma", "lockjaw", "lumbago",
    "lupus", "lymphoma", "malaria", "mastitis", "measles", "melanoma",
    "meningitis", "menopause", "miscarriage", "mumps", "myopia", "narcolepsy",
    "nausea", "neuralgia", "nystagmus", "obesity", "otitis", "palsy",
    "pancreatitis", "panic", "paralysis", "pertussis", "pharyngitis",
    "phlebitis", "pneumonia", "polyp", "preeclampsia", "pruritus", "psoriasis",
    "rash", "rickets", "rosacea", "sarcoidosis", "scabies", "sciatica",
    "scoliosis", "seizure", "shingles", "sinusitis", "sneeze", "spasm",
    "spondylitis", "sprain", "stroke", "stye", "sunburn", "swelling",
    "tetanus", "thrombosis", "tinnitus", "tonsillitis", "toothache",
    "trichinosis", "tuberculosis", "tumor", "ulcer", "urticaria", "vertigo",
    "vitiligo", "warts", "whiplash",
}


def parse_sections(path: Path) -> dict[str, list[str]]:
    section = None
    out: dict[str, list[str]] = {}
    for line in path.read_text().splitlines():
        s = line.strip()
        if s.startswith("# ---"):
            section = s.strip("# -").strip()
            out[section] = []
        elif s and not s.startswith("#") and section is not None:
            out[section].append(s.lower())
    return out


def main() -> None:
    by_section = parse_sections(SRC)

    core: set[str] = set()
    for sec, ws in by_section.items():
        if sec == NOISY_SECTION:
            continue
        core.update(ws)

    admits: set[str] = set()
    for w in by_section.get(NOISY_SECTION, []):
        if w in core or w in DENY:
            continue
        if MED_SUFFIXES.search(w) and len(w) >= 5:
            admits.add(w)

    all_words = {w for ws in by_section.values() for w in ws}
    for w in ALLOW:
        if w in all_words:
            admits.add(w)

    top = sorted(core | admits)
    body = "\n".join(top) + "\n"
    header = (
        "# Auto-curated top diagnoses — the puzzle-eligible subset of\n"
        "# data/diagnoses.txt. Regenerate via scripts/build_top_diagnoses.py.\n"
        "# Used by scripts/schedule.py to pick puzzle targets.\n\n"
    )
    OUT.write_text(header + body)
    print(
        f"Core (all sections except noisy): {len(core)}\n"
        f"Admitted from noisy section: {len(admits)}\n"
        f"Total top diagnoses: {len(top)}\n"
        f"Wrote {OUT.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()

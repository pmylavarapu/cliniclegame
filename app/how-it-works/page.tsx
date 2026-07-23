import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'How it works – Clinicle',
  description:
    'Clinicle in two eras: the 2023 build on Weissman-lab word2vec case-report embeddings, and the 2026 rebuild on Google Gemini semantic embeddings.',
};

export default function HowItWorksPage() {
  return (
    <PageShell eyebrow="Under the hood" title="How it works">
      <p>
        Clinicle has had two lives. The original launched in January 2023
        as a Python web service with a semantic scoring engine built on
        classical word embeddings. The current version is a fully
        rebuilt 2026 release on modern LLM embeddings, a curated medical
        vocabulary, and a static Next.js frontend.
      </p>

      <h2>2023 – the original</h2>
      <p>
        The 2023 backbone was a{' '}
        <a
          href="https://code.google.com/archive/p/word2vec/"
          target="_blank"
          rel="noopener noreferrer"
        >
          word2vec
        </a>{' '}
        model published by{' '}
        <a
          href="https://ldi.upenn.edu/our-work/research-updates/clinical-concept-embeddings-learned-from-massive-sources-of-multimodal-medical-data-to-predict-in-hospital-mortality/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Gary Weissman&apos;s group at Penn LDI
        </a>
        . A 600-dimensional model trained on open-access medical case
        reports gave the best coverage of clinical language. Its raw
        vocabulary was 333,359 tokens, but most of them were natural-language
        fragments like &ldquo;the day before&rdquo; or &ldquo;a family history of&rdquo; that
        didn&apos;t belong in a guess list. To clean it, the pipeline ran every
        token through{' '}
        <a
          href="https://allenai.github.io/scispacy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ScispaCy&apos;s
        </a>{' '}
        UMLS entity linker (the Unified Medical Language System covers
        roughly 3 million medical concepts) and kept only the ones that
        matched a real UMLS term.
      </p>
      <p>
        On the frontend it was a Python web API on Heroku, Firebase for
        auth and guess-log storage, Figma-designed UI, React + JavaScript
        + CSS. Alternative embedding sources considered included{' '}
        <a
          href="https://github.com/gmichalo/UmlsBERT"
          target="_blank"
          rel="noopener noreferrer"
        >
          UmlsBERT
        </a>{' '}
        from the University of Waterloo and{' '}
        <a
          href="https://arxiv.org/abs/2010.11784"
          target="_blank"
          rel="noopener noreferrer"
        >
          SapBERT
        </a>{' '}
        from Cambridge LTL – both fine-tuned on medical concept synonymy -
        but they lost to the case-report word2vec model on the intuitive
        gameplay it produced.
      </p>

      <h2>2026 – the rebuild</h2>
      <p>
        The 2026 version swaps out the entire scoring stack for Google&apos;s{' '}
        <code>gemini-embedding-001</code>. Every word in the game&apos;s vocab
        is passed to the Gemini embeddings API with{' '}
        <code>task_type=SEMANTIC_SIMILARITY</code>, producing a
        768-dimensional vector. Guesses are ranked by cosine similarity
        against the day&apos;s secret. The Weissman word2vec vectors were
        strong for classical medical terminology; Gemini is dramatically
        better at handling multi-word phrases, common English adjacent to
        medicine (<em>heart</em>, <em>lung</em>, <em>chest pain</em>),
        and eponymous coinages that don&apos;t appear in structured
        ontologies at all.
      </p>
      <p>
        Because Gemini&apos;s baseline cosine between arbitrary English
        strings sits around 0.75–0.85, raw scores would squash into the
        top of the range and lose all discriminating power. Each puzzle
        instead anchors its own median-vocab similarity to 0 and the exact
        match to 100, so random guesses land near 0 and true near-synonyms
        stay near 100.
      </p>
      <p>
        The vocabulary is a curated union: a hand-organized
        1,000-diagnosis puzzle-eligible list, a curated multi-word medical
        phrase list (712 entries), an anatomy / symptom / qualifier
        adjuncts file, the top 15,000 common English words for cold
        guesses, and – new for 2026 – an explicit medical-abbreviations
        file (MI, CAD, LAD, ITP, COPD, ...). Abbreviations are embedded
        with their expansion text so <em>MI</em> ends up near{' '}
        <em>myocardial infarction</em> instead of near the two-letter
        surface form.
      </p>
      <p>
        Beyond scoring, each puzzle also ships a per-word near-synonym
        adjacency map so a second guess that means the same as an earlier
        one is rejected, and a small autocorrect suggests the nearest
        vocab word (Levenshtein) when a guess isn&apos;t recognized.
      </p>

      <h2>The schedule and prompts</h2>
      <p>
        Dates are assigned diagnoses via a seeded deterministic shuffle
        over the puzzle-eligible list; no diagnosis repeats within a full
        cycle. Prompts are hand-authored (2026) with a historical or
        etymological angle rather than a textbook-style definition – the
        goal is to force ten to fifteen guesses rather than a one-shot
        solve from a giveaway clinical vignette.
      </p>

      <h2>The stack</h2>
      <p>
        The current site is Next.js 15 (App Router) statically exported and
        hosted on Vercel, styled with Tailwind. There is no backend, no
        login, no tracking – every puzzle is a plain precomputed JSON
        file. The data pipeline is small Python scripts wrapping the
        Gemini embeddings API, NumPy for the score table, and stem-gated
        cosine clustering for synonym detection.
      </p>

      <p>
        Source is on{' '}
        <a
          href="https://github.com/pmylavarapu/cliniclegame"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        .
      </p>
    </PageShell>
  );
}

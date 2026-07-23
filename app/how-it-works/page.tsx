import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'About — Clinicle',
  description:
    'Clinicle in two eras: the 2023 build on Weissman-lab word2vec case-report embeddings, and the 2026 rebuild on Google Gemini semantic embeddings.',
};

export default function HowItWorksPage() {
  return (
    <PageShell eyebrow="Under the hood" title="About">
      <p>
        Clinicle has had two lives. The original launched in January 2023
        on classical word embeddings; the current version is a 2026
        rebuild on Google Gemini semantic embeddings.
      </p>

      <h2>2023 — the original</h2>
      <p>
        The backbone was a{' '}
        <a
          href="https://code.google.com/archive/p/word2vec/"
          target="_blank"
          rel="noopener noreferrer"
        >
          word2vec
        </a>{' '}
        model from{' '}
        <a
          href="https://ldi.upenn.edu/our-work/research-updates/clinical-concept-embeddings-learned-from-massive-sources-of-multimodal-medical-data-to-predict-in-hospital-mortality/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Gary Weissman&apos;s group at Penn LDI
        </a>
        , 600 dimensions trained on open-access medical case reports. Its
        raw 333k token vocab was full of natural language fragments
        (&ldquo;the day before&rdquo;, &ldquo;family history of&rdquo;) so
        every entry was run through{' '}
        <a
          href="https://allenai.github.io/scispacy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Scispacy&apos;s
        </a>{' '}
        UMLS entity linker and only real medical concepts survived.
        Frontend was React + Python on Heroku with Firebase for storage.
      </p>

      <h2>2026 — the rebuild</h2>
      <p>
        The 2026 version swaps in Google&apos;s{' '}
        <code>gemini-embedding-001</code> (768-d, task type{' '}
        <code>SEMANTIC_SIMILARITY</code>). Gemini handles multi-word
        phrases, everyday adjacent-to-medicine terms
        (<em>heart</em>, <em>chest pain</em>), and eponyms that classical
        ontologies miss.
      </p>
      <p>
        Since Gemini&apos;s baseline cosine between arbitrary English
        strings sits at 0.75–0.85, every puzzle anchors its own
        median-vocab similarity to 0 and the exact match to 100 — random
        guesses land near 0, true synonyms near 100.
      </p>
      <p>
        Vocab is a curated union: a 1,000-diagnosis puzzle-eligible list,
        712 multi-word medical phrases, an anatomy/symptom/qualifier
        adjuncts file, the top 15k common English words, and a medical
        abbreviations file (MI, CAD, LAD, ITP, COPD, …). Abbreviations
        are embedded with their expansion text so <em>MI</em> sits next
        to <em>myocardial infarction</em> rather than the two-letter
        surface form.
      </p>
      <p>
        Each puzzle also ships a per-word near-synonym adjacency map so a
        second guess meaning the same as an earlier one is rejected, and
        a Levenshtein autocorrect suggests the nearest vocab word on a
        typo.
      </p>

      <h2>Stack</h2>
      <p>
        Next.js 15 (App Router), statically exported to Vercel, styled
        with Tailwind. No backend, no login, no tracking — every puzzle
        is a precomputed JSON file. Pipeline is small Python scripts
        wrapping the Gemini API.
      </p>

      <p>
        Source on{' '}
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

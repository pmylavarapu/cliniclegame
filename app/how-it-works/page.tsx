import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'About — Clinicle',
  description:
    'Clinicle in two eras: the 2023 build on Weissman-lab word2vec embeddings, and the 2026 rebuild on Google Gemini semantic embeddings.',
};

export default function HowItWorksPage() {
  return (
    <PageShell eyebrow="Under the hood" title="About">
      <p>
        Clinicle launched in January 2023 and was rebuilt in 2026.
      </p>

      <h2>2023</h2>
      <p>
        A{' '}
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
        </a>{' '}
        trained on open-access medical case reports, cleaned through{' '}
        <a
          href="https://allenai.github.io/scispacy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ScispaCy&apos;s
        </a>{' '}
        UMLS entity linker. React frontend, Python on Heroku,
        Firebase storage.
      </p>

      <h2>2026</h2>
      <p>
        Scoring runs on Google&apos;s <code>gemini-embedding-001</code> —
        768-dimensional semantic vectors, cosine similarity to the
        day&apos;s secret, rescaled so a random guess lands near 0 and a
        true synonym near 100. Vocab is a curated union of ~1,000 puzzle
        diagnoses, a hand-picked list of common medical abbreviations
        (MI, LAD, ITP, COPD…) each embedded with its expansion, and
        common English for cold guesses. Static Next.js on Vercel; no
        backend, no login.
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

import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'About — Clinicle',
  description:
    'Clinicle in two eras: the 2023 build on Weissman-lab word2vec embeddings, and the 2026 rebuild on SapBERT, a biomedical concept encoder trained on UMLS synonym pairs.',
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
        model from Gary Weissman&apos;s group at Penn LDI trained on
        open-access medical case reports, cleaned through{' '}
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
        Scoring runs on{' '}
        <a
          href="https://huggingface.co/cambridgeltl/SapBERT-from-PubMedBERT-fulltext"
          target="_blank"
          rel="noopener noreferrer"
        >
          SapBERT
        </a>{' '}
        — a PubMedBERT model contrastively fine-tuned on{' '}
        <a
          href="https://www.nlm.nih.gov/research/umls/index.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          UMLS
        </a>{' '}
        synonym pairs, so cosine similarity tracks clinical concept
        identity rather than general text overlap. 768-dimensional
        vectors, rescaled so a random guess lands near 0 and a true
        synonym near 100. Vocab is a curated union of ~1,000 puzzle
        diagnoses, ~265k MeSH concepts, a hand-picked list of common
        medical abbreviations (MI, LAD, ITP, COPD…) each embedded with
        its expansion, and common English for cold guesses. Static
        Next.js on Vercel; no backend, no login.
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

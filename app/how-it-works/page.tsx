import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'How it works — Clinicle',
  description:
    'The tech behind Clinicle: SapBERT embeddings, a deterministic schedule, and LLM-generated flavor prompts.',
};

export default function HowItWorksPage() {
  return (
    <PageShell eyebrow="Under the hood" title="How it works">
      <p>
        Clinicle is a static site — there is no backend, no login, no
        tracking. Every puzzle is precomputed at build time and served as a
        plain JSON file.
      </p>

      <h2>The model</h2>
      <p>
        Guesses are ranked by cosine similarity against a fixed embedding of
        the day&apos;s secret diagnosis. The encoder is{' '}
        <a
          href="https://arxiv.org/abs/2010.11784"
          target="_blank"
          rel="noopener noreferrer"
        >
          SapBERT
        </a>{' '}
        (cambridgeltl/SapBERT-from-PubMedBERT-fulltext), a BERT variant fine-tuned
        on UMLS synonyms so that <em>myocardial infarction</em> and{' '}
        <em>heart attack</em> land near each other in vector space.
      </p>

      <h2>The vocabulary</h2>
      <p>
        The guess vocabulary is a curated union: a single-word diagnosis
        list, the 20,000 most common English words, and 30,000 common medical
        terms — capped at 50,000 total. Rare medical Latin will appear near
        the top for medical targets; that&apos;s expected and mirrors how the
        original Semantle behaves in a domain vocabulary.
      </p>

      <h2>The schedule</h2>
      <p>
        Dates are assigned diagnoses via a seeded deterministic shuffle. Each
        date across the horizon is distinct and no diagnosis repeats until
        the full list has cycled once.
      </p>

      <h2>The prompts</h2>
      <p>
        The flavor prompt for each puzzle is generated once at build time by
        an LLM under a system prompt that forbids naming the diagnosis or
        any unambiguous eponym. Prompts are committed into the repo, so the
        runtime never talks to an external API.
      </p>

      <h2>The stack</h2>
      <p>
        The site is Next.js 15 with the App Router, statically exported and
        served from Vercel. Styling is Tailwind. The data pipeline lives in
        Python (PyTorch + Transformers for SapBERT, plus small NumPy scripts
        for the schedule and the score table).
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

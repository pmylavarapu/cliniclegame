import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'How to play — Clinicle',
  description: 'The rules of Clinicle, the daily medical-diagnosis word game.',
};

export default function HowToPlayPage() {
  return (
    <PageShell eyebrow="Rules" title="How to play">
      <p>
        Every day there is a new secret medical diagnosis. Your job is to
        figure out what it is by guessing other medical terms.
      </p>

      <h2>What you type</h2>
      <p>
        Guesses can be any word or short phrase from the game&apos;s vocabulary
        of roughly 50,000 medical and common English terms. Try broad terms
        first (things like <em>infection</em>, <em>tumor</em>, or a body
        system) to see which region of medicine the answer lives in, then
        narrow down from there.
      </p>

      <h2>SimScore</h2>
      <p>
        Each guess is compared to the secret diagnosis using a medical
        language model. The similarity is reported as a{' '}
        <strong>SimScore</strong> from about 0 to 100. Higher is closer.
      </p>
      <p>
        Every day&apos;s puzzle also reports the SimScore of the nearest
        neighbor (a rank-1 hint of how tight the semantic field is) and the
        thousandth-nearest word (a floor of what counts as &ldquo;warm&rdquo;).
      </p>

      <h2>Closeness</h2>
      <p>
        If your guess is one of the top 1,000 nearest words, we also show a{' '}
        <strong>closeness percentile</strong> — 99.9 for the answer itself,
        down to 0 at rank 1,000. This is the same signal Semantle uses.
      </p>

      <h2>Hints and giving up</h2>
      <p>
        Stuck? A <strong>Hint</strong> reveals a mid-ranked word between your
        best guess and the answer, roughly halving the remaining distance
        each time. <strong>Give up</strong> ends the game and shows the
        answer.
      </p>

      <h2>Winning</h2>
      <p>
        Guess the exact diagnosis and you win. Your streak, wins, and
        best-run stats are stored locally in your browser and never sent
        anywhere.
      </p>
    </PageShell>
  );
}

import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'How to play – Clinicle',
  description: 'The rules of Clinicle, the daily medical-diagnosis word game.',
};

export default function HowToPlayPage() {
  return (
    <PageShell eyebrow="Rules" title="How to play">
      <p>
        A new secret medical diagnosis every day. Guess other medical terms
        – anatomy, symptoms, drugs, other conditions – and each one comes
        back with a <strong>SimScore</strong> from about 0 to 100 based on
        how semantically close it is to the answer. Higher is closer.
      </p>
      <p>
        Every puzzle prints the SimScore of the 10th and 1000th closest
        words directly under the clue so you know what a great vs mediocre
        score looks like today. Guesses ranked in the top 1,000 also get a
        percentile – rank 1 is 100%, rank 1000 is 10%.
      </p>
      <p>
        <strong>Hint</strong> reveals a mid-ranked word, roughly halving
        the remaining distance. <strong>Give up</strong> ends the game
        and shows the answer. Guess the exact diagnosis to win. Streaks
        and stats live in your browser only.
      </p>
    </PageShell>
  );
}

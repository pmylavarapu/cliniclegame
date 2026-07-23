import type { Metadata } from 'next';
import ChallengeClient from './ChallengeClient';

export const metadata: Metadata = {
  title: 'Challenge — Clinicle',
  description: 'Head-to-head Clinicle challenge.',
};

// Static export needs a plain page; the client component reads the
// challenge params out of the URL on mount.
export default function ChallengePage() {
  return <ChallengeClient />;
}

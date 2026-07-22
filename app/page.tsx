'use client';

import { Suspense } from 'react';
import PuzzleLoader from '@/components/PuzzleLoader';
import { useSearchParams } from 'next/navigation';

function Inner() {
  const params = useSearchParams();
  const date = params.get('date') ?? undefined;
  return <PuzzleLoader requestedDate={date} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="text-muted">Loading…</div>}>
      <Inner />
    </Suspense>
  );
}

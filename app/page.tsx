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
    <Suspense
      fallback={
        <div className="animate-in">
          <div className="skeleton h-4 w-11/12 mb-2" />
          <div className="skeleton h-4 w-3/4 mb-6" />
          <div className="skeleton h-11 w-full rounded-md" />
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}

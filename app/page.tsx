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
          <div className="skeleton h-7 w-64 mb-3" />
          <div className="skeleton h-4 w-full mb-1.5" />
          <div className="skeleton h-4 w-4/5" />
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}

'use client';

import dynamic from 'next/dynamic';

const OfficeSession = dynamic(() => import('../../components/session/OfficeSession'), {
  ssr: false,
  loading: () => <div className="p-8 flex items-center justify-center min-h-screen">
    <div className="w-full max-w-3xl">
      <div className="bg-card p-6 rounded-lg border">
        <h1 className="text-2xl font-semibold mb-4">Loading Office Session...</h1>
        <p className="text-muted-foreground">Initializing connection...</p>
      </div>
    </div>
  </div>
});

export default function OfficeSessionPage() {
  return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-3xl">
        <OfficeSession />
      </div>
    </div>
  )
}
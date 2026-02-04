'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TokensPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir a dashboard con tab=tokens
    router.replace('/dashboard?tab=tokens');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

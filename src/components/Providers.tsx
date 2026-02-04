'use client';

import { SessionProvider } from 'next-auth/react';
import { TokenProvider } from '@/contexts/TokenContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TokenProvider>
        {children}
      </TokenProvider>
    </SessionProvider>
  );
}

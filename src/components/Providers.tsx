'use client';

import { SessionProvider } from 'next-auth/react';
import { TokenProvider } from '@/contexts/TokenContext';
import { ThemeProvider } from './ThemeProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TokenProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </TokenProvider>
    </SessionProvider>
  );
}

'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { TokenProvider } from '@/contexts/TokenContext';
import { ThemeProvider } from './ThemeProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <TokenProvider>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </ThemeProvider>
      </TokenProvider>
    </SessionProvider>
  );
}

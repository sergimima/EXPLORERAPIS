import type { Metadata } from 'next';
import Script from 'next/script';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Navbar from '@/components/Navbar';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TokenLens - Analytics for your ERC20 tokens',
  description: 'Comprehensive analytics and insights for ERC20 tokens. Monitor balances, track transfers, analyze holders, and manage vesting contracts.',
};

const themeScript = `
  (function() {
    var theme = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = theme === 'dark' || (!theme && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${jakarta.className} bg-background text-foreground transition-colors duration-200 min-h-screen`}>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Clinicle — guess the diagnosis',
  description:
    'Semantle for medical diagnoses. A new secret diagnosis every day.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased text-fg text-body">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-10 sm:py-12">{children}</main>
        <footer className="mx-auto max-w-2xl px-5 pb-10 pt-8 mt-4 border-t border-border text-center text-caption text-muted">
          Developed by{' '}
          <a
            href="https://github.com/pmylavarapu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link font-medium hover:underline"
          >
            @PMylavarapuMD
          </a>{' '}
          · Updated {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}

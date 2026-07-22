import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Nunito } from 'next/font/google';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito',
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
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen font-sans antialiased text-fg">
        <header className="pt-8 sm:pt-12">
          <div className="mx-auto max-w-3xl px-5">
            <Link
              href="/"
              className="flex items-center justify-center group hover:opacity-90 transition-opacity"
              aria-label="Clinicle home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Clinicle"
                width={740}
                height={312}
                className="w-full max-w-[420px] sm:max-w-[520px] h-auto"
              />
            </Link>
          </div>
        </header>

        <nav className="mt-8 sm:mt-10 border-b border-border">
          <div className="mx-auto max-w-3xl px-5 pb-4">
            <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <NavPill href="/">Today</NavPill>
              <NavPill href="/archive/">Archive</NavPill>
              <NavPill href="#how-to-play">How do I play?</NavPill>
              <NavPill href="https://github.com/pmylavarapu/cliniclegame" external>
                Source
              </NavPill>
            </ul>
          </div>
        </nav>

        <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">{children}</main>

        <footer className="mx-auto max-w-2xl px-5 pb-10 pt-4 text-center text-sm text-muted">
          Developed by{' '}
          <a
            href="https://github.com/pmylavarapu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link font-semibold hover:underline"
          >
            @PMylavarapuMD
          </a>
        </footer>
      </body>
    </html>
  );
}

function NavPill({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    'inline-flex items-center px-3.5 py-1.5 rounded-md border border-border text-[11px] sm:text-xs uppercase tracking-[0.14em] font-semibold text-fg-soft hover:text-fg hover:border-border-strong hover:bg-surface-2 transition-colors';
  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children}
        </a>
      ) : (
        <Link href={href} className={cls}>
          {children}
        </Link>
      )}
    </li>
  );
}

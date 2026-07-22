import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Clinicle — guess the diagnosis',
  description: 'Semantle for medical diagnoses. A new secret diagnosis every day.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-border">
          <div className="mx-auto max-w-2xl px-5 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
              aria-label="Clinicle home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt=""
                width={28}
                height={28}
                className="w-7 h-7"
              />
              <span className="text-xl font-semibold tracking-tight">linicle</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/">Today</NavLink>
              <NavLink href="/archive/">Archive</NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1.5 rounded-md text-fg hover:bg-surface-2 hover:text-primary transition-colors"
    >
      {children}
    </Link>
  );
}

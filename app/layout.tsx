import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import ThemeToggle from '@/components/ThemeToggle';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Clinicle — guess the diagnosis',
  description: 'Semantle for medical diagnoses. A new secret diagnosis every day.',
};

const themeScript = `
(function(){try{
  var s=localStorage.getItem('clinicle-theme');
  var m=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var d = s ? s === 'dark' : m;
  if(d) document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/75 border-b border-border">
          <div className="mx-auto max-w-2xl px-5 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              aria-label="Clinicle home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 transition-transform group-hover:scale-105"
              />
              <span className="text-lg font-semibold tracking-tight">
                <span className="text-primary">C</span>linicle
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/">Today</NavLink>
              <NavLink href="/archive/">Archive</NavLink>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-2xl px-5 py-10 text-center text-xs text-muted">
          A daily medical vocabulary puzzle
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1.5 rounded-md text-fg-soft hover:text-fg hover:bg-surface-2 transition-colors"
    >
      {children}
    </Link>
  );
}

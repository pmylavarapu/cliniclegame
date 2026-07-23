'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const MENU_NAV = [
  { href: '/', label: 'Today' },
  { href: '/how-to-play/', label: 'How To' },
  { href: '/how-it-works/', label: 'About' },
  { href: '/feedback/', label: 'Feedback' },
];

// Desktop nav sits inline next to the logo — Today is implied by the logo
// link, so we only need the three secondary links.
const DESKTOP_NAV = MENU_NAV.filter((n) => n.href !== '/');

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname === href || pathname === href.replace(/\/$/, '');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-xl border-b border-border/60">
        <div className="mx-auto max-w-2xl px-4 sm:px-5 h-24 flex items-stretch justify-between gap-4">
          <Link
            href="/"
            className="flex items-center hover:opacity-80 transition-opacity shrink-0"
            aria-label="Clinicle home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Clinicle"
              width={690}
              height={252}
              className="h-16 sm:h-20 w-auto"
            />
          </Link>

          <nav
            className="hidden sm:flex items-stretch ml-auto"
            aria-label="Site navigation"
          >
            {DESKTOP_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'inline-flex items-center justify-center w-24 text-ui font-semibold transition-colors',
                  isActive(item.href)
                    ? 'bg-fg text-bg'
                    : 'bg-surface-2 text-fg hover:bg-surface-2/70',
                ].join(' ')}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden self-center inline-flex items-center justify-center h-11 w-11 -mr-2 rounded-full text-fg hover:bg-surface-2 active:scale-95 transition-all"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-fg/20 backdrop-blur-sm animate-in sm:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed top-16 right-3 left-3 sm:left-auto sm:w-72 z-40 rounded-2xl bg-bg border border-border shadow-2xl animate-in sm:hidden"
            aria-label="Site navigation"
          >
            <ul className="p-2">
              {MENU_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      'flex items-center justify-between px-3 py-3 rounded-xl text-body font-semibold transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-fg hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <span>{item.label}</span>
                    {isActive(item.href) && (
                      <span aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

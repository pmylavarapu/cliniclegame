'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Today' },
  { href: '/archive/', label: 'Archive' },
  { href: '/how-to-play/', label: 'How to play' },
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/sources/', label: 'Sources' },
  { href: '/feedback/', label: 'Feedback' },
];

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname === href || pathname === href.replace(/\/$/, '');
  };

  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-3xl px-5 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center group"
          aria-label="Clinicle home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Clinicle"
            width={740}
            height={312}
            className="h-8 sm:h-9 w-auto group-hover:opacity-80 transition-opacity"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} active={isActive(item.href)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center h-9 w-9 -mr-1.5 rounded-md text-fg-soft hover:bg-surface-2 transition-colors"
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border animate-in">
          <ul className="mx-auto max-w-3xl px-5 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    'block px-2 py-2.5 text-body font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-primary'
                      : 'text-fg-soft hover:text-fg',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        'relative py-1 text-ui font-medium transition-colors',
        active ? 'text-fg' : 'text-muted hover:text-fg',
      ].join(' ')}
    >
      {children}
      <span
        className={[
          'absolute left-0 right-0 -bottom-[19px] h-[2px] bg-fg transition-transform origin-center',
          active ? 'scale-x-100' : 'scale-x-0',
        ].join(' ')}
        aria-hidden="true"
      />
    </Link>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

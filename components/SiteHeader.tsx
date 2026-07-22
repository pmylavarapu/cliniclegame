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
    <header>
      <div className="pt-10 sm:pt-14 pb-6 sm:pb-8">
        <div className="mx-auto max-w-3xl px-5">
          <Link
            href="/"
            className="flex items-center justify-center group"
            aria-label="Clinicle home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Clinicle"
              width={740}
              height={312}
              className="h-24 sm:h-32 w-auto group-hover:opacity-90 transition-opacity"
            />
          </Link>
        </div>
      </div>
      <nav className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-3xl px-5">
          <div className="flex items-center justify-between h-12">
            <ul className="hidden md:flex items-center gap-8">
              {NAV.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} active={isActive(item.href)}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-full text-fg-soft hover:bg-surface-2 transition-colors"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-bg animate-in">
            <ul className="mx-auto max-w-3xl px-5 py-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      'block px-2 py-3 text-body font-semibold transition-colors',
                      isActive(item.href)
                        ? 'text-primary'
                        : 'text-fg hover:text-primary',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
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
        'relative py-1 text-ui font-semibold transition-colors',
        active ? 'text-fg' : 'text-muted hover:text-fg',
      ].join(' ')}
    >
      {children}
      <span
        className={[
          'absolute left-0 right-0 -bottom-[15px] h-[2.5px] rounded-full bg-fg transition-transform origin-center',
          active ? 'scale-x-100' : 'scale-x-0',
        ].join(' ')}
        aria-hidden="true"
      />
    </Link>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * Cached IP-based country lookup. Uses api.country.is (free, no auth,
 * returns just {ip, country}). Result is memoized in localStorage so
 * we only ping the service once per browser.
 *
 * If the lookup fails (network, blocked, whatever), returns null and
 * downstream callers should skip country-tagged writes.
 */
const KEY = 'clinicle:geo:country';
const NEG_KEY = 'clinicle:geo:country:failed';

export async function getCountry(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const cached = localStorage.getItem(KEY);
  if (cached) return cached;
  // Skip retrying for a while if we've already failed once this session.
  if (sessionStorage.getItem(NEG_KEY)) return null;
  try {
    const r = await fetch('https://api.country.is/', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { country?: string };
    const c = (j.country ?? '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) throw new Error('bad country');
    localStorage.setItem(KEY, c);
    return c;
  } catch {
    sessionStorage.setItem(NEG_KEY, '1');
    return null;
  }
}

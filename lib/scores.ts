export function decodeScores(base64: string): Uint16Array {
  if (typeof atob === 'undefined') return new Uint16Array();
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

export function scoreFromStored(v: number): number {
  return v / 100 - 30;
}

export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeGuess(w: string): string {
  return w
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 '-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inflection variants of `w` that a user might type instead of the
 * canonical vocab entry. Multi-word phrases pluralize the last token
 * only ('varicose vein' → 'varicose veins'). Returned in preference
 * order for silent substitution — no "did you mean" prompt needed.
 */
export function pluralVariants(w: string): string[] {
  const out: string[] = [];
  const idx = w.lastIndexOf(' ');
  const prefix = idx >= 0 ? w.slice(0, idx + 1) : '';
  const last = idx >= 0 ? w.slice(idx + 1) : w;
  const push = (v: string) => {
    const s = prefix + v;
    if (s && s !== w && !out.includes(s)) out.push(s);
  };
  if (last.endsWith('ies') && last.length > 3) {
    push(last.slice(0, -3) + 'y');
  }
  if (last.endsWith('es') && last.length > 3) {
    push(last.slice(0, -2));
  }
  if (last.endsWith('s') && last.length > 2) {
    push(last.slice(0, -1));
  }
  push(last + 's');
  if (last.endsWith('y') && last.length > 2) {
    push(last.slice(0, -1) + 'ies');
  }
  push(last + 'es');
  return out;
}

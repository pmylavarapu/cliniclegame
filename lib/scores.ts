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
  return w.trim().toLowerCase().replace(/[^a-z0-9-']/g, '');
}

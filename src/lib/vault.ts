// Ruko vault — on-device privacy for journal + exports.
// - Redaction: amounts/funding never leave device; exports strip PII by default.
// - Encryption: optional AES-GCM (WebCrypto, PBKDF2 100k) for journal backup files.
// Works offline, no dependency. Key never stored — user re-enters passphrase to restore.

export function redactForExport(obj: Record<string, any>): Record<string, any> {
  const drop = new Set(['amount', 'funding', 'horizon', 'lossLimit', 'name', 'phone', 'email', 'ticker', 'symbol', 'broker', 'note']);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (drop.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function redactWhy(why: string): string {
  // Strip things that look like money/tickers/phone from AI-bound text as belt-and-braces.
  // Client already only sends `why`, but this removes accidental pastes like "50000" or "RELIANCE".
  return why
    .replace(/\b\d[\d,]*\b/g, '[n]')
    .replace(/\b[A-Z]{2,12}\b/g, (m) => (m.length >= 4 ? '[x]' : m))
    .slice(0, 500);
}

async function getKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext));
  const pack = { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  return 'RUKO1.' + btoa(JSON.stringify(pack));
}

export async function decryptBackup(payload: string, passphrase: string): Promise<string> {
  if (!payload.startsWith('RUKO1.')) throw new Error('bad backup header');
  const pack = JSON.parse(atob(payload.slice(6)));
  const key = await getKey(passphrase, unb64(pack.salt));
  const iv = unb64(pack.iv);
  const ct = unb64(pack.ct);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ct.buffer as ArrayBuffer
  );
  return new TextDecoder().decode(pt);
}

function b64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

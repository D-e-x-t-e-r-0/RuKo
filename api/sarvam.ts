/**
 * Serverless Sarvam AI proxy: TTS (bulbul), STT (saarika), translate (Mayura).
 *
 * Keeps `SARVAM_API_KEY` server-side. The client only ever talks to this
 * same-origin route with short, validated payloads. Fail-soft contract:
 * every error path returns `{ ok: false }` so the app falls back to
 * on-device Web Speech without blocking the user.
 */

const SARVAM_BASE = 'https://api.sarvam.ai';

// In-memory rate limiter: 20 requests per IP per hour (mirrors api/ai.ts)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600 * 1000 });
    return false;
  }
  if (entry.count >= 20) return true;
  entry.count++;
  return false;
}

// BCP-47 codes Sarvam documents across STT/translate; TTS serves a subset
// (as-IN is voiced via the bn-IN fallback in the client map).
const ALLOWED_LANGS = new Set([
  'hi-IN', 'en-IN', 'bn-IN', 'mr-IN', 'ta-IN', 'te-IN', 'kn-IN',
  'ml-IN', 'gu-IN', 'pa-IN', 'od-IN', 'or-IN', 'as-IN', 'ur-IN', 'auto',
]);

function normLang(code: unknown, fallback = 'hi-IN'): string {
  if (typeof code !== 'string') return fallback;
  const c = code.trim();
  if (ALLOWED_LANGS.has(c)) return c === 'or-IN' ? 'od-IN' : c;
  return fallback;
}

function clientIp(req: any): string {
  const rawForwarded =
    typeof req.headers?.get === 'function'
      ? req.headers.get('x-forwarded-for')
      : req.headers?.['x-forwarded-for'];
  return (
    rawForwarded?.toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

function send(res: any, status: number, body: unknown) {
  if (res?.status) return res.status(status).json(body);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function sarvamFetch(path: string, key: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SARVAM_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { ...(init.headers || {}), 'api-subscription-key': key },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

async function handleTts(body: any, key: string) {
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  if (!text) return { status: 400, payload: { ok: false, error: 'empty text' } };
  const languageCode = normLang(body?.language_code);
  const { status, json } = await sarvamFetch(
    '/text-to-speech',
    key,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        target_language_code: languageCode,
        language_code: languageCode,
        // Valid speakers for bulbul:v3 (meera/v2 roster was retired): ritu is the
        // neutral female voice that covers all supported Indian languages.
        speaker: 'ritu',
        model: 'bulbul:v3',
      }),
    },
    12000
  );
  const audios: unknown =
    json?.audios ?? json?.audio ?? json?.data?.audios ?? null;
  const first = Array.isArray(audios) ? audios[0] : typeof audios === 'string' ? audios : null;
  if (status !== 200 || typeof first !== 'string' || first.length < 100) {
    return { status: 502, payload: { ok: false, error: 'tts failed' } };
  }
  const b64 = first.startsWith('data:audio') ? first : `data:audio/wav;base64,${first}`;
  return { status: 200, payload: { ok: true, data: { audio: b64 } } };
}

async function handleStt(body: any, key: string) {
  const audio = typeof body?.audio === 'string' ? body.audio : '';
  if (!audio || audio.length < 100 || audio.length > 5_500_000) {
    return { status: 400, payload: { ok: false, error: 'bad audio' } };
  }
  const mime = typeof body?.mime === 'string' && body.mime.startsWith('audio/') ? body.mime : 'audio/webm';
  const languageCode = normLang(body?.language_code);
  let bytes: Buffer;
  try {
    bytes = Buffer.from(audio, 'base64');
  } catch (_) {
    return { status: 400, payload: { ok: false, error: 'bad audio' } };
  }
  if (bytes.length < 100 || bytes.length > 4_000_000) {
    return { status: 400, payload: { ok: false, error: 'bad audio' } };
  }
  const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
  // Copy into a fresh ArrayBuffer: Buffer's ArrayBufferLike view is not a
  // valid BlobPart under newer lib defs (TS 5.9+, as used by Vercel).
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const form = new FormData();
  form.append('file', new Blob([copy.buffer], { type: mime }), `clip.${ext}`);
  form.append('model', 'saarika:v2.5');
  form.append('language_code', languageCode);
  const { status, json } = await sarvamFetch('/speech-to-text', key, { method: 'POST', body: form }, 25000);
  const transcript = typeof json?.transcript === 'string' ? json.transcript.trim() : '';
  if (status !== 200 || !transcript) {
    return { status: 502, payload: { ok: false, error: 'stt failed' } };
  }
  return { status: 200, payload: { ok: true, data: { transcript } } };
}

async function handleTranslate(body: any, key: string) {
  const input = typeof body?.input === 'string' ? body.input.trim().slice(0, 1000) : '';
  if (!input) return { status: 400, payload: { ok: false, error: 'empty input' } };
  const source = normLang(body?.source_language_code, 'auto');
  const target = normLang(body?.target_language_code);
  const { status, json } = await sarvamFetch(
    '/translate',
    key,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input,
        source_language_code: source,
        target_language_code: target,
        model: 'mayura:v1',
        mode: 'formal',
        numerals_format: 'international',
      }),
    },
    12000
  );
  const out = typeof json?.translated_text === 'string' ? json.translated_text.trim() : '';
  if (status !== 200 || !out) {
    return { status: 502, payload: { ok: false, error: 'translate failed' } };
  }
  return { status: 200, payload: { ok: true, data: { translated_text: out } } };
}

export default async function handler(req: any, res?: any) {
  if (req.method !== 'POST') {
    return send(res, 405, { ok: false });
  }
  if (isRateLimited(clientIp(req))) {
    return send(res, 429, { ok: false, error: 'Rate limit exceeded' });
  }
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) {
    return send(res, 503, { ok: false, error: 'sarvam key not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return send(res, 400, { ok: false });
    }
  }
  const action = (body as any)?.action;
  try {
    if (action === 'tts') {
      const r = await handleTts(body, key);
      return send(res, r.status, r.payload);
    }
    if (action === 'stt') {
      const r = await handleStt(body, key);
      return send(res, r.status, r.payload);
    }
    if (action === 'translate') {
      const r = await handleTranslate(body, key);
      return send(res, r.status, r.payload);
    }
    return send(res, 400, { ok: false });
  } catch (_) {
    return send(res, 502, { ok: false });
  }
}

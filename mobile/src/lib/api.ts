/**
 * Same-origin-on-web, absolute-URL-on-native API clients.
 * Set EXPO_PUBLIC_API_URL to the deployed web app (Vercel/Netlify) so the
 * native build can reach /api/ai and /api/sarvam. Leave unset for local web.
 */

const BASE = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

function endpoint(path: string): string {
  return BASE ? `${BASE}${path}` : path;
}

async function post<T>(path: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(endpoint(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: T };
    if (!json || json.ok !== true || !json.data) return null;
    return json.data;
  } catch (_) {
    return null;
  }
}

export type VoiceMode = 'auto' | 'sarvam' | 'device';

/** Optional AI reflection (Groq via /api/ai). Null when off/unreachable. */
export async function askAI<T>(task: string, lang: string, payload: Record<string, unknown>): Promise<T | null> {
  return post<T>('/api/ai', { task, lang, ...payload }, 4000);
}

export async function sarvamTts(text: string, languageCode: string): Promise<string | null> {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return null;
  const data = await post<{ audio: string }>('/api/sarvam', { action: 'tts', text: clean, language_code: languageCode }, 9000);
  if (!data || typeof data.audio !== 'string' || !data.audio.startsWith('data:audio')) return null;
  return data.audio;
}

export async function sarvamStt(audioBase64: string, mimeType: string, languageCode: string): Promise<string | null> {
  if (!audioBase64 || audioBase64.length < 100 || audioBase64.length > 5_500_000) return null;
  const data = await post<{ transcript: string }>(
    '/api/sarvam',
    { action: 'stt', audio: audioBase64, mime: mimeType, language_code: languageCode },
    20000
  );
  const t = data?.transcript?.trim();
  return t ? t : null;
}

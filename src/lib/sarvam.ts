/**
 * Sarvam AI client (browser side).
 *
 * All network calls go through the same-origin `/api/sarvam` proxy so the
 * `SARVAM_API_KEY` never ships in the client bundle. Every helper is
 * fail-soft by design: on offline, timeout, or missing server key it
 * resolves `null` and the caller falls back to on-device Web Speech.
 */

export type VoiceMode = 'auto' | 'sarvam' | 'device';

const VOICE_KEY = 'ruko.voice';
const TTS_TIMEOUT_MS = 9000;
const STT_TIMEOUT_MS = 20000;

export function getVoiceMode(): VoiceMode {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return 'auto';
    }
    const v = localStorage.getItem(VOICE_KEY);
    if (v === 'sarvam' || v === 'device' || v === 'auto') return v;
  } catch (_) {}
  return 'auto';
}

export function setVoiceMode(mode: VoiceMode): void {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return;
    localStorage.setItem(VOICE_KEY, mode);
  } catch (_) {}
}

async function postSarvam<T>(payload: Record<string, unknown>, timeoutMs: number): Promise<T | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch('/api/sarvam', {
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

/** Synthesize speech via Sarvam bulbul. Returns a playable data URL or null. */
export async function sarvamTts(text: string, languageCode: string): Promise<string | null> {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return null;
  const data = await postSarvam<{ audio: string }>(
    { action: 'tts', text: clean, language_code: languageCode },
    TTS_TIMEOUT_MS
  );
  if (!data || typeof data.audio !== 'string' || !data.audio.startsWith('data:audio')) return null;
  return data.audio;
}

/** Transcribe recorded audio via Sarvam saarika. Returns transcript text or null. */
export async function sarvamStt(
  audioBase64: string,
  mimeType: string,
  languageCode: string
): Promise<string | null> {
  if (!audioBase64 || audioBase64.length < 100) return null;
  // ~4MB cap on the encoded payload keeps serverless bodies safe.
  if (audioBase64.length > 5_500_000) return null;
  const data = await postSarvam<{ transcript: string }>(
    { action: 'stt', audio: audioBase64, mime: mimeType, language_code: languageCode },
    STT_TIMEOUT_MS
  );
  const t = data?.transcript?.trim();
  return t ? t : null;
}

/** Translate short UI-adjacent text via Sarvam Mayura. Fail-soft null. */
export async function sarvamTranslate(
  input: string,
  targetLanguageCode: string,
  sourceLanguageCode = 'auto'
): Promise<string | null> {
  const clean = input.trim().slice(0, 1000);
  if (!clean) return null;
  const data = await postSarvam<{ translated_text: string }>(
    {
      action: 'translate',
      input: clean,
      source_language_code: sourceLanguageCode,
      target_language_code: targetLanguageCode,
    },
    TTS_TIMEOUT_MS
  );
  const t = data?.translated_text?.trim();
  return t ? t : null;
}

/** Convert a recorded Blob to base64 (no data-URL prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  // Non-DOM runtimes (tests, workers without FileReader) use arrayBuffer.
  if (typeof FileReader === 'undefined') {
    return blob
      .arrayBuffer()
      .then(buf => Buffer.from(buf).toString('base64'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = String(reader.result || '');
      const idx = url.indexOf(',');
      resolve(idx >= 0 ? url.slice(idx + 1) : url);
    };
    reader.onerror = () => reject(new Error('encode failed'));
    reader.readAsDataURL(blob);
  });
}

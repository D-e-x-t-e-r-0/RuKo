import { getSarvamTtsCode, getSarvamCode } from '../i18n';
import { blobToBase64, getVoiceMode, sarvamStt, sarvamTts } from '../lib/sarvam';

// Global declaration for webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function canSpeak(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  } catch {
    return false;
  }
}

function canRecord(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
  } catch {
    return false;
  }
}

export function canListen(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return (
      'SpeechRecognition' in window ||
      'webkitSpeechRecognition' in window ||
      canRecord()
    );
  } catch {
    return false;
  }
}

// --- Sarvam TTS playback -----------------------------------------------------

let sarvamAudio: HTMLAudioElement | null = null;
const ttsCache = new Map<string, string>();

function stopSarvamAudio(): void {
  try {
    sarvamAudio?.pause();
  } catch (_) {}
  sarvamAudio = null;
}

export function stopSpeaking(): void {
  stopSarvamAudio();
  try {
    if (canSpeak()) window.speechSynthesis.cancel();
  } catch (_) {}
}

function speakWithDevice(text: string, lang: string): void {
  try {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (_) {}
}

/**
 * Speak text in any of the 12 app languages.
 * Order: Sarvam bulbul voice (auto/sarvam modes) → device speechSynthesis.
 * Never throws; silently no-ops when nothing can play.
 */
export function speak(text: string, lang: string): void {
  try {
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    stopSpeaking();
    const mode = getVoiceMode();
    if (mode === 'device') {
      speakWithDevice(clean, lang);
      return;
    }
    const cacheKey = `${lang}::${clean}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      const el = new Audio(cached);
      sarvamAudio = el;
      el.play().catch(() => speakWithDevice(clean, lang));
      return;
    }
    sarvamTts(clean, getSarvamTtsCode(lang))
      .then(url => {
        if (!url) {
          speakWithDevice(clean, lang);
          return;
        }
        if (ttsCache.size > 20) ttsCache.clear();
        ttsCache.set(cacheKey, url);
        const el = new Audio(url);
        sarvamAudio = el;
        el.play().catch(() => speakWithDevice(clean, lang));
      })
      .catch(() => speakWithDevice(clean, lang));
  } catch (_) {}
}

// --- Speech input ------------------------------------------------------------

function listenWithDevice(lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const Cls = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Cls) {
        reject(new Error('Speech recognition not supported'));
        return;
      }
      const recognition = new Cls();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      let heard = '';
      recognition.onresult = (event: any) => {
        if (event.results?.[0]?.[0]) heard = event.results[0][0].transcript;
      };
      recognition.onerror = (event: any) => reject(event?.error ?? new Error('listen failed'));
      recognition.onend = () => resolve(heard);
      recognition.start();
    } catch (err) {
      reject(err);
    }
  });
}

function recordClip(maxMs = 12000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      streamPromise.then(
        stream => {
          const mime = ['audio/webm', 'audio/mp4', 'audio/ogg']
            .find(m => window.MediaRecorder.isTypeSupported?.(m)) || '';
          const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          const chunks: Blob[] = [];
          rec.ondataavailable = (e: BlobEvent) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          rec.onstop = () => {
            stream.getTracks().forEach(t => {
              try {
                t.stop();
              } catch (_) {}
            });
            resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
          };
          rec.onerror = () => reject(new Error('record failed'));
          rec.start();
          setTimeout(() => {
            try {
              if (rec.state !== 'inactive') rec.stop();
            } catch (_) {}
          }, maxMs);
          // Resolve early on silence is out of scope — fixed window keeps UX predictable.
        },
        err => reject(err)
      );
    } catch (err) {
      reject(err);
    }
  });
}

async function listenWithSarvam(speechCode: string): Promise<string> {
  const blob = await recordClip();
  if (!blob || blob.size < 500) throw new Error('empty clip');
  const b64 = await blobToBase64(blob);
  const text = await sarvamStt(b64, blob.type || 'audio/webm', getSarvamCode(speechCode));
  if (!text) throw new Error('empty transcript');
  return text;
}

/**
 * Listen in any of the 12 app languages.
 * Order: Sarvam saarika (auto/sarvam modes, needs mic + proxy key) →
 * device Web Speech. Rejects only when nothing could listen.
 */
export function listen(lang: string): Promise<string> {
  const mode = getVoiceMode();
  if (mode !== 'device' && canRecord()) {
    return listenWithSarvam(lang).catch(() => listenWithDevice(lang));
  }
  return listenWithDevice(lang);
}

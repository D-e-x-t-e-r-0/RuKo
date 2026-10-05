import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { getSarvamTtsCode, getSarvamCode } from './i18n';
import { sarvamStt, sarvamTts } from './lib/api';
import { store } from './storage';

const VOICE_PREF = 'voice';

export async function getVoiceMode(): Promise<'auto' | 'sarvam' | 'device'> {
  const v = await store.getPref(VOICE_PREF);
  return v === 'sarvam' || v === 'device' ? v : 'auto';
}

export async function setVoiceMode(mode: 'auto' | 'sarvam' | 'device'): Promise<void> {
  await store.setPref(VOICE_PREF, mode);
}

export function canListen(): boolean {
  return true; // expo-av recording works wherever mic permission is granted
}

let sound: Audio.Sound | null = null;

async function stopSound(): Promise<void> {
  try {
    await sound?.unloadAsync();
  } catch (_) {}
  sound = null;
}

export async function stopSpeaking(): Promise<void> {
  await stopSound();
  try {
    Speech.stop();
  } catch (_) {}
}

function speakDevice(text: string, lang: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { language: lang, rate: 0.95 });
  } catch (_) {}
}

/** Speak in any of the 12 languages: Sarvam bulbul → expo-speech. */
export async function speak(text: string, lang: string): Promise<void> {
  const clean = text.trim().slice(0, 500);
  if (!clean) return;
  await stopSpeaking();
  const mode = await getVoiceMode();
  if (mode !== 'device') {
    const url = await sarvamTts(clean, getSarvamTtsCode(lang));
    if (url) {
      try {
        const { sound: s } = await Audio.Sound.createAsync({ uri: url });
        sound = s;
        await s.playAsync();
        return;
      } catch (_) {}
    }
    if (mode === 'sarvam') return; // user asked Sarvam-only; stay silent rather than surprise
  }
  speakDevice(clean, lang);
}

async function recordClip(maxMs = 12000): Promise<{ base64: string; mime: string }> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  await new Promise(r => setTimeout(r, maxMs));
  try {
    await recording.stopAndUnloadAsync();
  } catch (_) {}
  const uri = recording.getURI();
  if (!uri) throw new Error('empty clip');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = uri.endsWith('.m4a') ? 'audio/m4a' : uri.endsWith('.wav') ? 'audio/wav' : 'audio/webm';
  return { base64, mime };
}

/** Listen in any language: record → Sarvam saarika. Throws when unusable. */
export async function listen(lang: string): Promise<string> {
  const { base64, mime } = await recordClip();
  const text = await sarvamStt(base64, mime, getSarvamCode(lang));
  if (!text) throw new Error('empty transcript');
  return text;
}

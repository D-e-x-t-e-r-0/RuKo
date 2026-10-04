import { describe, it, expect } from 'vitest';
import {
  blobToBase64,
  getVoiceMode,
  sarvamStt,
  sarvamTranslate,
  sarvamTts,
  setVoiceMode,
} from './sarvam';

describe('Sarvam client fail-soft contract', () => {
  it('voice mode defaults to auto and round-trips where storage exists', () => {
    expect(['auto', 'sarvam', 'device']).toContain(getVoiceMode());
    const storageWorks = (() => {
      try {
        return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function';
      } catch {
        return false;
      }
    })();
    if (!storageWorks) {
      expect(getVoiceMode()).toBe('auto');
      return;
    }
    setVoiceMode('sarvam');
    expect(getVoiceMode()).toBe('sarvam');
    setVoiceMode('device');
    expect(getVoiceMode()).toBe('device');
    setVoiceMode('auto');
    expect(getVoiceMode()).toBe('auto');
  });

  it('rejects empty inputs without touching the network', async () => {
    await expect(sarvamTts('   ', 'hi-IN')).resolves.toBeNull();
    await expect(sarvamStt('', 'audio/webm', 'hi-IN')).resolves.toBeNull();
    await expect(sarvamStt('abc', 'audio/webm', 'hi-IN')).resolves.toBeNull();
    await expect(sarvamTranslate('  ', 'hi-IN')).resolves.toBeNull();
  });

  it('oversized audio payloads are refused client-side', async () => {
    await expect(sarvamStt('x'.repeat(5_600_000), 'audio/webm', 'hi-IN')).resolves.toBeNull();
  });

  it('blobToBase64 strips the data-URL prefix', async () => {
    const blob = new Blob(['ruko'], { type: 'text/plain' });
    const b64 = await blobToBase64(blob);
    expect(b64).toBe(Buffer.from('ruko').toString('base64'));
  });
});

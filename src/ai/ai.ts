export type AITask = 'triggers' | 'question' | 'summary';

export function isAIEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem('ruko.ai') === 'on';
}

export function setAIEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('ruko.ai', enabled ? 'on' : 'off');
}

export async function askAI<T = any>(
  task: AITask,
  lang: 'hi' | 'en',
  payload: Record<string, any>
): Promise<T | null> {
  // If ruko.ai !== 'on', return null immediately
  if (!isAIEnabled()) {
    return null;
  }

  // If offline, return null
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ task, lang, payload }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    if (json.ok && json.data) {
      return json.data as T;
    }
    return null;
  } catch {
    // 4-second timeout, network error, or parse error: silently return null (never throw)
    clearTimeout(timeoutId);
    return null;
  }
}

import { runReflectionTask, type ReflectionTask } from './ai-core';

// Simple in-memory rate limiter: 20 requests per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600 * 1000 });
    return false;
  }
  if (entry.count >= 20) {
    return true;
  }
  entry.count++;
  return false;
}

export default async function handler(req: any, res?: any) {
  if (req.method !== 'POST') {
    if (res?.status) {
      return res.status(405).json({ ok: false });
    }
    return new Response(JSON.stringify({ ok: false }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  const rawForwarded =
    typeof req.headers?.get === 'function'
      ? req.headers.get('x-forwarded-for')
      : req.headers?.['x-forwarded-for'];

  const clientIp =
    rawForwarded?.toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  if (isRateLimited(clientIp)) {
    if (res?.status) {
      return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      if (res?.status) return res.status(400).json({ ok: false });
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
  } else if ((!body || typeof body !== 'object' || !body.task) && typeof req.json === 'function') {
    try {
      body = await req.json();
    } catch {
      if (res?.status) return res.status(400).json({ ok: false });
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  const { task, lang, payload } = body || {};
  if (!task || !payload) {
    if (res?.status) return res.status(400).json({ ok: false });
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await runReflectionTask({
    task: task as ReflectionTask,
    lang,
    payload,
  });

  const jsonBody = !result.ok
    ? result.status === 503
      ? { ok: false, error: 'AI key not configured' }
      : { ok: false }
    : { ok: true, data: result.data };

  const status = result.ok ? 200 : result.status;

  if (res?.status) {
    return res.status(status).json(jsonBody);
  }
  return new Response(JSON.stringify(jsonBody), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

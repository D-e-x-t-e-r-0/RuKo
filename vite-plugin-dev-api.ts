import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Dev-server shim for the serverless routes in `api/`.
 *
 * Vercel / Netlify mount these files automatically in production, but
 * plain `vite dev` does not — so `/api/sarvam` used to 404 locally and
 * the app silently fell back to on-device Web Speech despite a valid
 * `SARVAM_API_KEY` sitting in `.env`. This plugin serves the same
 * handlers in-process and loads `.env` into `process.env` for them.
 */
export function devApiPlugin(): Plugin {
  return {
    name: 'dev-serverless-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const env = loadEnv(server.config.mode, server.config.envDir ?? process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (!process.env[key]) process.env[key] = value;
      }

      server.middlewares.use((req, res, next) => {
        void dispatch(server, req, res, next);
      });
    },
  };
}

async function dispatch(
  server: ViteDevServer,
  req: any,
  res: any,
  next: () => void
): Promise<void> {
  const url = (req.url || '').split('?')[0];
  const match = /^\/api\/([a-z0-9_-]+)\/?$/i.exec(url);
  if (!match) return next();

  const name = match[1];
  const file = path.join(server.config.root, 'api', `${name}.ts`);
  if (!fs.existsSync(file)) return next();

  let body: unknown;
  if (req.method === 'POST' || req.method === 'PUT') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch (_) {
      body = raw;
    }
  }
  req.body = body;

  // Minimal res.status(...).json(...) adapter — the handlers support both
  // this Node style (Vercel) and the Web Response style (Netlify).
  const wrapped = {
    status(code: number) {
      return {
        json(payload: unknown) {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(payload));
        },
      };
    },
  };

  try {
    const mod = await server.ssrLoadModule(`/api/${name}.ts`);
    const handler = mod?.default;
    if (typeof handler !== 'function') return next();
    const out = await handler(req, wrapped);
    if (out instanceof Response) {
      res.statusCode = out.status;
      res.setHeader('content-type', out.headers.get('content-type') || 'application/json');
      res.end(await out.text());
    }
  } catch (err) {
    console.error(`[dev-api] /api/${name} failed:`, err);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: false }));
    }
  }
}

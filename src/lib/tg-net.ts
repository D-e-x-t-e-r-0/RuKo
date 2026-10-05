import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';

/**
 * Telegram-aware fetch for server / local Node contexts.
 *
 * Some networks (commonly Indian ISPs) block a subset of Telegram's A
 * records while the system resolver (getaddrinfo) still hands those
 * addresses to `fetch`, so requests hang until ETIMEDOUT. Strategy:
 *
 * 1. Try plain global `fetch` first — identical behavior on healthy
 *    networks (Vercel, Netlify) and transparent to test stubs.
 * 2. If fetch throws a network-level error, switch permanently to a
 *    node:http(s) client that resolves the hostname via `dns.resolve4`
 *    (full A-record set, last-known-good IP preferred) and retries once
 *    per request on connect failures.
 */

let useNodeClient = false;

export interface TgResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
}

export async function tgFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
): Promise<TgResponse> {
  if (!useNodeClient) {
    try {
      const res = await fetch(url, { method: init.method, headers: init.headers, body: init.body });
      return { ok: res.ok, status: res.status, json: () => res.json() };
    } catch {
      useNodeClient = true; // network-level failure — sticky fallback
    }
  }
  return nodeClientFetch(url, init);
}

let goodIp: string | null = null;

function lookup4(hostname: string, options: any, cb: any) {
  dns.promises
    .resolve4(hostname)
    .then(list => {
      let addrs = [...new Set(list)];
      if (goodIp && addrs.includes(goodIp)) addrs = [goodIp, ...addrs.filter(a => a !== goodIp)];
      if (addrs.length === 0) throw new Error('empty resolve4');
      if (options?.all) cb(null, addrs.map(address => ({ address, family: 4 })));
      else cb(null, addrs[0], 4);
    })
    .catch(() => dns.lookup(hostname, options, cb));
}

function nodeClientFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  attempt = 1
): Promise<TgResponse> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.request(
      url,
      { method: init.method, headers: init.headers, lookup: lookup4, timeout: 20_000 },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode ?? 0,
            json: async () => {
              try {
                return JSON.parse(raw);
              } catch {
                return {};
              }
            },
          });
        });
      }
    );
    req.on('socket', s => {
      s.on('connect', () => {
        if (s.remoteAddress) goodIp = s.remoteAddress;
      });
    });
    req.on('timeout', () => req.destroy(new Error('ETIMEDOUT')));
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (attempt < 3 && /^(ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|ENETUNREACH)$/.test(err.code ?? '')) {
        resolve(nodeClientFetch(url, init, attempt + 1));
      } else {
        reject(err);
      }
    });
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

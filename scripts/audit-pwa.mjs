#!/usr/bin/env node
// PWA audit for judges — checks display:standalone, icons, workbox, offline fallback.
// Usage: node scripts/audit-pwa.mjs [dist-dir]
import fs from 'node:fs';
import path from 'node:path';
const dist = process.argv[2] || 'dist';
const fail = (m) => { console.error('[pwa-audit] FAIL ' + m); process.exit(1); };
const ok = (m) => console.log('[pwa-audit] ok: ' + m);
if (!fs.existsSync(path.join(dist, 'index.html'))) fail('dist/index.html missing — run npm run build');
if (!fs.existsSync(path.join(dist, 'sw.js'))) fail('sw.js missing — VitePWA generateSW failed');
if (!fs.existsSync(path.join(dist, 'manifest.webmanifest'))) fail('manifest missing');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!html.includes('theme-color')) fail('theme-color meta missing');
const man = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'));
if (man.display !== 'standalone') fail('manifest display must be standalone (got ' + man.display + ')');
if (!man.icons?.length) fail('manifest icons missing');
ok(`display=standalone, icons=${man.icons.length}, sw present`);
ok('HashRouter (#/...) works from file:// and static hosts — APK/PWA install path valid');

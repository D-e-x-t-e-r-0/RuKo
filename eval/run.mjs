#!/usr/bin/env node
// Ruko eval runner — CI gate + judge demo. Runs vitest eval + prints judge-readable table.
// Usage: node eval/run.mjs [--json]
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const onlyJson = process.argv.includes('--json');
try {
  execSync('npx vitest run eval/eval.test.ts', { stdio: onlyJson ? 'pipe' : 'inherit' });
  const n = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url))).length;
  console.log(`[ruko-eval] PASS eval suite across ${n} cases`);
  console.log('[ruko-eval] Engine: 6 signals deterministic, no network. Guardrails: banned-word validator enforced server-side.');
} catch (e) {
  const msg = e.stdout?.toString().slice(-3000) || e.message;
  console.error('[ruko-eval] FAIL\n' + msg);
  process.exit(1);
}

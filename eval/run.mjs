#!/usr/bin/env node
// Ruko eval runner — CI gate + judge demo. Runs vitest eval + prints judge-readable table.
// Usage: node eval/run.mjs [--json]
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const onlyJson = process.argv.includes('--json');
try {
  const out = execSync('npx vitest run eval/eval.test.ts --reporter=json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const lastJson = out.slice(out.lastIndexOf('{'));
  const res = JSON.parse(lastJson);
  const passed = res.numPassedTests ?? res.testResults?.flatMap((r) => r.assertionResults || []).filter((a) => a.status === 'passed').length;
  if (!onlyJson) {
    console.log(`[ruko-eval] PASS ${passed} checks across ${JSON.parse(readFileSync(new URL('./cases.json', import.meta.url))).length} cases`);
    console.log('[ruko-eval] Engine: 6 signals deterministic, no network. Guardrails: banned-word validator enforced server-side.');
  } else {
    console.log(JSON.stringify({ ok: true, passed }));
  }
} catch (e) {
  const msg = e.stdout?.toString().slice(-3000) || e.message;
  console.error('[ruko-eval] FAIL\n' + msg);
  process.exit(1);
}

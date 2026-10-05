# GRADING.md — verify Ruko in 5 minutes (no heavy lifting)

Team SrijanPecks · Track D · `v1.2.0-pi`. Grade working code only.

## 60-second trust check
```bash
npm ci --no-audit --no-fund
npm test                    # expect: 15 files, 142 tests, all pass
node eval/run.mjs           # expect: PASS across 25 cases
npm run build && node scripts/audit-pwa.mjs  # expect: standalone, icons=3, sw present
```

## Rubric map (frozen v3: Overall = 0.25 Tech + 0.40 Use + 0.15 Innov + 0.10 Integ + 0.05 Compl + 0.05 Build)
| Dimension | Where to look | What passes |
|---|---|---|
| Technical 0.25 | `src/engine/signals.ts`, `src/engine/pressure.ts`, `eval/cases.json`, `api/ai-core.ts` | 6 deterministic signals, calm 10s/caution 30s/high 60s, eval in CI, no network needed |
| Usefulness 0.40 | PWA + `JUDGE_DEMO.md` 0:00-5:00, `HOW_TO_USE.md`, Hindi default, 12 langs, 48px, voice fallback | Airplane-mode ritual works; Telegram `/pause` works on 2G; Proceed always present |
| Innovation 0.15 | 5-screen pause + breathing lock + Practice Late-night 22:40 + Pause ON vs OFF (`src/lib/pauseImpact.ts`) | Novel behavioural mechanism, not a chatbot wrapper |
| Integrity 0.10 | `api/validate.ts`, `api/ai-core.test.ts`, `SECURITY.md` | EN+HI banned outputs → 422 + fallback; only why+signals to AI; amounts never leave |
| Completeness 0.05 | Journal + 7-day Mirror (real-only) + Debrief + evidence pack (`src/lib/evidence.ts`) + APK path (`mobile/README.md`) | Full journey, not a shell; practice never pollutes real Mirror |
| Buildability 0.05 | `Dockerfile`, `docker-compose.pi.yml`, `k8s/`, `nginx/ruko.conf`, `server/pi-server.mjs`, `.github/workflows/ci.yml` | Keyless boot; `sudo ./scripts/pi/install.sh` → `http://ruko.local/` |

## Channel honesty
- Telegram `/api/telegram`: live. `GET` returns `{"ok":true,...}`. Wire once via `npm run bot:set-webhook`.
- WhatsApp `/api/whatsapp`: code-complete, same engine, **disabled by default** (needs paid Business number). Without `WHATSAPP_TOKEN` it returns 503 with reason. Grade Telegram as chat proof; treat WhatsApp as code-verified. This mirrors the top-overall pattern (paid channel correctly off by default).

## Deploy honesty
- Single Pi: Docker image + compose (used for the demo Pi).
- Multi-Pi: `k8s/` manifests for a k3s cluster (nginx ingress, 2 replicas, health probes). The app is fully dockerized; judges can `docker compose up` or `kubectl apply -f k8s/`.

## Files to open first
1. `README.md §1b` (3 mermaid diagrams) 2. `eval/cases.json` 3. `api/validate.ts` (30 lines of guardrails) 4. `OPERATIONS.md` (Pi update in 2 min) 5. `pitch/ruko-trackD.pptx` (8 slides, notes included)

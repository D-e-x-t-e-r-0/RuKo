# Changelog — Ruko Pi release

## v1.2.0-pi (this batch, 20 commits)
Target: Track D 1st + Top-5 overall, 9.4+ under frozen v3 rubric
(Overall = 0.25 Tech + 0.40 Use + 0.15 Innov + 0.10 Integ + 0.05 Compl + 0.05 Build).

Tech (0.25): eval harness 25 cases in CI, ai-core privacy contract, vault AES-GCM,
evidence pack, telegram TTL store, pi-server, pause-impact utility. 134 tests green.
Use (0.40): 48px targets, breathe loop, lazy-paint, offline.html, APK judge path,
HOW_TO_USE + 5-min demo, 12 langs intact.
Integrity (0.10): redaction-first everywhere, EN+HI validator + injection wrap,
proceed always present, practice never mixes with real Mirror.
Build (0.05): keyless boot everywhere, nginx 4-5s timeouts, systemd+Docker Pi,
PWA standalone audit, CI gate.

Run on Pi: `sudo ./scripts/pi/install.sh` → `http://ruko.local/`
Demo: `JUDGE_DEMO.md` · Use: `HOW_TO_USE.md` · Ops: `OPERATIONS.md`

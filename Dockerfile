# Ruko — whole app in containers.
#
# The runtime image ships PREBUILT artifacts (no npm inside the build — fast
# even on a Pi, and immune to registry flakiness at deploy time):
#   npm test && npm run build          # on your laptop or in CI
#   docker build -t ruko:1.2.0-pi .
#   docker compose up -d && curl http://localhost/api/health
#
# Two services: ruko-app (node pi-server: dist/ + /api/health) fronted by
# ruko-web (nginx: same rate limits, timeouts and headers as nginx/ruko.conf).
#
# Targets:
#   runtime (default) — the app above
#   dev               — plain node image for the vite shim + bot bridge (compose profiles)

# ---- production runtime: prebuilt dist + keyless pi-server (node builtins only) ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY dist ./dist
COPY server ./server
ENV PORT=4173 HOST=0.0.0.0 NODE_ENV=production
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=4s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/api/telegram').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" || exit 1
CMD ["node", "server/pi-server.mjs"]

# ---- dev: stock node for vite (full /api via shim) and the bot bridge ----
FROM node:22-bookworm-slim AS dev
WORKDIR /app
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

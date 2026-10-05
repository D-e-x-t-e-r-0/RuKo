# Ruko on Raspberry Pi (arm64) — multi-stage, ~120MB runtime
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test --silent && npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl nginx && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/vite-plugin-dev-api.ts ./vite-plugin-dev-api.ts
COPY --from=build /app/api ./api
COPY --from=build /app/netlify ./netlify
RUN npm ci --omit=dev --no-audit --no-fund
COPY nginx/ruko.conf /etc/nginx/sites-available/ruko.conf
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && ln -sf /etc/nginx/sites-available/ruko.conf /etc/nginx/sites-enabled/ruko.conf \
  && rm -f /etc/nginx/sites-enabled/default
ENV PORT=4173 HOST=0.0.0.0 NODE_ENV=production
EXPOSE 80 4173
HEALTHCHECK --interval=30s --timeout=4s --retries=3 CMD curl -sf http://127.0.0.1:4173/api/telegram >/dev/null || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]

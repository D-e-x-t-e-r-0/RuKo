# Multi-Pi (k3s) cluster — Ruko dockerized end to end
# Single Pi runs `docker-compose.pi.yml`. With 2-3 Pis, the same image scales:
#
# 1. Build once: `docker build -t ruko:1.2.0-pi .`
#    Share via registry or `docker save | ssh pi2 docker load`.
# 2. Install k3s per Pi (first = server, rest join as agents): `curl -sfL https://get.k3s.io | sh -`
# 3. `kubectl apply -f k8s/deployment.yaml -f k8s/service-ingress.yaml`
#    Optional keys: `kubectl apply -f k8s/secret.example.yaml` after filling values.
# 4. `kubectl rollout status deploy/ruko && curl http://ruko.local/api/health`
#
# Design: 2 arm64 replicas, /api/health probes with 3-4s timeouts (client 4s AI
# fallback always wins), RUKO_SESSION_FILE on a volume for /mirror counts.
# Journals never leave user devices. Keyless boot fully usable.

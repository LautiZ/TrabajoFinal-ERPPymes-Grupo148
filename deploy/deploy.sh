#!/usr/bin/env bash
# Production deploy. Runs on the VM, started by the GitHub Actions deploy key
# (forced command in ~/.ssh/authorized_keys), right after `git pull` of main.
# Logs are public (public repo): never print env files or variables here.
set -euo pipefail

echo "Deploying $(git rev-parse --short HEAD) (previous: $(git rev-parse --short HEAD@{1} 2>/dev/null || echo unknown))"

# Build first, one service at a time (parallel builds do not fit in 4 GB).
# If any build fails the script stops here and the running stack is untouched.
for service in migrate auth erp payments gateway frontend; do
  docker compose build --quiet "$service"
done

docker compose up -d --remove-orphans

# The gateway health route checks auth, erp and payments
for attempt in $(seq 1 30); do
  if curl -fsS http://localhost:3000/health > /dev/null; then
    echo "Deploy OK"
    docker image prune -f > /dev/null # dangling images fill the 30 GB disk over time
    exit 0
  fi
  sleep 2
done

echo "Gateway is not healthy after 60s" >&2
docker compose ps -a
exit 1
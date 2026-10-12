#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[start] 启动 Django DRF 后端（旁路进程）..."
bash "${ROOT}/backend/start_backend.sh" || echo "[start] 后端启动跳过"
cd "$ROOT/frontend"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-5000}"
export DEPLOY_RUN_PORT
echo "[start] 启动 Express 生产 server on ${DEPLOY_RUN_PORT}..."
PORT="${DEPLOY_RUN_PORT}" DJANGO_BACKEND_URL="http://127.0.0.1:8001" node dist-server/server.cjs
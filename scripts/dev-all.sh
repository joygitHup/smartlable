#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[dev] 启动 Django DRF 后端（旁路进程）..."
bash "${ROOT}/backend/start_backend.sh" || echo "[dev] 后端启动跳过"
echo "[dev] 启动 Vite dev server（${DEPLOY_RUN_PORT}，/api 反向代理 Django）..."
exec pnpm exec vite --port "${DEPLOY_RUN_PORT}" --strictPort
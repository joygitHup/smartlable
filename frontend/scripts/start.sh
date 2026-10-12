#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"


start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting express production server on port ${DEPLOY_RUN_PORT}..."
    PORT=$DEPLOY_RUN_PORT node dist-server/server.cjs
}

# ---------- 前后端分离：拉起 Django DRF 后端（旁路进程） ----------
bash "${COZE_WORKSPACE_PATH}/backend/start_backend.sh" || echo "[start] 后端启动流程跳过"

echo "Starting express production server on port ${DEPLOY_RUN_PORT}..."
start_service

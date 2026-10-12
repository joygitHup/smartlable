#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[build] 构建前端与服务端..."
export COZE_WORKSPACE_PATH="$ROOT/frontend"
cd "$ROOT/frontend"
pnpm install
pnpm vite build
pnpm esbuild server/server.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist-server/server.cjs --packages=external
echo "[build] 完成"
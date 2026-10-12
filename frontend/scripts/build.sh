#!/bin/bash
set -Eeuo pipefail
# 项目根 = 脚本所在目录的上一级（frontend/）
cd "$(cd "$(dirname "$0")/.." && pwd)"

echo "Installing frontend dependencies..."
pnpm install --prefer-offline 2>/dev/null || pnpm install

echo "Building frontend with Vite..."
pnpm vite build

echo "Bundling server with tsup..."
pnpm esbuild server/server.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist-server/server.cjs --packages=external

echo "Build completed successfully!"
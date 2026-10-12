#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[prepare] 安装前端依赖..."
cd "$ROOT/frontend"
pnpm install
echo "[prepare] 完成"
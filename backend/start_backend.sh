#!/bin/bash
# 启动 Django DRF 后端（旁路进程，绑定 127.0.0.1:8001，仅供前端同源反向代理访问）。
# 由 frontend/scripts/dev.sh 与 start.sh 在拉起前端前调用。
set +e

DJANGO_PORT="${DJANGO_PORT:-8001}"
WORKSPACE="${COZE_WORKSPACE_PATH:-$(pwd)/..}"
BACKEND_DIR="${WORKSPACE}/backend"

# 端口已被占用则视为已在运行
if ss -H -lntp 2>/dev/null | grep -q ":${DJANGO_PORT} "; then
  echo "[backend] Django 已在运行于 127.0.0.1:${DJANGO_PORT}"
  exit 0
fi

if [ ! -f "${BACKEND_DIR}/manage.py" ]; then
  echo "[backend] 未找到 ${BACKEND_DIR}/manage.py，跳过 Django 启动（前端仍可用，/api 将返回 502）"
  exit 0
fi

mkdir -p "${LOG_DIR:-${WORKSPACE}/logs}"
LOGFILE="${LOG_DIR:-${WORKSPACE}/logs}/django.log"

cd "${BACKEND_DIR}"
export DJANGO_PORT
echo "[backend] 启动 Django 后端 127.0.0.1:${DJANGO_PORT} (log: ${LOGFILE})"
nohup python3 manage.py runserver "127.0.0.1:${DJANGO_PORT}" --noreload >>"${LOGFILE}" 2>&1 &
sleep 2

if ss -H -lntp 2>/dev/null | grep -q ":${DJANGO_PORT} "; then
  echo "[backend] Django 后端启动成功"
else
  echo "[backend] 警告：Django 后端可能未成功启动，请查看 ${LOGFILE}"
fi
exit 0
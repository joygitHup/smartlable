# AGENTS.md

## 项目概览
AI 智能标注系统（人机协同），实现「AI 预标注 → 置信度分流 → 人工审核 → 数据回流」的数据飞轮。
MVP 聚焦文本类任务（文本分类 / 情感分析 / 实体抽取），架构为**前后端分离**。

## 技术栈与架构
- **后端** `backend/`：Django 4.2 + Django REST Framework + DRF Token 认证，监听 `127.0.0.1:8001`
  - 真实调用 LLM 做预标注：`coze-coding-dev-sdk`（Python），模型 `glm-4-7-251222`（ai/service.py）
- **前端** `frontend/`：Vite 7 + React 19 + TypeScript + Tailwind CSS 3，运行于 ${DEPLOY_RUN_PORT}
- **联通**：同源同端口对外，`/api/**` 反向代理到 Django（开发走 Vite proxy，生产走 Express server.ts 内 http 代理）
- 数据存储：SQLite（backend/db.sqlite3）

## 常用命令
```bash
# 开发（根目录 .coze）
coze dev                                  # 启动 Django(8001) + Vite dev server(5000)，支持 HMR

# 后端（需系统 python3，已全局安装 django/drf）
cd backend && python3 manage.py runserver 127.0.0.1:8001   # 单独跑后端
cd backend && python3 manage.py migrate                    # 迁移
cd backend && python3 manage.py seed                       # 种子数据（多角色账号+示例任务）
python3 manage.py makemigrations                           # 生成迁移

# 前端
cd frontend && pnpm install
cd frontend && pnpm exec tsc --noEmit      # TS 类型检查
cd frontend && pnpm exec eslint .          # ESLint
cd frontend && pnpm exec stylelint "**/*.css"
cd frontend && pnpm exec vite build        # 前端生产构建

# 生产构建（根构建脚本，输出 dist/ + dist-server/server.cjs）
bash scripts/build.sh
# 生产启动（拉起 Django + Express）
bash scripts/start-all.sh
```

## 目录结构
```
backend/
  config/           # Django settings/urls/wsgi
  core/             # 用户(User.role)、权限、操作日志审计、种子 seed、dashboard
    management/commands/seed.py   # 预置 admin/operator/annotator/engineer/pm + 示例任务
    middleware.py                 # 审计日志落库（读 request._request._audit_*）
  tasks/            # 任务管理 + 数据单元 Unit + 导入/审核/展示
  ai/               # LLM 预标注 service.py + 模型记录 ModelRecord + compare
  quality/          # 质量统计 + 金标抽检
  start_backend.sh  # 后端拉起脚本
frontend/
  src/
    api.ts          # fetch 封装 + Token + authEvents
    auth.tsx        # AuthContext 鉴权
    layout/Layout.tsx
    pages/          # Login/Dashboard/TaskList/TaskDetail/Labeling/Models/System
    components/common.tsx
    types.ts
  server/server.ts  # 生产 Express + /api 反向代理(→Django)
  scripts/          # 模板 dev/build/start（生产 build 用 esbuild --packages=external）
scripts/            # 根编排：dev-all/build/start-all/prepare
.coze               # 根 TOML：dev/build/run 编排
```

## 关键 API（/api/v1 前缀，Token 认证）
- `POST /auth/login` / `GET /auth/me`
- Tasks: `GET/POST /tasks`、`GET /tasks/{id}`、`GET /tasks/{id}/units`、`GET /tasks/{id}/progress`、`GET /tasks/{id}/quality`
- `POST /tasks/{id}/import`（items 带 content，可选 ai_prediction/confidence 走分流）、`POST /tasks/{id}/to-review`（人工入队降级）、`GET /tasks/{id}/queue`（取一条待审核）、`POST /tasks/{id}/reflow`、`POST /tasks/{id}/gold-check`、`POST /tasks/{id}/export`
- `POST /units/{id}/review`（action: accept|modify）
- `POST /tasks/{id}/run-ai`（批量 LLM 预标注）、`GET/POST /ml/models`、`POST /ml/compare`
- `GET /dashboard`、`GET /users`、`GET /audit-logs`

## 注意
- 多 worktree 场景端口：前端用 ${DEPLOY_RUN_PORT}，后端固定 127.0.0.1:8001（同机单实例）。
- coze LLM SDK 账号余额影响预标注，欠费时 run-ai 如实返回 503 + errors；系统已提供「导入自带预标注」与「人工入队(to-review)」两条降级兜底链路。
- 审计：DRF 视图需在 `request._request` 上设置 `_audit_action/_audit_target_*` 才会被 middleware 落库。
- 前端禁止硬编码后端域名；后端代理统一走 `${DJANGO_BACKEND_URL:-http://127.0.0.1:8001}`。
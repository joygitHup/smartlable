"""
Django settings for AI 智能标注系统 (backend).
前后端分离：本后端仅暴露 REST API，监听 127.0.0.1:8001（由 DJANGO_PORT 环境变量覆盖），
前端 Express(5000) 通过 /api/** 反向代理访问本后端。
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-ai-annotate-dev-7hg3#k!$v@qa-annotation-system",
)
DEBUG = os.environ.get("COZE_PROJECT_ENV", "DEV") != "PROD"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 第三方
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "corsheaders",
    # 业务应用
    "core",
    "tasks",
    "ai",
    "quality",
    # F8~F15 业务增强模块
    "common",
    "specs",      # F8 冷启动与规范管理
    "workforce",  # F9 任务调度与人力管理
    "prelabel",   # F10 AI 预标注现实增强
    "qc",         # F11 质量管理深水区
    "compliance",  # F12 数据安全与合规
    "integration",  # F13 与业务系统集成
    "ops",        # F14 运营与协作
    "llmops",     # F15 LLM 时代新标注范式
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.AuditTrailMiddleware",
    "common.middleware.RequestIDMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("DJANGO_DB_PATH", str(BASE_DIR / "db.sqlite3")),
    }
}

AUTH_USER_MODEL = "core.User"
AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------- DRF ----------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "UNAUTHENTICATED_USER_ID": None,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "write": "100/hour",
        "sensitive": "10/hour",
        "export": "5/hour",
    },
}

# ---------------- CORS ----------------
CORS_ALLOW_CREDENTIALS = True


def _env_domain() -> str:
    d = os.environ.get("COZE_PROJECT_DOMAIN_DEFAULT", "").strip()
    if d.startswith("http://"):
        d = d[len("http://"):]
    elif d.startswith("https://"):
        d = d[len("https://"):]
    return d


_origin = _env_domain()
CORS_ALLOWED_ORIGINS = [f"https://{_origin}", f"http://{_origin}"] if len(_origin) > 1 else []
CORS_ALLOW_ALL_ORIGINS = True  # 沙箱环境经反向代理同源访问，放开以适配隧道域名

# ---------------- 业务配置 ----------------
DEFAULT_CONFIDENCE_THRESHOLD = 0.8
DEFAULT_MANUAL_REVIEW_RATIO = 0.3
# 默认预标注模型
DEFAULT_LLM_MODEL = os.environ.get(
    "AI_ANNOTATE_LLM_MODEL", "glm-4-7-251222"
)
# LLM 计费单价（每千 token 价格），如 {"glm-4-7-251222": {"input": 0.001, "output": 0.002}}；
# 留空表示未配置单价，成本记录按 0 计（不臆造价格）。
LLM_TOKEN_PRICE = {}

# ---------------- 缓存 ----------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "ai-annotate",
    }
}

# ---------------- OpenAPI ----------------
SPECTACULAR_SETTINGS = {
    "TITLE": "AI 智能标注系统 API",
    "DESCRIPTION": "AI 预标注 + 人工审核 + 业务增强模块 (F8~F15) REST API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
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
    "corsheaders",
    # 业务应用
    "core",
    "tasks",
    "ai",
    "quality",
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
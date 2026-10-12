from django.urls import path
from . import views

urlpatterns = [
    path("health", views.health),
    path("auth/login", views.login),
    path("auth/logout", views.logout),
    path("auth/me", views.me),
    path("users", views.users),
    path("users/<int:uid>", views.user_detail),
    path("audit-logs", views.audit_logs),
    path("dashboard", views.dashboard),
]
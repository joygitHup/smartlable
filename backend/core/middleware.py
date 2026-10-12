from django.utils.deprecation import MiddlewareMixin

# 需要审计的关键操作前缀（后端统一在此登记，避免散落）
AUDIT_ACTIONS = (
    "task:create",
    "task:update",
    "task:delete",
    "task:import",
    "task:run_ai",
    "task:reflow",
    "task:export",
    "unit:review",
    "gold:check",
    "ml:create",
    "user:create",
    "user:update",
)


class AuditTrailMiddleware(MiddlewareMixin):
    """为已登记的关键操作自动落审计日志；业务代码也可手动调 log_action。"""

    def process_response(self, request, response):
        # JSON 写操作（POST/PUT/PATCH/DELETE）且命中登记动作时记录。
        # 具体动作名由视图在响应头或通过 request._audit_action 标注。
        action = getattr(request, "_audit_action", None)
        if action:
            from .models import log_action

            log_action(
                getattr(request, "user", None),
                action,
                target_type=getattr(request, "_audit_target_type", ""),
                target_id=getattr(request, "_audit_target_id", ""),
                detail=getattr(request, "_audit_detail", {}),
            )
        return response
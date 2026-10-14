"""integration 列表查询参数过滤（纯函数）。"""


def filter_clients(qs, params):
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs


def filter_webhooks(qs, params):
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs


def filter_deliveries(qs, params):
    webhook = params.get("webhook") or params.get("webhook_id")
    if webhook:
        qs = qs.filter(webhook_id=webhook)
    event = params.get("event")
    if event:
        qs = qs.filter(event=event)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs


def filter_datasources(qs, params):
    source_type = params.get("source_type")
    if source_type:
        qs = qs.filter(source_type=source_type)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs


def filter_platforms(qs, params):
    platform_type = params.get("platform_type")
    if platform_type:
        qs = qs.filter(platform_type=platform_type)
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs


def filter_sso_configs(qs, params):
    provider = params.get("provider")
    if provider:
        qs = qs.filter(provider=provider)
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs

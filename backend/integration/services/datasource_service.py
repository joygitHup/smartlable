"""数据源对接服务(F13.3)：配置校验与 best-effort 同步（不伪装成功、不伪造数据）。

http_api 类型已实现真实适配器：连接校验与同步均真实发起 HTTP GET 并解析 JSON；
其它类型暂无适配器，如实返回失败原因，不假造数据。
"""
from django.db import transaction

from core.models import log_action

from ..constants import REQUIRED_CONFIG_KEYS
from ..models import DataSource, DataSourceStatus, SourceType
from ..utils import get_json, now


def _missing_keys(source: DataSource) -> list:
    required = REQUIRED_CONFIG_KEYS.get(source.source_type, [])
    config = source.config or {}
    return [key for key in required if not config.get(key)]


def _http_get(source: DataSource) -> dict:
    """按数据源 config 真实发起一次 GET 探活/拉取。"""
    config = source.config or {}
    headers = config.get("headers") if isinstance(config.get("headers"), dict) else None
    params = config.get("params") if isinstance(config.get("params"), dict) else None
    return get_json(config.get("url", ""), params=params, headers=headers)


def _extract_items(data, items_path: str) -> list:
    """按 items_path（点路径）定位记录列表，缺省时兼容常见包裹字段。"""
    node = data
    if items_path:
        for part in str(items_path).split("."):
            node = node.get(part) if isinstance(node, dict) else None
            if node is None:
                break
    if isinstance(node, list):
        return node
    if isinstance(node, dict):
        for key in ("items", "data", "results", "records", "list"):
            if isinstance(node.get(key), list):
                return node[key]
    return []


def _import_items(config: dict, items: list, user=None) -> int:
    """可选：把拉取到的记录导入指定任务(F13.3)。

    仅当 config 同时提供 task_id 与 content_field 时落库；否则只统计不导入。
    按 content 幂等去重，避免重复拉取造成数据膨胀。
    """
    task_id = config.get("task_id")
    content_field = config.get("content_field")
    if not task_id or not content_field or not items:
        return 0

    from tasks.models import SplitType, Task, Unit, UnitStatus  # 延迟导入，避免应用间耦合

    task = Task.objects.filter(id=task_id).first()
    if task is None:
        return 0

    created = 0
    for item in items:
        if not isinstance(item, dict):
            continue
        content = str(item.get(content_field) or "").strip()
        if not content or Unit.objects.filter(task=task, content=content).exists():
            continue
        Unit.objects.create(task=task, content=content, status=UnitStatus.CREATED, split=SplitType.NONE)
        created += 1
    return created


@transaction.atomic
def test_connection(source: DataSource, user=None) -> dict:
    """校验配置完整性；http_api 类型额外真实发起 GET 探活(F13.3)。"""
    missing = _missing_keys(source)
    if missing:
        source.status = DataSourceStatus.ERROR
        message = f"配置缺少必需字段: {', '.join(missing)}"
        ok_flag = False
    elif source.source_type == SourceType.HTTP_API:
        result = _http_get(source)
        ok_flag = result["ok"]
        source.status = DataSourceStatus.CONNECTED if ok_flag else DataSourceStatus.ERROR
        message = "HTTP 接口探活成功" if ok_flag else f"HTTP 接口探活失败：{result['error'] or result['status_code']}"
    else:
        source.status = DataSourceStatus.CONNECTED
        message = "配置完整，连接校验通过"
        ok_flag = True
    source.save(update_fields=["status", "updated_at"])
    log_action(user, "integration:datasource_test", "data_source", source.id, {"ok": ok_flag, "missing": missing})
    return {"ok": ok_flag, "status": source.status, "missing": missing, "message": message}


@transaction.atomic
def sync(source: DataSource, user=None) -> dict:
    """best-effort 同步(F13.3)。

    http_api：真实 GET 拉取 JSON，按 config 可选导入到指定任务；未实现适配器的类型如实返回失败。
    """
    missing = _missing_keys(source)
    if missing:
        ok_flag = False
        status = DataSourceStatus.ERROR
        synced = 0
        reason = f"配置缺少必需字段: {', '.join(missing)}"
    elif source.source_type == SourceType.HTTP_API:
        result = _http_get(source)
        if not result["ok"]:
            ok_flag = False
            status = DataSourceStatus.ERROR
            synced = 0
            reason = f"HTTP 接口拉取失败：{result['error'] or result['status_code']}"
        else:
            config = source.config or {}
            items = _extract_items(result["data"], config.get("items_path", ""))
            imported = _import_items(config, items, user)
            ok_flag = True
            status = DataSourceStatus.CONNECTED
            synced = len(items)
            reason = f"HTTP 接口同步成功，获取 {synced} 条记录"
            if imported:
                reason += f"，其中新增 {imported} 条到任务 #{config.get('task_id')}"
    else:
        ok_flag = False
        status = DataSourceStatus.ERROR
        synced = 0
        reason = "未实现该数据源的抽取适配器，无法真实同步"

    source.status = status
    source.last_sync_at = now()
    source.save(update_fields=["status", "last_sync_at", "updated_at"])
    log_action(user, "integration:datasource_sync", "data_source", source.id, {"ok": ok_flag, "synced": synced})
    return {"ok": ok_flag, "synced": synced, "status": status, "reason": reason}

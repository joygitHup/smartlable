"""
AI 预标注服务：通过 coze-coding-dev-sdk 真实调用 LLM，返回标签 + 置信度，并按阈值分流。
所有推理结果均来自真实模型响应，禁止 Mock。
"""
import json
import logging

from django.conf import settings

from langchain_core.messages import SystemMessage, HumanMessage
from coze_coding_dev_sdk import LLMClient
from coze_coding_utils.runtime_ctx.context import new_context

logger = logging.getLogger("ai_annotate.prelabel")

# prompt 与任务类型策略
SCHEMAS = {
    "classification": (
        "你是一个严谨的文本分类标注助手。根据标注规范，把下面样本归入且仅归入一个类别。"
        '只输出 JSON，不要任何解释：{"label": "<类别>", "confidence": 0.0-1.0} '
        "confidence 表示你对该分类的判断确信度。"
    ),
    "sentiment": (
        "你是一个严谨的情感分析标注助手。根据标注规范，判断下面文本的情感倾向。"
        '只输出 JSON，不要任何解释：{"label": "<正向|负面|中性>", "confidence": 0.0-1.0} '
        "confidence 表示你对该判断的确信度。"
    ),
    "entity": (
        "你是一个严谨的命名实体识别助手。抽取下面文本中的实体及类型。"
        '只输出 JSON，不要任何解释：{"entities": [{"text": "实体词", "type": "类型"}], "confidence": 0.0-1.0} '
        "confidence 表示整体抽取结果的确信度。"
    ),
    "object_detection": (
        "这是一个目标检测任务（当前为文本描述模式）。根据标注规范识别样本中的对象。"
        '只输出 JSON：{"label": "<对象类别>", "confidence": 0.0-1.0}。'
    ),
}


def _extract_model_ids() -> str:
    """返回默认 LLM 模型标识。"""
    return getattr(settings, "DEFAULT_LLM_MODEL", "glm-4-7-251222")


def _get_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict) and c.get("type") == "text":
                parts.append(c.get("text", ""))
        return " ".join(parts)
    return str(content)


def _extract_json(text: str):
    """从模型输出中提取 JSON。"""
    if not text:
        raise ValueError("模型返回为空")
    text = _get_text(text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 提取花括号包裹的最外层 JSON
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise ValueError(f"无法解析模型输出: {text[:120]}")


def _extract_usage(response) -> dict:
    """从 LLM 响应中尽力提取 token 用量(F15.2)。

    不同 SDK 版本字段位置不同，逐一探测；取不到时返回 0，
    不做估算、不伪造 token 数。
    """
    usage = {}
    meta = getattr(response, "response_metadata", None)
    if isinstance(meta, dict) and isinstance(meta.get("usage"), dict):
        usage = meta["usage"]
    if not usage:
        um = getattr(response, "usage_metadata", None)
        if isinstance(um, dict):
            usage = um
    if not usage:
        inner = getattr(response, "response", None)
        inner_meta = getattr(inner, "response_metadata", None) if inner is not None else None
        if isinstance(inner_meta, dict) and isinstance(inner_meta.get("usage"), dict):
            usage = inner_meta["usage"]

    prompt = usage.get("prompt_tokens") or usage.get("input_tokens") or 0
    completion = usage.get("completion_tokens") or usage.get("output_tokens") or 0
    total = usage.get("total_tokens") or (int(prompt or 0) + int(completion or 0))
    return {
        "prompt_tokens": int(prompt or 0),
        "completion_tokens": int(completion or 0),
        "total_tokens": int(total or 0),
    }


def run_inference(task, content: str) -> dict:
    """
    对单条样本执行 LLM 预标注。
    返回 {"prediction": {...}, "confidence": float, "model": str, "usage": {...}}
    失败时抛异常，由上层决定降级策略。
    """
    model = _extract_model_ids()
    schema = SCHEMAS.get(task.task_type, SCHEMAS["classification"])
    spec = task.spec or {}

    labels = spec.get("labels") or []
    instructions = spec.get("instructions") or ""
    label_hint = ""
    if labels:
        label_hint = f"\n候选类别：{', '.join(labels)}"

    system = SystemMessage(content="你是一套企业级 AI 预标注引擎。严格遵守标注规范，输出可被机器解析的纯 JSON。")
    human = HumanMessage(
        content=f"{schema}\n标注规范：{instructions or '（无额外说明）'}{label_hint}\n样本内容：\n---\n{content}\n---\n"
    )

    ctx = new_context(method="invoke")
    client = LLMClient(ctx=ctx)
    response = client.invoke(
        messages=[system, human],
        model=model,
        temperature=0.2,
        thinking="disabled",
        max_completion_tokens=1024,
    )
    data = _extract_json(response.content)

    # 归一化 prediction 与 confidence
    if task.task_type in ("entity",):
        prediction = data.get("entities", [])
        confidence = float(data.get("confidence", 0.8 if prediction else 0.2))
    else:
        label = data.get("label", "")
        prediction = {"label": label}
        confidence = float(data.get("confidence", 0.5))
    # 置信度限幅
    confidence = max(0.0, min(1.0, confidence))
    return {
        "prediction": prediction,
        "confidence": confidence,
        "model": model,
        "usage": _extract_usage(response),
    }
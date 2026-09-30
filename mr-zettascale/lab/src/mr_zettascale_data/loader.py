import json
from pathlib import Path
from typing import Any

from .models import ActivityRecord


def load_activities(path: Path) -> list[ActivityRecord]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    items = raw.get("activities", []) if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        raise ValueError("Input JSON must be an array or an object with an activities array.")
    return [normalize_activity(item, index) for index, item in enumerate(items, start=1)]


def normalize_activity(raw: Any, index: int) -> ActivityRecord:
    item = raw if isinstance(raw, dict) else {}
    start = pick_datetime(item, "start", "startLocal")
    end = pick_datetime(item, "end", "endLocal")
    tags = item.get("tags", [])
    return ActivityRecord(
        activity_id=string_value(item.get("id")) or f"record-{index}",
        title=string_value(item.get("title") or item.get("summary")),
        start_raw=start,
        end_raw=end,
        all_day=bool(item.get("allDay")),
        category=string_value(item.get("category") or item.get("categoryName")),
        tags=tuple(tag.strip() for tag in tags if isinstance(tag, str) and tag.strip()) if isinstance(tags, list) else (),
        notes=string_value(item.get("notes")),
        source=string_value(item.get("source")) or infer_source(item),
    )


def pick_datetime(item: dict[str, Any], calendar_key: str, draft_key: str) -> str:
    value = item.get(draft_key)
    if isinstance(value, str):
        return value.strip()
    calendar_value = item.get(calendar_key)
    if isinstance(calendar_value, str):
        return calendar_value.strip()
    if isinstance(calendar_value, dict):
        return string_value(calendar_value.get("dateTime") or calendar_value.get("date"))
    return ""


def string_value(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def infer_source(item: dict[str, Any]) -> str:
    return "assistant-draft" if "startLocal" in item or "categoryName" in item else "calendar"

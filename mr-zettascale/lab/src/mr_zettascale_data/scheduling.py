"""Offline checks for synthetic scheduling proposals, not a live scheduler."""

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


def load_scheduling_cases(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    cases = raw.get("cases", []) if isinstance(raw, dict) else []
    if not isinstance(cases, list):
        raise ValueError("Scheduling evaluation input must contain a cases array.")
    return [case for case in cases if isinstance(case, dict)]


def evaluate_scheduling_cases(cases: list[dict[str, Any]]) -> dict[str, Any]:
    results = [evaluate_case(case, index) for index, case in enumerate(cases, start=1)]
    passed = sum(result["passed"] for result in results)
    checks = Counter(check["name"] for result in results for check in result["checks"] if check["passed"])
    return {
        "summary": {"totalCases": len(results), "passedCases": passed, "failedCases": len(results) - passed},
        "passedCheckCounts": dict(sorted(checks.items())),
        "cases": results,
    }


def evaluate_case(case: dict[str, Any], index: int) -> dict[str, Any]:
    case_id = string_value(case.get("id")) or f"case-{index}"
    expected = case.get("expect") if isinstance(case.get("expect"), dict) else {}
    proposed = activity_list(case.get("proposedActivities"))
    existing = activity_list(case.get("existingActivities"))
    checks = []
    window_start = parse_datetime(case.get("windowStart"))
    window_end = parse_datetime(case.get("windowEnd"))

    if expected.get("startsInFuture"):
        current = parse_datetime(case.get("currentLocal"))
        checks.append(check("starts_in_future", current is not None and all(valid_start(item) >= current for item in proposed)))
    if expected.get("staysWithinWindow"):
        checks.append(check("stays_within_window", window_start is not None and window_end is not None and all(
            valid_start(item) >= window_start and valid_end(item) <= window_end for item in proposed
        )))
    if "maxOverlaps" in expected:
        limit = expected["maxOverlaps"]
        maximum = maximum_overlaps(existing + proposed)
        checks.append(check("respects_overlap_limit", isinstance(limit, int) and maximum <= limit, {"maximum": maximum, "limit": limit}))
    if expected.get("reviewable"):
        checks.append(check("all_proposals_reviewable", bool(proposed) and all(item.get("editable") is True for item in proposed)))
    if "focusBlockMinutes" in expected:
        checks.append(check_focus_breaks(proposed, expected["focusBlockMinutes"], expected.get("breakMinutes", 15)))
    if "unscheduledTitles" in expected:
        actual_titles = {string_value(item.get("title")) for item in activity_list(case.get("unscheduled"))}
        required_titles = {string_value(title) for title in expected["unscheduledTitles"] if isinstance(title, str)}
        checks.append(check("unscheduled_tasks_visible", required_titles.issubset(actual_titles), {"expected": sorted(required_titles), "actual": sorted(actual_titles)}))

    return {"id": case_id, "passed": bool(checks) and all(item["passed"] for item in checks), "checks": checks}


def check_focus_breaks(proposed: list[dict[str, Any]], focus_minutes: int, break_minutes: int) -> dict[str, Any]:
    ordered = sorted(proposed, key=valid_start)
    focus = [item for item in ordered if item.get("kind") == "focus"]
    focus_lengths_ok = all(minutes_between(item) == focus_minutes for item in focus)
    protected_pairs = all(any(
        item.get("kind") == "break"
        and minutes_between(item) == break_minutes
        and valid_start(item) == valid_end(left)
        and valid_end(item) == valid_start(right)
        for item in ordered
    ) for left, right in zip(focus, focus[1:]))
    return check("preserves_focus_breaks", bool(focus) and focus_lengths_ok and protected_pairs, {
        "focusBlocks": len(focus), "focusMinutes": focus_minutes, "breakMinutes": break_minutes
    })


def maximum_overlaps(activities: list[dict[str, Any]]) -> int:
    edges = []
    for activity in activities:
        start, end = valid_start(activity), valid_end(activity)
        if start >= end:
            continue
        edges.extend([(start, 1), (end, -1)])
    active = maximum = 0
    for _time, delta in sorted(edges, key=lambda edge: (edge[0], edge[1])):
        active += delta
        maximum = max(maximum, active)
    return maximum


def activity_list(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def parse_datetime(value: Any) -> datetime:
    if not isinstance(value, str):
        return datetime.min
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min


def valid_start(activity: dict[str, Any]) -> datetime:
    return parse_datetime(activity.get("start"))


def valid_end(activity: dict[str, Any]) -> datetime:
    return parse_datetime(activity.get("end"))


def minutes_between(activity: dict[str, Any]) -> int:
    return round((valid_end(activity) - valid_start(activity)).total_seconds() / 60)


def string_value(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def check(name: str, passed: bool, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"name": name, "passed": passed, **({"details": details} if details else {})}

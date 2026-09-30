from collections import Counter
from datetime import timedelta
import re

from .models import ActivityRecord, Finding, parse_local_datetime


AMBIGUOUS_TITLE_MAX_LENGTH = 4
UNUSUALLY_LONG_DURATION = timedelta(hours=12)


def analyze_activities(activities: list[ActivityRecord]) -> dict:
    findings: list[Finding] = []
    valid_records = []
    minutes_by_category: Counter[str] = Counter()
    minutes_by_day: Counter[str] = Counter()

    for activity in activities:
        activity_findings, start, end = analyze_activity(activity)
        findings.extend(activity_findings)
        has_error = any(finding.severity == "error" for finding in activity_findings)
        if has_error or start is None or end is None or end <= start:
            continue
        valid_records.append(activity)
        duration_minutes = round((end - start).total_seconds() / 60)
        minutes_by_category[activity.category or "Uncategorized"] += duration_minutes
        minutes_by_day[start.date().isoformat()] += duration_minutes

    finding_counts = Counter(finding.code for finding in findings)
    records_with_errors = {finding.activity_id for finding in findings if finding.severity == "error"}
    priority_ready = sum(1 for activity in valid_records if has_priority_context(activity))
    return {
        "summary": {
            "totalActivities": len(activities),
            "validActivities": len(valid_records),
            "invalidActivities": len(records_with_errors),
            "priorityContextReadyActivities": priority_ready,
            "priorityContextInsufficientActivities": finding_counts["insufficient_priority_context"],
        },
        "findingCounts": dict(sorted(finding_counts.items())),
        "timePatterns": {
            "minutesByCategory": dict(sorted(minutes_by_category.items())),
            "minutesByStartDate": dict(sorted(minutes_by_day.items())),
        },
        "findings": [finding.as_dict() for finding in findings],
    }


def analyze_activity(activity: ActivityRecord) -> tuple[list[Finding], object, object]:
    findings: list[Finding] = []
    if not activity.title:
        findings.append(finding(activity, "missing_title", "error", "Activity has no title."))
    elif is_ambiguous_title(activity.title):
        findings.append(finding(activity, "ambiguous_title", "warning", "Title is too short or code-like for reliable interpretation."))

    start = parse_local_datetime(activity.start_raw)
    end = parse_local_datetime(activity.end_raw)
    if start is None:
        findings.append(finding(activity, "invalid_start", "error", "Start date/time is missing or invalid."))
    if end is None:
        findings.append(finding(activity, "invalid_end", "error", "End date/time is missing or invalid."))
    if start is not None and end is not None:
        if end <= start:
            findings.append(finding(activity, "end_before_start", "error", "End must be after start."))
        elif not activity.all_day and end - start > UNUSUALLY_LONG_DURATION:
            findings.append(finding(activity, "unusually_long_duration", "warning", "Timed activity lasts longer than 12 hours."))

    if not activity.category:
        findings.append(finding(activity, "missing_category", "warning", "Activity has no category."))
    if not activity.tags:
        findings.append(finding(activity, "missing_tags", "info", "Activity has no tags."))
    if not has_priority_context(activity):
        findings.append(finding(activity, "insufficient_priority_context", "info", "Available data is too limited for confident priority inference."))
    return findings, start, end


def has_priority_context(activity: ActivityRecord) -> bool:
    return bool(activity.title and (activity.category or activity.tags or activity.notes))


def is_ambiguous_title(title: str) -> bool:
    compact = title.strip()
    if len(compact) <= AMBIGUOUS_TITLE_MAX_LENGTH:
        return True
    if re.fullmatch(r"[A-Z]{2,}[-_][A-Z0-9]+", compact):
        return True
    return compact.replace("-", "").replace("_", "").isalnum() and any(char.isdigit() for char in compact)


def finding(activity: ActivityRecord, code: str, severity: str, message: str) -> Finding:
    return Finding(code=code, severity=severity, activity_id=activity.activity_id, message=message)

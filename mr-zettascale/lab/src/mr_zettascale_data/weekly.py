"""Offline weekly time-pattern aggregation for sanitized activity records."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from .models import ActivityRecord, parse_local_datetime


def analyze_weekly_patterns(activities: list[ActivityRecord]) -> dict:
    minutes_by_category: Counter[str] = Counter()
    minutes_by_date: Counter[str] = Counter()
    minutes_by_period: Counter[str] = Counter()
    intervals_by_date: dict[str, list[tuple[datetime, datetime]]] = defaultdict(list)
    invalid_ids, all_day_count, missing_category_count, missing_tags_count, timed_count = [], 0, 0, 0, 0

    for activity in activities:
        missing_category_count += not bool(activity.category)
        missing_tags_count += not bool(activity.tags)
        start, end = normalized_interval(activity)
        if start is None or end is None or end <= start:
            invalid_ids.append(activity.activity_id)
            continue
        if activity.all_day:
            all_day_count += 1
            continue
        timed_count += 1
        category = activity.category or "Uncategorized"
        for segment_start, segment_end in split_at_midnight(start, end):
            minutes = round((segment_end - segment_start).total_seconds() / 60)
            day = segment_start.date().isoformat()
            minutes_by_category[category] += minutes
            minutes_by_date[day] += minutes
            minutes_by_period[time_period(segment_start)] += minutes
            intervals_by_date[day].append((segment_start, segment_end))

    daily_overlaps = {day: maximum_overlap(intervals) for day, intervals in sorted(intervals_by_date.items())}
    return {
        "summary": {
            "totalActivities": len(activities), "timedActivities": timed_count, "allDayActivities": all_day_count,
            "invalidActivities": len(invalid_ids), "totalScheduledMinutes": sum(minutes_by_category.values()),
            "daysWithOverlap": sum(value > 1 for value in daily_overlaps.values()), "maximumConcurrentActivities": max(daily_overlaps.values(), default=0),
        },
        "timePatterns": {
            "minutesByCategory": dict(sorted(minutes_by_category.items())), "minutesByDate": dict(sorted(minutes_by_date.items())),
            "minutesByStartPeriod": dict(sorted(minutes_by_period.items())), "maximumConcurrentActivitiesByDate": daily_overlaps,
        },
        "dataQuality": {"missingCategoryActivities": missing_category_count, "missingTagsActivities": missing_tags_count, "invalidActivityIds": invalid_ids},
    }


def normalized_interval(activity: ActivityRecord) -> tuple[datetime | None, datetime | None]:
    start, end = parse_local_datetime(activity.start_raw), parse_local_datetime(activity.end_raw)
    return (start.replace(tzinfo=None) if start else None, end.replace(tzinfo=None) if end else None)


def split_at_midnight(start: datetime, end: datetime):
    cursor = start
    while cursor.date() < end.date():
        next_day = datetime.combine(cursor.date() + timedelta(days=1), datetime.min.time())
        yield cursor, next_day
        cursor = next_day
    yield cursor, end


def time_period(value: datetime) -> str:
    if 5 <= value.hour < 12:
        return "morning"
    if 12 <= value.hour < 17:
        return "afternoon"
    if 17 <= value.hour < 22:
        return "evening"
    return "night"


def maximum_overlap(intervals: list[tuple[datetime, datetime]]) -> int:
    edges = [(start, 1) for start, _ in intervals] + [(end, -1) for _, end in intervals]
    active = maximum = 0
    for _time, delta in sorted(edges, key=lambda edge: (edge[0], edge[1])):
        active += delta
        maximum = max(maximum, active)
    return maximum

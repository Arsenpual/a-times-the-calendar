"""Explainable data-readiness checks for future human priority review."""

from collections import Counter

from .models import ActivityRecord
from .quality import is_ambiguous_title


def assess_priority_confidence(activities: list[ActivityRecord]) -> dict:
    assessments = [assess_activity(activity) for activity in activities]
    counts = Counter(item["confidence"] for item in assessments)
    ready = sum(item["reviewState"] == "ready_for_human_review" for item in assessments)
    return {
        "summary": {
            "totalActivities": len(assessments),
            "highConfidence": counts["high"],
            "moderateConfidence": counts["moderate"],
            "lowConfidence": counts["low"],
            "readyForHumanReview": ready,
        },
        "assessments": assessments,
    }


def assess_activity(activity: ActivityRecord) -> dict:
    signals = []
    missing = []
    clear_title = bool(activity.title) and not is_ambiguous_title(activity.title)
    if clear_title:
        signals.append("clear_title")
    else:
        missing.append("clear_title")
    if activity.category:
        signals.append("category")
    else:
        missing.append("category")
    if activity.tags:
        signals.append("tags")
    else:
        missing.append("tags")
    if activity.notes:
        signals.append("notes")
    else:
        missing.append("notes")

    score = len(signals)
    confidence = "high" if clear_title and score >= 3 else "moderate" if clear_title and score >= 2 else "low"
    return {
        "activityId": activity.activity_id,
        "title": activity.title,
        "confidence": confidence,
        "evidenceSignals": signals,
        "missingSignals": missing,
        "reviewState": "ready_for_human_review" if confidence == "high" else "needs_more_context",
    }

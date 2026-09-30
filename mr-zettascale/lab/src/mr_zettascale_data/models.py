from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ActivityRecord:
    """A source-neutral activity shape used only for offline analysis."""

    activity_id: str
    title: str
    start_raw: str
    end_raw: str
    all_day: bool
    category: str
    tags: tuple[str, ...]
    notes: str
    source: str


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    activity_id: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "severity": self.severity,
            "activityId": self.activity_id,
            "message": self.message,
        }


def parse_local_datetime(value: str) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(candidate)
    except ValueError:
        return None

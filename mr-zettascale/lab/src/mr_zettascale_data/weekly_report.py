import json
from pathlib import Path


def write_weekly_reports(report: dict, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "weekly-time-pattern-report.json"
    markdown_path = output_dir / "weekly-time-pattern-report.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_path.write_text(to_markdown(report), encoding="utf-8")
    return json_path, markdown_path


def to_markdown(report: dict) -> str:
    summary, patterns, quality = report["summary"], report["timePatterns"], report["dataQuality"]
    lines = ["# Weekly Time-Pattern Report", "", "This is a descriptive summary of scheduled time, not a judgment or recommendation.", "", "## Summary", "",
        f"- Timed activities: {summary['timedActivities']}", f"- All-day activities: {summary['allDayActivities']}", f"- Invalid activities excluded: {summary['invalidActivities']}",
        f"- Scheduled time: {summary['totalScheduledMinutes']} minutes", f"- Days with overlapping timed activities: {summary['daysWithOverlap']}",
        f"- Maximum concurrent timed activities: {summary['maximumConcurrentActivities']}", "", "## Minutes By Category", ""]
    lines.extend(f"- {name}: {minutes}" for name, minutes in patterns["minutesByCategory"].items())
    lines.extend(["", "## Minutes By Date", ""])
    lines.extend(f"- {name}: {minutes}" for name, minutes in patterns["minutesByDate"].items())
    lines.extend(["", "## Minutes By Start Period", ""])
    lines.extend(f"- {name}: {minutes}" for name, minutes in patterns["minutesByStartPeriod"].items())
    lines.extend(["", "## Data Quality", "", f"- Activities without category: {quality['missingCategoryActivities']}", f"- Activities without tags: {quality['missingTagsActivities']}", f"- Invalid activity ids: {', '.join(quality['invalidActivityIds']) or 'none'}"])
    return "\n".join(lines) + "\n"

import json
from pathlib import Path


def write_reports(report: dict, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "activity-quality-report.json"
    markdown_path = output_dir / "activity-quality-report.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_path.write_text(to_markdown(report), encoding="utf-8")
    return json_path, markdown_path


def to_markdown(report: dict) -> str:
    summary = report["summary"]
    finding_counts = report["findingCounts"]
    lines = [
        "# Activity Data Quality Report",
        "",
        "## Summary",
        "",
        f"- Activities analyzed: {summary['totalActivities']}",
        f"- Valid activities: {summary['validActivities']}",
        f"- Invalid activities: {summary['invalidActivities']}",
        f"- Ready for future priority analysis: {summary['priorityContextReadyActivities']}",
        f"- Insufficient priority context: {summary['priorityContextInsufficientActivities']}",
        "",
        "## Finding Counts",
        "",
    ]
    lines.extend(f"- `{code}`: {count}" for code, count in finding_counts.items())
    lines.extend(["", "## Findings", ""])
    if not report["findings"]:
        lines.append("No findings.")
    else:
        lines.extend(
            f"- [{finding['severity']}] `{finding['code']}` for `{finding['activityId']}`: {finding['message']}"
            for finding in report["findings"]
        )
    return "\n".join(lines) + "\n"

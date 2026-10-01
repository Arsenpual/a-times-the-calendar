import json
from pathlib import Path


def write_priority_reports(report: dict, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "priority-confidence-report.json"
    markdown_path = output_dir / "priority-confidence-report.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_path.write_text(to_markdown(report), encoding="utf-8")
    return json_path, markdown_path


def to_markdown(report: dict) -> str:
    summary = report["summary"]
    lines = [
        "# Priority Confidence Report",
        "",
        "This report measures data readiness only. It does not infer urgency, importance, or an Eisenhower quadrant.",
        "",
        "## Summary",
        "",
        f"- Activities assessed: {summary['totalActivities']}",
        f"- High confidence: {summary['highConfidence']}",
        f"- Moderate confidence: {summary['moderateConfidence']}",
        f"- Low confidence: {summary['lowConfidence']}",
        f"- Ready for human priority review: {summary['readyForHumanReview']}",
        "",
        "## Activity Readiness",
        "",
    ]
    for item in report["assessments"]:
        title = item["title"] or "(untitled)"
        signals = ", ".join(item["evidenceSignals"]) or "none"
        missing = ", ".join(item["missingSignals"]) or "none"
        lines.append(f"- `{item['activityId']}` {title}: {item['confidence']} confidence; evidence: {signals}; missing: {missing}")
    return "\n".join(lines) + "\n"

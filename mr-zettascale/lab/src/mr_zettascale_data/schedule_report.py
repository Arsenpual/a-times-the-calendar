import json
from pathlib import Path


def write_schedule_reports(report: dict, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "scheduling-evaluation-report.json"
    markdown_path = output_dir / "scheduling-evaluation-report.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_path.write_text(to_markdown(report), encoding="utf-8")
    return json_path, markdown_path


def to_markdown(report: dict) -> str:
    summary = report["summary"]
    lines = [
        "# Scheduling Evaluation Report",
        "",
        "## Summary",
        "",
        f"- Cases evaluated: {summary['totalCases']}",
        f"- Passed: {summary['passedCases']}",
        f"- Failed: {summary['failedCases']}",
        "",
        "## Cases",
        "",
    ]
    for case in report["cases"]:
        status = "passed" if case["passed"] else "failed"
        lines.append(f"- `{case['id']}`: {status}")
        lines.extend(f"  - {'pass' if check['passed'] else 'fail'}: `{check['name']}`" for check in case["checks"])
    return "\n".join(lines) + "\n"

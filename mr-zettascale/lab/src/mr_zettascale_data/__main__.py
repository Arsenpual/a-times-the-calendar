import argparse
from pathlib import Path

from .loader import load_activities
from .quality import analyze_activities
from .report import write_reports
from .schedule_report import write_schedule_reports
from .scheduling import evaluate_scheduling_cases, load_scheduling_cases
from .priority import assess_priority_confidence
from .priority_report import write_priority_reports
from .weekly import analyze_weekly_patterns
from .weekly_report import write_weekly_reports


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an MR.Zettascale offline evaluation report.")
    parser.add_argument("--input", required=True, type=Path, help="Activity JSON input file.")
    parser.add_argument("--output", required=True, type=Path, help="Directory for local report files.")
    parser.add_argument("--schedule-evaluation", action="store_true", help="Evaluate synthetic scheduling proposals instead of activity data quality.")
    parser.add_argument("--priority-confidence", action="store_true", help="Measure activity data readiness for human priority review.")
    parser.add_argument("--weekly-insight", action="store_true", help="Summarize weekly time patterns from activity data.")
    args = parser.parse_args()

    selected_modes = sum([args.schedule_evaluation, args.priority_confidence, args.weekly_insight])
    if selected_modes > 1:
        parser.error("Choose only one evaluation mode.")
    if args.schedule_evaluation:
        report = evaluate_scheduling_cases(load_scheduling_cases(args.input))
        json_path, markdown_path = write_schedule_reports(report, args.output)
    elif args.priority_confidence:
        report = assess_priority_confidence(load_activities(args.input))
        json_path, markdown_path = write_priority_reports(report, args.output)
    elif args.weekly_insight:
        report = analyze_weekly_patterns(load_activities(args.input))
        json_path, markdown_path = write_weekly_reports(report, args.output)
    else:
        report = analyze_activities(load_activities(args.input))
        json_path, markdown_path = write_reports(report, args.output)
    print(f"Wrote {json_path}")
    print(f"Wrote {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import argparse
from pathlib import Path

from .loader import load_activities
from .quality import analyze_activities
from .report import write_reports
from .schedule_report import write_schedule_reports
from .scheduling import evaluate_scheduling_cases, load_scheduling_cases


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an MR.Zettascale offline evaluation report.")
    parser.add_argument("--input", required=True, type=Path, help="Activity JSON input file.")
    parser.add_argument("--output", required=True, type=Path, help="Directory for local report files.")
    parser.add_argument("--schedule-evaluation", action="store_true", help="Evaluate synthetic scheduling proposals instead of activity data quality.")
    args = parser.parse_args()

    if args.schedule_evaluation:
        report = evaluate_scheduling_cases(load_scheduling_cases(args.input))
        json_path, markdown_path = write_schedule_reports(report, args.output)
    else:
        report = analyze_activities(load_activities(args.input))
        json_path, markdown_path = write_reports(report, args.output)
    print(f"Wrote {json_path}")
    print(f"Wrote {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

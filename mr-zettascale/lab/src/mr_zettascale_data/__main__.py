import argparse
from pathlib import Path

from .loader import load_activities
from .quality import analyze_activities
from .report import write_reports


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an MR.Zettascale activity-data quality report.")
    parser.add_argument("--input", required=True, type=Path, help="Activity JSON input file.")
    parser.add_argument("--output", required=True, type=Path, help="Directory for local report files.")
    args = parser.parse_args()

    report = analyze_activities(load_activities(args.input))
    json_path, markdown_path = write_reports(report, args.output)
    print(f"Wrote {json_path}")
    print(f"Wrote {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

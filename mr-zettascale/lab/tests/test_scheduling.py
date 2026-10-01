import unittest
from pathlib import Path

from src.mr_zettascale_data.scheduling import evaluate_scheduling_cases, load_scheduling_cases


FIXTURE = Path(__file__).parents[1] / "data" / "scheduling-evaluation.json"


class SchedulingEvaluationTests(unittest.TestCase):
    def test_synthetic_phase_four_cases_pass(self):
        report = evaluate_scheduling_cases(load_scheduling_cases(FIXTURE))
        self.assertEqual(report["summary"], {"totalCases": 5, "passedCases": 5, "failedCases": 0})

    def test_evaluator_detects_a_fourth_overlap(self):
        report = evaluate_scheduling_cases([{
            "id": "too-many-overlaps",
            "windowStart": "2026-10-01T00:00",
            "windowEnd": "2026-10-02T00:00",
            "existingActivities": [
                {"start": "2026-10-01T10:00", "end": "2026-10-01T11:00"},
                {"start": "2026-10-01T10:00", "end": "2026-10-01T11:00"},
                {"start": "2026-10-01T10:00", "end": "2026-10-01T11:00"},
            ],
            "proposedActivities": [{"start": "2026-10-01T10:00", "end": "2026-10-01T11:00", "editable": True}],
            "expect": {"maxOverlaps": 3}
        }])
        self.assertEqual(report["summary"]["failedCases"], 1)
        self.assertFalse(report["cases"][0]["checks"][0]["passed"])

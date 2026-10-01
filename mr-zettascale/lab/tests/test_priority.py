import unittest
from pathlib import Path

from src.mr_zettascale_data.loader import load_activities, normalize_activity
from src.mr_zettascale_data.priority import assess_priority_confidence


LAB_ROOT = Path(__file__).parents[1]


class PriorityConfidenceTests(unittest.TestCase):
    def test_synthetic_fixture_has_explainable_readiness_levels(self):
        report = assess_priority_confidence(load_activities(LAB_ROOT / "data" / "priority-confidence.json"))
        self.assertEqual(report["summary"], {
            "totalActivities": 6,
            "highConfidence": 2,
            "moderateConfidence": 2,
            "lowConfidence": 2,
            "readyForHumanReview": 2,
        })

    def test_ambiguous_title_never_reaches_high_confidence(self):
        activity = normalize_activity({
            "id": "code", "summary": "PRJ-X", "category": "งาน", "tags": ["project"], "notes": "ต้องตรวจ"
        }, 1)
        assessment = assess_priority_confidence([activity])["assessments"][0]
        self.assertEqual(assessment["confidence"], "low")
        self.assertIn("clear_title", assessment["missingSignals"])

    def test_confidence_does_not_assign_a_priority_or_quadrant(self):
        activity = normalize_activity({"id": "clear", "summary": "เตรียมรายงาน", "category": "งาน", "tags": ["deadline"]}, 1)
        assessment = assess_priority_confidence([activity])["assessments"][0]
        self.assertNotIn("priority", assessment)
        self.assertNotIn("quadrant", assessment)


if __name__ == "__main__":
    unittest.main()

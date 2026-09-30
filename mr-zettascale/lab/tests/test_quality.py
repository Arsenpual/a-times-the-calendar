import sys
import unittest
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB_ROOT))

from src.mr_zettascale_data.loader import normalize_activity
from src.mr_zettascale_data.quality import analyze_activities


class ActivityQualityTests(unittest.TestCase):
    def analyze(self, *items):
        activities = [normalize_activity(item, index) for index, item in enumerate(items, start=1)]
        return analyze_activities(activities)

    def codes(self, report):
        return [finding["code"] for finding in report["findings"]]

    def test_overnight_activity_is_valid(self):
        report = self.analyze({
            "id": "overnight", "summary": "เดินทาง", "start": "2026-10-01T23:30",
            "end": "2026-10-02T01:00", "category": "ส่วนตัว", "tags": ["travel"]
        })
        self.assertEqual(report["summary"]["validActivities"], 1)
        self.assertNotIn("end_before_start", self.codes(report))

    def test_all_day_activity_is_valid(self):
        report = self.analyze({
            "id": "all-day", "summary": "วันหยุด", "start": {"date": "2026-10-01"},
            "end": {"date": "2026-10-02"}, "allDay": True, "category": "ส่วนตัว", "tags": ["holiday"]
        })
        self.assertEqual(report["summary"]["validActivities"], 1)

    def test_malformed_activity_does_not_stop_analysis(self):
        report = self.analyze(
            {"id": "broken", "summary": "ข้อมูลเสีย", "start": "broken", "end": "2026-10-01T10:00"},
            {"id": "valid", "summary": "ประชุม", "start": "2026-10-01T10:00", "end": "2026-10-01T11:00", "category": "งาน", "tags": ["meeting"]},
        )
        self.assertEqual(report["summary"]["totalActivities"], 2)
        self.assertEqual(report["summary"]["validActivities"], 1)
        self.assertIn("invalid_start", self.codes(report))

    def test_reversed_time_is_an_error(self):
        report = self.analyze({
            "id": "reversed", "summary": "เวลาสลับ", "start": "2026-10-01T11:00",
            "end": "2026-10-01T10:00", "category": "งาน", "tags": ["test"]
        })
        self.assertIn("end_before_start", self.codes(report))

    def test_priority_context_requires_more_than_a_title(self):
        report = self.analyze({
            "id": "context", "summary": "อ่านหนังสือ", "start": "2026-10-01T10:00", "end": "2026-10-01T11:00"
        })
        self.assertIn("insufficient_priority_context", self.codes(report))

    def test_code_like_title_is_ambiguous(self):
        report = self.analyze({
            "id": "code", "summary": "PRJ-X", "start": "2026-10-01T10:00", "end": "2026-10-01T11:00",
            "category": "งาน", "tags": ["project"]
        })
        self.assertIn("ambiguous_title", self.codes(report))

    def test_same_input_produces_the_same_report(self):
        item = {"id": "stable", "summary": "ประชุม", "start": "2026-10-01T10:00", "end": "2026-10-01T11:00", "category": "งาน", "tags": ["meeting"]}
        self.assertEqual(self.analyze(item), self.analyze(item))


if __name__ == "__main__":
    unittest.main()

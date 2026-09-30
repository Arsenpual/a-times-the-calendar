import sys
import unittest
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB_ROOT))

from src.mr_zettascale_data.loader import load_activities, normalize_activity
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

    def test_google_calendar_datetime_object_is_valid(self):
        report = self.analyze({
            "id": "calendar-object", "summary": "คุยกับทีม",
            "start": {"dateTime": "2026-10-01T10:00"},
            "end": {"dateTime": "2026-10-01T10:30"},
            "category": "งาน", "tags": ["meeting"]
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

    def test_invalid_end_is_an_error(self):
        report = self.analyze({
            "id": "bad-end", "summary": "เวลาจบเสีย", "start": "2026-10-01T10:00",
            "end": "not-a-date", "category": "งาน", "tags": ["test"]
        })
        self.assertIn("invalid_end", self.codes(report))

    def test_notes_can_supply_priority_context(self):
        report = self.analyze({
            "id": "notes", "summary": "เตรียมพรีเซนต์", "start": "2026-10-01T10:00",
            "end": "2026-10-01T11:00", "notes": "ต้องส่งพรุ่งนี้"
        })
        self.assertNotIn("insufficient_priority_context", self.codes(report))

    def test_long_timed_activity_is_a_warning(self):
        report = self.analyze({
            "id": "long", "summary": "งานยาว", "start": "2026-10-01T07:00",
            "end": "2026-10-01T20:00", "category": "งาน", "tags": ["project"]
        })
        self.assertIn("unusually_long_duration", self.codes(report))

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

    def test_sample_fixture_covers_every_initial_finding_code(self):
        activities = load_activities(LAB_ROOT / "data" / "sample-activities.json")
        report = analyze_activities(activities)
        self.assertEqual(report["summary"]["totalActivities"], 24)
        self.assertTrue({
            "missing_title", "invalid_start", "invalid_end", "end_before_start",
            "missing_category", "missing_tags", "ambiguous_title",
            "unusually_long_duration", "insufficient_priority_context",
        }.issubset(set(self.codes(report))))


if __name__ == "__main__":
    unittest.main()

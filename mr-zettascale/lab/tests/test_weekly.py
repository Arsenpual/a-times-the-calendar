import unittest
from pathlib import Path

from src.mr_zettascale_data.loader import load_activities, normalize_activity
from src.mr_zettascale_data.weekly import analyze_weekly_patterns


LAB_ROOT = Path(__file__).parents[1]


class WeeklyPatternTests(unittest.TestCase):
    def test_synthetic_week_splits_overnight_time_and_excludes_invalid_data(self):
        report = analyze_weekly_patterns(load_activities(LAB_ROOT / "data" / "weekly-patterns.json"))
        self.assertEqual(report["summary"], {
            "totalActivities": 10, "timedActivities": 8, "allDayActivities": 1, "invalidActivities": 1,
            "totalScheduledMinutes": 660, "daysWithOverlap": 1, "maximumConcurrentActivities": 2,
        })
        self.assertEqual(report["timePatterns"]["minutesByDate"]["2026-10-06"], 90)
        self.assertEqual(report["timePatterns"]["minutesByDate"]["2026-10-07"], 300)
        self.assertEqual(report["timePatterns"]["minutesByCategory"]["Uncategorized"], 60)
        self.assertEqual(report["dataQuality"]["invalidActivityIds"], ["invalid-sunday"])

    def test_timezone_offset_datetimes_are_aggregated_as_local_time(self):
        activity = normalize_activity({
            "id": "offset", "summary": "ประชุม", "start": "2026-10-05T09:00:00+07:00",
            "end": "2026-10-05T10:00:00+07:00", "category": "งาน", "tags": ["meeting"]
        }, 1)
        report = analyze_weekly_patterns([activity])
        self.assertEqual(report["timePatterns"]["minutesByStartPeriod"], {"morning": 60})


if __name__ == "__main__":
    unittest.main()

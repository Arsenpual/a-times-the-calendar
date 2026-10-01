# MR.Zettascale Data Lab

This is an offline, read-only Python workspace for activity-data analysis.
It does not connect to Firestore, Google Calendar, or the live Node.js API.

## Run the sample report

From this directory:

```powershell
python -m src.mr_zettascale_data --input data/sample-activities.json --output reports
```

The command creates these local reports:

- `reports/activity-quality-report.json`
- `reports/activity-quality-report.md`

## Run tests

```powershell
python -m unittest discover -s tests -v
```

## Run the scheduling evaluation

```powershell
python -m src.mr_zettascale_data --schedule-evaluation --input data/scheduling-evaluation.json --output reports
```

This synthetic evaluation checks Phase 4 proposals for future-time handling,
window bounds, the three-overlap limit, protected 90/15 focus blocks, visible
unscheduled tasks, and reviewable drafts. It evaluates data only; it does not
run a live scheduler or modify Calendar data.

## Run the priority-confidence experiment

```powershell
python -m src.mr_zettascale_data --priority-confidence --input data/priority-confidence.json --output reports
```

The result explains whether an activity has enough clear title, category,
tags, and notes context for a human to review its priority. It never labels an
activity urgent, important, or assigns an Eisenhower Matrix quadrant.

## Run the weekly time-pattern insight

```powershell
python -m src.mr_zettascale_data --weekly-insight --input data/weekly-patterns.json --output reports
```

This descriptive report totals scheduled time by category, date, and broad
local start period. Timed overnight activities are split across dates, all-day
activities are counted separately, and malformed time data is excluded with a
visible quality note. It does not make recommendations or alter Calendar data.

## Accepted input

The input can be a JSON array or an object with an `activities` array. Each
item may use either the Calendar shape (`summary`, `start`, `end`) or the
assistant draft shape (`title`, `startLocal`, `endLocal`, `categoryName`).

Synthetic fixtures may be committed. Real exports and generated reports are
ignored by Git because they can contain personal schedule data.

## Export a bounded production sample

Stage 5A adds an authenticated Node.js endpoint for deliberately exporting a
small local analysis sample. It reads only Primary Google Calendar event
timing/title plus the matching T.i.M.E.S. category, tags, and lock state.
OAuth tokens, descriptions, attendees, and unrelated Calendar fields are not
included.

`GET /api/data-lab/activity-export?windowStart=YYYY-MM-DD&windowEnd=YYYY-MM-DD`

`windowEnd` is exclusive and the window may be at most 31 days. The endpoint
returns a downloadable JSON envelope compatible with this tool. Keep the
download local under `data/`; it is intentionally ignored by Git.

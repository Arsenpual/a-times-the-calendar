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

## Accepted input

The input can be a JSON array or an object with an `activities` array. Each
item may use either the Calendar shape (`summary`, `start`, `end`) or the
assistant draft shape (`title`, `startLocal`, `endLocal`, `categoryName`).

Synthetic fixtures may be committed. Real exports and generated reports are
ignored by Git because they can contain personal schedule data.

# Python Data Lab Plan

## Purpose

Introduce Python to T.i.M.E.S. for the first time as MR.Zettascale's offline data lab.

The first version reads and analyzes activity data only. It must not write to Google Calendar, Firestore, or any user data source. Node.js remains the production backend and JavaScript remains the frontend stack.

The aim is to help MR.Zettascale understand the quality and shape of the information it will later use for scheduling, priority reasoning, and personal insights.

## System Boundary

```text
Frontend (React / JavaScript)
  -> Node.js backend (API, authentication, business rules, Calendar writes)
    -> Python Data Lab (offline analysis, reports, evaluation)
```

Python starts outside the user request path. It runs manually against local, sanitized JSON data and produces reports. This keeps the first integration small, inspectable, and reversible.

## First Deliverable: Activity Data Quality Report

Create a command-line tool that reads a JSON activity collection and produces:

- A machine-readable JSON report for later use by Node.js or other tooling.
- A Markdown report for development review.

The report should answer:

- How many activities can be analyzed safely?
- Which activities have invalid or incomplete time data?
- How many activities lack a category or tags?
- Which titles are too short or ambiguous for reliable priority inference?
- How much data is currently sufficient for future Eisenhower-style reasoning?
- What basic time patterns are visible by day and category?

## Data Contract

The current application already has two relevant shapes:

- Calendar activity data: `id`, `summary`, `start`, `end`, and `startDate`.
- Assistant activity draft data: `title`, `startLocal`, `endLocal`, `allDay`, `categoryName`, `tags`, and `notes`.

Python should normalize either source into one analysis record:

```json
{
  "id": "activity-001",
  "title": "ประชุมทีม",
  "start": "2026-10-01T10:00",
  "end": "2026-10-01T11:00",
  "allDay": false,
  "category": "งาน",
  "tags": ["meeting"],
  "notes": "",
  "source": "calendar"
}
```

This normalized record is the shared foundation for later reporting, assistant evaluation, priority experiments, and weekly insights.

## Recommended Structure

```text
mr-zettascale/
  lab/
    README.md
    pyproject.toml
    data/
      sample-activities.json
    src/
      mr_zettascale_data/
        models.py
        loader.py
        quality.py
        report.py
    tests/
      fixtures/
      test_quality.py
    reports/
      activity-quality-report.json
      activity-quality-report.md
```

Use synthetic data for committed examples and tests. Local exports containing real user activity data must stay out of Git.

## Delivery Stages

### Stage 1: Synthetic Dataset

Create 20-30 sample activities that cover ordinary and difficult cases:

- Complete activity data.
- Missing category or tags.
- Short or ambiguous titles such as `PRJ-X`.
- Invalid date/time values.
- End time earlier than start time.
- All-day activities.
- Activities that continue across midnight.
- Overlapping activities.

No production Calendar or Firestore data is used in this stage.

### Stage 2: Deterministic Quality Rules

Implement stable, explainable rules before using an AI model. Each finding includes a severity (`error`, `warning`, or `info`), a machine-readable code, the relevant activity id, and a short explanation.

Initial finding codes:

- `missing_title`
- `invalid_start`
- `invalid_end`
- `end_before_start`
- `missing_category`
- `missing_tags`
- `ambiguous_title`
- `unusually_long_duration`
- `insufficient_priority_context`

The priority-context rule must never claim an activity is unimportant. It only identifies when available evidence is too weak for a confident priority inference.

### Stage 3: Reports

Generate both JSON and Markdown reports. A Markdown summary might look like this:

```text
Activities analyzed: 24
Invalid activities: 2
Missing category: 8
Missing tags: 11
Ambiguous titles: 4
Sufficient context for future priority analysis: 9
```

The JSON report should preserve totals, findings, and aggregate metrics so future tooling can consume it without parsing Markdown.

### Stage 4: Tests

Add automated tests for the rules that affect analysis correctness:

- Valid and invalid date/time parsing.
- Overnight activities are valid when their end is on the next date.
- All-day activities follow their own date rules.
- A malformed activity produces a finding without stopping the whole report.
- The same fixture produces the same report on every run.

### Stage 5: Controlled Node.js Handoff

Only after the lab is trusted, add a small Node.js export path that creates sanitized JSON for analysis. Python still runs as a manual command or scheduled internal job, not as an HTTP service.

Potential later flow:

```text
Node.js exports a narrow, sanitized activity set
  -> Python analyzes it offline
  -> Python writes a report
  -> a developer reviews the report
```

## What Is Deliberately Out of Scope

The first Python integration must not:

- Connect to Firestore directly.
- Accept browser requests.
- Run in the Activity creation request path.
- Create, edit, or delete Calendar data.
- Call an AI API.
- Assign Eisenhower Matrix quadrants automatically for a user.
- Store personal preferences or conclusions without explicit user approval.

## Technology Choice

Start with the Python standard library: `json`, `datetime`, `pathlib`, `dataclasses`, `argparse`, and `unittest`.

This avoids dependencies while the data contract and rules are still changing. Add `pandas` only when the dataset becomes large enough to benefit from tabular aggregation and statistical analysis.

## Definition of Done

The first Python data milestone is complete when:

1. One command reads a JSON fixture and creates JSON and Markdown reports.
2. A malformed item does not terminate the full analysis.
3. Quality rules are covered by automated tests.
4. Synthetic sample data is safe to commit.
5. Real local exports, generated reports, and credentials are ignored by Git.
6. Node.js and frontend behavior remain unchanged.

## Next Step After Completion

Use the quality report to decide which assistant capability has enough evidence to prototype next. The likely first candidates are an evaluation dataset for activity drafts, an offline priority-confidence experiment, or a weekly time-pattern insight.

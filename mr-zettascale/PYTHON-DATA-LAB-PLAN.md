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

When Node.js later exports real data for a local analysis run, it must wrap
records in an explicit, privacy-bounded envelope:

```json
{
  "exportVersion": 1,
  "generatedAt": "2026-10-01T12:00:00Z",
  "timeZone": "Asia/Bangkok",
  "windowStart": "2026-10-01T00:00",
  "windowEnd": "2026-10-08T00:00",
  "activities": []
}
```

Node.js is responsible for joining only the metadata needed for analysis:
Calendar event timing/title plus the matching category, tags, and lock state.
The export must remain local, omit OAuth tokens and unrelated Calendar fields,
and cover only an explicit bounded date window.

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

Create a committed initial fixture of at least 10 sample activities that
covers ordinary and difficult cases. Expand it toward 20-30 cases before
adding more complex priority or scheduling analysis:

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

### Stages 1-4 Implementation Status: Complete

The first delivery is implemented in `mr-zettascale/lab`.

- The committed fixture contains 24 synthetic activities covering complete,
  incomplete, all-day, overnight, ambiguous, invalid, reversed-time, long,
  and uncategorized cases.
- The quality engine implements every initial finding code. The next fixture
  expansion should add an explicit `invalid_end` case alongside the existing
  invalid-start case.
- The command-line tool writes local JSON and Markdown reports.
- Twelve automated tests cover all-day and overnight records, malformed input
  isolation, reversed times, ambiguous titles, priority context, and stable
  report output.

### Stage 5A: Sanitized Node.js Export

Add a small, authenticated Node.js export path that creates the bounded
analysis envelope above. It must join Calendar timing/title with the user's
category, tags, and lock metadata without giving Python direct Firestore or
Google Calendar access.

The export is a deliberate developer or user action at first. Python still
runs as a manual command or scheduled internal job, not as an HTTP service.

Potential later flow:

```text
Node.js exports a narrow, sanitized activity set
  -> Python analyzes it offline
  -> Python writes a report
  -> a developer reviews the report
```

### Stage 5B: Scheduling Evaluation

Use synthetic fixtures first to evaluate the completed Phase 4 scheduling
behaviour. Record whether a proposed plan:

- starts in the future when planning for today;
- stays within its intended date window;
- respects the maximum-three-overlaps rule;
- preserves a 15-minute break between 90-minute focus blocks;
- reports tasks that could not be scheduled instead of silently dropping them;
- keeps every proposed Activity editable and reviewable before a write.

This is evaluation tooling only. It does not alter the JavaScript scheduler or
make a live scheduling decision.

### Stage 5A Implementation Status: Complete

The authenticated `GET /api/data-lab/activity-export` route creates a download
for an explicit 1-31 day window. It reads only Primary Calendar event id,
title, start/end, and all-day state, then joins category names, tags, and lock
state from the requesting user's Firestore collections. The envelope has the
documented version, generation time, `Asia/Bangkok` time zone, explicit
exclusive window bounds, and a `truncated` flag when Google Calendar has more
than 500 matching events. Tokens, descriptions, attendees, and unrelated
Calendar fields never leave Node.js.

Automated route tests cover bounded-window validation, recurring-id metadata
joins, all-day records, cancelled/transparent event exclusion, and the absence
of credential fields from the response.

### Stage 5B Implementation Status: Complete

The Data Lab now has a committed synthetic scheduling-evaluation dataset and
an offline Python evaluator. It writes JSON and Markdown reports for future
time suggestions, bounded planning windows, the three-overlap rule, protected
90-minute focus blocks with 15-minute breaks, visibly unscheduled tasks, and
editable proposals. It does not execute the production scheduler or write to
Calendar; backend integration tests remain the source of truth for the live
JavaScript behavior.

### Priority Confidence Experiment: Complete

An offline, synthetic priority-confidence experiment now measures only data
readiness for a future human priority review. Its transparent signals are a
clear non-ambiguous title, category, tags, and notes. It reports high,
moderate, or low confidence plus missing signals, and deliberately never
assigns urgency, importance, or an Eisenhower quadrant.

### Weekly Time-Pattern Insight: Complete

An offline weekly report now aggregates scheduled minutes by category, date,
and broad local start period. Overnight timed activities are split at midnight,
all-day activities are reported separately, and malformed records are excluded
with visible data-quality counts. Overlap is reported only as descriptive
calendar density. The report makes no recommendation and does not modify
Calendar data.

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

## Next Step

The first Python Data Lab milestone is now complete. The application now offers
an explicit, authenticated Data Lab download in Settings for a user-selected
window up to 31 days. It keeps the exported file local for manual review with
the offline reports. A separate human-approved insight surface in T.i.M.E.S.
remains a future product decision.

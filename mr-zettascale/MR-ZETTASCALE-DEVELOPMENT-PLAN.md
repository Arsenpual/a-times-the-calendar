# MR.Zettascale — Development Plan

## Product goal

MR.Zettascale is the web-only planning assistant inside Activity Mode of
T.i.M.E.S. Its first responsibility is to turn a short natural-language
request into a safe, reviewable Activity draft.

The assistant must never silently create, change, or delete Calendar data.
The person always reviews the draft, may edit its fields manually in chat,
and explicitly presses **Confirm** before an Activity is created.

## System roles

MR.Zettascale uses each part of T.i.M.E.S. for a distinct responsibility:

- React and JavaScript provide the user experience and Activity Mode
  interactions.
- Node.js is the production backend for APIs, authentication, business rules,
  assistant request handling, and Calendar writes.
- Python is an offline Data Lab for sanitized activity-data analysis, reports,
  evaluation datasets, and future planning experiments.

Python is not part of the first Activity creation request path. It must not
write directly to Google Calendar or Firestore. This keeps the live assistant
safe while giving its future reasoning a measurable data foundation.

## Primary experience

The user should reach a usable Activity draft in one to three messages.

Example:

> "พรุ่งนี้หลังเลิกงานไปออกกำลังกาย"

MR.Zettascale proposes a title, date, start/end time, and optional category.
It clearly lists every value it assumed. The user can use **Edit detail** in
the chat to change any value, then presses **Confirm สร้างกิจกรรม**.

## Rules for the Activity Creation Skill

- The activity title or intent is the only essential item that must not be
  guessed when it is genuinely unclear.
- Missing date defaults to today; explicit tomorrow/next-day language uses
  tomorrow.
- Missing time is inferred from the activity title and common context.
  Homework after school defaults to 19:00–21:00. A generic activity defaults
  to 19:00–20:00.
- Category, tags, recurrence, and all-day status are optional. Do not delay a
  draft to ask about them.
- Ask at most two concise follow-up questions. Finish a safe draft by the
  third user message.
- Every AI-generated value must be editable by the user before confirmation.

## Phase 1 — Stable Activity Creation

Goal: make the current Activity Mode assistant reliable before giving it more
responsibilities.

- Move Activity-specific prompt, output schema, assumptions, examples, and
  validation into a dedicated `activity-creation` skill module in the backend.
- Keep a strict structured draft: title, start/end local datetime, all-day,
  category, tags, recurrence, notes, and assumptions.
- Validate date/time and duration server-side before returning a draft.
- Provide a compact web chat that stays beside the seven-day Activity plan,
  manual **Edit detail**, and a single confirmation action that creates the
  Activity. The chat must not hide the Week Spine; when an Activity Popup is
  open, both surfaces remain visible together.
- Add automated cases for Thai and English requests, vague requests, date
  words, all-day activities, and malformed AI output.

Success criteria:

- A normal request produces a valid draft in one to three messages.
- No AI call writes Calendar data by itself.
- Invalid output cannot reach the Calendar save handler.

## Phase 2 — Context Awareness

Goal: make suggestions fit the user's real schedule.

Supply only necessary context to the model for the relevant date range:

- current local date, time, and timezone;
- activities around the proposed time;
- locked activities;
- user categories and tags;
- available schedule windows.

Add deterministic application logic around the model:

- detect activity overlap using Activity Mode rules;
- allow at most three overlapping activities;
- propose nearby alternatives when the limit would be exceeded;
- explain conflicts and assumptions clearly;
- avoid sending an entire calendar to the model unnecessarily.

## Phase 3 — Personal Preferences

Goal: make default suggestions feel personal without turning chat history into
uncontrolled memory.

Store only deliberate, inspectable preferences, for example:

```json
{
  "homeworkDefaultStart": "19:00",
  "homeworkDefaultDurationMinutes": 120,
  "exerciseDefaultDurationMinutes": 60,
  "preferredEveningStart": "18:30"
}
```

- Learn candidates from repeated user corrections, not automatically from all
  conversation text.
- Let the user view, edit, enable, or delete every stored preference.
- Use preferences as defaults only; never treat them as mandatory rules.

### Phase 3 implementation status — complete

The first delivery stores only the four explicit preferences above in
`users/{uid}/private/assistantPreferences`. They are editable in Settings and
are applied deterministically only where the person did not specify a time or
duration. Candidate learning now observes only a timing/duration correction to
an MR.Zettascale activity proposal after that proposal is saved. The same
correction must occur twice before Settings offers it for approval; it never
silently turns chat text into memory.

## Phase 2 completion — 30 September 2026

Phase 2 is complete.

- The browser sends no full Calendar. It supplies only a nine-day local
  planning window, current local clock, nearby activity start/end/title,
  lock state, categories, and existing tags.
- The backend derives bounded daytime free-window hints and rejects malformed
  or over-broad context. Suggestions for the current day do not point to time
  that has already passed.
- The backend and frontend both apply the same maximum-three-overlaps rule.
  A fourth overlap receives a clear conflict message (including locked items)
  and up to three selectable nearby time alternatives.
- Automated tests cover daytime windows, all-day collisions, locked conflict
  context, the three-overlap limit, alternatives, and past-time exclusion.

## Phase 3 completion — 30 September 2026

Phase 3 is complete.

- Preference storage remains a small inspectable document, never a chat
  transcript. All four supported fields can be viewed, edited, enabled,
  disabled, and deleted in Settings.
- The only learning input is a timing/duration change to an MR.Zettascale
  proposal after an explicit Activity save. A request cannot count the same
  preference twice, so one save never creates a false learning candidate.
- Candidates require the same correction across two separate saves and still
  need explicit approval before they become a default. Explicit user input
  always overrides an enabled preference.

## Phase 3.5 — Data Foundation

Goal: introduce Python safely as MR.Zettascale's offline data-analysis lab
before using it for live scheduling or priority features.

- Define one normalized activity-analysis record that can represent Calendar
  activities and assistant-generated drafts.
- Start with a synthetic activity dataset; do not use real Calendar or
  Firestore data in committed examples or tests.
- Create an Activity Data Quality Report that detects incomplete, malformed,
  ambiguous, and insufficient-context activity data.
- Produce both a machine-readable JSON report and a Markdown development
  report.
- Add deterministic tests for invalid times, overnight activities, all-day
  activities, incomplete records, and stable report output.
- Keep the first Python tool offline and read-only. A controlled Node.js JSON
  export may be added only after the analysis rules are trusted.

Success criteria:

- One command can analyze a synthetic JSON fixture and produce both reports.
- A malformed activity creates a finding without terminating the full run.
- No Python process changes Calendar, Firestore, preferences, or Activity
  drafts.
- Node.js and frontend behavior remain unchanged.

Detailed implementation plan: `PYTHON-DATA-LAB-PLAN.md`.

### Phase 3.5 implementation status — complete

The first Python Data Lab delivery lives in `mr-zettascale/lab`. It uses only
the Python standard library and runs offline against a synthetic activity
fixture. The command-line tool normalizes Calendar-shaped activity data and
assistant-draft-shaped data, applies deterministic quality rules, and writes
local JSON and Markdown reports.

- The initial checks cover missing titles, invalid start/end values, reversed
  times, missing categories or tags, code-like titles, unusually long timed
  activities, and insufficient priority context.
- Tests cover all-day records, overnight records, malformed input isolation,
  reversed times, ambiguous titles, priority-context detection, and stable
  output for the same input.
- Local exports and generated reports are ignored by Git. Python has no
  Firestore, Google Calendar, HTTP, or AI-model integration.

## Phase 4 — Scheduling Skill

Goal: plan more than one Activity without losing user control.

### Phase 4A — Find a Time

Start with one task and one explicit duration. Offer two or three suitable
time options, let the person choose one, then create only one reviewable
Activity draft. Recheck Calendar overlap rules immediately before confirmation.

### Phase 4A implementation status — complete

The Activity assistant now recognizes explicit find-time requests such as
"ช่วยหาเวลาว่างออกกำลังกายหนึ่งชั่วโมงพรุ่งนี้" without calling an AI
model. It uses the existing nine-day schedule context and bounded daytime
free-window rules to return up to three 30-minute-aligned options. Every
option contains only a reviewable Activity draft; selecting it rechecks the
frontend overlap guard and opens ActivityPopup. Calendar writes still happen
only when the person explicitly saves that popup.

The first delivery supports an explicit duration in Arabic digits or common
Thai hour wording, plus today, tomorrow, or an ISO date. It does not yet plan
multiple tasks, reserve breaks, or infer hidden priorities.

### Phase 4B — Plan a List

Accept a small list of tasks and return a single reviewable plan containing
multiple Activity drafts. The person can edit or remove each draft before one
explicit confirmation step. If only part of a confirmed plan can be created,
report exactly which Activities succeeded and which failed.

### Phase 4B implementation status — complete

The first delivery accepts a clear comma-, semicolon-, or newline-separated
list of two to five tasks, each with an explicit duration. It schedules drafts
sequentially into the same bounded free-window context and keeps tasks that do
not fit visibly unscheduled rather than guessing a conflicting time.

The chat preview lets the person include or exclude each draft and edit its
title, start, or end before one explicit `สร้าง N กิจกรรม` confirmation. The
frontend validates the combined overlap set before it begins Calendar writes,
then creates activities sequentially. Its result reports every created title
and every failed title; a submitted preview cannot be confirmed again, so a
partial success cannot create duplicates on retry.

The first delivery deliberately handles only explicit list syntax and does not
yet split tasks, infer duration, add breaks, or optimize by personal energy.

### Phase 4C — Split and Protect Time

Split large tasks into drafts, add breaks, avoid overly dense schedules, and
use approved preferences only as defaults. Keep every proposed Activity
individually editable before confirmation.

### Phase 4C implementation status — complete

The initial focus policy is an explicit product default: 90 minutes of focus
followed by a 15-minute break. A request such as "ช่วยแบ่งงานทำรายงาน 3
ชั่วโมงพรุ่งนี้" produces reviewable focus and break drafts in the same plan
preview. Focus blocks after a break use 15-minute scheduling increments so a
new block begins immediately after its protected break when the Calendar is
free.

The policy applies only to explicit split-task requests with an explicit
duration. It does not infer a person's energy pattern or save an inferred
preference. Every focus or break draft remains selectable and editable before
the single batch confirmation.

- Find suitable free time.
- Offer two or three reasonable time options.
- Split a large task into Activity drafts.
- Add breaks and avoid overly dense schedules.
- Plan a day or a week from a list of tasks.
- Preview the complete set of proposed changes before any are created.

Use a stronger model only for genuinely complex planning, while keeping the
lower-cost model for normal one-Activity drafts.

## Phase 5 — Activity Management Skill

After creation is stable, add explicit, reviewable actions:

- edit title, time, category, tags, and notes;
- move or duplicate an Activity;
- create and adjust recurrence;
- archive and restore;
- delete one recurrence occurrence or an entire series.

Every write action must show a precise preview such as:

> "ย้าย ‘ประชุมทีม’ จาก 10:00 เป็น 13:00 ใช่ไหม?"

## Phase 6 — Evaluation and Feedback

Maintain a small test set of real user phrases, including:

- "ทำการบ้านหลังเลิกเรียน"
- "พรุ่งนี้ประชุมทีมสิบโมงชั่วโมงครึ่ง"
- "วันศุกร์ไปหาหมอตอนบ่าย"
- "หาเวลาว่างออกกำลังกายหนึ่งชั่วโมง"
- "เดือนหน้าทำความสะอาดทุกวันอาทิตย์"

Measure:

- completion within one to three messages;
- user corrections per draft;
- valid structured output rate;
- accidental conflict rate;
- AI calls and cost per created Activity.

Use the Python Data Lab to make these measurements repeatable. It should also
report activity-data quality, the proportion of drafts with insufficient
priority context, and the outcomes of scheduling or priority experiments.
No offline conclusion becomes a user preference or a live assistant rule
without explicit product review and user-control safeguards.

## Suggested code structure

```text
frontend/src/features/activity/assistant/
├── api/
│   └── activity-assistant-api.js
├── components/
│   └── activity-assistant-dialog.jsx
├── hooks/
│   └── use-assistant-chat-storage.js
├── config/
│   └── activity-assistant-conversation-tree.js
├── lib/
│   ├── activity-popup-handoff.js
│   └── daily-summary-chat.js
└── tests/
    └── activity-popup-handoff.test.js

backend/
├── skills/
│   └── activity-creation/
│       ├── prompt.js
│       ├── schema.js
│       ├── assumptions.js
│       ├── validator.js
│       └── examples.js
└── routes/
    └── activity-assistant.js

mr-zettascale/
└── lab/
    ├── data/
    ├── src/
    │   └── mr_zettascale_data/
    ├── tests/
    └── reports/
```

## Phase 1 completion — 16 September 2026

Phase 1 is complete.

- The backend Activity Creation skill is separated into prompt, schema,
  assumptions, validator, examples, time-period logic, and product knowledge.
- The compact assistant deliberately stays beside the seven-day plan rather
  than taking over the whole screen. ActivityPopup and the assistant can be
  visible together for review.
- A valid assistant response is handed to ActivityPopup only as a draft;
  Calendar writes remain behind the person's explicit Save confirmation.
- Unit coverage validates time/tag assumptions and malformed outputs. Route
  integration coverage uses a mocked Gemini/usage service to verify the
  endpoint's knowledge, valid-draft, malformed-output, and quota-release
  paths without calling Vertex AI or Firestore.

The next implementation work is Phase 3.5: establish the offline Python Data
Lab and Activity Data Quality Report before expanding MR.Zettascale into
multi-Activity scheduling.

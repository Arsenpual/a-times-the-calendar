# MR.Zettascale — Development Plan

## Product goal

MR.Zettascale is the web-only planning assistant inside Activity Mode of
T.i.M.E.S. Its first responsibility is to turn a short natural-language
request into a safe, reviewable Activity draft.

The assistant must never silently create, change, or delete Calendar data.
The person always reviews the draft, may edit its fields manually in chat,
and explicitly presses **Confirm** before an Activity is created.

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

### Phase 3 implementation status

The first delivery stores only the four explicit preferences above in
`users/{uid}/private/assistantPreferences`. They are editable in Settings and
are applied deterministically only where the person did not specify a time or
duration. Candidate learning now observes only a timing/duration correction to
an MR.Zettascale activity proposal after that proposal is saved. The same
correction must occur twice before Settings offers it for approval; it never
silently turns chat text into memory.

## Phase 4 — Scheduling Skill

Goal: plan more than one Activity without losing user control.

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

The next implementation work is Phase 2: supply narrow schedule context and
apply overlap/conflict rules before making a time suggestion.

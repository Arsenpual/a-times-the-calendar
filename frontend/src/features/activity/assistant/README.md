# MR.Zettascale Activity Assistant

This feature owns the compact assistant shown beside the seven-day Activity
plan. It can propose and explain an Activity, but never saves Calendar data.

- `api/` communicates with the authenticated assistant endpoints.
- `components/` renders the compact chat dialog.
- `hooks/use-activity-assistant-conversation.js` owns conversation state and
  async actions; the dialog owns presentation only.
- `lib/preference-corrections.js` extracts inspectable preference observations
  after a successful save, independently of the application shell.
- `config/` contains deterministic template-chat branches and knowledge
  follow-up questions.
- `lib/` contains pure, testable formatting and the safe hand-off to
  `ActivityPopup`.

The only path to a Calendar write is the normal Save action inside
`ActivityPopup` after the person reviews the hand-off.

## Phase 2 — schedule context

The browser sends a narrow nine-day planning window only: the current local
clock, activities inside that window, each activity's lock status, categories,
and existing tags. The backend builds daytime free-window hints and repeats the
three-overlap rule. If a fourth overlap would occur, the chat explains the
conflict and keeps up to three selectable nearby alternatives. Suggestions for
today never point to a time already passed.

## Phase 3 — explicit preferences

Preferences are not chat memory. The only retained values live in
`users/{uid}/private/assistantPreferences`: homework start/duration, exercise
duration, and preferred evening start. They can be viewed, edited, disabled,
or deleted in Settings. A timing/duration correction to an MR.Zettascale draft
is observed only after the person explicitly saves that activity. The same
field must be corrected in two separate saves before Settings offers it as an
approval candidate; the candidate is never enabled automatically.

## Phase 4A — find a time

An explicit request to find time for one activity with one duration is handled
deterministically before the Calendar-question or Gemini branches. The backend
uses only the browser's existing narrow nine-day schedule context and returns
up to three free daytime slots. Selecting a slot opens one ActivityPopup draft;
it does not write to Calendar or create multiple Activities.

The browser repeats the overlap guard immediately before it opens the draft,
so a schedule change while the chat was open cannot bypass the normal
maximum-three-overlaps rule.

## Phase 4B — plan a list

A clear list of two to five tasks with explicit durations can be planned into
one draft set. The assistant places tasks sequentially in the bounded schedule
context and leaves a task visibly unscheduled when no suitable slot remains.

Before one explicit batch confirmation, the chat preview supports excluding an
item or editing its title and start/end values. The mutation layer checks the
combined overlap set, creates items in sequence, reloads the Calendar once,
and reports partial success item by item. A submitted preview is locked to
prevent duplicate creation after a partial failure.

## Phase 4C — split and protect time

The initial focus policy is 90 minutes of focus followed by a 15-minute break.
An explicit split-task request creates focus and break drafts in the same
reviewable plan preview. The planner searches on 15-minute increments only
for this flow so the next focus block can begin directly after its break.

The policy is a visible product default, not stored personal memory. A person
can still exclude or edit every generated focus or break Activity before the
batch confirmation.

## Storage and verification

Chat storage is scoped to the authenticated UID (v2). AccountApp remounts on
identity changes. Guest sessions do not persist; ownerless v1 history is not
imported into another account. ActivityPopup is the sole review/save surface;
the obsolete in-chat draft editor and its direct save callback were removed.

`npm run lint` checks assistant code and the preference candidate component
for undefined variables and Hook errors; assistant JavaScript also rejects
unused variables. This initial lint scope is included in `npm run verify` and
does not yet cover all frontend features. Boundary tests cover account-scoped
restore, future-only alternatives, unrelated overlaps, and preference signals.

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

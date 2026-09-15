# MR.Zettascale Activity Assistant

This feature owns the compact assistant shown beside the seven-day Activity
plan. It can propose and explain an Activity, but never saves Calendar data.

- `api/` communicates with the authenticated assistant endpoints.
- `components/` renders the compact chat dialog.
- `config/` contains deterministic template-chat branches and knowledge
  follow-up questions.
- `lib/` contains pure, testable formatting and the safe hand-off to
  `ActivityPopup`.

The only path to a Calendar write is the normal Save action inside
`ActivityPopup` after the person reviews the hand-off.

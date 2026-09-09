# Firebase Functions reminder scheduler

`checkDueReminders` is the sole server scheduler (every minute, asia-southeast3). Cloud Run worker is retired. Source changes do not resume existing cloud jobs.

## Structure

- `index.js`: schedule, queries, FCM delivery and runtime updates.
- `domain/reminder-due-logic.js`: shared due-date and eligibility rules.
- `domain/interval-schedule.js`: shared interval slots and summaries.
- Frontend reminder lib modules re-export these domain modules; there are no copied implementations.

The shared ESM domain lives within the Functions deployment source, so deployment includes it without copying. It has no Firebase or browser dependencies.

## Storage

Reminders: `users/{uid}/modes/reminder-mode/reminders/{id}`.
Activities: `users/{uid}/modes/activity-mode/activity-notifications/{id}`.
Tokens: `users/{uid}/modes/reminder-mode/fcmTokens/{id}`.
Both query groups require `enabled ASC, nextDueAt ASC` collection-group indexes. Legacy paths are skipped.

## Current scope

FCM uses shared eligibility (interval, routine and stopwatch excluded). The existing browser Telegram flow remains separate; this change does not move Telegram delivery to Functions. Existing lastNotifiedAt policy remains, including on failure or missing tokens; concurrent execution deduplication is not an atomic claim. Date calculations retain runtime-local timezone behavior.

## Validation and deployment

Run `node --test functions/worker-schema.test.cjs functions/domain.test.cjs` and the frontend build. Verify Firestore integration in the emulator before live use.

Deploy indexes with `firebase deploy --only firestore:indexes` and wait until ready.
Deploy the scheduler with `firebase deploy --only functions:checkDueReminders` only when ready to resume notifications: deployment can create/update its schedule. Keep the retired Cloud Run scheduler paused.

## Firestore Emulator integration tests

From the repository root (Java 21+, Firebase CLI and functions dependencies installed):

```powershell
firebase emulators:exec --only firestore --project demo-reminder-integration "node --test functions/reminder-emulator.test.cjs"
```

The suite invokes the real scheduled function handler through its `run()` entry point against real Firestore Emulator reads, collection-group queries and writes. Only FCM delivery is stubbed; it never sends device notifications. Fixtures use a dedicated demo project, are reset between tests, and the suite refuses to run without a loopback emulator address.

Coverage: interval exclusion (24h/minute, daytime, overnight), weekly multiple times/next week/stale weekdays/snooze, once-at/countdown, event re-arming, inactive/completed/future/null/renotify exclusions, full and partial FCM failures, invalid-token cleanup, missing tokens, activity mirrors, legacy paths, user isolation and 451-document batches.

Tests preserve the existing failure policy: failed FCM attempts still advance/disarm reminders and are not retried for that occurrence. Interval is currently excluded from FCM. These are explicit behavior assertions, not guarantees of successful delivery.

Scope limits: the suite does not exercise Cloud Scheduler infrastructure or a deployed Functions HTTP endpoint. Firestore Emulator does not validate production composite-index readiness. Dates run in Asia/Bangkok; per-user timezones and overlapping invocations are outside this suite.

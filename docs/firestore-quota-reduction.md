# Firestore read/write budget changes

These are code-based estimates, not production usage measurements. Counts
exclude initial loads, mutations, transaction retries and other features.

| Idle workload | Before | After |
| --- | --- | --- |
| Open chat with 30 messages, visible | 13,500 document reads/hour/tab | 450 metadata reads/hour/tab; messages only after revision changes |
| Closed chat, visible, connected | 120 reads/hour/tab | 60 reads/hour/tab |
| Hidden chat | Continued polling | No polling |
| Reminder sync, visible | 240 reads/hour/tab | 60 reads/hour/tab |
| Reminder sync, hidden | 240 reads/hour/tab | 12 reads/hour/tab, plus resume refresh |
| Unchanged news subscription | 3 reads + 1 write/check | 1 read + 0 writes/check, plus shared job overhead |
| Legacy category repair after restart | Both mapping collections scanned | One persistent marker read |

News uses an existence query and a transactional interval claim before a
paginated scan. The winning worker adds one lease read/write per interval;
other processes skip the scan while the claim is active. Empty subscriptions
cost only the existence query, with no lease write. Slow scans do not overlap
within a process; subscription transactions still deduplicate new item keys
across processes if a scan outlives the interval. `lastCheckedAt` is now updated
only when unseen items are recorded, not as a heartbeat.

Chat revision changes are committed with message writes/read acknowledgements.
This adds a metadata write for incoming messages and edits; existing outgoing
counter updates share that write. Unchanged polls return 304 after one metadata
read. New frontend code remains compatible with the older backend (without
revision responses it keeps doing full reads until the backend is upgraded).

The push scheduler still checks every minute. Empty queries therefore retain
their minimum read cost. Queries exclude local-only clocks and null/zero due
times. Scheduler updates also change reminder syncRevision in the same batch,
so browsers receive changes made by the worker.

RESOURCE_EXHAUSTED no longer supplies invented read balances or reset times.
The API supplies a five-minute cooldown rather than assuming Pacific midnight.
Actual metric, balance and plan must be checked in Firebase/Google Cloud.

## Rollout

1. Deploy the new composite index in `firestore.indexes.json` and wait until it
   is ready: reminders collection group, enabled/type/nextDueAt ascending.
   Keep existing indexes for the previous worker during rollout.
2. Validate the scheduler in the Firebase emulator, then deploy Functions.
3. Deploy backend and frontend. No destructive data migration is required.
   Repair completion markers are written lazily after successful repairs.
4. Compare Firestore read/write usage under similar workloads and verify chat
   message edits, unread counters, news delivery and cross-device reminders.

The local verification suite uses mocked Firestore and React hooks; it does not
prove production index readiness or measure live quota usage. No cloud deploy
is performed as part of these source changes.

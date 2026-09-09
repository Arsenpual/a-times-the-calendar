# Retired Cloud Run worker

Firebase Functions `checkDueReminders` is the sole supported scheduler.
This entry point exits without reading Firestore or sending notifications.
Keep the old job and its scheduler paused. Existing cloud deployments are not changed by this source update.
See `../functions/README.md` for the active implementation.

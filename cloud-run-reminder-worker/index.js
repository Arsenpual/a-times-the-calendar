// Retired: Firebase Functions is the only supported reminder scheduler.
console.error("Cloud Run worker is retired. Use Firebase Functions checkDueReminders.");
process.exitCode = 1;

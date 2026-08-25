const admin = require("firebase-admin");
const { isOneShotType, computeNextDueAt } = require("./reminder-due-logic");

// On Cloud Run this uses Application Default Credentials from the attached
// service account; no Firebase service-account JSON file is stored in the repo.
admin.initializeApp();
const db = admin.firestore();
const RENOTIFY_GUARD_FIELD = "lastNotifiedAt";

async function removeInvalidTokens(userId, tokens, response) {
  const removals = response.responses.flatMap((result, index) =>
    result.success || result.error?.code !== "messaging/registration-token-not-registered"
      ? []
      : [db.collection("users").doc(userId).collection("fcmTokens").doc(encodeURIComponent(tokens[index])).delete()]
  );
  await Promise.all(removals);
}

async function processUserDueReminders(userId, reminders, now) {
  const tokenDocs = await db.collection("users").doc(userId).collection("fcmTokens").get();
  const tokens = tokenDocs.docs.map((doc) => doc.data().token).filter(Boolean);
  const updates = [];

  for (const { ref, reminder } of reminders) {
    if (tokens.length) {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          data: { reminderId: ref.id, title: "ถึงเวลาแล้ว", body: reminder.title || "(ไม่มีชื่อ)" },
          tokens
        });
        console.log(`push ${ref.id}: ${response.successCount}/${tokens.length}`);
        await removeInvalidTokens(userId, tokens, response);
      } catch (error) {
        console.error(`push failed for ${ref.id}`, error);
      }
    }

    const next = { [RENOTIFY_GUARD_FIELD]: now };
    if (isOneShotType(reminder.type)) next.enabled = false;
    else if (reminder.type === "interval" || reminder.type === "weekly") next.nextDueAt = computeNextDueAt(reminder, now);
    else if (reminder.type === "event-anchored") next.nextDueAt = null;
    updates.push({ ref, next });
  }

  // Firestore batches are limited to 500 operations.
  for (let start = 0; start < updates.length; start += 450) {
    const batch = db.batch();
    for (const { ref, next } of updates.slice(start, start + 450)) batch.update(ref, next);
    await batch.commit();
  }
}

async function main() {
  const now = Date.now();
  const snapshot = await db.collectionGroup("reminder-mode")
    .where("enabled", "==", true)
    .where("nextDueAt", "<=", now)
    .get();
  const byUser = new Map();

  for (const doc of snapshot.docs) {
    const reminder = doc.data();
    if (reminder.completedAt || !reminder.nextDueAt || reminder.nextDueAt > now) continue;
    // Interval เวอร์ชันพื้นฐานยังเป็นเพียงข้อมูลความถี่ใน UI เท่านั้น:
    // ไม่ต้อง scan, ส่ง FCM หรือเขียน runtime ทุกนาที.
    if (reminder.type === "interval" || reminder.type === "routine" || reminder.type === "stopwatch") continue;
    if ((reminder[RENOTIFY_GUARD_FIELD] || 0) >= reminder.nextDueAt) continue;
    const userId = doc.ref.parent.parent?.id;
    if (!userId) continue;
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId).push({ ref: doc.ref, reminder });
  }

  console.log(`due reminders: ${[...byUser.values()].reduce((total, items) => total + items.length, 0)} across ${byUser.size} users`);
  for (const [userId, reminders] of byUser) await processUserDueReminders(userId, reminders, now);
}

main().then(() => {
  console.log("reminder worker completed");
}).catch((error) => {
  console.error("reminder worker failed", error);
  process.exitCode = 1;
});

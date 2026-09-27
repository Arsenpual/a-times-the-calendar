const FIRESTORE_FREE_DAILY_READ_LIMIT = 50_000;
const PACIFIC_TIME_ZONE = "America/Los_Angeles";

const pacificPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

function zonedParts(date) {
  return Object.fromEntries(
    pacificPartsFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
}

function timeZoneOffsetMs(date) {
  const parts = zonedParts(date);
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function pacificMidnightToUtc(year, month, day) {
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  let candidate = midnightAsUtc - timeZoneOffsetMs(new Date(midnightAsUtc));
  // Re-evaluate at the resulting instant so DST transitions use the offset
  // in effect at the target midnight rather than at the initial UTC guess.
  candidate = midnightAsUtc - timeZoneOffsetMs(new Date(candidate));
  return new Date(candidate);
}

function nextFirestoreQuotaReset(now = new Date()) {
  const currentPacificDate = zonedParts(now);
  const nextDay = new Date(Date.UTC(currentPacificDate.year, currentPacificDate.month - 1, currentPacificDate.day + 1));
  return pacificMidnightToUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate());
}

function firestoreQuotaExhaustedPayload(now = new Date()) {
  return {
    metric: "documentReads",
    remaining: 0,
    dailyLimit: FIRESTORE_FREE_DAILY_READ_LIMIT,
    resetsAt: nextFirestoreQuotaReset(now).toISOString(),
    resetTimeZone: PACIFIC_TIME_ZONE
  };
}

module.exports = {
  FIRESTORE_FREE_DAILY_READ_LIMIT,
  nextFirestoreQuotaReset,
  firestoreQuotaExhaustedPayload
};

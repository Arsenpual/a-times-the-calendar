import { firebaseApp } from "./firebase-config.js";

let analyticsPromise;

async function getAnalyticsClient() {
  if (!analyticsPromise) {
    analyticsPromise = import("firebase/analytics")
      .then(async ({ getAnalytics, isSupported, logEvent }) => (await isSupported() ? { analytics: getAnalytics(firebaseApp), logEvent } : null))
      .catch(() => null);
  }
  return analyticsPromise;
}

// Telemetry ต้องไม่ block การทำงานหลัก หาก Firebase project ยังไม่เปิด Analytics.
export function logReminderEvent(name, params = {}) {
  getAnalyticsClient().then((client) => {
    if (client) client.logEvent(client.analytics, name, params);
  });
}

// Remote Config มี default ปลอดภัย เพื่อ rollout Omnibar โดยไม่ต้อง redeploy.
export async function getReminderFeatureFlags() {
  const defaults = { omnibarEnabled: false };
  try {
    const { getRemoteConfig, fetchAndActivate, getValue } = await import("firebase/remote-config");
    const remoteConfig = getRemoteConfig(firebaseApp);
    remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 3_600_000;
    remoteConfig.defaultConfig = { reminder_omnibar_enabled: "false" };
    await fetchAndActivate(remoteConfig);
    return { omnibarEnabled: getValue(remoteConfig, "reminder_omnibar_enabled").asBoolean() };
  } catch {
    return defaults;
  }
}

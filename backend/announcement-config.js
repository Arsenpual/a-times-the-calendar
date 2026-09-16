const DEFAULT_ANNOUNCEMENT_CONFIG = Object.freeze({
  enabled: true,
  repeatIntervalMinutes: 5,
  holdDurationSeconds: 1.8,
  scrollSpeedPxPerSecond: 60,
  scrambleEnabled: true
});

function within(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

/**
 * Converts the optional Firestore fields into safe UI settings. Old documents
 * with only `message` continue to use the default configuration.
 */
function normalizeAnnouncementConfig(source = {}) {
  return {
    enabled: source.enabled !== false,
    repeatIntervalMinutes: within(source.repeatIntervalMinutes, DEFAULT_ANNOUNCEMENT_CONFIG.repeatIntervalMinutes, 1, 1_440),
    holdDurationSeconds: within(source.holdDurationSeconds, DEFAULT_ANNOUNCEMENT_CONFIG.holdDurationSeconds, 0.5, 60),
    scrollSpeedPxPerSecond: within(source.scrollSpeedPxPerSecond, DEFAULT_ANNOUNCEMENT_CONFIG.scrollSpeedPxPerSecond, 20, 240),
    scrambleEnabled: source.scrambleEnabled !== false
  };
}

module.exports = { DEFAULT_ANNOUNCEMENT_CONFIG, normalizeAnnouncementConfig };

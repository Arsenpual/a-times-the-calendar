import { useEffect, useState } from "react";
import { getAnnouncement } from "../api/announcement.js";

const FALLBACK_MESSAGE = "🎉 อัปเดตเวอร์ชันใหม่ — เพิ่มการรองรับกิจกรรมข้ามเที่ยงคืน และปรับปรุงการแสดงผลไทม์ไลน์";
const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  repeatIntervalMinutes: 5,
  holdDurationSeconds: 1.8,
  scrollSpeedPxPerSecond: 60,
  scrambleEnabled: true
});

export function useAnnouncementMessage(firebaseUser) {
  const [announcement, setAnnouncement] = useState({ message: FALLBACK_MESSAGE, config: DEFAULT_CONFIG });

  useEffect(() => {
    let cancelled = false;
    let lastFetchedAt = 0;
    const MIN_REFETCH_INTERVAL_MS = 60_000;
    const loadAnnouncement = async (force = false) => {
      if (!firebaseUser) {
        if (!cancelled) setAnnouncement({ message: FALLBACK_MESSAGE, config: DEFAULT_CONFIG });
        return;
      }
      const now = Date.now();
      if (!force && now - lastFetchedAt < MIN_REFETCH_INTERVAL_MS) return;
      lastFetchedAt = now;
      try {
        const announcement = await getAnnouncement();
        if (!cancelled) setAnnouncement({
          message: announcement.configured ? (announcement.message || "") : FALLBACK_MESSAGE,
          config: { ...DEFAULT_CONFIG, ...(announcement.config || {}) }
        });
      } catch {
        if (!cancelled) setAnnouncement({ message: FALLBACK_MESSAGE, config: DEFAULT_CONFIG });
      }
    };
    loadAnnouncement(true);
    const onFocus = () => loadAnnouncement(false);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [firebaseUser]);

  return announcement;
}

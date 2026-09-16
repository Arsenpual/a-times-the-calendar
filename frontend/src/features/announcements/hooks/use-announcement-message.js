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
    const loadAnnouncement = async () => {
      if (!firebaseUser) {
        if (!cancelled) setAnnouncement({ message: FALLBACK_MESSAGE, config: DEFAULT_CONFIG });
        return;
      }
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
    loadAnnouncement();
    window.addEventListener("focus", loadAnnouncement);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadAnnouncement);
    };
  }, [firebaseUser]);

  return announcement;
}

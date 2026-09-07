import { useEffect, useState } from "react";
import { getAnnouncement } from "../api/announcement.js";

const FALLBACK_MESSAGE = "🎉 อัปเดตเวอร์ชันใหม่ — เพิ่มการรองรับกิจกรรมข้ามเที่ยงคืน และปรับปรุงการแสดงผลไทม์ไลน์";

export function useAnnouncementMessage(firebaseUser) {
  const [announcementMessage, setAnnouncementMessage] = useState(FALLBACK_MESSAGE);

  useEffect(() => {
    let cancelled = false;
    const loadAnnouncement = async () => {
      if (!firebaseUser) {
        if (!cancelled) setAnnouncementMessage(FALLBACK_MESSAGE);
        return;
      }
      try {
        const announcement = await getAnnouncement();
        if (!cancelled) setAnnouncementMessage(announcement.configured ? (announcement.message || "") : FALLBACK_MESSAGE);
      } catch {
        if (!cancelled) setAnnouncementMessage(FALLBACK_MESSAGE);
      }
    };
    loadAnnouncement();
    window.addEventListener("focus", loadAnnouncement);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadAnnouncement);
    };
  }, [firebaseUser]);

  return announcementMessage;
}

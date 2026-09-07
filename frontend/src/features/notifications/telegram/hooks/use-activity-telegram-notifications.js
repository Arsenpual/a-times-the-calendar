import { useEffect, useRef } from "react";
import { activityDate } from "../../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../../shared/lib/id-utils.js";
import { areTelegramNotificationsEnabled } from "../telegram-notification-preferences.js";
import { sendTelegramActivity } from "../api.js";

export function useActivityTelegramNotifications({ firebaseUser, activities, archivedActivityIds }) {
  const sentKeysRef = useRef(new Set());
  const cursorRef = useRef(Date.now() - 30_000);

  useEffect(() => {
    sentKeysRef.current.clear();
    cursorRef.current = Date.now() - 30_000;
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    const notifyActivitiesStartingNow = () => {
      const now = Date.now();
      const previousCheck = cursorRef.current;
      cursorRef.current = now;
      activities.forEach((activity) => {
        if (!activity.start?.dateTime) return;
        const activityStart = activityDate(activity.start)?.getTime();
        const normalizedId = normalizeActivityId(activity.id);
        const isArchived = archivedActivityIds.has(activity.id) || archivedActivityIds.has(normalizedId);
        if (!Number.isFinite(activityStart) || isArchived || activityStart <= previousCheck || activityStart > now) return;
        const notificationKey = `${normalizedId}:${activityStart}`;
        if (!areTelegramNotificationsEnabled(firebaseUser.uid) || sentKeysRef.current.has(notificationKey)) return;
        sentKeysRef.current.add(notificationKey);
        sendTelegramActivity(activity.summary || "(Untitled activity)", `activity:${notificationKey}`).catch(() => {});
      });
    };
    notifyActivitiesStartingNow();
    const intervalId = window.setInterval(notifyActivitiesStartingNow, 15_000);
    return () => window.clearInterval(intervalId);
  }, [firebaseUser, activities, archivedActivityIds]);
}

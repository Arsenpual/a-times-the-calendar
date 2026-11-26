import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeActivityId } from '../../../shared/lib/id-utils.js';
import { soundEngine } from '../lib/sound';
import type { GameState, WorldToast } from '../types/game';

export interface ActivityModeEvent {
  id: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

export interface ClockActivityAnnouncement {
  id: string;
  activityId: string;
  title: string;
  startTimeLabel: string;
  statusLabel: string;
  triggeredAt: number;
}

interface ParsedTimedActivity {
  id: string;
  normalizedId: string;
  title: string;
  startMs: number;
  endMs: number;
  startTimeLabel: string;
}

function formatThaiClockTime(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} น.`;
}

function parseTimedActivities(
  activities: ActivityModeEvent[] | undefined,
  archivedActivityIds: Set<string> | undefined
): ParsedTimedActivity[] {
  if (!Array.isArray(activities) || activities.length === 0) return [];
  const parsed: ParsedTimedActivity[] = [];

  for (const activity of activities) {
    if (!activity?.id || !activity.start?.dateTime) continue;
    const normalizedId = normalizeActivityId(activity.id);
    if (
      archivedActivityIds &&
      (archivedActivityIds.has(activity.id) || archivedActivityIds.has(normalizedId))
    ) {
      continue;
    }

    const startMs = Date.parse(activity.start.dateTime);
    if (!Number.isFinite(startMs)) continue;

    const rawEndMs = activity.end?.dateTime ? Date.parse(activity.end.dateTime) : NaN;
    const endMs = Number.isFinite(rawEndMs) && rawEndMs > startMs ? rawEndMs : startMs + 30 * 60 * 1000;
    const title = (activity.summary || '').trim() || 'กิจกรรมไม่มีชื่อ';

    parsed.push({
      id: activity.id,
      normalizedId,
      title,
      startMs,
      endMs,
      startTimeLabel: formatThaiClockTime(startMs),
    });
  }

  parsed.sort((a, b) => a.startMs - b.startMs);
  return parsed;
}

export interface UseGrandfatherClockActivitiesOptions {
  activities?: ActivityModeEvent[];
  archivedActivityIds?: Set<string>;
  isVisible: boolean;
  gameState: GameState;
  showToast: (text: string, tone?: WorldToast['tone']) => void;
}

/**
 * Connects the Living Room antique grandfather pendulum clock to Activity Mode events.
 * Whenever a scheduled Activity Mode event reaches its start time while in Cozy Desk,
 * plays the antique grandfather clock chime and displays the activity name (with 3-round marquee for long titles).
 */
export function useGrandfatherClockActivities({
  activities,
  archivedActivityIds,
  isVisible,
  gameState,
  showToast,
}: UseGrandfatherClockActivitiesOptions) {
  const [activeClockAnnouncement, setActiveClockAnnouncement] =
    useState<ClockActivityAnnouncement | null>(null);

  const queueRef = useRef<Omit<ClockActivityAnnouncement, 'triggeredAt'>[]>([]);
  const activeRef = useRef<ClockActivityAnnouncement | null>(null);
  const triggeredKeysRef = useRef<Set<string>>(new Set());
  const lastCheckMsRef = useRef<number>(Date.now());
  const seqRef = useRef(0);

  activeRef.current = activeClockAnnouncement;

  const timedActivities = useMemo(
    () => parseTimedActivities(activities, archivedActivityIds),
    [activities, archivedActivityIds]
  );

  const activateAnnouncement = useCallback(
    (item: Omit<ClockActivityAnnouncement, 'triggeredAt'>) => {
      const next: ClockActivityAnnouncement = {
        ...item,
        triggeredAt: Date.now(),
      };
      activeRef.current = next;
      setActiveClockAnnouncement(next);
      soundEngine.playGrandfatherClockChime();
    },
    []
  );

  const enqueueAnnouncement = useCallback(
    (item: Omit<ClockActivityAnnouncement, 'triggeredAt'>) => {
      if (!activeRef.current) {
        activateAnnouncement(item);
      } else {
        queueRef.current.push(item);
      }
    },
    [activateAnnouncement]
  );

  const completeClockAnnouncement = useCallback(() => {
    const nextItem = queueRef.current.shift() ?? null;
    if (nextItem) {
      activateAnnouncement(nextItem);
    } else {
      activeRef.current = null;
      setActiveClockAnnouncement(null);
    }
  }, [activateAnnouncement]);

  // Monitor Activity Mode start times every second while Cozy Desk is visible
  useEffect(() => {
    if (!isVisible) {
      lastCheckMsRef.current = Date.now();
      return;
    }

    const checkStartingActivities = () => {
      const now = Date.now();
      const previousCheck = lastCheckMsRef.current;
      lastCheckMsRef.current = now;

      if (gameState === 'TITLE_MENU') {
        return;
      }

      // Allow a small 10s grace window for brief tab throttling without replaying old activities
      const windowStart = Math.max(previousCheck - 2_000, now - 10_000);

      for (const act of timedActivities) {
        if (act.startMs <= windowStart || act.startMs > now) continue;
        const key = `${act.normalizedId}:${act.startMs}`;
        if (triggeredKeysRef.current.has(key)) continue;

        triggeredKeysRef.current.add(key);
        seqRef.current += 1;
        enqueueAnnouncement({
          id: `clock-act-${seqRef.current}-${act.startMs}`,
          activityId: act.id,
          title: act.title,
          startTimeLabel: act.startTimeLabel,
          statusLabel: 'ถึงเวลาเริ่มกิจกรรม',
        });
      }
    };

    checkStartingActivities();
    const timerId = window.setInterval(checkStartingActivities, 1_000);
    return () => window.clearInterval(timerId);
  }, [enqueueAnnouncement, gameState, isVisible, timedActivities]);

  // Interactive check when user clicks / presses E at the living room grandfather clock
  const handleInteractClock = useCallback(() => {
    const now = Date.now();
    const nowLabel = formatThaiClockTime(now);

    const ongoing = timedActivities.find((act) => act.startMs <= now && now < act.endMs) ?? null;
    const upcoming = timedActivities.find((act) => act.startMs > now) ?? null;
    const featured = ongoing ?? upcoming;

    if (featured) {
      seqRef.current += 1;
      const statusLabel = ongoing ? 'กำลังดำเนินอยู่' : 'กิจกรรมถัดไป';
      // Replace current preview/display immediately so clicking the clock always responds crisply
      queueRef.current = [];
      activateAnnouncement({
        id: `clock-check-${seqRef.current}-${now}`,
        activityId: featured.id,
        title: featured.title,
        startTimeLabel: featured.startTimeLabel,
        statusLabel,
      });
      showToast(
        `นาฬิกาลูกตุ้มโบราณบอกเวลา ${nowLabel} · ${statusLabel} (${featured.startTimeLabel}): ${featured.title}`,
        'house'
      );
      return;
    }

    soundEngine.playGrandfatherClockChime();
    showToast(
      `นาฬิกาลูกตุ้มโบราณบอกเวลา ${nowLabel} — เชื่อมต่อ Activity Mode แล้ว (ยังไม่มีกิจกรรมถัดไปในช่วงนี้)`,
      'house'
    );
  }, [activateAnnouncement, showToast, timedActivities]);

  return {
    activeClockAnnouncement,
    completeClockAnnouncement,
    handleInteractClock,
  };
}

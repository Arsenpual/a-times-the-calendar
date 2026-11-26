import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchActivities } from '../../../shared/api/google-calendar.js';
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

export interface ActivityModeCategory {
  id: string;
  name?: string;
  label?: string;
  color?: string;
}

export interface ClockActivityAnnouncement {
  id: string;
  activityId: string;
  title: string;
  startTimeLabel: string;
  timeRangeLabel: string;
  categoryName?: string;
  categoryColor?: string;
  statusLabel: string;
  triggeredAt: number;
}

export type ClockDayActivityStatus = 'completed' | 'ongoing' | 'next' | 'upcoming';

export interface ClockDayActivityItem {
  id: string;
  normalizedId: string;
  title: string;
  isAllDay: boolean;
  startMs: number;
  endMs: number;
  startTimeLabel: string;
  endTimeLabel: string;
  timeRangeLabel: string;
  dateKey: string;
  dateLabel: string;
  categoryName?: string;
  categoryColor?: string;
  status: ClockDayActivityStatus;
  countdownLabel?: string;
}

export interface ClockNextActivityCountdown {
  activity: ClockDayActivityItem;
  remainingMs: number;
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  hmsLabel: string;
  thaiLabel: string;
  isToday: boolean;
}

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export function formatLocalDateKey(msOrDate: number | Date): string {
  const d = typeof msOrDate === 'number' ? new Date(msOrDate) : msOrDate;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatThaiShortDate(msOrDate: number | Date): string {
  const d = typeof msOrDate === 'number' ? new Date(msOrDate) : msOrDate;
  return `${d.getDate()} ${THAI_SHORT_MONTHS[d.getMonth()] ?? ''}`;
}

export function formatThaiClockTime(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} น.`;
}

export function formatCountdownMetrics(remainingMs: number): {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  hmsLabel: string;
  thaiLabel: string;
} {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  const hmsLabel = days > 0 ? `${days} วัน ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;

  let thaiLabel = '';
  if (days > 0) {
    thaiLabel = `อีก ${days} วัน ${hours} ชม. ${minutes} นาที`;
  } else if (hours > 0) {
    thaiLabel = `อีก ${hours} ชม. ${minutes} นาที ${ss} วินาที`;
  } else if (minutes > 0) {
    thaiLabel = `อีก ${minutes} นาที ${ss} วินาที`;
  } else {
    thaiLabel = `อีก ${seconds} วินาที`;
  }

  return {
    totalSeconds,
    hours: days * 24 + hours,
    minutes,
    seconds,
    hmsLabel,
    thaiLabel,
  };
}

interface RawParsedActivity {
  id: string;
  normalizedId: string;
  title: string;
  isAllDay: boolean;
  startMs: number;
  endMs: number;
  startTimeLabel: string;
  endTimeLabel: string;
  timeRangeLabel: string;
  dateKey: string;
  dateLabel: string;
  categoryName?: string;
  categoryColor?: string;
}

function parseAllActivities(
  activities: ActivityModeEvent[] | undefined,
  archivedActivityIds: Set<string> | undefined,
  categories: ActivityModeCategory[] | undefined,
  activityCategoryMap: Record<string, string> | undefined
): RawParsedActivity[] {
  if (!Array.isArray(activities) || activities.length === 0) return [];

  const categoryById = new Map<string, ActivityModeCategory>();
  if (Array.isArray(categories)) {
    for (const cat of categories) {
      if (cat?.id) categoryById.set(cat.id, cat);
    }
  }

  const parsed: RawParsedActivity[] = [];
  const seenIds = new Set<string>();

  for (const activity of activities) {
    if (!activity?.id || seenIds.has(activity.id)) continue;
    const normalizedId = normalizeActivityId(activity.id);
    if (
      archivedActivityIds &&
      (archivedActivityIds.has(activity.id) || archivedActivityIds.has(normalizedId))
    ) {
      continue;
    }

    const catId =
      activityCategoryMap?.[activity.id] ?? activityCategoryMap?.[normalizedId] ?? undefined;
    const catObj = catId ? categoryById.get(catId) : undefined;
    const categoryName = catObj?.name || catObj?.label || undefined;
    const categoryColor = catObj?.color || undefined;
    const title = (activity.summary || '').trim() || 'กิจกรรมไม่มีชื่อ';

    if (activity.start?.dateTime) {
      const startMs = Date.parse(activity.start.dateTime);
      if (!Number.isFinite(startMs)) continue;
      const rawEndMs = activity.end?.dateTime ? Date.parse(activity.end.dateTime) : NaN;
      const endMs =
        Number.isFinite(rawEndMs) && rawEndMs > startMs ? rawEndMs : startMs + 30 * 60 * 1000;
      const startTimeLabel = formatThaiClockTime(startMs);
      const endTimeLabel = formatThaiClockTime(endMs);
      const timeRangeLabel = `${startTimeLabel.replace(/\s*น\.$/, '')} – ${endTimeLabel}`;

      seenIds.add(activity.id);
      parsed.push({
        id: activity.id,
        normalizedId,
        title,
        isAllDay: false,
        startMs,
        endMs,
        startTimeLabel,
        endTimeLabel,
        timeRangeLabel,
        dateKey: formatLocalDateKey(startMs),
        dateLabel: formatThaiShortDate(startMs),
        categoryName,
        categoryColor,
      });
    } else if (activity.start?.date) {
      const dayStart = new Date(`${activity.start.date}T00:00:00`);
      const startMs = dayStart.getTime();
      if (!Number.isFinite(startMs)) continue;
      const endMs = startMs + 24 * 60 * 60 * 1000 - 1;

      seenIds.add(activity.id);
      parsed.push({
        id: activity.id,
        normalizedId,
        title,
        isAllDay: true,
        startMs,
        endMs,
        startTimeLabel: 'ทั้งวัน',
        endTimeLabel: 'ทั้งวัน',
        timeRangeLabel: 'ตลอดทั้งวัน',
        dateKey: activity.start.date,
        dateLabel: formatThaiShortDate(dayStart),
        categoryName,
        categoryColor,
      });
    }
  }

  parsed.sort((a, b) => {
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
    return a.startMs - b.startMs;
  });

  return parsed;
}

export interface UseGrandfatherClockActivitiesOptions {
  activities?: ActivityModeEvent[];
  archivedActivityIds?: Set<string>;
  categories?: ActivityModeCategory[];
  activityCategoryMap?: Record<string, string>;
  calendarAccessToken?: string | null;
  isVisible: boolean;
  gameState: GameState;
  showToast: (text: string, tone?: WorldToast['tone']) => void;
}

/**
 * Connects the Living Room antique grandfather pendulum clock to Activity Mode events.
 * - Plays the antique grandfather clock chime and displays the activity name (with 3-round right-to-left marquee for long titles) when an activity reaches its start time.
 * - After passing the activity start-time announcement period, displays a live countdown to the next upcoming activity.
 * - Provides the full-day Activity Mode schedule for viewing all activities of the day.
 */
export function useGrandfatherClockActivities({
  activities,
  archivedActivityIds,
  categories,
  activityCategoryMap,
  calendarAccessToken,
  isVisible,
  gameState,
  showToast,
}: UseGrandfatherClockActivitiesOptions) {
  const [activeClockAnnouncement, setActiveClockAnnouncement] =
    useState<ClockActivityAnnouncement | null>(null);
  const [isClockScheduleOpen, setIsClockScheduleOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [fetchedTodayActivities, setFetchedTodayActivities] = useState<ActivityModeEvent[]>([]);
  const [isSyncingTodayActivities, setIsSyncingTodayActivities] = useState(false);

  const queueRef = useRef<Omit<ClockActivityAnnouncement, 'triggeredAt'>[]>([]);
  const activeRef = useRef<ClockActivityAnnouncement | null>(null);
  const triggeredKeysRef = useRef<Set<string>>(new Set());
  const lastCheckMsRef = useRef<number>(Date.now());
  const seqRef = useRef(0);

  activeRef.current = activeClockAnnouncement;

  const todayDateKey = useMemo(() => formatLocalDateKey(nowMs), [nowMs]);

  // Merge prop activities from Activity Mode with any direct today-window fallback fetch
  const mergedRawActivities = useMemo(() => {
    const base = Array.isArray(activities) ? activities : [];
    if (fetchedTodayActivities.length === 0) return base;
    const byId = new Map<string, ActivityModeEvent>();
    for (const item of base) {
      if (item?.id) byId.set(item.id, item);
    }
    for (const item of fetchedTodayActivities) {
      if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
    }
    return Array.from(byId.values());
  }, [activities, fetchedTodayActivities]);

  const allParsedActivities = useMemo(
    () =>
      parseAllActivities(
        mergedRawActivities,
        archivedActivityIds,
        categories,
        activityCategoryMap
      ),
    [activityCategoryMap, archivedActivityIds, categories, mergedRawActivities]
  );

  const timedActivities = useMemo(
    () =>
      allParsedActivities
        .filter((act) => !act.isAllDay)
        .sort((a, b) => a.startMs - b.startMs),
    [allParsedActivities]
  );

  // If the user navigated Activity Mode to a different week/month and opened Cozy Desk,
  // allow fetching today's window directly so today's full schedule is always available.
  const refreshTodayActivities = useCallback(async () => {
    if (!calendarAccessToken) return;
    setIsSyncingTodayActivities(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      const items = await fetchActivities(calendarAccessToken, start, end);
      if (Array.isArray(items)) {
        setFetchedTodayActivities(items);
      }
    } catch {
      // Keep existing Activity Mode state on transient fetch errors
    } finally {
      setIsSyncingTodayActivities(false);
    }
  }, [calendarAccessToken]);

  useEffect(() => {
    if (!isVisible || !calendarAccessToken) return;
    const hasTodayInProp = (activities ?? []).some((act) => {
      const dt = act?.start?.dateTime ? Date.parse(act.start.dateTime) : NaN;
      if (Number.isFinite(dt) && formatLocalDateKey(dt) === todayDateKey) return true;
      if (act?.start?.date === todayDateKey) return true;
      return false;
    });
    if (!hasTodayInProp && fetchedTodayActivities.length === 0) {
      void refreshTodayActivities();
    }
  }, [
    activities,
    calendarAccessToken,
    fetchedTodayActivities.length,
    isVisible,
    refreshTodayActivities,
    todayDateKey,
  ]);

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

  // Automatically end the active chime announcement after 10s (short) or 3 marquee rounds (long)
  useEffect(() => {
    if (!activeClockAnnouncement) return;
    const titleLen = activeClockAnnouncement.title.length;
    const estimatedDurationMs =
      titleLen <= 16
        ? 10_000
        : Math.max(10_500, Math.ceil(((120 + titleLen * 6.5) / 38) * 3 * 1000) + 400);
    const timerId = window.setTimeout(() => {
      completeClockAnnouncement();
    }, estimatedDurationMs);
    return () => window.clearTimeout(timerId);
  }, [activeClockAnnouncement, completeClockAnnouncement]);

  // Tick every second to check starting activities and update the live countdown timer
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const checkStartingActivities = () => {
      const now = Date.now();
      setNowMs(now);

      if (gameState === 'TITLE_MENU') {
        return;
      }

      const previousCheck = lastCheckMsRef.current;
      lastCheckMsRef.current = now;

      // Allow up to a 60s start window so entering Cozy Desk during an activity's start minute still chimes once
      const windowStart = Math.max(previousCheck - 2_000, now - 60_000);

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
          timeRangeLabel: act.timeRangeLabel,
          categoryName: act.categoryName,
          categoryColor: act.categoryColor,
          statusLabel: 'ถึงเวลาเริ่มกิจกรรม',
        });
      }
    };

    checkStartingActivities();
    const timerId = window.setInterval(checkStartingActivities, 1_000);
    return () => window.clearInterval(timerId);
  }, [enqueueAnnouncement, gameState, isVisible, timedActivities]);

  // Compute today's full-day schedule & live statuses
  const {
    todayActivities,
    upcomingWeekActivities,
    ongoingActivity,
    lastStartedTodayActivity,
    nextActivityCountdown,
  } = useMemo(() => {
    const dayStart = new Date(`${todayDateKey}T00:00:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    // Next upcoming timed activity (prefer today's upcoming first, then any future in the loaded schedule)
    const nextTimed = timedActivities.find((act) => act.startMs > nowMs) ?? null;

    const decorateItem = (raw: RawParsedActivity): ClockDayActivityItem => {
      if (raw.isAllDay) {
        return {
          ...raw,
          status: 'ongoing',
        };
      }
      if (raw.endMs <= nowMs) {
        return {
          ...raw,
          status: 'completed',
        };
      }
      if (raw.startMs <= nowMs && nowMs < raw.endMs) {
        return {
          ...raw,
          status: 'ongoing',
        };
      }
      const metrics = formatCountdownMetrics(raw.startMs - nowMs);
      const isVeryNext = nextTimed?.id === raw.id && nextTimed?.startMs === raw.startMs;
      return {
        ...raw,
        status: isVeryNext ? 'next' : 'upcoming',
        countdownLabel: metrics.hmsLabel,
      };
    };

    const todayItems = allParsedActivities
      .filter((act) => {
        if (act.dateKey === todayDateKey) return true;
        if (!act.isAllDay && act.startMs < dayEnd && act.endMs > dayStart) return true;
        return false;
      })
      .map(decorateItem);

    const futureWeekItems = timedActivities
      .filter((act) => act.dateKey > todayDateKey && act.startMs > nowMs)
      .slice(0, 8)
      .map(decorateItem);

    const ongoing =
      todayItems.find((act) => !act.isAllDay && act.status === 'ongoing') ?? null;

    const startedToday = todayItems.filter(
      (act) => !act.isAllDay && act.startMs <= nowMs
    );
    const lastStarted =
      startedToday.length > 0 ? startedToday[startedToday.length - 1] : null;

    let countdown: ClockNextActivityCountdown | null = null;
    if (nextTimed) {
      const decoratedNext = decorateItem(nextTimed);
      const remainingMs = Math.max(0, nextTimed.startMs - nowMs);
      const metrics = formatCountdownMetrics(remainingMs);
      countdown = {
        activity: decoratedNext,
        remainingMs,
        totalSeconds: metrics.totalSeconds,
        hours: metrics.hours,
        minutes: metrics.minutes,
        seconds: metrics.seconds,
        hmsLabel: metrics.hmsLabel,
        thaiLabel: metrics.thaiLabel,
        isToday: nextTimed.dateKey === todayDateKey,
      };
    }

    return {
      todayActivities: todayItems,
      upcomingWeekActivities: futureWeekItems,
      ongoingActivity: ongoing,
      lastStartedTodayActivity: lastStarted,
      nextActivityCountdown: countdown,
    };
  }, [allParsedActivities, nowMs, timedActivities, todayDateKey]);

  const openClockSchedule = useCallback(() => {
    soundEngine.playInteract();
    setIsClockScheduleOpen(true);
  }, []);

  const closeClockSchedule = useCallback(() => {
    soundEngine.playInteract();
    setIsClockScheduleOpen(false);
  }, []);

  const triggerActivityPreviewChime = useCallback(
    (activity: Pick<ClockDayActivityItem, 'id' | 'title' | 'startTimeLabel' | 'timeRangeLabel' | 'categoryName' | 'categoryColor'>) => {
      seqRef.current += 1;
      queueRef.current = [];
      activateAnnouncement({
        id: `clock-preview-${seqRef.current}-${Date.now()}`,
        activityId: activity.id,
        title: activity.title,
        startTimeLabel: activity.startTimeLabel,
        timeRangeLabel: activity.timeRangeLabel,
        categoryName: activity.categoryName,
        categoryColor: activity.categoryColor,
        statusLabel: 'ถึงเวลาเริ่มกิจกรรม',
      });
    },
    [activateAnnouncement]
  );

  // Interactive check when user clicks / presses E at the living room grandfather clock:
  // Opens the full-day Activity Mode schedule silently (no clock chime sound, no center-screen toast)
  const handleInteractClock = useCallback(() => {
    setNowMs(Date.now());
    setIsClockScheduleOpen(true);
  }, []);

  return {
    nowMs,
    activeClockAnnouncement,
    completeClockAnnouncement,
    todayActivities,
    upcomingWeekActivities,
    ongoingActivity,
    lastStartedTodayActivity,
    nextActivityCountdown,
    isClockScheduleOpen,
    setIsClockScheduleOpen,
    openClockSchedule,
    closeClockSchedule,
    handleInteractClock,
    triggerActivityPreviewChime,
    refreshTodayActivities,
    isSyncingTodayActivities,
  };
}

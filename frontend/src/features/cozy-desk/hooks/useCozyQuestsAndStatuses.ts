import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { CharacterTaskActivityUpdate } from '../components/AiStudioModal';
import type {
  AssistantMood,
  CharacterId,
  CharacterStatusMap,
  CharacterStatusSnapshot,
  ChatMessage,
  DailyPlantWateringRecord,
  DailySleepRecord,
  GameState,
  MinaPinMission,
  SavedDraft,
  TvFeedItem,
  WorldToast,
} from '../types/game';
import {
  findTodayPlantWatering,
  loadPlantWateringHistory,
  recordPlantWateringToday,
} from '../lib/plantQuestStorage';
import {
  fetchSleepLogs,
  findTodaySleepRecord,
  formatSleepTimeSummary,
  getLocalIsoDate,
  getMsUntilLocalMidnight,
  persistSleepLog,
  removeSleepLog,
} from '../api/sleepLogsApi';
import { soundEngine } from '../lib/sound';
import { initYouTubeAuth } from '../api/youtubeAuth';
import { cozyApiFetch, cozyStorageKey } from '../api/cozyApi';
import {
  createFallbackCharacterStatuses,
  STORAGE_DRAFTS_KEY,
  STORAGE_MESSAGES_KEY,
  STORAGE_TV_FEED_KEY,
} from '../lib/cozyDeskDefaults';

export interface UseCozyQuestsAndStatusesOptions {
  messages: ChatMessage[];
  drafts: SavedDraft[];
  customTvFeed: TvFeedItem[];
  firebaseUser: User | null;
  setGoogleUser: React.Dispatch<React.SetStateAction<User | null>>;
  setYoutubeToken: React.Dispatch<React.SetStateAction<string | null>>;
  serverCharacterStatuses: CharacterStatusMap | null;
  setServerCharacterStatuses: React.Dispatch<React.SetStateAction<CharacterStatusMap | null>>;
  clientCharacterActivities: Record<CharacterId, CharacterTaskActivityUpdate>;
  setClientCharacterActivities: React.Dispatch<
    React.SetStateAction<Record<CharacterId, CharacterTaskActivityUpdate>>
  >;
  assistantMood: AssistantMood;
  minaMission: MinaPinMission | null;
  toastTimerRef: React.MutableRefObject<number | null>;
  setToast: React.Dispatch<React.SetStateAction<WorldToast | null>>;
  bubbleTimerRef: React.MutableRefObject<number | null>;
  setMinaBubbleText: React.Dispatch<React.SetStateAction<string | null>>;
  sleepLogs: DailySleepRecord[];
  setSleepLogs: React.Dispatch<React.SetStateAction<DailySleepRecord[]>>;
  gameState: GameState;
}

export function useCozyQuestsAndStatuses({
  messages,
  drafts,
  customTvFeed,
  firebaseUser,
  setGoogleUser,
  setYoutubeToken,
  serverCharacterStatuses,
  setServerCharacterStatuses,
  clientCharacterActivities,
  setClientCharacterActivities,
  assistantMood,
  minaMission,
  toastTimerRef,
  setToast,
  bubbleTimerRef,
  setMinaBubbleText,
  sleepLogs,
  setSleepLogs,
  gameState,
}: UseCozyQuestsAndStatusesOptions) {
  // Persist messages & drafts
  useEffect(() => {
    try {
      localStorage.setItem(
        cozyStorageKey(STORAGE_MESSAGES_KEY),
        JSON.stringify(messages.slice(-40))
      );
    } catch {
      // Ignore quota errors
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(cozyStorageKey(STORAGE_DRAFTS_KEY), JSON.stringify(drafts));
    } catch {
      // Ignore quota errors
    }
  }, [drafts]);

  useEffect(() => {
    try {
      localStorage.setItem(cozyStorageKey(STORAGE_TV_FEED_KEY), JSON.stringify(customTvFeed));
    } catch {
      // Ignore quota errors
    }
  }, [customTvFeed]);

  // Listen to Firebase Auth state and clear cached token on sign-out
  useEffect(() => {
    const unsubscribe = initYouTubeAuth(
      (user, token) => {
        setGoogleUser(user);
        setYoutubeToken(token);
      },
      () => {
        setGoogleUser(firebaseUser);
        setYoutubeToken(null);
      }
    );
    return unsubscribe;
  }, [firebaseUser, setGoogleUser, setYoutubeToken]);

  const fetchCharacterStatuses = useCallback(async () => {
    try {
      const res = await cozyApiFetch('/api/characters/status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        characters?: CharacterStatusMap;
      };
      if (data.ok && data.characters) {
        setServerCharacterStatuses(data.characters);
      }
    } catch {
      // Keep last known snapshot silently
    }
  }, [setServerCharacterStatuses]);

  useEffect(() => {
    void fetchCharacterStatuses();
    const timer = window.setInterval(() => {
      void fetchCharacterStatuses();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [fetchCharacterStatuses]);

  const handleUpdateCharacterActivity = useCallback(
    (characterId: CharacterId, activity: CharacterTaskActivityUpdate) => {
      setClientCharacterActivities((prev) => ({
        ...prev,
        [characterId]: activity,
      }));
    },
    [setClientCharacterActivities]
  );

  const characterStatuses = useMemo<CharacterStatusMap>(() => {
    const base = serverCharacterStatuses ?? createFallbackCharacterStatuses();

    const mergeOne = (id: CharacterId): CharacterStatusSnapshot => {
      const serverSnap = base[id];
      const clientAct = clientCharacterActivities[id];

      if (id === 'mina' && assistantMood === 'pinning' && minaMission) {
        const shortTitle =
          minaMission.taskTitle.length > 26
            ? `${minaMission.taskTitle.slice(0, 25)}…`
            : minaMission.taskTitle;
        return {
          ...serverSnap,
          status: 'busy',
          currentTask: `ปักหมุดงาน: ${shortTitle}`,
        };
      }

      if (clientAct.busy && clientAct.taskLabel) {
        return {
          ...serverSnap,
          status: 'busy',
          currentTask: clientAct.taskLabel,
        };
      }

      if (serverSnap.status === 'unavailable') {
        return serverSnap;
      }

      if (clientAct.errorReason) {
        return {
          ...serverSnap,
          status: 'unavailable',
          currentTask: null,
          unavailableReason: clientAct.errorReason,
          unavailableCode: clientAct.errorCode ?? serverSnap.unavailableCode ?? null,
        };
      }

      return serverSnap;
    };

    return {
      mina: mergeOne('mina'),
      antigravity: mergeOne('antigravity'),
      ai_studio: mergeOne('ai_studio'),
    };
  }, [assistantMood, clientCharacterActivities, minaMission, serverCharacterStatuses]);

  const showToast = useCallback(
    (text: string, speaker: WorldToast['speaker'] = 'house') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ id: Date.now(), text, speaker });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 4200);
    },
    [setToast, toastTimerRef]
  );

  const showMinaBubble = useCallback(
    (text: string, durationMs = 4500) => {
      if (bubbleTimerRef.current) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      setMinaBubbleText(text);
      bubbleTimerRef.current = window.setTimeout(() => {
        setMinaBubbleText(null);
      }, durationMs);
    },
    [bubbleTimerRef, setMinaBubbleText]
  );

  // Hydrate daily sleep .json archive from server (merged with local backup)
  useEffect(() => {
    let active = true;
    void fetchSleepLogs().then((records) => {
      if (active) {
        setSleepLogs(records);
      }
    });
    return () => {
      active = false;
    };
  }, [setSleepLogs]);

  const [todayIsoDate, setTodayIsoDate] = useState<string>(() => getLocalIsoDate());
  const [plantWateringLogs, setPlantWateringLogs] = useState<DailyPlantWateringRecord[]>(() =>
    loadPlantWateringHistory()
  );
  const [plantWateringTriggerId, setPlantWateringTriggerId] = useState(0);

  // Automatically reset daily quests (sleep upload + 5 entryway potted plants watering) right at local midnight (00:00)
  useEffect(() => {
    const checkDayRollover = () => {
      const current = getLocalIsoDate();
      setTodayIsoDate((prev) => {
        if (prev !== current) {
          if (gameState !== 'TITLE_MENU') {
            showToast(
              'ขึ้นวันใหม่แล้ว (00:00 น.) — ภารกิจบันทึกการนอนและภารกิจรดน้ำต้นไม้ 5 ต้นประจำวันรีเซ็ตแล้วครับ',
              'house'
            );
          }
          return current;
        }
        return prev;
      });
    };

    const msUntilMidnight = getMsUntilLocalMidnight();
    const midnightTimer = window.setTimeout(checkDayRollover, msUntilMidnight);
    const fallbackInterval = window.setInterval(checkDayRollover, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDayRollover();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearTimeout(midnightTimer);
      window.clearInterval(fallbackInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [gameState, showToast, todayIsoDate]);

  const todaySleepRecord = useMemo(
    () => findTodaySleepRecord(sleepLogs, todayIsoDate),
    [sleepLogs, todayIsoDate]
  );
  const hasLoggedTodaySleep = Boolean(todaySleepRecord);
  const todaySleepSummary = useMemo(
    () => formatSleepTimeSummary(todaySleepRecord),
    [todaySleepRecord]
  );

  const todayPlantWateringRecord = useMemo(
    () => findTodayPlantWatering(plantWateringLogs, todayIsoDate),
    [plantWateringLogs, todayIsoDate]
  );
  const hasWateredPlantsToday = Boolean(todayPlantWateringRecord);
  const todayPlantWaterLabel = todayPlantWateringRecord?.lastWateredTimeLabel ?? null;

  const handleWaterPorchPlants = useCallback(() => {
    soundEngine.playWaterPlants();
    setPlantWateringTriggerId((n) => n + 1);
    setPlantWateringLogs((prev) => {
      const { records, todayRecord, wasFirstToday } = recordPlantWateringToday(
        prev,
        todayIsoDate
      );
      if (wasFirstToday) {
        showToast(
          `ภารกิจรดน้ำต้นไม้ทั้ง 5 ต้นวันนี้สำเร็จแล้ว! (${todayRecord.lastWateredTimeLabel}) · รีเซ็ตอัตโนมัติตอน 00:00 น.`,
          'player'
        );
      } else {
        showToast(
          `รดน้ำต้นไม้ทั้ง 5 ต้นเพิ่มความสดชื่นอีกครั้งแล้ว (${todayRecord.lastWateredTimeLabel} · วันนี้รดแล้ว ${todayRecord.wateredCount} ครั้ง)`,
          'player'
        );
      }
      return records;
    });
  }, [showToast, todayIsoDate]);

  const handleSaveSleepLog = useCallback(
    async (record: DailySleepRecord) => {
      const wasDoneToday = hasLoggedTodaySleep;
      const next = await persistSleepLog(record);
      setSleepLogs(next);
      const summary = formatSleepTimeSummary(record);
      if (!wasDoneToday || record.createdAt === record.updatedAt) {
        showToast(
          `ภารกิจการนอนวันนี้สำเร็จ! ${summary?.hudLabel ?? `วันที่ ${record.date}`} — บันทึก .json เรียบร้อยแล้ว`,
          'player'
        );
      }
    },
    [hasLoggedTodaySleep, setSleepLogs, showToast]
  );

  const handleDeleteSleepLog = useCallback(
    async (id: string) => {
      const next = await removeSleepLog(id);
      setSleepLogs(next);
      showToast('ลบบันทึกการนอนออกจากคลัง .json แล้ว', 'house');
    },
    [setSleepLogs, showToast]
  );

  return {
    fetchCharacterStatuses,
    handleUpdateCharacterActivity,
    characterStatuses,
    showToast,
    showMinaBubble,
    todayIsoDate,
    plantWateringTriggerId,
    hasLoggedTodaySleep,
    todaySleepSummary,
    hasWateredPlantsToday,
    todayPlantWaterLabel,
    handleWaterPorchPlants,
    handleSaveSleepLog,
    handleDeleteSleepLog,
  };
}

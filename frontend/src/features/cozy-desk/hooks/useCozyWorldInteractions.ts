import { useCallback, useEffect, useRef, useState } from 'react';
import { isDiningChairSeatId } from '../game/houseMap';
import type {
  AssistantTaskDelivery,
  InteractableId,
  MinaActionMenuAnchor,
  MinaSummonMode,
  RoomZone,
  TvFeedItem,
} from '../types/game';
import { soundEngine } from '../lib/sound';
import {
  clearYouTubeAccessToken,
  requestGoogleDriveWriteAccess,
  signInWithGoogleForYouTube,
  signOutGoogle,
} from '../api/youtubeAuth';
import { BOOKSHELF_TIPS } from '../lib/cozyDeskDefaults';


export function useCozyWorldInteractions(ctx: any) {
  const {
    appRootRef,
    enteredNativeFullscreenRef,
    isFullscreenMap,
    setIsFullscreenMap,
    showHelp,
    setShowHelp,
    isVisible,
    isSleepLogOpen,
    setIsSleepLogOpen,
    isMailboxOpen,
    setIsMailboxOpen,
    isAiStudioOpen,
    setIsAiStudioOpen,
    isAntigravityOpen,
    setIsAntigravityOpen,
    isDriveOpen,
    setIsDriveOpen,
    isPinboardOpen,
    setIsPinboardOpen,
    isTvOpen,
    setIsTvOpen,
    minaActionMenu,
    setMinaActionMenu,
    gameState,
    setGameState,
    playerSeat,
    setPlayerSeat,
    showMinaBubble,
    showToast,
    setZone,
    setAssistantMood,
    setMinaSummonCommand,
    setTimeOfDay,
    tipIndex,
    setTipIndex,
    setGmailFreshArrival,
    handleWaterPorchPlants,
    setCustomTvFeed,
    setActiveTvItem,
    setIsSigningInGoogle,
    setGoogleAuthError,
    setGoogleUser,
    setYoutubeToken,
    setGmailScopeMissing,
    firebaseUser,
    setSyncedTaskLists,
    setTasksSyncError,
    setGmailUnreadTotal,
    setLocallyReadMailIds,
    setLocallyReadUnreadIds,
    knownGmailUnreadIdsRef,
    hasPolledGmailOnceRef,
  } = ctx;

  const enterFullscreenMap = useCallback(() => {
    soundEngine.playInteract();
    setShowHelp(false);
    setIsFullscreenMap(true);
    const rootEl = appRootRef.current;
    if (rootEl && typeof rootEl.requestFullscreen === 'function' && !document.fullscreenElement) {
      rootEl.requestFullscreen().catch(() => {
        // Gracefully stay in full-viewport CSS mode if browser blocks native fullscreen
      });
    }
  }, []);

  const exitFullscreenMap = useCallback(() => {
    soundEngine.playInteract();
    setIsFullscreenMap(false);
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {
        // Ignore if already exited
      });
    }
  }, []);

  const toggleFullscreenMap = useCallback(() => {
    if (isFullscreenMap) {
      exitFullscreenMap();
    } else {
      enterFullscreenMap();
    }
  }, [enterFullscreenMap, exitFullscreenMap, isFullscreenMap]);

  // Sync React state when user exits native browser fullscreen (e.g. via Esc or browser UI)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        enteredNativeFullscreenRef.current = true;
      } else if (enteredNativeFullscreenRef.current) {
        enteredNativeFullscreenRef.current = false;
        setIsFullscreenMap(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Global Esc shortcut to close Sleep Quest, Mailbox, AI Studio, Antigravity, Drive, Pinboard, TV, help, stand up from desk, or exit fullscreen map
  useEffect(() => {
    if (!isVisible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isSleepLogOpen) {
        setIsSleepLogOpen(false);
        soundEngine.playInteract();
        return;
      }
      if (isMailboxOpen) {
        setIsMailboxOpen(false);
        soundEngine.playInteract();
        return;
      }
      if (isAiStudioOpen) {
        setIsAiStudioOpen(false);
        soundEngine.playInteract();
        return;
      }
      if (isAntigravityOpen) {
        setIsAntigravityOpen(false);
        soundEngine.playInteract();
        return;
      }
      if (isDriveOpen) {
        setIsDriveOpen(false);
        soundEngine.playInteract();
        return;
      }
      if (isPinboardOpen) {
        setIsPinboardOpen(false);
        soundEngine.playInteract();
        return;
      }
      if (isTvOpen) {
        setIsTvOpen(false);
        soundEngine.playInteract();
        return;
      }
      if (minaActionMenu) {
        setMinaActionMenu(null);
        soundEngine.playInteract();
        return;
      }
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      if (gameState === 'WORKING') {
        setGameState('PLAYING');
        soundEngine.playInteract();
        showMinaBubble('พักเดินยืดเส้นยืดสายก่อนได้เลยครับ');
        return;
      }
      if (playerSeat) {
        setPlayerSeat(null);
        soundEngine.playInteract();
        return;
      }
      if (isFullscreenMap) {
        exitFullscreenMap();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [
    exitFullscreenMap,
    gameState,
    isAiStudioOpen,
    isAntigravityOpen,
    isDriveOpen,
    isFullscreenMap,
    isMailboxOpen,
    isPinboardOpen,
    isSleepLogOpen,
    isTvOpen,
    isVisible,
    minaActionMenu,
    playerSeat,
    showHelp,
    showMinaBubble,
  ]);

  // Global 'F' shortcut to toggle fullscreen full-map view while playing
  useEffect(() => {
    if (!isVisible) return;
    const handleFullscreenKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'f') return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (
        gameState !== 'PLAYING' ||
        isTvOpen ||
        isPinboardOpen ||
        isDriveOpen ||
        isAntigravityOpen ||
        isAiStudioOpen ||
        isMailboxOpen ||
        isSleepLogOpen
      ) {
        return;
      }
      e.preventDefault();
      toggleFullscreenMap();
    };
    window.addEventListener('keydown', handleFullscreenKey);
    return () => window.removeEventListener('keydown', handleFullscreenKey);
  }, [
    gameState,
    isAiStudioOpen,
    isAntigravityOpen,
    isDriveOpen,
    isMailboxOpen,
    isPinboardOpen,
    isSleepLogOpen,
    isTvOpen,
    isVisible,
    toggleFullscreenMap,
  ]);

  const handleStartGame = () => {
    soundEngine.playInteract();
    setGameState('PLAYING');
    showToast(
      'เดินสำรวจห้องพักผ่อน หรือข้ามประตูฝั่งขวาเข้าห้องทำงานไปหามีน่าได้เลยครับ',
      'house'
    );
  };

  const handleZoneChange = useCallback(
    (nextZone: RoomZone) => {
      setZone(nextZone);
      if (nextZone === 'office') {
        soundEngine.playEnterOffice();
        showMinaBubble('สวัสดีครับ เข้ามาแล้วเหรอ!', 3200);
      } else {
        setAssistantMood('idle');
      }
    },
    [showMinaBubble]
  );

  const handleMinaProximityEvent = useCallback(
    (event: 'approached' | 'returning') => {
      if (event === 'approached') {
        soundEngine.playEnterOffice();
        setAssistantMood('greeting');
        showMinaBubble('สวัสดีครับ! มีอะไรให้ช่วยไหม?', 4000);
        window.setTimeout(() => {
          setAssistantMood((curr) => (curr === 'greeting' ? 'idle' : curr));
        }, 2600);
      } else {
        setAssistantMood('idle');
        showMinaBubble('งั้นกลับไปทำงานที่โต๊ะต่อนะครับ', 3200);
      }
    },
    [showMinaBubble]
  );

  const handleAntigravityProximityEvent = useCallback(
    (event: 'approached' | 'returning') => {
      if (event === 'approached') {
        soundEngine.playEnterOffice();
      }
    },
    []
  );

  const handleAiStudioProximityEvent = useCallback(
    (event: 'approached' | 'returning') => {
      if (event === 'approached') {
        soundEngine.playEnterOffice();
      }
    },
    []
  );

  const handleRequestMinaMenu = useCallback((anchor: MinaActionMenuAnchor) => {
    setMinaActionMenu(anchor);
  }, []);

  const handleDismissMinaMenu = useCallback(() => {
    setMinaActionMenu(null);
  }, []);

  const handleSelectMinaSummonMode = useCallback(
    (mode: MinaSummonMode) => {
      setMinaActionMenu(null);
      setPlayerSeat(null);
      soundEngine.playEnterOffice();
      setMinaSummonCommand({ id: Date.now(), mode });

      if (mode === 'walk_then_chat') {
        showMinaBubble('กำลังเดินไปหาครับ รอสักครู่นะ!', 4000);
      } else {
        setGameState('WORKING');
        setAssistantMood('greeting');
        showMinaBubble('เริ่มคุยได้เลยครับ กำลังเดินไปหา!', 3800);
        window.setTimeout(() => {
          setAssistantMood((curr) => (curr === 'greeting' ? 'idle' : curr));
        }, 1800);
      }
    },
    [showMinaBubble]
  );

  const handleMinaSummonArrived = useCallback(
    (mode: MinaSummonMode) => {
      if (mode === 'walk_then_chat') {
        soundEngine.playEnterOffice();
        setPlayerSeat(null);
        setGameState('WORKING');
        setAssistantMood('greeting');
        showMinaBubble('มาถึงแล้วครับ! อยากคุยเรื่องไหนดี?', 3600);
        window.setTimeout(() => {
          setAssistantMood((curr) => (curr === 'greeting' ? 'idle' : curr));
        }, 1800);
      } else {
        setAssistantMood((curr) => {
          if (curr === 'idle') {
            showMinaBubble('เดินมาถึงแล้วครับ พร้อมช่วยงานเต็มที่!', 3200);
          }
          return curr;
        });
      }
    },
    [showMinaBubble]
  );

  const handleInteract = useCallback(
    (id: InteractableId) => {
      setMinaActionMenu(null);

      if (id === 'mina_desk') {
        soundEngine.playEnterOffice();
        setPlayerSeat(null);
        setGameState('WORKING');
        setAssistantMood('greeting');
        showMinaBubble('พร้อมคุยงานครับ อยากเริ่มเรื่องไหนดี?', 3600);
        window.setTimeout(() => {
          setAssistantMood((curr) => (curr === 'greeting' ? 'idle' : curr));
        }, 1600);
        return;
      }

      if (id === 'workdesk') {
        soundEngine.playInteract();
        setPlayerSeat((curr) => {
          const next = curr === 'workdesk' ? null : 'workdesk';
          if (next === 'workdesk') {
            showToast('นั่งหน้าคอมพิวเตอร์ที่โต๊ะทำงานส่วนตัวแล้วครับ (กด WASD / E / Esc เพื่อลุก)', 'player');
          }
          return next;
        });
        return;
      }

      if (id === 'coffee') {
        soundEngine.playCoffeeSip();
        showToast('จิบกาแฟอุ่นๆ หอมกรุ่น เติมความสดชื่นก่อนเริ่มทำงานแล้วครับ', 'player');
        return;
      }

      if (id === 'sofa') {
        soundEngine.playInteract();
        setPlayerSeat((curr) => {
          const next = curr === 'sofa' ? null : 'sofa';
          if (next === 'sofa') {
            showToast('เอนหลังนั่งพักผ่อนบนโซฟาห้องนั่งเล่นแล้วครับ (คลิกทีวีดู YouTube หรือกด WASD เพื่อลุก)', 'player');
          }
          return next;
        });
        return;
      }

      if (id === 'window') {
        soundEngine.playInteract();
        setTimeOfDay((prev) => {
          const next: TimeOfDay =
            prev === 'morning'
              ? 'afternoon'
              : prev === 'afternoon'
                ? 'evening'
                : 'morning';
          const label =
            next === 'morning'
              ? 'เปลี่ยนเป็นแสงยามเช้าสดใสแล้วครับ'
              : next === 'afternoon'
                ? 'เปลี่ยนเป็นแสงบ่ายอุ่นๆ แล้วครับ'
                : 'เปลี่ยนเป็นบรรยากาศยามค่ำพร้อมแสงโคมไฟแล้วครับ';
          showToast(label, 'house');
          return next;
        });
        return;
      }

      if (id === 'bookshelf') {
        soundEngine.playInteract();
        const tip = BOOKSHELF_TIPS[tipIndex % BOOKSHELF_TIPS.length];
        setTipIndex((i) => i + 1);
        showToast(tip, 'house');
        return;
      }

      if (id === 'clock') {
        soundEngine.playEnterOffice();
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        showToast(`นาฬิกาลูกตุ้มคลาสสิกบอกเวลา ${hh}:${mm} น. — เสียงลูกตุ้มแกว่งนุ่มนวลสบายหู`, 'house');
        return;
      }

      if (id === 'tv') {
        soundEngine.playInteract();
        setIsTvOpen(true);
        return;
      }

      if (id === 'pinboard') {
        soundEngine.playInteract();
        setIsPinboardOpen(true);
        return;
      }

      if (id === 'drive_table') {
        soundEngine.playInteract();
        setIsDriveOpen(true);
        return;
      }

      if (id === 'antigravity_desk') {
        soundEngine.playEnterOffice();
        setIsAntigravityOpen(true);
        return;
      }

      if (id === 'ai_studio_desk') {
        soundEngine.playEnterOffice();
        setIsAiStudioOpen(true);
        return;
      }

      if (isDiningChairSeatId(id)) {
        soundEngine.playInteract();
        const seatPositionLabel: Record<typeof id, string> = {
          dining_chair_nw: 'ฝั่งบนซ้าย',
          dining_chair_ne: 'ฝั่งบนขวา',
          dining_chair_sw: 'ฝั่งล่างซ้าย',
          dining_chair_se: 'ฝั่งล่างขวา',
        };
        setPlayerSeat((curr) => {
          const next = curr === id ? null : id;
          if (next === id) {
            showToast(
              `นั่งเก้าอี้โต๊ะอาหาร (${seatPositionLabel[id]}) พร้อมหน้าฉลองมื้อไก่งวงคริสต์มาสวันครอบครัวอบอุ่นแล้วครับ (กด WASD / E / Esc เพื่อลุก)`,
              'player'
            );
          }
          return next;
        });
        return;
      }

      if (id === 'mailbox') {
        soundEngine.playInteract();
        setGmailFreshArrival(false);
        setIsMailboxOpen(true);
        return;
      }

      if (id === 'sleep_log') {
        soundEngine.playInteract();
        setIsSleepLogOpen(true);
        return;
      }

      if (id === 'bedroom_bed') {
        soundEngine.playInteract();
        setPlayerSeat((curr) => {
          const next = curr === 'bedroom_bed' ? null : 'bedroom_bed';
          if (next === 'bedroom_bed') {
            showToast(
              'ปิดไฟห้องนอนและเอนตัวลงนอนแล้วครับ — วิวนอกหน้าต่างเปลี่ยนเป็นตอนกลางคืนอัตโนมัติ (กด WASD / E / Esc เพื่อตื่น)',
              'player'
            );
          }
          return next;
        });
        return;
      }

      if (id === 'green_car') {
        setPlayerSeat((curr) => {
          const next = curr === 'green_car' ? null : 'green_car';
          if (next === 'green_car') {
            soundEngine.playCarIgnition();
            showToast(
              'สตาร์ทรถคันสีเขียวแล้วครับ — W/S เดินหน้า–ถอยหลัง · A/D เลี้ยว · Space เบรก · H บีบแตร · E ลงจากรถ',
              'player'
            );
          } else {
            soundEngine.playInteract();
          }
          return next;
        });
        return;
      }

      if (id === 'porch_plants') {
        handleWaterPorchPlants();
        return;
      }

      if (id === 'dining_table') {
        soundEngine.playCoffeeSip();
        showToast(
          'ไก่งวงอบคริสต์มาสตัวใหญ่สีทองหอมกรุ่นกลางโต๊ะ สัญลักษณ์แห่งวันครอบครัวแสนอบอุ่น! (คลิกที่เก้าอี้ทั้ง 4 ตัวเพื่อนั่งทานได้เลย)',
          'player'
        );
      }
    },
    [handleWaterPorchPlants, showMinaBubble, showToast, tipIndex]
  );

  const handleCarWrapHome = useCallback(
    (_direction: 'left' | 'right') => {
      soundEngine.playEnterOffice();
      showToast('ขับวนรอบหมู่บ้านกลับมาถึงหน้าบ้านแล้วครับ!', 'player');
    },
    [showToast]
  );

  const handleAddCustomTvItem = ({
    title,
    channel,
    videoId,
  }: {
    title: string;
    channel: string;
    videoId: string;
  }) => {
    const newItem: TvFeedItem = {
      id: `custom-${Date.now()}`,
      title,
      channel,
      category: 'รายการของฉัน',
      videoId,
      isCustom: true,
    };
    setCustomTvFeed((prev) => [newItem, ...prev]);
    setActiveTvItem(newItem);
    soundEngine.playInteract();
  };

  const handleDeleteCustomTvItem = (id: string) => {
    setCustomTvFeed((prev) => prev.filter((item) => item.id !== id));
    setActiveTvItem((curr) => (curr?.id === id ? null : curr));
  };

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    setGoogleAuthError(null);
    try {
      const { user, accessToken } = await signInWithGoogleForYouTube();
      setGoogleUser(user);
      setYoutubeToken(accessToken);
      setGmailScopeMissing(false);
      soundEngine.playInteract();
      showToast(
        `เชื่อมต่อบัญชี Google (${user.displayName || user.email || 'Google'}) สำหรับ Gmail, Drive, Tasks และ YouTube เรียบร้อยแล้วครับ`,
        'house'
      );
    } catch (err) {
      const errCode = (err as { code?: string })?.code ?? '';
      if (errCode === 'auth/popup-closed-by-user') {
        setGoogleAuthError('ยกเลิกหน้าต่างเข้าสู่ระบบ Google แล้ว สามารถกดเชื่อมต่อใหม่ได้ทุกเมื่อ');
      } else if (errCode === 'auth/popup-blocked') {
        setGoogleAuthError('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปแล้วลองกด Sign in with Google อีกครั้ง');
      } else {
        setGoogleAuthError(
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเข้าสู่ระบบ Google ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
        );
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutGoogle();
    } finally {
      setGoogleUser(null);
      setYoutubeToken(null);
      setGoogleAuthError(null);
      setGmailUnreadTotal(0);
      setGmailScopeMissing(false);
      setGmailFreshArrival(false);
      setLocallyReadMailIds(new Set());
      setLocallyReadUnreadIds(new Set());
      knownGmailUnreadIdsRef.current = new Set();
      hasPolledGmailOnceRef.current = false;
      soundEngine.playInteract();
    }
  };

  const handleRequestDriveWriteAccess = async (): Promise<boolean> => {
    setIsSigningInGoogle(true);
    setGoogleAuthError(null);
    try {
      const { user, accessToken } = await requestGoogleDriveWriteAccess();
      setGoogleUser(user);
      setYoutubeToken(accessToken);
      soundEngine.playInteract();
      showToast('ได้รับสิทธิ์บันทึกไฟล์ลง Google Drive แล้วครับ', 'house');
      return true;
    } catch (err) {
      setGoogleAuthError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถขอสิทธิ์เขียน Google Drive ได้ (อาจถูกจำกัดโดย OAuth Client ของโปรเจกต์)'
      );
      return false;
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleYouTubeTokenExpired = useCallback(() => {
    clearYouTubeAccessToken();
    setYoutubeToken(null);
    setSyncedTaskLists(null);
    setTasksSyncError(null);
    setGmailUnreadTotal(0);
    setGmailFreshArrival(false);
    setMinaReadyReviewCount(0);
    knownGmailUnreadIdsRef.current = new Set();
    hasPolledGmailOnceRef.current = false;
  }, []);

  // Scheduled Google Tasks executor across Mina / Antigravity / AI Studio (walks to player & delivers in chat)
  const [runningMinaTaskIds, setRunningMinaTaskIds] = useState<string[]>([]);
  const [tasksBoardRefreshNonce, setTasksBoardRefreshNonce] = useState(0);
  const [minaReadyReviewCount, setMinaReadyReviewCount] = useState(0);
  const runningMinaTaskIdsRef = useRef<Set<string>>(new Set());
  const isScanningMinaTasksRef = useRef(false);
  const pendingDeliveriesRef = useRef<AssistantTaskDelivery[]>([]);
  const inFlightDeliveryRef = useRef<AssistantTaskDelivery | null>(null);
  const uiBlockersRef = useRef({
    gameState,
    isTvOpen,
    isDriveOpen,
    isMailboxOpen,
    isSleepLogOpen,
    isAntigravityOpen,
    isAiStudioOpen,
    isPinboardOpen,
  });
  uiBlockersRef.current = {
    gameState,
    isTvOpen,
    isDriveOpen,
    isMailboxOpen,
    isSleepLogOpen,
    isAntigravityOpen,
    isAiStudioOpen,
    isPinboardOpen,
  };

  return {
    enterFullscreenMap,
    exitFullscreenMap,
    toggleFullscreenMap,
    handleStartGame,
    handleZoneChange,
    handleMinaProximityEvent,
    handleAntigravityProximityEvent,
    handleAiStudioProximityEvent,
    handleRequestMinaMenu,
    handleDismissMinaMenu,
    handleSelectMinaSummonMode,
    handleMinaSummonArrived,
    handleInteract,
    handleCarWrapHome,
    handleAddCustomTvItem,
    handleDeleteCustomTvItem,
    handleGoogleSignIn,
    handleGoogleSignOut,
    handleRequestDriveWriteAccess,
    handleYouTubeTokenExpired,
    runningMinaTaskIds,
    setRunningMinaTaskIds,
    tasksBoardRefreshNonce,
    setTasksBoardRefreshNonce,
    minaReadyReviewCount,
    setMinaReadyReviewCount,
    runningMinaTaskIdsRef,
    isScanningMinaTasksRef,
    pendingDeliveriesRef,
    inFlightDeliveryRef,
    uiBlockersRef,
  };
}

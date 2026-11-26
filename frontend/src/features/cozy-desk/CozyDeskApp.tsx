import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Footprints, MessageSquare } from 'lucide-react';
import type { CharacterTaskActivityUpdate } from './components/AiStudioModal';
import { GameCanvas } from './components/GameCanvas';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import { WorkspacePanel } from './components/WorkspacePanel';
import { CAMERA_DEFAULT_ZOOM } from './game/houseMap';
import type {
  AssistantDeliveryWalkCommand,
  AssistantMood,
  AssistantTaskDelivery,
  CameraCommand,
  CameraUiState,
  CharacterId,
  CharacterStatusMap,
  ChatMessage,
  DailySleepRecord,
  DrivingHudState,
  GameState,
  InteractableObject,
  MinaActionMenuAnchor,
  MinaPinMission,
  MinaSummonCommand,
  PlayerSeatId,
  RoomZone,
  SavedDraft,
  TimeOfDay,
  TvFeedItem,
  WorkMode,
  WorldToast,
} from './types/game';
import { loadLocalSleepLogs } from './api/sleepLogsApi';
import { getYouTubeAccessToken } from './api/youtubeAuth';
import { soundEngine } from './lib/sound';
import type { GoogleTaskListWithTasks } from './api/tasksApi';
import {
  DEFAULT_TV_FEED,
  loadStorage,
  STORAGE_DRAFTS_KEY,
  STORAGE_MESSAGES_KEY,
  STORAGE_TV_FEED_KEY,
} from './lib/cozyDeskDefaults';
import {
  CozyBottomActionBar,
  CozyCameraToolbar,
  CozyFullscreenOverlays,
  CozyWorldToastAndHelp,
} from './components/CozyViewportChrome';
import { CozyModalsLayer } from './components/CozyModalsLayer';
import { useCozyQuestsAndStatuses } from './hooks/useCozyQuestsAndStatuses';
import { useCozyWorldInteractions } from './hooks/useCozyWorldInteractions';
import { useCozyTaskDeliveryAndScheduler } from './hooks/useCozyTaskDeliveryAndScheduler';
import { useCozyAssistantStreaming } from './hooks/useCozyAssistantStreaming';
import {
  useGrandfatherClockActivities,
  type ActivityModeCategory,
  type ActivityModeEvent,
} from './hooks/useGrandfatherClockActivities';

export interface CozyDeskAppProps {
  isVisible?: boolean;
  firebaseUser?: User | null;
  activities?: ActivityModeEvent[];
  archivedActivityIds?: Set<string>;
  categories?: ActivityModeCategory[];
  activityCategoryMap?: Record<string, string>;
  calendarAccessToken?: string | null;
  onSwitchToActivityMode?: () => void;
  navigationExpanded?: boolean;
  onToggleNavigation?: () => void;
}

export default function CozyDeskApp({
  isVisible = true,
  firebaseUser = null,
  activities = [],
  archivedActivityIds,
  categories,
  activityCategoryMap,
  calendarAccessToken = null,
  onSwitchToActivityMode,
  navigationExpanded = false,
  onToggleNavigation,
}: CozyDeskAppProps) {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [zone, setZone] = useState<RoomZone>('living');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('afternoon');
  const [muted, setMuted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);

  const [nearestInteractable, setNearestInteractable] =
    useState<InteractableObject | null>(null);
  const [playerSeat, setPlayerSeat] = useState<PlayerSeatId | null>(null);
  const [drivingHud, setDrivingHud] = useState<DrivingHudState | null>(null);
  const [workoutReps, setWorkoutReps] = useState(0);
  const [assistantMood, setAssistantMood] = useState<AssistantMood>('idle');
  const [minaBubbleText, setMinaBubbleText] = useState<string | null>(null);
  const [minaMission, setMinaMission] = useState<MinaPinMission | null>(null);
  const [minaActionMenu, setMinaActionMenu] = useState<MinaActionMenuAnchor | null>(null);
  const [minaSummonCommand, setMinaSummonCommand] = useState<MinaSummonCommand | null>(null);
  const [deliveryWalkCommand, setDeliveryWalkCommand] =
    useState<AssistantDeliveryWalkCommand | null>(null);
  const [deliveredChatTaskAgy, setDeliveredChatTaskAgy] =
    useState<AssistantTaskDelivery | null>(null);
  const [deliveredChatTaskAiStudio, setDeliveredChatTaskAiStudio] =
    useState<AssistantTaskDelivery | null>(null);
  const [saveToDriveRequest, setSaveToDriveRequest] = useState<{
    content: string;
    title?: string;
    assistantName: string;
  } | null>(null);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  const [cameraUi, setCameraUi] = useState<CameraUiState>({
    zoomPercent: Math.round(CAMERA_DEFAULT_ZOOM * 100),
    focusMode: 'follow',
    activePreset: 'follow',
  });
  const [extraPinCount, setExtraPinCount] = useState(0);
  const [toast, setToast] = useState<WorldToast | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  // Living room YouTube TV, Office Google Tasks Pinboard, Drive Table, Antigravity, Google AI Studio, Roadside Mailbox & Bedroom Sleep Quest modal states
  const [isTvOpen, setIsTvOpen] = useState(false);
  const [isPinboardOpen, setIsPinboardOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isAntigravityOpen, setIsAntigravityOpen] = useState(false);
  const [isAiStudioOpen, setIsAiStudioOpen] = useState(false);
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);
  const [isSleepLogOpen, setIsSleepLogOpen] = useState(false);
  const [sleepLogs, setSleepLogs] = useState<DailySleepRecord[]>(() =>
    loadLocalSleepLogs()
  );
  const [serverCharacterStatuses, setServerCharacterStatuses] =
    useState<CharacterStatusMap | null>(null);
  const [clientCharacterActivities, setClientCharacterActivities] = useState<
    Record<CharacterId, CharacterTaskActivityUpdate>
  >({
    mina: { busy: false, taskLabel: null },
    antigravity: { busy: false, taskLabel: null },
    ai_studio: { busy: false, taskLabel: null },
  });
  const [customTvFeed, setCustomTvFeed] = useState<TvFeedItem[]>(() =>
    loadStorage<TvFeedItem[]>(STORAGE_TV_FEED_KEY, [])
  );
  const allTvFeed = [...customTvFeed, ...DEFAULT_TV_FEED];
  const [activeTvItem, setActiveTvItem] = useState<TvFeedItem | null>(null);

  // Google Auth for personalized YouTube feed, Google Tasks, Google Drive & Gmail (persisted per uid until expiry)
  const [googleUser, setGoogleUser] = useState<User | null>(firebaseUser);
  const [youtubeToken, setYoutubeToken] = useState<string | null>(() =>
    getYouTubeAccessToken(firebaseUser?.uid)
  );
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [syncedTaskLists, setSyncedTaskLists] = useState<GoogleTaskListWithTasks[] | null>(null);
  const [isSyncingTasks, setIsSyncingTasks] = useState(false);
  const [tasksSyncError, setTasksSyncError] = useState<string | null>(null);

  // Live Gmail Roadside Mailbox notification state
  const [gmailUnreadTotal, setGmailUnreadTotal] = useState(0);
  const [gmailScopeMissing, setGmailScopeMissing] = useState(false);
  const [locallyReadMailIds, setLocallyReadMailIds] = useState<Set<string>>(() => new Set());
  const [locallyReadUnreadIds, setLocallyReadUnreadIds] = useState<Set<string>>(() => new Set());
  const [suppressedUnreadBaseline, setSuppressedUnreadBaseline] = useState<number | null>(null);
  const [gmailFreshArrival, setGmailFreshArrival] = useState(false);
  const knownGmailUnreadIdsRef = useRef<Set<string>>(new Set());
  const hasPolledGmailOnceRef = useRef(false);
  const freshArrivalTimerRef = useRef<number | null>(null);

  // Workspace state persisted in localStorage
  const [workMode, setWorkMode] = useState<WorkMode>('qa');
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadStorage<ChatMessage[]>(STORAGE_MESSAGES_KEY, []).map((m) =>
      m.taskProposal?.status === 'saving'
        ? { ...m, taskProposal: { ...m.taskProposal, status: 'pending' } }
        : m
    )
  );
  const [drafts, setDrafts] = useState<SavedDraft[]>(() =>
    loadStorage<SavedDraft[]>(STORAGE_DRAFTS_KEY, [])
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const appRootRef = useRef<HTMLDivElement | null>(null);
  const enteredNativeFullscreenRef = useRef(false);

  const {
    fetchCharacterStatuses, handleUpdateCharacterActivity, characterStatuses, showToast, showMinaBubble,
    todayIsoDate, plantWateringTriggerId, hasLoggedTodaySleep, todaySleepSummary, hasWateredPlantsToday,
    todayPlantWaterLabel, handleWaterPorchPlants, handleSaveSleepLog, handleSaveSleepLogsBatch, handleDeleteSleepLog,
  } = useCozyQuestsAndStatuses({
    messages, drafts, customTvFeed, firebaseUser, setGoogleUser, setYoutubeToken, serverCharacterStatuses,
    setServerCharacterStatuses, clientCharacterActivities, setClientCharacterActivities, assistantMood,
    minaMission, toastTimerRef, setToast, bubbleTimerRef, setMinaBubbleText, sleepLogs, setSleepLogs, gameState,
  });

  const {
    nowMs: clockNowMs, activeClockAnnouncement, completeClockAnnouncement, todayActivities, upcomingWeekActivities,
    ongoingActivity, lastStartedTodayActivity, nextActivityCountdown, isClockScheduleOpen, setIsClockScheduleOpen,
    openClockSchedule, closeClockSchedule, handleInteractClock, triggerActivityPreviewChime,
    refreshTodayActivities, isSyncingTodayActivities,
  } = useGrandfatherClockActivities({
    activities, archivedActivityIds, categories, activityCategoryMap, calendarAccessToken, isVisible, gameState, showToast,
  });

  const {
    enterFullscreenMap, exitFullscreenMap, toggleFullscreenMap, handleStartGame, handleZoneChange,
    handleMinaProximityEvent, handleAntigravityProximityEvent, handleAiStudioProximityEvent, handleRequestMinaMenu,
    handleDismissMinaMenu, handleSelectMinaSummonMode, handleMinaSummonArrived, handleInteract, handleCarWrapHome,
    handleAddCustomTvItem, handleDeleteCustomTvItem, handleGoogleSignIn, handleGoogleSignOut,
    handleRequestDriveWriteAccess, handleYouTubeTokenExpired, runningMinaTaskIds, setRunningMinaTaskIds,
    tasksBoardRefreshNonce, setTasksBoardRefreshNonce, minaReadyReviewCount, setMinaReadyReviewCount,
    runningMinaTaskIdsRef, isScanningMinaTasksRef, pendingDeliveriesRef, inFlightDeliveryRef, uiBlockersRef,
  } = useCozyWorldInteractions({
    appRootRef, enteredNativeFullscreenRef, isFullscreenMap, setIsFullscreenMap, showHelp, setShowHelp, isVisible,
    isClockScheduleOpen, setIsClockScheduleOpen, isSleepLogOpen, setIsSleepLogOpen, isMailboxOpen, setIsMailboxOpen,
    isAiStudioOpen, setIsAiStudioOpen, isAntigravityOpen, setIsAntigravityOpen, isDriveOpen, setIsDriveOpen,
    isPinboardOpen, setIsPinboardOpen, isTvOpen, setIsTvOpen, minaActionMenu, setMinaActionMenu, gameState,
    setGameState, playerSeat, setPlayerSeat, showMinaBubble, showToast, setZone, setAssistantMood,
    setMinaSummonCommand, setTimeOfDay, tipIndex, setTipIndex, setGmailFreshArrival, handleWaterPorchPlants,
    handleInteractClock, setCustomTvFeed, setActiveTvItem, setIsSigningInGoogle, setGoogleAuthError, setGoogleUser,
    setYoutubeToken, setGmailScopeMissing, firebaseUser, setSyncedTaskLists, setTasksSyncError, setGmailUnreadTotal,
    setLocallyReadMailIds, setLocallyReadUnreadIds, setSuppressedUnreadBaseline, knownGmailUnreadIdsRef, hasPolledGmailOnceRef,
  });

  const {
    handleAssistantDeliveryArrived,
    handleOpenAssistantChatFromPinboard,
    executeMinaScheduledTask,
    handleAskMinaAnalyzeSleep,
    scanAndRunDueMinaTasks,
  } = useCozyTaskDeliveryAndScheduler({
    setPlayerSeat,
    setMinaActionMenu,
    setMessages,
    workMode,
    setGameState,
    setAssistantMood,
    showMinaBubble,
    setDeliveredChatTaskAgy,
    setIsAntigravityOpen,
    setDeliveredChatTaskAiStudio,
    setIsAiStudioOpen,
    inFlightDeliveryRef,
    pendingDeliveriesRef,
    uiBlockersRef,
    setIsPinboardOpen,
    showToast,
    setDeliveryWalkCommand,
    isTvOpen,
    isDriveOpen,
    isMailboxOpen,
    isSleepLogOpen,
    isAntigravityOpen,
    isAiStudioOpen,
    gameState,
    setMinaSummonCommand,
    youtubeToken,
    runningMinaTaskIdsRef,
    setRunningMinaTaskIds,
    syncedTaskLists,
    todayIsoDate,
    timeOfDay,
    sleepLogs,
    setSyncedTaskLists,
    setMinaReadyReviewCount,
    setTasksBoardRefreshNonce,
    fetchCharacterStatuses,
    handleYouTubeTokenExpired,
    setIsSleepLogOpen,
    handleUpdateCharacterActivity,
    googleUser,
    isScanningMinaTasksRef,
    setTasksSyncError,
  });

  const {
    syncGmailUnreadStatus,
    handleMarkMailRead,
    handleMarkAllMailRead,
    effectiveMailboxUnreadCount,
    syncGoogleTasksForMina,
    minaTasksSummary,
    handleToggleWorkspace,
    handleToggleMute,
    handleConfirmChatTask,
    handleCancelChatTask,
    handleMinaMissionEvent,
    handleSendMessage,
    handleRetryLast,
    handleClearChat,
    handleSaveDraft,
    handleDeleteDraft,
  } = useCozyAssistantStreaming({
    youtubeToken,
    setGmailUnreadTotal,
    setGmailFreshArrival,
    setGmailScopeMissing,
    knownGmailUnreadIdsRef,
    hasPolledGmailOnceRef,
    freshArrivalTimerRef,
    showToast,
    handleYouTubeTokenExpired,
    gmailScopeMissing,
    setLocallyReadMailIds,
    setLocallyReadUnreadIds,
    gmailUnreadTotal,
    locallyReadUnreadIds,
    suppressedUnreadBaseline,
    setSuppressedUnreadBaseline,
    setSyncedTaskLists,
    setTasksSyncError,
    setIsSyncingTasks,
    gameState,
    syncedTaskLists,
    setGameState,
    showMinaBubble,
    muted,
    setMuted,
    abortControllerRef,
    setMessages,
    setIsStreaming,
    setApiError,
    setAssistantMood,
    handleUpdateCharacterActivity,
    timeOfDay,
    sleepLogs,
    fetchCharacterStatuses,
    todayIsoDate,
    setMinaMission,
    scanAndRunDueMinaTasks,
    setExtraPinCount,
    messages,
    workMode,
    isStreaming,
    setDrafts,
  });

  // Sync soundEngine mute state when Cozy Desk mode visibility changes
  useEffect(() => {
    if (!isVisible) {
      soundEngine.setMuted(true);
    } else {
      soundEngine.setMuted(muted);
    }
  }, [isVisible, muted]);

  if (gameState === 'TITLE_MENU') {
    return (
      <div className="cozy-desk-mode flex h-full w-full flex-col overflow-hidden bg-[#1C1917] text-[#F5EFE6]">
        <TitleScreen
          onStart={handleStartGame}
          navigationExpanded={navigationExpanded}
          onToggleNavigation={onToggleNavigation}
        />
      </div>
    );
  }

  const isWorking = gameState === 'WORKING';

  return (
    <div
      ref={appRootRef}
      className="cozy-desk-mode flex h-full w-full flex-col overflow-hidden bg-[#1C1917] text-[#F5EFE6]"
    >
      {!isFullscreenMap && (
        <TopHud
          zone={zone}
          gameState={gameState}
          timeOfDay={timeOfDay}
          muted={muted}
          showHelp={showHelp}
          navigationExpanded={navigationExpanded}
          onToggleNavigation={onToggleNavigation}
          hasLoggedTodaySleep={hasLoggedTodaySleep}
          todaySleepLabel={todaySleepSummary?.hudLabel ?? null}
          onOpenSleepQuest={() => {
            soundEngine.playInteract();
            setIsSleepLogOpen(true);
          }}
          hasWateredPlantsToday={hasWateredPlantsToday}
          todayPlantWaterLabel={todayPlantWaterLabel}
          onFocusPlantQuest={() => {
            soundEngine.playInteract();
            setCameraCommand({ id: Date.now(), type: 'preset', preset: 'entryway' });
            showToast(
              hasWateredPlantsToday
                ? `รดน้ำกระถางต้นไม้ทั้ง 5 ต้นเรียบร้อยแล้ววันนี้ (${todayPlantWaterLabel ?? 'สำเร็จ'}) · รีเซ็ตอัตโนมัติตอนเที่ยงคืน 00:00 น.`
                : 'ภารกิจประจำวัน: คลิกที่กระถางต้นไม้ 5 ต้นตรงระเบียงโถงทางเข้า หรือเดินไปกด E เพื่อรดน้ำได้เลยครับ',
              'house'
            );
          }}
          minaReadyReviewCount={minaReadyReviewCount}
          onOpenMinaReviewTasks={() => {
            soundEngine.playInteract();
            setIsPinboardOpen(true);
          }}
          onChangeTimeOfDay={(tod) => {
            soundEngine.playInteract();
            setTimeOfDay(tod);
          }}
          onToggleMute={handleToggleMute}
          onToggleHelp={() => setShowHelp((s) => !s)}
          onToggleWorkspace={handleToggleWorkspace}
          onToggleFullscreenMap={toggleFullscreenMap}
        />
      )}

      {/* Main Split Stage: 2D Pixel House + Slide-in Home Office AI Workspace */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left/Center: 2D Pixel Art House Viewport */}
        <main
          className={`relative flex min-h-0 flex-1 flex-col items-center justify-center ${
            isFullscreenMap ? 'p-0' : 'p-2 sm:p-3'
          }`}
        >
          <div className="relative flex h-full w-full flex-col items-center justify-center">
            {!isFullscreenMap && (
              <CozyCameraToolbar
                cameraUi={cameraUi}
                onCommand={setCameraCommand}
                onEnterFullscreen={enterFullscreenMap}
              />
            )}

            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
              <div className="relative h-full w-full">
                <GameCanvas
                  gameState={gameState}
                  playerSeat={playerSeat}
                  timeOfDay={timeOfDay}
                  assistantMood={assistantMood}
                  minaBubbleText={minaBubbleText}
                  minaMission={minaMission}
                  minaSummonCommand={minaSummonCommand}
                  deliveryWalkCommand={deliveryWalkCommand}
                  cameraCommand={cameraCommand}
                  isMinaMenuOpen={Boolean(minaActionMenu)}
                  extraPinCount={extraPinCount}
                  isTvOn={isTvOpen}
                  isDriveOpen={isDriveOpen}
                  isAntigravityOpen={isAntigravityOpen}
                  isAiStudioOpen={isAiStudioOpen}
                  isMailboxOpen={isMailboxOpen}
                  isSleepLogOpen={isSleepLogOpen}
                  hasLoggedTodaySleep={hasLoggedTodaySleep}
                  todaySleepLabel={todaySleepSummary?.canvasLabel ?? null}
                  hasWateredPlantsToday={hasWateredPlantsToday}
                  todayPlantWaterLabel={todayPlantWaterLabel}
                  plantWateringTriggerId={plantWateringTriggerId}
                  mailboxUnreadCount={effectiveMailboxUnreadCount}
                  mailboxFreshArrival={gmailFreshArrival}
                  characterStatuses={characterStatuses}
                  clockAnnouncement={activeClockAnnouncement}
                  clockCountdown={
                    nextActivityCountdown
                      ? {
                          title: nextActivityCountdown.activity.title,
                          startTimeLabel: nextActivityCountdown.activity.startTimeLabel,
                          hmsLabel: nextActivityCountdown.hmsLabel,
                        }
                      : null
                  }
                  isModalOpen={
                    !isVisible ||
                    isTvOpen ||
                    isPinboardOpen ||
                    isDriveOpen ||
                    isAntigravityOpen ||
                    isAiStudioOpen ||
                    isMailboxOpen ||
                    isSleepLogOpen ||
                    isClockScheduleOpen ||
                    Boolean(saveToDriveRequest)
                  }
                  isFullscreenMap={isFullscreenMap}
                  onZoneChange={handleZoneChange}
                  onNearestChange={setNearestInteractable}
                  onInteract={handleInteract}
                  onStandUp={() => setPlayerSeat(null)}
                  onRequestMinaMenu={handleRequestMinaMenu}
                  onDismissMinaMenu={handleDismissMinaMenu}
                  onMinaSummonArrived={handleMinaSummonArrived}
                  onAssistantDeliveryArrived={handleAssistantDeliveryArrived}
                  onMinaMissionEvent={handleMinaMissionEvent}
                  onMinaProximityEvent={handleMinaProximityEvent}
                  onAntigravityProximityEvent={handleAntigravityProximityEvent}
                  onAiStudioProximityEvent={handleAiStudioProximityEvent}
                  onCameraChange={setCameraUi}
                  onCarWrapHome={handleCarWrapHome}
                  onDrivingHudChange={setDrivingHud}
                  onWorkoutRepsChange={setWorkoutReps}
                />

                {/* Minimal 2-button floating chooser when clicking Mina at her computer desk */}
                {minaActionMenu &&
                  !isWorking &&
                  !isTvOpen &&
                  !isPinboardOpen &&
                  !isDriveOpen &&
                  !isAntigravityOpen &&
                  !isAiStudioOpen &&
                  !isMailboxOpen &&
                  !isSleepLogOpen && (
                  <div
                    role="menu"
                    aria-label="เลือกวิธีเริ่มสนทนากับมีน่า"
                    style={{
                      left: `${Math.round(Math.max(12, Math.min(76, minaActionMenu.normX * 100 - 12)))}%`,
                      top: `${Math.round(minaActionMenu.normY * 100)}%`,
                    }}
                    className="absolute z-20 flex -translate-y-1/2 flex-col gap-1.5 rounded-lg border border-[#54453A] bg-[#241E1A]/95 p-1.5 shadow-xl backdrop-blur-xs"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectMinaSummonMode('walk_then_chat')}
                      className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-[#473B32] bg-[#2E2620] px-3 py-1.5 text-xs font-medium text-[#FAF6F0] transition-colors hover:border-[#D97736] hover:bg-[#3A2E25]"
                    >
                      <Footprints className="h-3.5 w-3.5 shrink-0 text-[#E5985B]" />
                      <span>เดินมาหาแล้วคุย</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectMinaSummonMode('chat_then_walk')}
                      className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-[#473B32] bg-[#2E2620] px-3 py-1.5 text-xs font-medium text-[#FAF6F0] transition-colors hover:border-[#6B9080] hover:bg-[#2B332F]"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#8CB8A5]" />
                      <span>เริ่มคุยทันที</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!isFullscreenMap && (
              <CozyBottomActionBar
                isWorking={isWorking}
                playerSeat={playerSeat}
                drivingHud={drivingHud}
                workoutReps={workoutReps}
                nearestInteractable={nearestInteractable}
                effectiveMailboxUnreadCount={effectiveMailboxUnreadCount}
                hasLoggedTodaySleep={hasLoggedTodaySleep}
                todaySleepHudLabel={todaySleepSummary?.hudLabel ?? null}
                hasWateredPlantsToday={hasWateredPlantsToday}
                todayPlantWaterLabel={todayPlantWaterLabel}
                zone={zone}
                onClearSeat={() => setPlayerSeat(null)}
                onInteract={handleInteract}
              />
            )}
          </div>

          {isFullscreenMap && (
            <CozyFullscreenOverlays
              isWorking={isWorking}
              playerSeat={playerSeat}
              drivingHud={drivingHud}
              workoutReps={workoutReps}
              nearestInteractable={nearestInteractable}
              effectiveMailboxUnreadCount={effectiveMailboxUnreadCount}
              hasLoggedTodaySleep={hasLoggedTodaySleep}
              todaySleepHudLabel={todaySleepSummary?.hudLabel ?? null}
              hasWateredPlantsToday={hasWateredPlantsToday}
              todayPlantWaterLabel={todayPlantWaterLabel}
              onExitFullscreen={exitFullscreenMap}
              onClearSeat={() => setPlayerSeat(null)}
              onInteract={handleInteract}
            />
          )}

          <CozyWorldToastAndHelp
            toast={toast}
            showHelp={showHelp}
            onCloseHelp={() => setShowHelp(false)}
          />
        </main>

        {/* Right: Home Office Gemini Workspace Drawer */}
        {isWorking && (
          <div className="h-[58vh] w-full shrink-0 lg:h-full lg:w-[440px] xl:w-[480px]">
            <WorkspacePanel
              messages={messages}
              drafts={drafts}
              workMode={workMode}
              assistantMood={assistantMood}
              isStreaming={isStreaming}
              error={apiError}
              googleUser={googleUser}
              accessToken={youtubeToken}
              isSigningInGoogle={isSigningInGoogle}
              googleAuthError={googleAuthError}
              tasksSummary={minaTasksSummary}
              isSyncingTasks={isSyncingTasks}
              tasksSyncError={tasksSyncError}
              onSyncTasks={() => void syncGoogleTasksForMina()}
              onGoogleSignIn={() => void handleGoogleSignIn()}
              onChangeWorkMode={setWorkMode}
              onSendMessage={handleSendMessage}
              onRetryLast={handleRetryLast}
              onClearChat={handleClearChat}
              onSaveDraft={handleSaveDraft}
              onDeleteDraft={handleDeleteDraft}
              onConfirmChatTask={handleConfirmChatTask}
              onCancelChatTask={handleCancelChatTask}
              onSaveToDrive={(payload) => {
                soundEngine.playInteract();
                setSaveToDriveRequest(payload);
              }}
              onOpenPinboard={() => {
                soundEngine.playInteract();
                setIsPinboardOpen(true);
              }}
              onCloseWorkspace={handleToggleWorkspace}
            />
          </div>
        )}
      </div>
      <CozyModalsLayer
        isTvOpen={isTvOpen}
        setIsTvOpen={setIsTvOpen}
        allTvFeed={allTvFeed}
        activeTvItem={activeTvItem}
        setActiveTvItem={setActiveTvItem}
        googleUser={googleUser}
        youtubeToken={youtubeToken}
        isSigningInGoogle={isSigningInGoogle}
        googleAuthError={googleAuthError}
        handleGoogleSignIn={handleGoogleSignIn}
        handleGoogleSignOut={handleGoogleSignOut}
        handleYouTubeTokenExpired={handleYouTubeTokenExpired}
        handleAddCustomTvItem={handleAddCustomTvItem}
        handleDeleteCustomTvItem={handleDeleteCustomTvItem}
        isPinboardOpen={isPinboardOpen}
        setIsPinboardOpen={setIsPinboardOpen}
        runningMinaTaskIds={runningMinaTaskIds}
        tasksBoardRefreshNonce={tasksBoardRefreshNonce}
        executeMinaScheduledTask={executeMinaScheduledTask}
        handleOpenAssistantChatFromPinboard={handleOpenAssistantChatFromPinboard}
        scanAndRunDueMinaTasks={scanAndRunDueMinaTasks}
        isDriveOpen={isDriveOpen}
        setIsDriveOpen={setIsDriveOpen}
        isAntigravityOpen={isAntigravityOpen}
        setIsAntigravityOpen={setIsAntigravityOpen}
        characterStatuses={characterStatuses}
        deliveredChatTaskAgy={deliveredChatTaskAgy}
        handleUpdateCharacterActivity={handleUpdateCharacterActivity}
        showToast={showToast}
        fetchCharacterStatuses={fetchCharacterStatuses}
        saveToDriveRequest={saveToDriveRequest}
        setSaveToDriveRequest={setSaveToDriveRequest}
        isAiStudioOpen={isAiStudioOpen}
        setIsAiStudioOpen={setIsAiStudioOpen}
        deliveredChatTaskAiStudio={deliveredChatTaskAiStudio}
        isMailboxOpen={isMailboxOpen}
        setIsMailboxOpen={setIsMailboxOpen}
        gmailScopeMissing={gmailScopeMissing}
        setGmailScopeMissing={setGmailScopeMissing}
        effectiveMailboxUnreadCount={effectiveMailboxUnreadCount}
        locallyReadMailIds={locallyReadMailIds}
        handleMarkMailRead={handleMarkMailRead}
        handleMarkAllMailRead={handleMarkAllMailRead}
        syncGmailUnreadStatus={syncGmailUnreadStatus}
        isSleepLogOpen={isSleepLogOpen}
        setIsSleepLogOpen={setIsSleepLogOpen}
        sleepLogs={sleepLogs}
        hasLoggedTodaySleep={hasLoggedTodaySleep}
        todaySleepHudLabel={todaySleepSummary?.hudLabel ?? null}
        handleAskMinaAnalyzeSleep={handleAskMinaAnalyzeSleep}
        handleSaveSleepLog={handleSaveSleepLog}
        handleSaveSleepLogsBatch={handleSaveSleepLogsBatch}
        handleDeleteSleepLog={handleDeleteSleepLog}
        handleRequestDriveWriteAccess={handleRequestDriveWriteAccess}
        isClockScheduleOpen={isClockScheduleOpen}
        onCloseClockSchedule={closeClockSchedule}
        clockNowMs={clockNowMs}
        todayActivities={todayActivities}
        upcomingWeekActivities={upcomingWeekActivities}
        ongoingActivity={ongoingActivity}
        lastStartedTodayActivity={lastStartedTodayActivity}
        nextActivityCountdown={nextActivityCountdown}
        isSyncingTodayActivities={isSyncingTodayActivities}
        canSyncTodayActivities={Boolean(calendarAccessToken)}
        onRefreshTodayActivities={() => void refreshTodayActivities()}
        onPreviewActivityChime={triggerActivityPreviewChime}
        onSwitchToActivityMode={onSwitchToActivityMode}
      />
    </div>
  );
}

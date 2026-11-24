import type { User } from 'firebase/auth';
import { AiStudioModal, type CharacterTaskActivityUpdate } from './AiStudioModal';
import { AntigravityModal } from './AntigravityModal';
import { DriveTableModal } from './DriveTableModal';
import { MailboxModal } from './MailboxModal';
import { SaveToDriveModal } from './SaveToDriveModal';
import { SleepQuestModal } from './SleepQuestModal';
import { TasksPinboardModal } from './TasksPinboardModal';
import { TvModal } from './TvModal';
import { soundEngine } from '../lib/sound';
import type {
  AssistantTaskDelivery,
  CharacterId,
  CharacterStatusMap,
  DailySleepRecord,
  GoogleTask,
  TvFeedItem,
  WorldToast,
} from '../types/game';

export interface CozyModalsLayerProps {
  isTvOpen: boolean;
  setIsTvOpen: React.Dispatch<React.SetStateAction<boolean>>;
  allTvFeed: TvFeedItem[];
  activeTvItem: TvFeedItem | null;
  setActiveTvItem: React.Dispatch<React.SetStateAction<TvFeedItem | null>>;
  googleUser: User | null;
  youtubeToken: string | null;
  isSigningInGoogle: boolean;
  googleAuthError: string | null;
  handleGoogleSignIn: () => Promise<void>;
  handleGoogleSignOut: () => Promise<void>;
  handleYouTubeTokenExpired: () => void;
  handleAddCustomTvItem: (item: { title: string; channel: string; videoId: string }) => void;
  handleDeleteCustomTvItem: (id: string) => void;
  isPinboardOpen: boolean;
  setIsPinboardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  runningMinaTaskIds: string[];
  tasksBoardRefreshNonce: number;
  executeMinaScheduledTask: (
    taskListId: string,
    task: GoogleTask,
    options?: {
      triggerSource?: 'auto' | 'manual';
      refineInstruction?: string;
    }
  ) => Promise<void>;
  handleOpenAssistantChatFromPinboard: (initialPrompt?: string) => void;
  scanAndRunDueMinaTasks: () => Promise<void>;
  isDriveOpen: boolean;
  setIsDriveOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAntigravityOpen: boolean;
  setIsAntigravityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  characterStatuses: CharacterStatusMap;
  deliveredChatTaskAgy: AssistantTaskDelivery | null;
  handleUpdateCharacterActivity: (
    characterId: CharacterId,
    activity: CharacterTaskActivityUpdate
  ) => void;
  showToast: (text: string, speaker?: WorldToast['speaker']) => void;
  fetchCharacterStatuses: () => Promise<void>;
  saveToDriveRequest: {
    content: string;
    title?: string;
    assistantName: string;
  } | null;
  setSaveToDriveRequest: React.Dispatch<
    React.SetStateAction<{
      content: string;
      title?: string;
      assistantName: string;
    } | null>
  >;
  isAiStudioOpen: boolean;
  setIsAiStudioOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deliveredChatTaskAiStudio: AssistantTaskDelivery | null;
  isMailboxOpen: boolean;
  setIsMailboxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  gmailScopeMissing: boolean;
  setGmailScopeMissing: React.Dispatch<React.SetStateAction<boolean>>;
  effectiveMailboxUnreadCount: number;
  locallyReadMailIds: Set<string>;
  handleMarkMailRead: (messageId: string, wasUnread: boolean) => void;
  syncGmailUnreadStatus: () => Promise<void>;
  isSleepLogOpen: boolean;
  setIsSleepLogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sleepLogs: DailySleepRecord[];
  hasLoggedTodaySleep: boolean;
  todaySleepHudLabel: string | null;
  handleAskMinaAnalyzeSleep: () => Promise<void>;
  handleSaveSleepLog: (record: DailySleepRecord) => Promise<void>;
  handleSaveSleepLogsBatch?: (records: DailySleepRecord[]) => Promise<void>;
  handleDeleteSleepLog: (id: string) => Promise<void>;
  handleRequestDriveWriteAccess: () => Promise<boolean>;
}

export function CozyModalsLayer({
  isTvOpen,
  setIsTvOpen,
  allTvFeed,
  activeTvItem,
  setActiveTvItem,
  googleUser,
  youtubeToken,
  isSigningInGoogle,
  googleAuthError,
  handleGoogleSignIn,
  handleGoogleSignOut,
  handleYouTubeTokenExpired,
  handleAddCustomTvItem,
  handleDeleteCustomTvItem,
  isPinboardOpen,
  setIsPinboardOpen,
  runningMinaTaskIds,
  tasksBoardRefreshNonce,
  executeMinaScheduledTask,
  handleOpenAssistantChatFromPinboard,
  scanAndRunDueMinaTasks,
  isDriveOpen,
  setIsDriveOpen,
  isAntigravityOpen,
  setIsAntigravityOpen,
  characterStatuses,
  deliveredChatTaskAgy,
  handleUpdateCharacterActivity,
  showToast,
  fetchCharacterStatuses,
  saveToDriveRequest,
  setSaveToDriveRequest,
  isAiStudioOpen,
  setIsAiStudioOpen,
  deliveredChatTaskAiStudio,
  isMailboxOpen,
  setIsMailboxOpen,
  gmailScopeMissing,
  setGmailScopeMissing,
  effectiveMailboxUnreadCount,
  locallyReadMailIds,
  handleMarkMailRead,
  syncGmailUnreadStatus,
  isSleepLogOpen,
  setIsSleepLogOpen,
  sleepLogs,
  hasLoggedTodaySleep,
  todaySleepHudLabel,
  handleAskMinaAnalyzeSleep,
  handleSaveSleepLog,
  handleSaveSleepLogsBatch,
  handleDeleteSleepLog,
  handleRequestDriveWriteAccess,
}: CozyModalsLayerProps) {
  return (
    <>
      {isTvOpen && (
        <TvModal
          feedItems={allTvFeed}
          activeItem={activeTvItem}
          googleUser={googleUser}
          accessToken={youtubeToken}
          isSigningIn={isSigningInGoogle}
          authError={googleAuthError}
          onGoogleSignIn={() => void handleGoogleSignIn()}
          onGoogleSignOut={() => void handleGoogleSignOut()}
          onTokenExpired={handleYouTubeTokenExpired}
          onSelectItem={(item) => {
            soundEngine.playInteract();
            setActiveTvItem(item);
          }}
          onBackToFeed={() => {
            soundEngine.playInteract();
            setActiveTvItem(null);
          }}
          onAddCustomItem={handleAddCustomTvItem}
          onDeleteCustomItem={handleDeleteCustomTvItem}
          onClose={() => {
            soundEngine.playInteract();
            setIsTvOpen(false);
          }}
        />
      )}
      {isPinboardOpen && (
        <TasksPinboardModal
          googleUser={googleUser}
          accessToken={youtubeToken}
          isSigningIn={isSigningInGoogle}
          authError={googleAuthError}
          runningMinaTaskIds={runningMinaTaskIds}
          boardRefreshNonce={tasksBoardRefreshNonce}
          onRunMinaTaskNow={(taskListId, task, opts) =>
            executeMinaScheduledTask(taskListId, task, {
              triggerSource: 'manual',
              refineInstruction: opts?.refineInstruction,
            })
          }
          onOpenAssistantChat={handleOpenAssistantChatFromPinboard}
          onTasksChanged={() => {
            void scanAndRunDueMinaTasks();
          }}
          onGoogleSignIn={() => void handleGoogleSignIn()}
          onGoogleSignOut={() => void handleGoogleSignOut()}
          onTokenExpired={handleYouTubeTokenExpired}
          onClose={() => {
            soundEngine.playInteract();
            setIsPinboardOpen(false);
          }}
        />
      )}
      {isDriveOpen && (
        <DriveTableModal
          googleUser={googleUser}
          accessToken={youtubeToken}
          isSigningIn={isSigningInGoogle}
          authError={googleAuthError}
          onGoogleSignIn={() => void handleGoogleSignIn()}
          onGoogleSignOut={() => void handleGoogleSignOut()}
          onTokenExpired={handleYouTubeTokenExpired}
          onClose={() => {
            soundEngine.playInteract();
            setIsDriveOpen(false);
          }}
        />
      )}
      <AntigravityModal
        isOpen={isAntigravityOpen}
        statusSnapshot={characterStatuses.antigravity}
        incomingTaskDelivery={deliveredChatTaskAgy}
        onTaskActivityChange={(activity) =>
          handleUpdateCharacterActivity('antigravity', activity)
        }
        onBackgroundComplete={(taskSummary) => {
          showToast(`Antigravity ทำงานเสร็จแล้ว: ${taskSummary}`, 'house');
        }}
        onRefreshStatus={() => void fetchCharacterStatuses()}
        onSaveToDrive={(payload) => {
          soundEngine.playInteract();
          setSaveToDriveRequest(payload);
        }}
        onClose={() => {
          soundEngine.playInteract();
          setIsAntigravityOpen(false);
        }}
      />
      <AiStudioModal
        isOpen={isAiStudioOpen}
        statusSnapshot={characterStatuses.ai_studio}
        incomingTaskDelivery={deliveredChatTaskAiStudio}
        onTaskActivityChange={(activity) =>
          handleUpdateCharacterActivity('ai_studio', activity)
        }
        onBackgroundComplete={(taskSummary) => {
          showToast(`Google AI Studio ทำงานเสร็จแล้ว: ${taskSummary}`, 'house');
        }}
        onRefreshStatus={() => void fetchCharacterStatuses()}
        onSaveToDrive={(payload) => {
          soundEngine.playInteract();
          setSaveToDriveRequest(payload);
        }}
        onClose={() => {
          soundEngine.playInteract();
          setIsAiStudioOpen(false);
        }}
      />
      {isMailboxOpen && (
        <MailboxModal
          googleUser={googleUser}
          accessToken={youtubeToken}
          isSigningIn={isSigningInGoogle}
          authError={googleAuthError}
          gmailScopeMissing={gmailScopeMissing}
          unreadCount={effectiveMailboxUnreadCount}
          locallyReadIds={locallyReadMailIds}
          onMarkMessageRead={handleMarkMailRead}
          onSyncUnreadStatus={() => void syncGmailUnreadStatus()}
          onGoogleSignIn={() => void handleGoogleSignIn()}
          onGoogleSignOut={() => void handleGoogleSignOut()}
          onTokenExpired={handleYouTubeTokenExpired}
          onGmailScopeError={() => setGmailScopeMissing(true)}
          onClose={() => {
            soundEngine.playInteract();
            setIsMailboxOpen(false);
          }}
        />
      )}
      {isSleepLogOpen && (
        <SleepQuestModal
          logs={sleepLogs}
          hasLoggedToday={hasLoggedTodaySleep}
          todaySleepLabel={todaySleepHudLabel}
          googleUser={googleUser}
          accessToken={youtubeToken}
          isSigningIn={isSigningInGoogle}
          authError={googleAuthError}
          onGoogleSignIn={() => void handleGoogleSignIn()}
          onTokenExpired={handleYouTubeTokenExpired}
          onAskMinaAnalyzeSleep={() => void handleAskMinaAnalyzeSleep()}
          onSaveLog={handleSaveSleepLog}
          onSaveLogsBatch={handleSaveSleepLogsBatch}
          onDeleteLog={handleDeleteSleepLog}
          onClose={() => {
            soundEngine.playInteract();
            setIsSleepLogOpen(false);
          }}
        />
      )}
      <SaveToDriveModal
        isOpen={Boolean(saveToDriveRequest)}
        initialContent={saveToDriveRequest?.content ?? ''}
        initialTitle={saveToDriveRequest?.title}
        assistantName={saveToDriveRequest?.assistantName}
        googleUser={googleUser}
        accessToken={youtubeToken}
        isSigningIn={isSigningInGoogle}
        authError={googleAuthError}
        onGoogleSignIn={() => void handleGoogleSignIn()}
        onGoogleSignOut={() => void handleGoogleSignOut()}
        onRequestDriveWriteAccess={handleRequestDriveWriteAccess}
        onTokenExpired={handleYouTubeTokenExpired}
        onSaved={(file, fmt) => {
          soundEngine.playMessageReceived();
          const label =
            fmt === 'google_doc'
              ? 'Google Docs'
              : fmt === 'google_sheet'
                ? 'Google Sheets'
                : 'Markdown (.md)';
          showToast(`บันทึก "${file.name}" เป็น ${label} ลง Google Drive แล้ว`, 'mina');
        }}
        onClose={() => {
          soundEngine.playInteract();
          setSaveToDriveRequest(null);
        }}
      />
    </>
  );
}

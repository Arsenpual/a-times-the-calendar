export type GameState = 'TITLE_MENU' | 'PLAYING' | 'WORKING';

export type RoomZone = 'living' | 'office' | 'kitchen' | 'bathroom' | 'entryway' | 'bedroom' | 'garage' | 'gym';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export type WorkMode = 'qa' | 'brainstorm' | 'draft';

export type AssistantMood = 'idle' | 'greeting' | 'thinking' | 'speaking' | 'pinning';

export type FacingDirection = 'up' | 'down' | 'left' | 'right';

export type CameraFocusMode = 'follow' | 'free';

export type CameraPresetId =
  | 'follow'
  | 'overview'
  | 'living'
  | 'office'
  | 'gym'
  | 'kitchen'
  | 'bathroom'
  | 'entryway'
  | 'bedroom'
  | 'garage';

export interface CameraTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface CameraUiState {
  zoomPercent: number;
  focusMode: CameraFocusMode;
  activePreset: CameraPresetId | null;
}

export type CameraCommand =
  | { id: number; type: 'preset'; preset: CameraPresetId }
  | { id: number; type: 'zoom_step'; delta: number }
  | { id: number; type: 'reset_zoom' };

export type MinaMissionPhase =
  | 'working_at_desk'
  | 'approaching_player'
  | 'summoned_to_player'
  | 'greeting_player'
  | 'walking_to_board'
  | 'pinning'
  | 'walking_back';

export type MinaSummonMode = 'walk_then_chat' | 'chat_then_walk';

export interface MinaSummonCommand {
  id: number;
  mode: MinaSummonMode;
}

export interface MinaActionMenuAnchor {
  normX: number;
  normY: number;
}

export interface MinaNpcState {
  x: number;
  y: number;
  facing: FacingDirection;
  isMoving: boolean;
  walkFrame: number;
  phase: MinaMissionPhase;
  pinProgress: number;
}

export interface MinaPinMission {
  id: number;
  taskTitle: string;
}

export type TaskProposalStatus = 'pending' | 'saving' | 'added' | 'cancelled' | 'error';

export type TaskAssistantId = 'mina' | 'antigravity' | 'ai_studio';

export interface AssistantTaskDelivery {
  id: number;
  assistantId: TaskAssistantId;
  assistantName: string;
  taskListId: string;
  taskId: string;
  taskTitle: string;
  cleanTitle: string;
  scheduledTime?: string | null;
  completedAtLabel: string;
  success: boolean;
  summary?: string;
  errorMessage?: string;
}

export interface AssistantDeliveryWalkCommand {
  id: number;
  assistantId: TaskAssistantId;
  bubbleText: string;
}

export interface RovingAssistantNpcState {
  x: number;
  y: number;
  facing: FacingDirection;
  isMoving: boolean;
  walkFrame: number;
  phase: 'at_desk' | 'walking_to_player' | 'waiting_with_player' | 'walking_back';
}

export interface ChatTaskProposal {
  title: string;
  notes?: string;
  dueDate?: string;
  assignToMina?: boolean;
  assistantId?: TaskAssistantId;
  scheduledTime?: string;
  status: TaskProposalStatus;
  createdTaskId?: string;
  errorMessage?: string;
}

export type DiningChairSeatId =
  | 'dining_chair_nw'
  | 'dining_chair_ne'
  | 'dining_chair_sw'
  | 'dining_chair_se';

export type PlayerSeatId =
  | 'workdesk'
  | 'sofa'
  | 'bedroom_bed'
  | 'green_car'
  | DiningChairSeatId;

export interface GreenCarState {
  x: number;
  y: number;
  /** Heading in radians (0 = right/+X, Math.PI/2 = down/+Y, -Math.PI/2 = up/-Y) */
  angle: number;
  /** Signed forward velocity in world px/s (negative = reversing) */
  speed: number;
  /** Visual front-wheel steer angle in radians (-0.45..0.45) */
  steerAngle: number;
  isDriving: boolean;
  braking: boolean;
  reversing: boolean;
  hornTick: number;
}

export interface DrivingHudState {
  speedKmh: number;
  gear: 'P' | 'D' | 'R';
}

export type SofaActivity = 'tea' | 'newspaper' | 'tv_remote';

export type ShowerPhase = 'wetting' | 'grab_soap' | 'scrub_soap' | 'return_soap' | 'rinse';

export type InteractableId =
  | 'coffee'
  | 'sofa'
  | 'window'
  | 'bookshelf'
  | 'clock'
  | 'tv'
  | 'pinboard'
  | 'workdesk'
  | 'drive_table'
  | 'mina_desk'
  | 'antigravity_desk'
  | 'ai_studio_desk'
  | 'dining_table'
  | 'mailbox'
  | 'sleep_log'
  | 'bedroom_bed'
  | 'green_car'
  | 'porch_plants'
  | DiningChairSeatId;

export interface DailyPlantWateringRecord {
  date: string; // YYYY-MM-DD (local date)
  wateredCount: number;
  lastWateredAt: string; // ISO timestamp
  lastWateredTimeLabel: string; // e.g. "11:15 น."
}

export type AntigravityMode = 'code' | 'workspace' | 'arch';

export interface AntigravityMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: AntigravityMode;
  createdAt: number;
  inspectedFiles?: string[];
}

export type AiStudioMode = 'prompt' | 'build' | 'schema';

export type AiStudioModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export type AiStudioThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiStudioMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: AiStudioMode;
  model?: AiStudioModelId;
  createdAt: number;
}

export type CharacterId = 'mina' | 'antigravity' | 'ai_studio';

export type CharacterAvailabilityStatus = 'ready' | 'busy' | 'unavailable';

export interface CharacterStatusSnapshot {
  id: CharacterId;
  name: string;
  status: CharacterAvailabilityStatus;
  tokensRemaining: number;
  tokensUsed: number;
  tokensLimit: number;
  resetAt: number;
  currentTask: string | null;
  unavailableReason: string | null;
  unavailableCode?: string | null;
}

export type CharacterStatusMap = Record<CharacterId, CharacterStatusSnapshot>;

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  starred?: boolean;
  ownerName?: string;
  parents?: string[];
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  updated?: string;
  parent?: string;
}

export interface GmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  to?: string;
  dateRaw?: string;
  internalDate: number;
  isUnread: boolean;
  isStarred: boolean;
  labelIds: string[];
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText: string;
  attachments: GmailAttachmentMeta[];
}

export interface SleepStageMetric {
  minutes: number;
  durationText: string;
  percent: number | null;
  status: string | null;
  referenceRange: string | null;
}

export interface SleepAiAnalysis {
  summary: string;
  strengths: string[];
  concerns: string[];
  actionableTips: string[];
  circadianNote: string;
  analyzedAt: string;
  model: string;
}

export interface RawSleepReferenceRange {
  raw_text: string;
  unit?: string;
  unit_th?: string;
  min_value: number | null;
  max_value: number | null;
  operator: string;
}

export interface RawSleepStageEntry {
  stage_key: 'deep' | 'light' | 'rem';
  label_th: string;
  duration_hours: number;
  duration_minutes: number;
  duration_total_minutes: number;
  duration_total_seconds: number;
  duration_raw_text: string;
  percentage_value: number | null;
  percentage_unit: string;
  percentage_raw_text: string | null;
  status_label_th: string | null;
  reference_range: RawSleepReferenceRange | null;
}

export interface RawSleepSubMetricEntry {
  metric_key: string;
  label_th: string;
  numeric_value: number | null;
  unit_th: string;
  raw_text: string | null;
  status_label_th: string | null;
  reference_range: RawSleepReferenceRange | null;
}

export interface RawSleepInfographic {
  record_header: {
    date_iso: string;
    date_short_th: string;
    weekday_short_th: string;
    raw_header_text: string;
  };
  sleep_window: {
    sleep_start_date: string;
    sleep_start_time_24h: string | null;
    sleep_start_hour: number | null;
    sleep_start_minute: number | null;
    sleep_start_raw_label: string | null;
    wake_up_date: string;
    wake_up_time_24h: string | null;
    wake_up_hour: number | null;
    wake_up_minute: number | null;
    wake_up_raw_label: string | null;
  };
  total_sleep_duration: {
    hours: number;
    minutes: number;
    total_minutes: number | null;
    total_seconds: number | null;
    decimal_hours: number | null;
    raw_text: string | null;
    status_label_th: string | null;
    reference_range: RawSleepReferenceRange | null;
  };
  sleep_score_raw: {
    score_value: number | null;
    score_unit_th: string;
    better_than_users: {
      percent_value: number | null;
      unit: string;
      raw_text: string | null;
    };
    star_rating_raw: {
      full_stars: number | null;
      half_stars: number | null;
      total_displayed_stars: number;
      derived_numeric_rating: number | null;
    };
  };
  sleep_stages_raw: {
    deep_sleep: RawSleepStageEntry;
    light_sleep: RawSleepStageEntry;
    rem_sleep: RawSleepStageEntry;
  };
  sub_metrics_raw: {
    deep_sleep_continuity: RawSleepSubMetricEntry;
    breathing_quality: RawSleepSubMetricEntry;
    awakenings_count: RawSleepSubMetricEntry;
  };
}

export interface DailySleepRecord {
  id: string;
  date: string; // YYYY-MM-DD
  dateLabel: string;
  sourceApp: string;
  userLabel: string | null;
  sleepScore: number | null;
  percentileBeat: number | null;
  bedtime: string | null; // HH:mm
  wakeTime: string | null; // HH:mm
  totalSleepMinutes: number | null;
  totalSleepText: string | null;
  totalSleepStatus: string | null;
  totalSleepReference: string | null;
  stages: {
    deep: SleepStageMetric;
    light: SleepStageMetric;
    rem: SleepStageMetric;
  };
  deepSleepContinuityScore: number | null;
  deepSleepContinuityStatus: string | null;
  awakeCount: number | null;
  awakeStatus: string | null;
  breathingQualityScore: number | null;
  breathingQualityStatus: string | null;
  previousDayStressScore: number | null;
  appInsights: string[];
  appRecommendation: string | null;
  rawInfographic?: RawSleepInfographic | null;
  aiAnalysis?: SleepAiAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

export interface TvFeedItem {
  id: string;
  title: string;
  channel: string;
  category: string;
  videoId: string;
  duration?: string;
  isLive?: boolean;
  isCustom?: boolean;
  publishedAt?: string;
  thumbnailUrl?: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  itemCount: number;
  thumbnailUrl?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InteractableObject {
  id: InteractableId;
  zone: RoomZone;
  label: string;
  actionLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  interactRadius: number;
}

export interface InspectableObject {
  id: string;
  zone: RoomZone;
  areaLabel: string;
  name: string;
  detail: string;
  x: number;
  y: number;
  w: number;
  h: number;
  priority?: number;
}

export interface InspectHoverRenderState {
  object: InspectableObject;
  /** 0..1 fill progress shown between hint delay and 2s reveal */
  progress: number;
  revealed: boolean;
  pointerVx: number;
  pointerVy: number;
}

export interface PlayerState {
  x: number;
  y: number;
  facing: FacingDirection;
  isMoving: boolean;
  walkFrame: number;
  isSitting: boolean;
  seat: PlayerSeatId | null;
  sofaActivity: SofaActivity | null;
  sofaActivityElapsed: number;
  isShowering: boolean;
  showerPhase: ShowerPhase | null;
  showerPhaseElapsed: number;
  showerPrivacyProgress: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: WorkMode;
  createdAt: number;
  taskProposal?: ChatTaskProposal;
}

export interface SavedDraft {
  id: string;
  title: string;
  content: string;
  mode: WorkMode;
  createdAt: number;
}

export interface WorldToast {
  id: number;
  text: string;
  speaker?: 'player' | 'mina' | 'house';
}

const BASE_URL = import.meta.env.BASE_URL || '/';

export const ASSETS = {
  minaPortrait: `${BASE_URL}cozy-desk/images/pixel_assistant_mina_1795272162729.jpg`,
  playerPortrait: `${BASE_URL}cozy-desk/images/pixel_player_avatar_1795272163275.jpg`,
  homeBanner: `${BASE_URL}cozy-desk/images/pixel_home_title_banner_1795272163110.jpg`,
} as const;

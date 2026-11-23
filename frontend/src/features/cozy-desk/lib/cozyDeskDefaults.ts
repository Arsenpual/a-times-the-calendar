import type {
  CharacterId,
  CharacterStatusMap,
  CharacterStatusSnapshot,
  TvFeedItem,
  WorkMode,
} from '../types/game';
import { cozyStorageKey } from '../api/cozyApi';

export const STORAGE_MESSAGES_KEY = 'cozy_desk_messages_v1';
export const STORAGE_DRAFTS_KEY = 'cozy_desk_drafts_v1';
export const STORAGE_TV_FEED_KEY = 'cozy_desk_tv_custom_feed_v1';

export const DEFAULT_TV_FEED: TvFeedItem[] = [
  {
    id: 'chillhop-lofi-live',
    title: 'lofi hip hop radio — beats to study/relax to',
    channel: 'Chillhop Music',
    category: 'Lo-fi & โฟกัส',
    videoId: '7NOSDKb0HlU',
    isLive: true,
  },
  {
    id: 'synthwave-live',
    title: 'synthwave radio — beats to chill/game to',
    channel: 'Lofi Girl',
    category: 'Lo-fi & โฟกัส',
    videoId: '4xDzrJKXOOY',
    isLive: true,
  },
  {
    id: 'coding-chillstep',
    title: 'Lock In and Start Coding — Deep Focus Chillstep',
    channel: 'Chill Music Lab',
    category: 'โค้ดดิ้ง & ทำงาน',
    videoId: 'M5QY2_8704o',
    duration: '1:00:00',
  },
  {
    id: 'cozy-coffee-jazz',
    title: 'Coffee Jazz Music — Chill Out Lounge Jazz Radio 24/7',
    channel: 'BGM channel',
    category: 'คาเฟ่ & แจ๊ส',
    videoId: 'fEvM-OUbaKs',
    isLive: true,
  },
  {
    id: 'best-of-lofi',
    title: 'Best of lofi hip hop — beats to relax/study to',
    channel: 'Lofi Girl',
    category: 'Lo-fi & โฟกัส',
    videoId: 'n61ULEU7CO0',
    duration: '1:01:36',
  },
  {
    id: 'rainy-fireplace',
    title: 'Fireplace Ambience — Cozy Fire for Relaxation',
    channel: 'Fireplace Atmosphere',
    category: 'ธรรมชาติ & ผ่อนคลาย',
    videoId: 'L_LUpnjgPso',
    duration: '10:00:00',
  },
  {
    id: 'rain-window-asmr',
    title: 'Rain Sound On Window with Soft Thunder — Study & Sleep',
    channel: 'Relaxing Ambience ASMR',
    category: 'ธรรมชาติ & ผ่อนคลาย',
    videoId: 'mPZkdNFkNps',
    duration: '8:00:00',
  },
  {
    id: 'forest-waterfall',
    title: 'Relaxing Nature Sounds — Calm Forest Waterfall',
    channel: 'johnnielawson',
    category: 'ธรรมชาติ & ผ่อนคลาย',
    videoId: 'eKFTSSKCzWA',
    duration: '8:00:00',
  },
  {
    id: 'lofi-sleep-chill',
    title: 'lofi hip hop radio — beats to sleep/chill to',
    channel: 'Lofi Girl',
    category: 'คาเฟ่ & แจ๊ส',
    videoId: 'DWcJFNfaw9c',
    isLive: true,
  },
];

export const BOOKSHELF_TIPS = [
  'โน้ตจากชั้นหนังสือ: เริ่มงานชิ้นใหญ่ด้วยการแตกเป็น 1 ขั้นตอนที่ทำเสร็จได้ใน 10 นาที',
  'โน้ตจากชั้นหนังสือ: พักสายตาทุก 45 นาทีแล้วกลับมาลุยต่อจะช่วยให้คิดไอเดียคมขึ้น',
  'โน้ตจากชั้นหนังสือ: ฉบับร่างแรกไม่จำเป็นต้องสมบูรณ์แบบ แค่เริ่มเขียนให้จบก่อนแล้วค่อยเกลา',
];

export function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(cozyStorageKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getNextLocalMidnightMs(): number {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

export function createFallbackCharacterStatuses(): CharacterStatusMap {
  const resetAt = getNextLocalMidnightMs();
  const base = (id: CharacterId, name: string): CharacterStatusSnapshot => ({
    id,
    name,
    status: 'ready',
    tokensRemaining: 250_000,
    tokensUsed: 0,
    tokensLimit: 250_000,
    resetAt,
    currentTask: null,
    unavailableReason: null,
    unavailableCode: null,
  });
  return {
    mina: base('mina', 'มีน่า'),
    antigravity: base('antigravity', 'Antigravity'),
    ai_studio: base('ai_studio', 'Google AI Studio'),
  };
}

export function summarizeMinaTask(prompt: string, mode: WorkMode): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  const prefix =
    mode === 'draft'
      ? 'ร่างข้อความ'
      : mode === 'brainstorm'
        ? 'ระดมไอเดีย'
        : 'ตอบคำถาม';
  if (!cleaned) return prefix;
  const snippet = cleaned.length > 26 ? `${cleaned.slice(0, 25)}…` : cleaned;
  return `${prefix}: ${snippet}`;
}

import type { DailySleepRecord, SleepAiAnalysis } from '../types/game';
import { cozyApiFetch, cozyStorageKey } from './cozyApi';

const STORAGE_KEY = 'cozy_desk_sleep_logs_v1';

export const SAMPLE_SLEEP_IMAGE_URL = `${import.meta.env.BASE_URL || '/'}cozy-desk/aistudio/sporthealth-3-20261123-001010_02a8143c.jpg`;

export function getLocalIsoDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalIsoDateFromTimestamp(
  isoTimestamp: string | null | undefined
): string | null {
  if (!isoTimestamp) return null;
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalIsoDate(parsed);
}

export function getMsUntilLocalMidnight(now = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    250
  );
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

export function formatMinutesToThaiDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return '—';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs} ชม. ${mins} นาที`;
  if (hrs > 0) return `${hrs} ชม.`;
  return `${mins} นาที`;
}

export function formatDurationBadge(
  minutes: number | null | undefined,
  fallbackText?: string | null
): string | null {
  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0 && mins > 0) return `${hrs}ชม. ${mins}น.`;
    if (hrs > 0) return `${hrs}ชม.`;
    return `${mins}น.`;
  }
  if (fallbackText?.trim()) {
    return fallbackText
      .trim()
      .replace(/\s*ชั่วโมง\s*/g, 'ชม. ')
      .replace(/\s*นาที\s*/g, 'น.')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return null;
}

export interface TodaySleepTimeSummary {
  timeRange: string | null;
  durationShort: string | null;
  hudLabel: string;
  canvasLabel: string;
}

export function formatSleepTimeSummary(
  record: DailySleepRecord | null | undefined
): TodaySleepTimeSummary | null {
  if (!record) return null;

  const bed = record.bedtime?.trim() || null;
  const wake = record.wakeTime?.trim() || null;
  const timeRange =
    bed && wake ? `${bed}–${wake}` : bed ? `เข้านอน ${bed}` : wake ? `ตื่น ${wake}` : null;

  const durationBadge = formatDurationBadge(
    record.totalSleepMinutes,
    record.totalSleepText
  );
  const label = durationBadge || 'บันทึกแล้ว';

  return {
    timeRange,
    durationShort: durationBadge,
    hudLabel: label,
    canvasLabel: label,
  };
}

export function findTodaySleepRecord(
  logs: DailySleepRecord[],
  todayIsoDate: string
): DailySleepRecord | null {
  const matches = logs.filter(
    (rec) =>
      getLocalIsoDateFromTimestamp(rec.createdAt) === todayIsoDate ||
      rec.date === todayIsoDate
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => {
    const cCmp = (b.createdAt || '').localeCompare(a.createdAt || '');
    if (cCmp !== 0) return cCmp;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  })[0];
}

export function loadLocalSleepLogs(): DailySleepRecord[] {
  try {
    const raw = window.localStorage.getItem(cozyStorageKey(STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortSleepRecords(parsed.filter(isValidSleepRecordShape));
  } catch {
    return [];
  }
}

export function saveLocalSleepLogs(records: DailySleepRecord[]): void {
  try {
    window.localStorage.setItem(cozyStorageKey(STORAGE_KEY), JSON.stringify(sortSleepRecords(records)));
  } catch {
    // Ignore storage quota issues
  }
}

export function isValidSleepRecordShape(item: unknown): item is DailySleepRecord {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.sourceApp === 'string' &&
    Boolean(r.stages) &&
    typeof r.stages === 'object'
  );
}

export function sortSleepRecords(records: DailySleepRecord[]): DailySleepRecord[] {
  return [...records].sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

function mergeSleepRecordLists(
  serverLogs: DailySleepRecord[],
  localLogs: DailySleepRecord[]
): DailySleepRecord[] {
  const byId = new Map<string, DailySleepRecord>();
  for (const item of localLogs) {
    byId.set(item.id, item);
  }
  for (const item of serverLogs) {
    const existing = byId.get(item.id);
    if (!existing || (item.updatedAt || '') >= (existing.updatedAt || '')) {
      byId.set(item.id, item);
    }
  }
  return sortSleepRecords(Array.from(byId.values()));
}

export async function fetchSleepLogs(): Promise<DailySleepRecord[]> {
  const local = loadLocalSleepLogs();
  try {
    const res = await cozyApiFetch('/api/sleep/logs', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return local;
    }
    const data = (await res.json()) as { logs?: DailySleepRecord[] };
    const serverLogs = Array.isArray(data.logs)
      ? data.logs.filter(isValidSleepRecordShape)
      : [];
    const merged = mergeSleepRecordLists(serverLogs, local);
    saveLocalSleepLogs(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function persistSleepLog(record: DailySleepRecord): Promise<DailySleepRecord[]> {
  const local = loadLocalSleepLogs();
  const optimistic = sortSleepRecords([
    record,
    ...local.filter((item) => item.id !== record.id),
  ]);
  saveLocalSleepLogs(optimistic);

  try {
    const res = await cozyApiFetch('/api/sleep/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record }),
    });
    if (res.ok) {
      const data = (await res.json()) as { logs?: DailySleepRecord[] };
      if (Array.isArray(data.logs)) {
        const synced = sortSleepRecords(data.logs.filter(isValidSleepRecordShape));
        saveLocalSleepLogs(synced);
        return synced;
      }
    }
  } catch {
    // Keep local persistence if server disk write is unavailable
  }
  return optimistic;
}

export async function removeSleepLog(id: string): Promise<DailySleepRecord[]> {
  const local = loadLocalSleepLogs().filter((item) => item.id !== id);
  saveLocalSleepLogs(local);

  try {
    const res = await cozyApiFetch(`/api/sleep/logs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = (await res.json()) as { logs?: DailySleepRecord[] };
      if (Array.isArray(data.logs)) {
        const synced = sortSleepRecords(data.logs.filter(isValidSleepRecordShape));
        saveLocalSleepLogs(synced);
        return synced;
      }
    }
  } catch {
    // Keep local deletion
  }
  return local;
}

/**
 * Loads an image File or URL and gently downscales overly large captures while
 * preserving razor-sharp Thai/English numbers on tall scrolling health screenshots.
 */
export async function prepareImageForSleepExtraction(
  source: File | string
): Promise<{ imageBase64: string; mimeType: string; previewDataUrl: string }> {
  const blob: Blob =
    typeof source === 'string'
      ? await (async () => {
          const res = await fetch(source);
          if (!res.ok) {
            throw new Error('ไม่สามารถโหลดไฟล์รูปภาพตัวอย่างได้');
          }
          return res.blob();
        })()
      : source;

  if (!blob.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ (.jpg, .png หรือ .webp)');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้'));
      el.src = objectUrl;
    });

    const maxW = 1280;
    const maxH = 3400;
    const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ');
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const outMime = 'image/jpeg';
    const previewDataUrl = canvas.toDataURL(outMime, 0.88);
    const commaIdx = previewDataUrl.indexOf(',');
    const imageBase64 = commaIdx >= 0 ? previewDataUrl.slice(commaIdx + 1) : previewDataUrl;

    return {
      imageBase64,
      mimeType: outMime,
      previewDataUrl,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function extractSleepRecordFromImage(
  imageBase64: string,
  mimeType: string,
  defaultDate = getLocalIsoDate()
): Promise<{ record: DailySleepRecord; model: string }> {
  const res = await cozyApiFetch('/api/sleep/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, defaultDate }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    record?: DailySleepRecord;
    model?: string;
    error?: string;
  };

  if (!res.ok || !data.record) {
    throw new Error(data.error || 'ไม่สามารถแปลงข้อมูลการนอนจากรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
  }

  return {
    record: data.record,
    model: data.model || 'gemini-4-hydrogen',
  };
}

export async function analyzeSleepRecordWithAi(
  targetRecord: DailySleepRecord,
  historyRecords: DailySleepRecord[]
): Promise<SleepAiAnalysis> {
  const res = await cozyApiFetch('/api/sleep/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetRecord,
      historyRecords: historyRecords.slice(0, 14),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    analysis?: SleepAiAnalysis;
    error?: string;
  };

  if (!res.ok || !data.analysis) {
    throw new Error(data.error || 'ไม่สามารถวิเคราะห์ข้อมูลการนอนด้วย AI ได้ในขณะนี้');
  }

  return data.analysis;
}

export function downloadSleepJsonFile(
  payload: DailySleepRecord | DailySleepRecord[],
  filename: string
): void {
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

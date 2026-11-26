import type {
  DailySleepRecord,
  RawSleepInfographic,
  SleepAiAnalysis,
} from '../types/game';
import { cozyApiFetch, cozyStorageKey } from './cozyApi';
import {
  buildRawSleepInfographic,
  getLocalIsoDate,
  isRawSleepInfographicShape,
  isValidSleepRecordShape,
  mergeSleepRecordLists,
  sortSleepRecords,
} from '../lib/sleepSchema';

export {
  buildRawSleepInfographic,
  countStandardHuaweiFields,
  findTodaySleepRecord,
  formatDurationBadge,
  formatMinutesToThaiDuration,
  formatSleepTimeSummary,
  getLocalIsoDate,
  getLocalIsoDateFromTimestamp,
  getMsUntilLocalMidnight,
  isRawSleepInfographicShape,
  isValidSleepRecordShape,
  mergeSleepRecordLists,
  parseRawSleepInfographicToRecord,
  resolveSleepStartDate,
  shiftIsoDateDays,
  sortSleepRecords,
  STANDARD_HUAWEI_FIELDS_TOTAL,
} from '../lib/sleepSchema';
export type { TodaySleepTimeSummary } from '../lib/sleepSchema';

const STORAGE_KEY = 'cozy_desk_sleep_logs_v1';
const PENDING_DELETES_KEY = 'cozy_desk_sleep_pending_deletes_v1';
const SCAN_BACKUPS_KEY = 'cozy_desk_sleep_scan_backups_v1';
const MAX_SCAN_BACKUPS = 30;

export interface SleepSyncResult {
  logs: DailySleepRecord[];
  synced: boolean;
  syncError?: string;
}

export interface SleepScanBackupEntry {
  backupId: string;
  scannedAt: string;
  date: string;
  sourceApp: string;
  fileName: string;
  payload: RawSleepInfographic;
}

export type SleepExtractionResult =
  | {
      skippedDuplicate: true;
      duplicateDate: string;
      dateLabel?: string;
      model: string;
    }
  | {
      skippedDuplicate: false;
      record: DailySleepRecord;
      model: string;
    };

export const SAMPLE_SLEEP_IMAGE_URL = `${import.meta.env.BASE_URL || '/'}cozy-desk/aistudio/sporthealth-1-20261123-182816_1fde3a7c.jpg`;

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

function isValidScanBackupEntry(value: unknown): value is SleepScanBackupEntry {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.backupId === 'string' &&
    typeof obj.scannedAt === 'string' &&
    typeof obj.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(obj.date) &&
    typeof obj.fileName === 'string' &&
    isRawSleepInfographicShape(obj.payload)
  );
}

export function loadSleepScanBackups(): SleepScanBackupEntry[] {
  try {
    const raw = window.localStorage.getItem(cozyStorageKey(SCAN_BACKUPS_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidScanBackupEntry)
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  } catch {
    return [];
  }
}

export function saveSleepScanBackup(record: DailySleepRecord): SleepScanBackupEntry {
  const payload = record.rawInfographic ?? buildRawSleepInfographic(record);
  const scannedAt = new Date().toISOString();
  const entry: SleepScanBackupEntry = {
    backupId: `backup_${record.date}_${Date.now().toString(36)}`,
    scannedAt,
    date: record.date,
    sourceApp: record.sourceApp || 'Health App',
    fileName: `sleep-${record.date}-backup.json`,
    payload,
  };
  try {
    const existing = loadSleepScanBackups();
    const next = [entry, ...existing.filter((item) => item.date !== record.date)].slice(
      0,
      MAX_SCAN_BACKUPS
    );
    window.localStorage.setItem(cozyStorageKey(SCAN_BACKUPS_KEY), JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
  return entry;
}

export function removeSleepScanBackup(backupId: string): SleepScanBackupEntry[] {
  const next = loadSleepScanBackups().filter((item) => item.backupId !== backupId);
  try {
    if (next.length === 0) {
      window.localStorage.removeItem(cozyStorageKey(SCAN_BACKUPS_KEY));
    } else {
      window.localStorage.setItem(cozyStorageKey(SCAN_BACKUPS_KEY), JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota issues
  }
  return next;
}

function loadPendingDeleteIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(cozyStorageKey(PENDING_DELETES_KEY));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0));
  } catch {
    return new Set();
  }
}

function savePendingDeleteIds(ids: Set<string>): void {
  try {
    if (ids.size === 0) {
      window.localStorage.removeItem(cozyStorageKey(PENDING_DELETES_KEY));
    } else {
      window.localStorage.setItem(
        cozyStorageKey(PENDING_DELETES_KEY),
        JSON.stringify(Array.from(ids))
      );
    }
  } catch {
    // Ignore storage quota issues
  }
}

export async function fetchSleepLogs(): Promise<DailySleepRecord[]> {
  const local = loadLocalSleepLogs();
  const pendingDeletes = loadPendingDeleteIds();
  try {
    if (pendingDeletes.size > 0) {
      const remaining = new Set(pendingDeletes);
      for (const delId of pendingDeletes) {
        try {
          const delRes = await cozyApiFetch(`/api/sleep/logs/${encodeURIComponent(delId)}`, {
            method: 'DELETE',
          });
          if (delRes.ok) {
            remaining.delete(delId);
          }
        } catch {
          // Keep pending delete for next retry
        }
      }
      savePendingDeleteIds(remaining);
    }

    const activePending = loadPendingDeleteIds();
    const res = await cozyApiFetch('/api/sleep/logs', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return local.filter((item) => !activePending.has(item.id));
    }
    const data = (await res.json()) as { logs?: DailySleepRecord[] };
    const serverLogs = Array.isArray(data.logs)
      ? data.logs.filter(isValidSleepRecordShape)
      : [];
    const merged = mergeSleepRecordLists(serverLogs, local, activePending);
    saveLocalSleepLogs(merged);
    return merged;
  } catch {
    return local.filter((item) => !pendingDeletes.has(item.id));
  }
}

export async function persistSleepLog(record: DailySleepRecord): Promise<SleepSyncResult> {
  const local = loadLocalSleepLogs();
  const optimistic = sortSleepRecords([
    record,
    ...local.filter((item) => item.id !== record.id),
  ]);
  saveLocalSleepLogs(optimistic);

  const pendingDeletes = loadPendingDeleteIds();
  if (pendingDeletes.delete(record.id)) {
    savePendingDeleteIds(pendingDeletes);
  }

  try {
    const res = await cozyApiFetch('/api/sleep/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record }),
    });
    if (res.ok) {
      const data = (await res.json()) as { logs?: DailySleepRecord[] };
      if (Array.isArray(data.logs)) {
        const syncedLogs = sortSleepRecords(data.logs.filter(isValidSleepRecordShape));
        saveLocalSleepLogs(syncedLogs);
        return { logs: syncedLogs, synced: true };
      }
      return { logs: optimistic, synced: true };
    }
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      logs: optimistic,
      synced: false,
      syncError: errData.error || `ซิงก์ขึ้นคลาวด์ไม่สำเร็จ (HTTP ${res.status})`,
    };
  } catch (err) {
    return {
      logs: optimistic,
      synced: false,
      syncError: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อซิงก์ข้อมูลได้',
    };
  }
}

export async function persistSleepLogsBatch(
  records: DailySleepRecord[]
): Promise<SleepSyncResult> {
  const capped = records.slice(0, 31);
  if (capped.length === 0) {
    return { logs: loadLocalSleepLogs(), synced: true };
  }
  const local = loadLocalSleepLogs();
  const incomingIds = new Set(capped.map((r) => r.id));
  const optimistic = sortSleepRecords([
    ...capped,
    ...local.filter((item) => !incomingIds.has(item.id)),
  ]);
  saveLocalSleepLogs(optimistic);

  const pendingDeletes = loadPendingDeleteIds();
  let changedPending = false;
  for (const id of incomingIds) {
    if (pendingDeletes.delete(id)) changedPending = true;
  }
  if (changedPending) savePendingDeleteIds(pendingDeletes);

  try {
    const res = await cozyApiFetch('/api/sleep/logs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: capped }),
    });
    if (res.ok) {
      const data = (await res.json()) as { logs?: DailySleepRecord[] };
      if (Array.isArray(data.logs)) {
        const syncedLogs = sortSleepRecords(data.logs.filter(isValidSleepRecordShape));
        saveLocalSleepLogs(syncedLogs);
        return { logs: syncedLogs, synced: true };
      }
      return { logs: optimistic, synced: true };
    }
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      logs: optimistic,
      synced: false,
      syncError: errData.error || `ซิงก์ชุดข้อมูลขึ้นคลาวด์ไม่สำเร็จ (HTTP ${res.status})`,
    };
  } catch (err) {
    return {
      logs: optimistic,
      synced: false,
      syncError: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อซิงก์ข้อมูลได้',
    };
  }
}

export async function removeSleepLog(id: string): Promise<SleepSyncResult> {
  const local = loadLocalSleepLogs().filter((item) => item.id !== id);
  saveLocalSleepLogs(local);

  const pendingDeletes = loadPendingDeleteIds();
  pendingDeletes.add(id);
  savePendingDeleteIds(pendingDeletes);

  try {
    const res = await cozyApiFetch(`/api/sleep/logs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      pendingDeletes.delete(id);
      savePendingDeleteIds(pendingDeletes);
      const data = (await res.json()) as { logs?: DailySleepRecord[] };
      if (Array.isArray(data.logs)) {
        const syncedLogs = sortSleepRecords(data.logs.filter(isValidSleepRecordShape));
        saveLocalSleepLogs(syncedLogs);
        return { logs: syncedLogs, synced: true };
      }
      return { logs: local, synced: true };
    }
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      logs: local,
      synced: false,
      syncError: errData.error || `ลบบนคลาวด์ไม่สำเร็จ (HTTP ${res.status}) ระบบจะลองลบซ้ำเมื่อเชื่อมต่อได้`,
    };
  } catch (err) {
    return {
      logs: local,
      synced: false,
      syncError:
        err instanceof Error
          ? `${err.message} (ลบในเครื่องแล้ว และจะซิงก์การลบบนคลาวด์อัตโนมัติเมื่อเชื่อมต่อได้)`
          : 'ลบบนคลาวด์ไม่สำเร็จ ระบบจะลองลบซ้ำเมื่อเชื่อมต่อได้',
    };
  }
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

    const maxW = 1080;
    const maxH = 4400;
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
    let previewDataUrl = canvas.toDataURL(outMime, 0.86);
    if (previewDataUrl.length > 3_800_000) {
      previewDataUrl = canvas.toDataURL(outMime, 0.76);
    }
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
  defaultDate = getLocalIsoDate(),
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    existingDates?: string[];
    forceRescan?: boolean;
  } = {}
): Promise<SleepExtractionResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 55_000;
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }
  const timerId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await cozyApiFetch('/api/sleep/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        defaultDate,
        existingDates: options.existingDates,
        forceRescan: options.forceRescan === true,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new Error('การสแกนภาพใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง');
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timerId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }

  const data = (await res.json().catch(() => ({}))) as {
    skippedDuplicate?: boolean;
    duplicateDate?: string;
    dateLabel?: string;
    record?: DailySleepRecord;
    model?: string;
    error?: string;
    detail?: string;
  };

  if (res.ok && data.skippedDuplicate && typeof data.duplicateDate === 'string') {
    return {
      skippedDuplicate: true,
      duplicateDate: data.duplicateDate,
      dateLabel: data.dateLabel,
      model: data.model || 'gemini-3.1-flash-lite',
    };
  }

  if (!res.ok || !data.record) {
    const baseMsg =
      data.error || `ไม่สามารถแปลงข้อมูลการนอนจากรูปภาพได้ (HTTP ${res.status})`;
    throw new Error(data.detail ? `${baseMsg} [${data.detail}]` : baseMsg);
  }

  return {
    skippedDuplicate: false,
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
  payload:
    | DailySleepRecord
    | DailySleepRecord[]
    | RawSleepInfographic
    | RawSleepInfographic[],
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

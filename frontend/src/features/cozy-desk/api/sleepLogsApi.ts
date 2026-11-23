import type {
  DailySleepRecord,
  RawSleepInfographic,
  RawSleepReferenceRange,
  SleepAiAnalysis,
} from '../types/game';
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

    const maxW = 1080;
    const maxH = 2800;
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
    const previewDataUrl = canvas.toDataURL(outMime, 0.82);
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
    detail?: string;
  };

  if (!res.ok || !data.record) {
    const baseMsg =
      data.error || `ไม่สามารถแปลงข้อมูลการนอนจากรูปภาพได้ (HTTP ${res.status})`;
    throw new Error(data.detail ? `${baseMsg} [${data.detail}]` : baseMsg);
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

const THAI_MONTHS_SHORT = [
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
const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function parseThaiHeaderParts(dateIso: string, dateLabel?: string | null) {
  const parsed = new Date(`${dateIso}T12:00:00`);
  const validDate = !Number.isNaN(parsed.getTime());
  const defaultShort = validDate
    ? `${parsed.getDate()} ${THAI_MONTHS_SHORT[parsed.getMonth()]}`
    : dateIso;
  const defaultWeekday = validDate ? THAI_WEEKDAYS_SHORT[parsed.getDay()] : '';

  const trimmed = (dateLabel || '').trim();
  const match = trimmed.match(/^(อา\.|จ\.|อ\.|พ\.|พฤ\.|ศ\.|ส\.)\s+(.+)$/);
  return {
    date_iso: dateIso,
    date_short_th: match ? match[2].trim() : defaultShort,
    weekday_short_th: match ? match[1] : defaultWeekday,
    raw_header_text: trimmed || (defaultWeekday ? `${defaultWeekday} ${defaultShort}` : defaultShort),
  };
}

function parseTime24h(timeStr: string | null | undefined): {
  time_24h: string | null;
  hour: number | null;
  minute: number | null;
} {
  if (!timeStr) return { time_24h: null, hour: null, minute: null };
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { time_24h: timeStr.trim(), hour: null, minute: null };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return {
    time_24h: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    hour: Number.isFinite(hour) ? hour : null,
    minute: Number.isFinite(minute) ? minute : null,
  };
}

function parseReferenceRange(
  rawText: string | null | undefined,
  defaultUnit: string,
  unitKey: 'unit' | 'unit_th' = 'unit'
): RawSleepReferenceRange | null {
  const raw = (rawText || '').trim();
  if (!raw) return null;
  const betweenMatch = raw.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (betweenMatch) {
    return {
      raw_text: raw,
      [unitKey]: defaultUnit,
      min_value: Number(betweenMatch[1]),
      max_value: Number(betweenMatch[2]),
      operator: 'between_inclusive',
    };
  }
  const ltMatch = raw.match(/<\s*(\d+(?:\.\d+)?)/);
  if (ltMatch) {
    return {
      raw_text: raw,
      [unitKey]: defaultUnit,
      min_value: null,
      max_value: Number(ltMatch[1]),
      operator: 'less_than',
    };
  }
  return {
    raw_text: raw,
    [unitKey]: defaultUnit,
    min_value: null,
    max_value: null,
    operator: 'unknown',
  };
}

function formatThaiFullDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs > 0 && mins > 0) return `${hrs} ชั่วโมง ${mins} นาที`;
  if (hrs > 0) return `${hrs} ชั่วโมง`;
  return `${mins} นาที`;
}

export function buildRawSleepInfographic(record: DailySleepRecord): RawSleepInfographic {
  const header = parseThaiHeaderParts(record.date, record.dateLabel);
  const mmdd = /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    ? `${record.date.slice(5, 7)}/${record.date.slice(8, 10)}`
    : record.date;
  const start = parseTime24h(record.bedtime);
  const wake = parseTime24h(record.wakeTime);

  const totalMins =
    typeof record.totalSleepMinutes === 'number' && Number.isFinite(record.totalSleepMinutes)
      ? Math.max(0, Math.round(record.totalSleepMinutes))
      : null;

  const scoreVal = typeof record.sleepScore === 'number' ? record.sleepScore : null;
  const derivedRating =
    record.rawInfographic?.sleep_score_raw?.star_rating_raw?.derived_numeric_rating ??
    (scoreVal != null ? Math.round((scoreVal / 20) * 2) / 2 : null);
  const fullStars = derivedRating != null ? Math.floor(derivedRating) : null;
  const halfStars = derivedRating != null ? (derivedRating % 1 >= 0.5 ? 1 : 0) : null;

  const buildStage = (
    stageKey: 'deep' | 'light' | 'rem',
    defaultLabel: string,
    defaultRef: string
  ) => {
    const st = record.stages[stageKey];
    const mins = Math.max(0, Math.round(st.minutes || 0));
    const pct = typeof st.percent === 'number' ? st.percent : null;
    const rawRef = st.referenceRange || defaultRef;
    const existingStage =
      stageKey === 'deep'
        ? record.rawInfographic?.sleep_stages_raw?.deep_sleep
        : stageKey === 'light'
          ? record.rawInfographic?.sleep_stages_raw?.light_sleep
          : record.rawInfographic?.sleep_stages_raw?.rem_sleep;

    return {
      stage_key: stageKey,
      label_th: existingStage?.label_th || defaultLabel,
      duration_hours: Math.floor(mins / 60),
      duration_minutes: mins % 60,
      duration_total_minutes: mins,
      duration_total_seconds: mins * 60,
      duration_raw_text: st.durationText || formatThaiFullDuration(mins),
      percentage_value: pct,
      percentage_unit: '%',
      percentage_raw_text: pct != null ? `${pct}%` : null,
      status_label_th: st.status ?? null,
      reference_range: parseReferenceRange(rawRef, 'percent', 'unit'),
    };
  };

  return {
    record_header: header,
    sleep_window: {
      sleep_start_date: record.date,
      sleep_start_time_24h: start.time_24h,
      sleep_start_hour: start.hour,
      sleep_start_minute: start.minute,
      sleep_start_raw_label: start.time_24h ? `${mmdd} เวลานอน ${start.time_24h} น.` : null,
      wake_up_date: record.date,
      wake_up_time_24h: wake.time_24h,
      wake_up_hour: wake.hour,
      wake_up_minute: wake.minute,
      wake_up_raw_label: wake.time_24h ? `${mmdd} ตื่นนอน ${wake.time_24h} น.` : null,
    },
    total_sleep_duration: {
      hours: totalMins != null ? Math.floor(totalMins / 60) : 0,
      minutes: totalMins != null ? totalMins % 60 : 0,
      total_minutes: totalMins,
      total_seconds: totalMins != null ? totalMins * 60 : null,
      decimal_hours: totalMins != null ? Number((totalMins / 60).toFixed(4)) : null,
      raw_text: record.totalSleepText || (totalMins != null ? formatThaiFullDuration(totalMins) : null),
      status_label_th: record.totalSleepStatus ?? null,
      reference_range: parseReferenceRange(record.totalSleepReference || '6-10 ชม.', 'hour', 'unit'),
    },
    sleep_score_raw: {
      score_value: scoreVal,
      score_unit_th: 'คะแนน',
      better_than_users: {
        percent_value: record.percentileBeat ?? null,
        unit: '%',
        raw_text:
          record.percentileBeat != null ? `ดีกว่า ${record.percentileBeat}% ของผู้ใช้` : null,
      },
      star_rating_raw: {
        full_stars: fullStars,
        half_stars: halfStars,
        total_displayed_stars: 5,
        derived_numeric_rating: derivedRating,
      },
    },
    sleep_stages_raw: {
      deep_sleep: buildStage('deep', 'นอนหลับสนิท', '20-60%'),
      light_sleep: buildStage('light', 'นอนน้อย', '<55%'),
      rem_sleep: buildStage('rem', 'นอนหลับ REM', '10-30%'),
    },
    sub_metrics_raw: {
      deep_sleep_continuity: {
        metric_key: 'deep_sleep_continuity',
        label_th: 'ความต่อเนื่องของการนอนหลับลึก',
        numeric_value: record.deepSleepContinuityScore ?? null,
        unit_th: 'คะแนน',
        raw_text:
          record.deepSleepContinuityScore != null
            ? `${record.deepSleepContinuityScore} คะแนน`
            : null,
        status_label_th: record.deepSleepContinuityStatus ?? null,
        reference_range: parseReferenceRange('70-100 คะแนน', 'คะแนน', 'unit_th'),
      },
      breathing_quality: {
        metric_key: 'breathing_quality',
        label_th: 'คุณภาพการหายใจ',
        numeric_value: record.breathingQualityScore ?? null,
        unit_th: 'คะแนน',
        raw_text:
          record.breathingQualityScore != null ? `${record.breathingQualityScore} คะแนน` : null,
        status_label_th: record.breathingQualityStatus ?? null,
        reference_range: parseReferenceRange('70-100 คะแนน', 'คะแนน', 'unit_th'),
      },
      awakenings_count: {
        metric_key: 'awakenings',
        label_th: 'จำนวนครั้งที่ตื่นนอน',
        numeric_value: record.awakeCount ?? null,
        unit_th: 'ครั้ง',
        raw_text: record.awakeCount != null ? `${record.awakeCount} ครั้ง` : null,
        status_label_th: record.awakeStatus ?? null,
        reference_range: parseReferenceRange('0-1 ครั้ง', 'ครั้ง', 'unit_th'),
      },
    },
  };
}

export function isRawSleepInfographicShape(item: unknown): item is RawSleepInfographic {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  return Boolean(
    r.record_header &&
      typeof r.record_header === 'object' &&
      r.sleep_stages_raw &&
      typeof r.sleep_stages_raw === 'object'
  );
}

export function parseRawSleepInfographicToRecord(raw: RawSleepInfographic): DailySleepRecord {
  const nowIso = new Date().toISOString();
  const date = raw.record_header?.date_iso || getLocalIsoDate();
  const deep = raw.sleep_stages_raw?.deep_sleep;
  const light = raw.sleep_stages_raw?.light_sleep;
  const rem = raw.sleep_stages_raw?.rem_sleep;

  return {
    id: `sleep_${date}`,
    date,
    dateLabel: raw.record_header?.raw_header_text || date,
    sourceApp: 'Huawei Health',
    userLabel: null,
    sleepScore: raw.sleep_score_raw?.score_value ?? null,
    percentileBeat: raw.sleep_score_raw?.better_than_users?.percent_value ?? null,
    bedtime: raw.sleep_window?.sleep_start_time_24h ?? null,
    wakeTime: raw.sleep_window?.wake_up_time_24h ?? null,
    totalSleepMinutes: raw.total_sleep_duration?.total_minutes ?? null,
    totalSleepText: raw.total_sleep_duration?.raw_text ?? null,
    totalSleepStatus: raw.total_sleep_duration?.status_label_th ?? null,
    totalSleepReference: raw.total_sleep_duration?.reference_range?.raw_text ?? null,
    stages: {
      deep: {
        minutes: deep?.duration_total_minutes ?? 0,
        durationText: deep?.duration_raw_text ?? '',
        percent: deep?.percentage_value ?? null,
        status: deep?.status_label_th ?? null,
        referenceRange: deep?.reference_range?.raw_text ?? null,
      },
      light: {
        minutes: light?.duration_total_minutes ?? 0,
        durationText: light?.duration_raw_text ?? '',
        percent: light?.percentage_value ?? null,
        status: light?.status_label_th ?? null,
        referenceRange: light?.reference_range?.raw_text ?? null,
      },
      rem: {
        minutes: rem?.duration_total_minutes ?? 0,
        durationText: rem?.duration_raw_text ?? '',
        percent: rem?.percentage_value ?? null,
        status: rem?.status_label_th ?? null,
        referenceRange: rem?.reference_range?.raw_text ?? null,
      },
    },
    deepSleepContinuityScore: raw.sub_metrics_raw?.deep_sleep_continuity?.numeric_value ?? null,
    deepSleepContinuityStatus: raw.sub_metrics_raw?.deep_sleep_continuity?.status_label_th ?? null,
    awakeCount: raw.sub_metrics_raw?.awakenings_count?.numeric_value ?? null,
    awakeStatus: raw.sub_metrics_raw?.awakenings_count?.status_label_th ?? null,
    breathingQualityScore: raw.sub_metrics_raw?.breathing_quality?.numeric_value ?? null,
    breathingQualityStatus: raw.sub_metrics_raw?.breathing_quality?.status_label_th ?? null,
    previousDayStressScore: null,
    appInsights: [],
    appRecommendation: null,
    rawInfographic: raw,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

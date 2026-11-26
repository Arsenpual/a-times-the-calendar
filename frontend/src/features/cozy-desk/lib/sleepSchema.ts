import type {
  DailySleepRecord,
  RawSleepInfographic,
  RawSleepReferenceRange,
} from '../types/game';

export const STANDARD_HUAWEI_FIELDS_TOTAL = 10;

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
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
    return '—';
  }
  if (minutes === 0) return '0 นาที';
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

export function mergeSleepRecordLists(
  serverLogs: DailySleepRecord[],
  localLogs: DailySleepRecord[],
  pendingDeletes: Set<string> = new Set()
): DailySleepRecord[] {
  const byId = new Map<string, DailySleepRecord>();
  for (const item of localLogs) {
    if (!pendingDeletes.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  for (const item of serverLogs) {
    if (pendingDeletes.has(item.id)) continue;
    const existing = byId.get(item.id);
    if (!existing || (item.updatedAt || '') >= (existing.updatedAt || '')) {
      byId.set(item.id, item);
    }
  }
  return sortSleepRecords(Array.from(byId.values()));
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

export function shiftIsoDateDays(dateIso: string, deltaDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return dateIso;
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  if (Number.isNaN(dt.getTime())) return dateIso;
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function resolveSleepStartDate(
  wakeDateIso: string,
  bedtime: string | null | undefined,
  wakeTime: string | null | undefined
): string {
  const start = parseTime24h(bedtime);
  const wake = parseTime24h(wakeTime);
  if (
    start.hour != null &&
    start.minute != null &&
    wake.hour != null &&
    wake.minute != null
  ) {
    const startMins = start.hour * 60 + start.minute;
    const wakeMins = wake.hour * 60 + wake.minute;
    if (startMins > wakeMins) {
      return shiftIsoDateDays(wakeDateIso, -1);
    }
  }
  return wakeDateIso;
}

export function countStandardHuaweiFields(record: DailySleepRecord): number {
  let count = 0;
  if (Boolean(record.bedtime || record.wakeTime)) count += 1;
  if (typeof record.totalSleepMinutes === 'number' && record.totalSleepMinutes > 0) count += 1;
  if (typeof record.sleepScore === 'number') count += 1;
  if (typeof record.percentileBeat === 'number') count += 1;
  if (
    typeof record.stages?.deep?.minutes === 'number' ||
    typeof record.stages?.deep?.percent === 'number'
  ) {
    count += 1;
  }
  if (
    typeof record.stages?.light?.minutes === 'number' ||
    typeof record.stages?.light?.percent === 'number'
  ) {
    count += 1;
  }
  if (
    typeof record.stages?.rem?.minutes === 'number' ||
    typeof record.stages?.rem?.percent === 'number'
  ) {
    count += 1;
  }
  if (typeof record.deepSleepContinuityScore === 'number') count += 1;
  if (typeof record.breathingQualityScore === 'number') count += 1;
  if (typeof record.awakeCount === 'number') count += 1;
  return count;
}

export function buildRawSleepInfographic(record: DailySleepRecord): RawSleepInfographic {
  const header = parseThaiHeaderParts(record.date, record.dateLabel);
  const startDate = resolveSleepStartDate(record.date, record.bedtime, record.wakeTime);
  const startMmdd = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? `${startDate.slice(5, 7)}/${startDate.slice(8, 10)}`
    : startDate;
  const wakeMmdd = /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    ? `${record.date.slice(5, 7)}/${record.date.slice(8, 10)}`
    : record.date;
  const start = parseTime24h(record.bedtime);
  const wake = parseTime24h(record.wakeTime);

  const totalMins =
    typeof record.totalSleepMinutes === 'number' && Number.isFinite(record.totalSleepMinutes)
      ? Math.max(0, Math.round(record.totalSleepMinutes))
      : null;

  const scoreVal = typeof record.sleepScore === 'number' ? record.sleepScore : null;
  const existingStar =
    record.rawInfographic?.sleep_score_raw?.star_rating_raw?.derived_numeric_rating;
  const derivedRating =
    typeof existingStar === 'number' && existingStar >= 0 && existingStar <= 5
      ? Math.round(existingStar * 2) / 2
      : null;
  const fullStars = derivedRating != null ? Math.floor(derivedRating) : null;
  const halfStars = derivedRating != null ? (derivedRating % 1 >= 0.5 ? 1 : 0) : null;

  const buildStage = (stageKey: 'deep' | 'light' | 'rem', defaultLabel: string) => {
    const st = record.stages[stageKey];
    const mins =
      typeof st.minutes === 'number' && Number.isFinite(st.minutes) && st.minutes >= 0
        ? Math.round(st.minutes)
        : null;
    const pct = typeof st.percent === 'number' ? st.percent : null;
    const rawRef = st.referenceRange || null;
    const existingStage =
      stageKey === 'deep'
        ? record.rawInfographic?.sleep_stages_raw?.deep_sleep
        : stageKey === 'light'
          ? record.rawInfographic?.sleep_stages_raw?.light_sleep
          : record.rawInfographic?.sleep_stages_raw?.rem_sleep;

    return {
      stage_key: stageKey,
      label_th: existingStage?.label_th || defaultLabel,
      duration_hours: mins != null ? Math.floor(mins / 60) : null,
      duration_minutes: mins != null ? mins % 60 : null,
      duration_total_minutes: mins,
      duration_total_seconds: mins != null ? mins * 60 : null,
      duration_raw_text: st.durationText || (mins != null ? formatThaiFullDuration(mins) : null),
      percentage_value: pct,
      percentage_unit: '%',
      percentage_raw_text: pct != null ? `${pct}%` : null,
      status_label_th: st.status ?? null,
      reference_range: rawRef ? parseReferenceRange(rawRef, 'percent', 'unit') : null,
    };
  };

  const standardFound = countStandardHuaweiFields(record);

  return {
    schema_version: '2.1-huawei-standard',
    scan_metadata: {
      standard: 'huawei_health_v1',
      source_app: record.sourceApp || 'Health App',
      detected_language: record.scanSummary?.detectedLanguage || 'unknown',
      confidence:
        record.scanSummary?.confidence ||
        (standardFound >= 6 ? 'high' : standardFound >= 2 ? 'medium' : 'low'),
      standard_fields_found: standardFound,
      standard_fields_total: STANDARD_HUAWEI_FIELDS_TOTAL,
      scannable_sections: record.scanSummary?.scannableSections ?? [],
      skipped_sections: record.scanSummary?.skippedSections ?? [],
    },
    record_header: header,
    sleep_window: {
      sleep_start_date: start.time_24h ? startDate : null,
      sleep_start_time_24h: start.time_24h,
      sleep_start_hour: start.hour,
      sleep_start_minute: start.minute,
      sleep_start_raw_label: start.time_24h ? `${startMmdd} เวลานอน ${start.time_24h} น.` : null,
      wake_up_date: wake.time_24h ? record.date : null,
      wake_up_time_24h: wake.time_24h,
      wake_up_hour: wake.hour,
      wake_up_minute: wake.minute,
      wake_up_raw_label: wake.time_24h ? `${wakeMmdd} ตื่นนอน ${wake.time_24h} น.` : null,
    },
    total_sleep_duration: {
      hours: totalMins != null ? Math.floor(totalMins / 60) : null,
      minutes: totalMins != null ? totalMins % 60 : null,
      total_minutes: totalMins,
      total_seconds: totalMins != null ? totalMins * 60 : null,
      decimal_hours: totalMins != null ? Number((totalMins / 60).toFixed(4)) : null,
      raw_text: record.totalSleepText || (totalMins != null ? formatThaiFullDuration(totalMins) : null),
      status_label_th: record.totalSleepStatus ?? null,
      reference_range: record.totalSleepReference
        ? parseReferenceRange(record.totalSleepReference, 'hour', 'unit')
        : null,
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
        total_displayed_stars: derivedRating != null ? 5 : null,
        derived_numeric_rating: derivedRating,
      },
    },
    sleep_stages_raw: {
      deep_sleep: buildStage('deep', 'นอนหลับสนิท'),
      light_sleep: buildStage('light', 'นอนหลับตื้น'),
      rem_sleep: buildStage('rem', 'นอนหลับ REM'),
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
        reference_range: record.deepSleepContinuityReference
          ? parseReferenceRange(record.deepSleepContinuityReference, 'คะแนน', 'unit_th')
          : null,
      },
      breathing_quality: {
        metric_key: 'breathing_quality',
        label_th: 'คุณภาพการหายใจ',
        numeric_value: record.breathingQualityScore ?? null,
        unit_th: 'คะแนน',
        raw_text:
          record.breathingQualityScore != null ? `${record.breathingQualityScore} คะแนน` : null,
        status_label_th: record.breathingQualityStatus ?? null,
        reference_range: record.breathingQualityReference
          ? parseReferenceRange(record.breathingQualityReference, 'คะแนน', 'unit_th')
          : null,
      },
      awakenings_count: {
        metric_key: 'awakenings',
        label_th: 'จำนวนครั้งที่ตื่นนอน',
        numeric_value: record.awakeCount ?? null,
        unit_th: 'ครั้ง',
        raw_text: record.awakeCount != null ? `${record.awakeCount} ครั้ง` : null,
        status_label_th: record.awakeStatus ?? null,
        reference_range: record.awakeReference
          ? parseReferenceRange(record.awakeReference, 'ครั้ง', 'unit_th')
          : null,
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
  const sourceApp = raw.scan_metadata?.source_app || 'Health App';

  const record: DailySleepRecord = {
    id: `sleep_${date}`,
    date,
    dateLabel: raw.record_header?.raw_header_text || date,
    sourceApp,
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
        minutes: typeof deep?.duration_total_minutes === 'number' ? deep.duration_total_minutes : null,
        durationText: deep?.duration_raw_text ?? null,
        percent: deep?.percentage_value ?? null,
        status: deep?.status_label_th ?? null,
        referenceRange: deep?.reference_range?.raw_text ?? null,
      },
      light: {
        minutes: typeof light?.duration_total_minutes === 'number' ? light.duration_total_minutes : null,
        durationText: light?.duration_raw_text ?? null,
        percent: light?.percentage_value ?? null,
        status: light?.status_label_th ?? null,
        referenceRange: light?.reference_range?.raw_text ?? null,
      },
      rem: {
        minutes: typeof rem?.duration_total_minutes === 'number' ? rem.duration_total_minutes : null,
        durationText: rem?.duration_raw_text ?? null,
        percent: rem?.percentage_value ?? null,
        status: rem?.status_label_th ?? null,
        referenceRange: rem?.reference_range?.raw_text ?? null,
      },
    },
    deepSleepContinuityScore: raw.sub_metrics_raw?.deep_sleep_continuity?.numeric_value ?? null,
    deepSleepContinuityStatus: raw.sub_metrics_raw?.deep_sleep_continuity?.status_label_th ?? null,
    deepSleepContinuityReference: raw.sub_metrics_raw?.deep_sleep_continuity?.reference_range?.raw_text ?? null,
    awakeCount: raw.sub_metrics_raw?.awakenings_count?.numeric_value ?? null,
    awakeStatus: raw.sub_metrics_raw?.awakenings_count?.status_label_th ?? null,
    awakeReference: raw.sub_metrics_raw?.awakenings_count?.reference_range?.raw_text ?? null,
    breathingQualityScore: raw.sub_metrics_raw?.breathing_quality?.numeric_value ?? null,
    breathingQualityStatus: raw.sub_metrics_raw?.breathing_quality?.status_label_th ?? null,
    breathingQualityReference: raw.sub_metrics_raw?.breathing_quality?.reference_range?.raw_text ?? null,
    previousDayStressScore: null,
    appInsights: [],
    appRecommendation: null,
    scanSummary: null,
    rawInfographic: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const standardFound = countStandardHuaweiFields(record);
  record.scanSummary = raw.scan_metadata
    ? {
        isSleepScreenshot: true,
        detectedApp: sourceApp,
        detectedLanguage: raw.scan_metadata.detected_language || 'unknown',
        scannableSections: raw.scan_metadata.scannable_sections ?? [],
        skippedSections: raw.scan_metadata.skipped_sections ?? [],
        confidence: raw.scan_metadata.confidence || 'medium',
        standardFieldsFound: standardFound,
        standardFieldsTotal: STANDARD_HUAWEI_FIELDS_TOTAL,
      }
    : null;

  // Preserve star rating from imported raw JSON while regenerating clean canonical v2.1 shape
  record.rawInfographic = raw;
  record.rawInfographic = buildRawSleepInfographic(record);
  return record;
}

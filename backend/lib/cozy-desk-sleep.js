const { PRIMARY_MODEL } = require("./cozy-desk-state.js");

function toFiniteNumberOrNull(val) {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toCleanStringOrNull(val, maxLen = 240) {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

const STANDARD_HUAWEI_FIELDS_TOTAL = 10;

function sanitizeSleepStage(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const rawMinutes = toFiniteNumberOrNull(obj.minutes);
  const minutes = rawMinutes !== null && rawMinutes >= 0 ? Math.round(rawMinutes) : null;
  const hrs = minutes !== null ? Math.floor(minutes / 60) : 0;
  const remMins = minutes !== null ? minutes % 60 : 0;
  const fallbackText =
    minutes !== null && minutes > 0
      ? hrs > 0
        ? `${hrs} ชั่วโมง ${remMins} นาที`
        : `${remMins} นาที`
      : minutes === 0
        ? "0 นาที"
        : null;
  return {
    minutes,
    durationText: toCleanStringOrNull(obj.durationText, 80) ?? fallbackText,
    percent: toFiniteNumberOrNull(obj.percent),
    status: toCleanStringOrNull(obj.status, 40),
    referenceRange: toCleanStringOrNull(obj.referenceRange, 60),
  };
}

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const THAI_WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function parseThaiHeaderParts(dateIso, dateLabel) {
  const parsed = new Date(`${dateIso}T12:00:00`);
  const validDate = !Number.isNaN(parsed.getTime());
  const defaultShort = validDate
    ? `${parsed.getDate()} ${THAI_MONTHS_SHORT[parsed.getMonth()]}`
    : dateIso;
  const defaultWeekday = validDate ? THAI_WEEKDAYS_SHORT[parsed.getDay()] : "";
  const trimmed = (dateLabel || "").trim();
  const match = trimmed.match(/^(อา\.|จ\.|อ\.|พ\.|พฤ\.|ศ\.|ส\.)\s+(.+)$/);
  return {
    date_iso: dateIso,
    date_short_th: match ? match[2].trim() : defaultShort,
    weekday_short_th: match ? match[1] : defaultWeekday,
    raw_header_text: trimmed || (defaultWeekday ? `${defaultWeekday} ${defaultShort}` : defaultShort),
  };
}

function parseTime24hParts(timeStr) {
  if (!timeStr || typeof timeStr !== "string") {
    return { time_24h: null, hour: null, minute: null };
  }
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { time_24h: timeStr.trim(), hour: null, minute: null };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return {
    time_24h: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour: Number.isFinite(hour) ? hour : null,
    minute: Number.isFinite(minute) ? minute : null,
  };
}

function parseReferenceRangeObj(rawText, defaultUnit, unitKey = "unit") {
  const raw = (rawText || "").trim();
  if (!raw) return null;
  const betweenMatch = raw.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (betweenMatch) {
    return {
      raw_text: raw,
      [unitKey]: defaultUnit,
      min_value: Number(betweenMatch[1]),
      max_value: Number(betweenMatch[2]),
      operator: "between_inclusive",
    };
  }
  const ltMatch = raw.match(/<\s*(\d+(?:\.\d+)?)/);
  if (ltMatch) {
    return {
      raw_text: raw,
      [unitKey]: defaultUnit,
      min_value: null,
      max_value: Number(ltMatch[1]),
      operator: "less_than",
    };
  }
  return {
    raw_text: raw,
    [unitKey]: defaultUnit,
    min_value: null,
    max_value: null,
    operator: "unknown",
  };
}

function formatThaiFullDuration(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs > 0 && mins > 0) return `${hrs} ชั่วโมง ${mins} นาที`;
  if (hrs > 0) return `${hrs} ชั่วโมง`;
  return `${mins} นาที`;
}

function shiftIsoDateDays(dateIso, deltaDays) {
  if (typeof dateIso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return dateIso;
  }
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  if (Number.isNaN(dt.getTime())) return dateIso;
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function resolveSleepStartDate(wakeDateIso, bedtime, wakeTime) {
  const start = parseTime24hParts(bedtime);
  const wake = parseTime24hParts(wakeTime);
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

function sanitizeStringList(rawList, maxItems = 12, maxLen = 120) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  for (const item of rawList) {
    const clean = toCleanStringOrNull(item, maxLen);
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

function countStandardHuaweiFields(record) {
  if (!record || typeof record !== "object") return 0;
  let count = 0;
  if (Boolean(record.bedtime || record.wakeTime)) count += 1;
  if (typeof record.totalSleepMinutes === "number" && record.totalSleepMinutes > 0) count += 1;
  if (typeof record.sleepScore === "number") count += 1;
  if (typeof record.percentileBeat === "number") count += 1;
  if (
    typeof record.stages?.deep?.minutes === "number" ||
    typeof record.stages?.deep?.percent === "number"
  ) {
    count += 1;
  }
  if (
    typeof record.stages?.light?.minutes === "number" ||
    typeof record.stages?.light?.percent === "number"
  ) {
    count += 1;
  }
  if (
    typeof record.stages?.rem?.minutes === "number" ||
    typeof record.stages?.rem?.percent === "number"
  ) {
    count += 1;
  }
  if (typeof record.deepSleepContinuityScore === "number") count += 1;
  if (typeof record.breathingQualityScore === "number") count += 1;
  if (typeof record.awakeCount === "number") count += 1;
  return count;
}

function sanitizeScanSummary(rawSummary, record) {
  const obj = rawSummary && typeof rawSummary === "object" ? rawSummary : {};
  const found = countStandardHuaweiFields(record);
  const rawConf = String(obj.confidence || "").trim().toLowerCase();
  const confidence =
    rawConf === "high" || rawConf === "medium" || rawConf === "low"
      ? rawConf
      : found >= 6
        ? "high"
        : found >= 2
          ? "medium"
          : "low";

  return {
    isSleepScreenshot: obj.isSleepScreenshot !== false,
    detectedApp:
      toCleanStringOrNull(obj.detectedApp, 80) ??
      toCleanStringOrNull(record.sourceApp, 80) ??
      "Health App",
    detectedLanguage: toCleanStringOrNull(obj.detectedLanguage, 24) ?? "unknown",
    scannableSections: sanitizeStringList(obj.scannableSections, 12, 100),
    skippedSections: sanitizeStringList(obj.skippedSections, 14, 120),
    confidence,
    standardFieldsFound: found,
    standardFieldsTotal: STANDARD_HUAWEI_FIELDS_TOTAL,
  };
}

function buildRawSleepInfographic(record, starRatingHint = null) {
  const header = parseThaiHeaderParts(record.date, record.dateLabel);
  const startDate = resolveSleepStartDate(record.date, record.bedtime, record.wakeTime);
  const startMmdd = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? `${startDate.slice(5, 7)}/${startDate.slice(8, 10)}`
    : startDate;
  const wakeMmdd = /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    ? `${record.date.slice(5, 7)}/${record.date.slice(8, 10)}`
    : record.date;
  const start = parseTime24hParts(record.bedtime);
  const wake = parseTime24hParts(record.wakeTime);
  const totalMins =
    typeof record.totalSleepMinutes === "number" && Number.isFinite(record.totalSleepMinutes)
      ? Math.max(0, Math.round(record.totalSleepMinutes))
      : null;

  const scoreVal = typeof record.sleepScore === "number" ? record.sleepScore : null;
  const existingStarRating = toFiniteNumberOrNull(
    record.rawInfographic?.sleep_score_raw?.star_rating_raw?.derived_numeric_rating
  );
  const rawStar = starRatingHint !== null ? starRatingHint : existingStarRating;
  const derivedRating =
    typeof rawStar === "number" && rawStar >= 0 && rawStar <= 5
      ? Math.round(rawStar * 2) / 2
      : null;
  const fullStars = derivedRating != null ? Math.floor(derivedRating) : null;
  const halfStars = derivedRating != null ? (derivedRating % 1 >= 0.5 ? 1 : 0) : null;

  const buildStage = (stageKey, defaultLabel) => {
    const st = record.stages?.[stageKey] || {};
    const mins =
      typeof st.minutes === "number" && Number.isFinite(st.minutes) && st.minutes >= 0
        ? Math.round(st.minutes)
        : null;
    const pct = typeof st.percent === "number" ? st.percent : null;
    const rawRef = st.referenceRange || null;
    return {
      stage_key: stageKey,
      label_th: defaultLabel,
      duration_hours: mins != null ? Math.floor(mins / 60) : null,
      duration_minutes: mins != null ? mins % 60 : null,
      duration_total_minutes: mins,
      duration_total_seconds: mins != null ? mins * 60 : null,
      duration_raw_text:
        st.durationText || (mins != null ? formatThaiFullDuration(mins) : null),
      percentage_value: pct,
      percentage_unit: "%",
      percentage_raw_text: pct != null ? `${pct}%` : null,
      status_label_th: st.status ?? null,
      reference_range: rawRef ? parseReferenceRangeObj(rawRef, "percent", "unit") : null,
    };
  };

  const scanSummary = sanitizeScanSummary(record.scanSummary, record);

  return {
    schema_version: "2.1-huawei-standard",
    scan_metadata: {
      standard: "huawei_health_v1",
      source_app: record.sourceApp || "Health App",
      detected_language: scanSummary.detectedLanguage,
      confidence: scanSummary.confidence,
      standard_fields_found: scanSummary.standardFieldsFound,
      standard_fields_total: scanSummary.standardFieldsTotal,
      scannable_sections: scanSummary.scannableSections,
      skipped_sections: scanSummary.skippedSections,
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
      raw_text:
        record.totalSleepText || (totalMins != null ? formatThaiFullDuration(totalMins) : null),
      status_label_th: record.totalSleepStatus ?? null,
      reference_range: record.totalSleepReference
        ? parseReferenceRangeObj(record.totalSleepReference, "hour", "unit")
        : null,
    },
    sleep_score_raw: {
      score_value: scoreVal,
      score_unit_th: "คะแนน",
      better_than_users: {
        percent_value: record.percentileBeat ?? null,
        unit: "%",
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
      deep_sleep: buildStage("deep", "นอนหลับสนิท"),
      light_sleep: buildStage("light", "นอนหลับตื้น"),
      rem_sleep: buildStage("rem", "นอนหลับ REM"),
    },
    sub_metrics_raw: {
      deep_sleep_continuity: {
        metric_key: "deep_sleep_continuity",
        label_th: "ความต่อเนื่องของการนอนหลับลึก",
        numeric_value: record.deepSleepContinuityScore ?? null,
        unit_th: "คะแนน",
        raw_text:
          record.deepSleepContinuityScore != null
            ? `${record.deepSleepContinuityScore} คะแนน`
            : null,
        status_label_th: record.deepSleepContinuityStatus ?? null,
        reference_range: record.deepSleepContinuityReference
          ? parseReferenceRangeObj(record.deepSleepContinuityReference, "คะแนน", "unit_th")
          : null,
      },
      breathing_quality: {
        metric_key: "breathing_quality",
        label_th: "คุณภาพการหายใจ",
        numeric_value: record.breathingQualityScore ?? null,
        unit_th: "คะแนน",
        raw_text:
          record.breathingQualityScore != null ? `${record.breathingQualityScore} คะแนน` : null,
        status_label_th: record.breathingQualityStatus ?? null,
        reference_range: record.breathingQualityReference
          ? parseReferenceRangeObj(record.breathingQualityReference, "คะแนน", "unit_th")
          : null,
      },
      awakenings_count: {
        metric_key: "awakenings",
        label_th: "จำนวนครั้งที่ตื่นนอน",
        numeric_value: record.awakeCount ?? null,
        unit_th: "ครั้ง",
        raw_text: record.awakeCount != null ? `${record.awakeCount} ครั้ง` : null,
        status_label_th: record.awakeStatus ?? null,
        reference_range: record.awakeReference
          ? parseReferenceRangeObj(record.awakeReference, "ครั้ง", "unit_th")
          : null,
      },
    },
  };
}

function sanitizeSleepRecord(raw, fallbackDate = new Date().toISOString().slice(0, 10)) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const nowIso = new Date().toISOString();
  const rawDate = toCleanStringOrNull(obj.date, 20);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : fallbackDate;
  const id =
    toCleanStringOrNull(obj.id, 80) ?? `sleep_${date}_${Date.now().toString(36)}`;
  const stagesObj = obj.stages && typeof obj.stages === "object" ? obj.stages : {};
  const deep = sanitizeSleepStage(stagesObj.deep);
  const light = sanitizeSleepStage(stagesObj.light);
  const rem = sanitizeSleepStage(stagesObj.rem);

  const stageValues = [deep.minutes, light.minutes, rem.minutes].filter(
    (v) => typeof v === "number" && v >= 0
  );
  const stageSum = stageValues.reduce((sum, v) => sum + v, 0);
  const totalSleepMinutes =
    toFiniteNumberOrNull(obj.totalSleepMinutes) ??
    (stageValues.length > 0 && stageSum > 0 ? stageSum : null);

  let aiAnalysis = null;
  if (obj.aiAnalysis && typeof obj.aiAnalysis === "object") {
    const a = obj.aiAnalysis;
    const summary = toCleanStringOrNull(a.summary, 1200);
    if (summary) {
      aiAnalysis = {
        summary,
        strengths: Array.isArray(a.strengths)
          ? a.strengths.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        concerns: Array.isArray(a.concerns)
          ? a.concerns.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        actionableTips: Array.isArray(a.actionableTips)
          ? a.actionableTips.map((s) => toCleanStringOrNull(s, 300)).filter(Boolean).slice(0, 6)
          : [],
        circadianNote: toCleanStringOrNull(a.circadianNote, 500) ?? "",
        analyzedAt: toCleanStringOrNull(a.analyzedAt, 40) ?? nowIso,
        model: toCleanStringOrNull(a.model, 60) ?? PRIMARY_MODEL,
      };
    }
  }

  const baseRecord = {
    id,
    date,
    dateLabel: toCleanStringOrNull(obj.dateLabel, 60) ?? date,
    sourceApp: toCleanStringOrNull(obj.sourceApp, 80) ?? "Health App",
    userLabel: null,
    sleepScore: toFiniteNumberOrNull(obj.sleepScore),
    percentileBeat: toFiniteNumberOrNull(obj.percentileBeat),
    bedtime: toCleanStringOrNull(obj.bedtime, 20),
    wakeTime: toCleanStringOrNull(obj.wakeTime, 20),
    totalSleepMinutes,
    totalSleepText:
      toCleanStringOrNull(obj.totalSleepText, 80) ??
      (totalSleepMinutes != null
        ? `${Math.floor(totalSleepMinutes / 60)} ชั่วโมง ${totalSleepMinutes % 60} นาที`
        : null),
    totalSleepStatus: toCleanStringOrNull(obj.totalSleepStatus, 40),
    totalSleepReference: toCleanStringOrNull(obj.totalSleepReference, 60),
    stages: { deep, light, rem },
    deepSleepContinuityScore: toFiniteNumberOrNull(obj.deepSleepContinuityScore),
    deepSleepContinuityStatus: toCleanStringOrNull(obj.deepSleepContinuityStatus, 40),
    deepSleepContinuityReference:
      toCleanStringOrNull(obj.deepSleepContinuityReference, 60) ??
      toCleanStringOrNull(obj.rawInfographic?.sub_metrics_raw?.deep_sleep_continuity?.reference_range?.raw_text, 60),
    awakeCount: toFiniteNumberOrNull(obj.awakeCount),
    awakeStatus: toCleanStringOrNull(obj.awakeStatus, 40),
    awakeReference:
      toCleanStringOrNull(obj.awakeReference, 60) ??
      toCleanStringOrNull(obj.rawInfographic?.sub_metrics_raw?.awakenings_count?.reference_range?.raw_text, 60),
    breathingQualityScore: toFiniteNumberOrNull(obj.breathingQualityScore),
    breathingQualityStatus: toCleanStringOrNull(obj.breathingQualityStatus, 40),
    breathingQualityReference:
      toCleanStringOrNull(obj.breathingQualityReference, 60) ??
      toCleanStringOrNull(obj.rawInfographic?.sub_metrics_raw?.breathing_quality?.reference_range?.raw_text, 60),
    previousDayStressScore: null,
    appInsights: [],
    appRecommendation: null,
    scanSummary: null,
    aiAnalysis,
    createdAt: toCleanStringOrNull(obj.createdAt, 40) ?? nowIso,
    updatedAt: nowIso,
  };

  baseRecord.scanSummary = sanitizeScanSummary(obj.scanSummary, baseRecord);

  const starHint = toFiniteNumberOrNull(
    obj.rawInfographic?.sleep_score_raw?.star_rating_raw?.derived_numeric_rating
  );
  baseRecord.rawInfographic = buildRawSleepInfographic(baseRecord, starHint);

  return baseRecord;
}

const SLEEP_DATE_DETECT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isSleepScreenshot: { type: "BOOLEAN" },
    date: { type: "STRING" },
    dateLabel: { type: "STRING" },
  },
  required: ["isSleepScreenshot", "date"],
};

const SLEEP_EXTRACT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isSleepScreenshot: { type: "BOOLEAN" },
    detectedLanguage: { type: "STRING" },
    confidence: { type: "STRING" },
    scannableSections: { type: "ARRAY", items: { type: "STRING" } },
    skippedSections: { type: "ARRAY", items: { type: "STRING" } },
    date: { type: "STRING" },
    dateLabel: { type: "STRING" },
    sourceApp: { type: "STRING" },
    sleepScore: { type: "NUMBER" },
    percentileBeat: { type: "NUMBER" },
    starRating: { type: "NUMBER" },
    bedtime: { type: "STRING" },
    wakeTime: { type: "STRING" },
    totalSleepMinutes: { type: "NUMBER" },
    totalSleepText: { type: "STRING" },
    totalSleepStatus: { type: "STRING" },
    totalSleepReference: { type: "STRING" },
    deepMinutes: { type: "NUMBER" },
    deepText: { type: "STRING" },
    deepPercent: { type: "NUMBER" },
    deepStatus: { type: "STRING" },
    deepReference: { type: "STRING" },
    lightMinutes: { type: "NUMBER" },
    lightText: { type: "STRING" },
    lightPercent: { type: "NUMBER" },
    lightStatus: { type: "STRING" },
    lightReference: { type: "STRING" },
    remMinutes: { type: "NUMBER" },
    remText: { type: "STRING" },
    remPercent: { type: "NUMBER" },
    remStatus: { type: "STRING" },
    remReference: { type: "STRING" },
    deepSleepContinuityScore: { type: "NUMBER" },
    deepSleepContinuityStatus: { type: "STRING" },
    deepSleepContinuityReference: { type: "STRING" },
    awakeCount: { type: "NUMBER" },
    awakeStatus: { type: "STRING" },
    awakeReference: { type: "STRING" },
    breathingQualityScore: { type: "NUMBER" },
    breathingQualityStatus: { type: "STRING" },
    breathingQualityReference: { type: "STRING" },
  },
  required: ["isSleepScreenshot", "sourceApp", "scannableSections", "skippedSections"],
};

const SLEEP_ANALYZE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    concerns: { type: "ARRAY", items: { type: "STRING" } },
    circadianNote: { type: "STRING" },
    actionableTips: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "strengths", "concerns", "circadianNote", "actionableTips"],
};

function formatSleepLogsContext(sleepLogs) {
  const logs = Array.isArray(sleepLogs) ? sleepLogs : [];
  if (logs.length === 0) {
    return [
      "ข้อมูลบันทึกการนอนประจำวัน (จากภารกิจในห้องนอน): ยังไม่มีข้อมูลการนอนที่บันทึกไว้",
      "- หากผู้ใช้ถามถึงข้อมูลการนอน ให้แนะนำว่าให้เดินไปที่โต๊ะข้างเตียงฝั่งขวาในห้องนอนใหญ่เพื่ออัปโหลดภาพสถิติการนอน (จากเครื่องหรือ Google Drive) เก็บสะสมเป็นไฟล์ .json รายวัน แล้วส่งให้มีน่าสรุปภาพรวมทางแชทนี้ได้เลย",
    ].join("\n");
  }
  const lines = logs.map((log) => {
    const dur =
      log.totalSleepText ||
      (typeof log.totalSleepMinutes === "number"
        ? `${Math.floor(log.totalSleepMinutes / 60)} ชม. ${log.totalSleepMinutes % 60} นาที`
        : "ไม่ระบุ");
    const score = typeof log.sleepScore === "number" ? `${log.sleepScore} คะแนน` : "ไม่ระบุคะแนน";
    const windowStr = log.bedtime && log.wakeTime ? `เวลานอน ${log.bedtime}–${log.wakeTime}` : "ไม่ระบุช่วงเวลา";
    const deep = log.stages?.deep;
    const light = log.stages?.light;
    const rem = log.stages?.rem;
    const stageParts = [];
    if (deep && (deep.minutes != null || deep.percent != null)) {
      stageParts.push(
        `หลับลึก ${deep.durationText || (deep.minutes != null ? `${deep.minutes}น.` : "—")}${deep.percent != null ? ` (${deep.percent}%)` : ""}`
      );
    }
    if (light && (light.minutes != null || light.percent != null)) {
      stageParts.push(
        `หลับตื้น ${light.durationText || (light.minutes != null ? `${light.minutes}น.` : "—")}${light.percent != null ? ` (${light.percent}%)` : ""}`
      );
    }
    if (rem && (rem.minutes != null || rem.percent != null)) {
      stageParts.push(
        `REM ${rem.durationText || (rem.minutes != null ? `${rem.minutes}น.` : "—")}${rem.percent != null ? ` (${rem.percent}%)` : ""}`
      );
    }
    const extraParts = [];
    if (typeof log.deepSleepContinuityScore === "number") extraParts.push(`ต่อเนื่องหลับลึก ${log.deepSleepContinuityScore}`);
    if (typeof log.breathingQualityScore === "number") extraParts.push(`หายใจ ${log.breathingQualityScore}`);
    if (typeof log.awakeCount === "number") extraParts.push(`ตื่น ${log.awakeCount} ครั้ง`);
    const stagesText = stageParts.length > 0 ? ` | ${stageParts.join(", ")}` : "";
    const extraText = extraParts.length > 0 ? ` | ${extraParts.join(", ")}` : "";
    return `- วันที่ ${log.date} (${log.dateLabel || log.date}): ${score} | ${dur} | ${windowStr}${stagesText}${extraText}`;
  });
  return [
    `ข้อมูลบันทึกการนอนประจำวันจริง (.json มาตรฐาน Huawei Health ทั้งหมด ${logs.length} วัน):`,
    "- ห้ามกล่าวถึงข้อมูลที่ไม่เกี่ยวข้องกับการนอนเด็ดขาด (เช่น ข้อมูลส่วนตัว/ชื่อบัญชีผู้ใช้ หรือคำแนะนำสุขภาพที่ไม่ได้อยู่ในข้อมูลจริง)",
    ...lines,
  ].join("\n");
}

function formatThaiMinutesText(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) return "—";
  const rounded = Math.round(minutes);
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hrs > 0 && mins > 0) return `${hrs} ชั่วโมง ${mins} นาที`;
  if (hrs > 0) return `${hrs} ชั่วโมง`;
  return `${mins} นาที`;
}

const THAI_FULL_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const THAI_FULL_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function formatThaiFullDate(dateIso) {
  const parsed = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  const day = parsed.getDate();
  const month = THAI_FULL_MONTHS[parsed.getMonth()];
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatThaiWeekdayDate(dateIso) {
  const parsed = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  const weekday = THAI_FULL_WEEKDAYS[parsed.getDay()];
  return `วัน${weekday}ที่ ${formatThaiFullDate(dateIso)}`;
}

function buildDeterministicSleepSummary(sleepLogs) {
  const logs = (Array.isArray(sleepLogs) ? sleepLogs : [])
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  if (logs.length === 0) {
    return "ยังไม่มีข้อมูลบันทึกการนอนที่สะสมไว้ในระบบครับ";
  }

  const avg = (arr) =>
    arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

  const scores = logs.map((l) => l.sleepScore).filter((n) => typeof n === "number");
  const durations = logs
    .map((l) => l.totalSleepMinutes)
    .filter((n) => typeof n === "number" && n > 0);
  const deepMins = logs.map((l) => l.stages?.deep?.minutes).filter((n) => typeof n === "number" && n > 0);
  const deepPcts = logs.map((l) => l.stages?.deep?.percent).filter((n) => typeof n === "number");
  const lightMins = logs.map((l) => l.stages?.light?.minutes).filter((n) => typeof n === "number" && n > 0);
  const lightPcts = logs.map((l) => l.stages?.light?.percent).filter((n) => typeof n === "number");
  const remMins = logs.map((l) => l.stages?.rem?.minutes).filter((n) => typeof n === "number" && n > 0);
  const remPcts = logs.map((l) => l.stages?.rem?.percent).filter((n) => typeof n === "number");
  const continuities = logs
    .map((l) => l.deepSleepContinuityScore)
    .filter((n) => typeof n === "number");
  const breathings = logs
    .map((l) => l.breathingQualityScore)
    .filter((n) => typeof n === "number");
  const awakes = logs.map((l) => l.awakeCount).filter((n) => typeof n === "number");

  const oldest = logs[logs.length - 1];
  const newest = logs[0];
  const dateRangeText =
    logs.length === 1 || oldest.date === newest.date
      ? `${formatThaiFullDate(newest.date)} (${newest.date})`
      : `${formatThaiFullDate(oldest.date)} – ${formatThaiFullDate(newest.date)}`;

  const bedtimes = logs.map((l) => l.bedtime).filter(Boolean);
  const waketimes = logs.map((l) => l.wakeTime).filter(Boolean);
  const windowSummary =
    bedtimes.length > 0 && waketimes.length > 0
      ? `${bedtimes[0]} น. – ${waketimes[0]} น.`
      : "—";

  const lines = [
    `สวัสดีค่ะคุณผู้ใช้ มีน่า (Mina) จัดเตรียมสรุปภาพรวมข้อมูลการนอนประจำห้องทำงาน Cozy Desk มาให้แล้วนะคะ เรียบเรียงข้อมูลจริงจากไฟล์ \`.json\` ทั้งหมด ${logs.length} วัน แบบกระชับ อ่านง่าย และพร้อมนำไปใช้ต่อได้ทันทีค่ะ`,
    "",
    "---",
    "",
    "### 📊 ภาพรวมสถิติการนอนทั้งหมด",
    "",
    `* **จำนวนวันที่บันทึก:** ${logs.length} วัน`,
    `* **ช่วงวันที่:** ${dateRangeText}`,
    "* **คะแนนการนอน (Sleep Score):**",
    `  * ค่าเฉลี่ย: ${avg(scores) != null ? `${avg(scores)} คะแนน` : "—"}`,
    `  * ต่ำสุด: ${scores.length > 0 ? `${Math.min(...scores)} คะแนน` : "—"}`,
    `  * สูงสุด: ${scores.length > 0 ? `${Math.max(...scores)} คะแนน` : "—"}`,
    "* **ระยะเวลานอนรวม:**",
    `  * ค่าเฉลี่ย: ${formatThaiMinutesText(avg(durations))}`,
    `  * ต่ำสุด / สูงสุด: ${
      durations.length > 0
        ? `${formatThaiMinutesText(Math.min(...durations))} / ${formatThaiMinutesText(Math.max(...durations))}`
        : "—"
    }`,
    `* **ช่วงเวลาเข้านอน – ตื่นนอน (โดยรวม):** ${windowSummary}`,
    "* **สัดส่วนและระยะเวลาเฉลี่ยของคุณภาพการนอน:**",
    `  * **หลับลึก (Deep Sleep):** ${formatThaiMinutesText(avg(deepMins))}${avg(deepPcts) != null ? ` (${avg(deepPcts)}%)` : ""}`,
    `  * **หลับตื้น (Light Sleep):** ${formatThaiMinutesText(avg(lightMins))}${avg(lightPcts) != null ? ` (${avg(lightPcts)}%)` : ""}`,
    `  * **REM Sleep:** ${formatThaiMinutesText(avg(remMins))}${avg(remPcts) != null ? ` (${avg(remPcts)}%)` : ""}`,
    "* **ค่าตัวชี้วัดเสริม (ภาพรวม):**",
    `  * ความต่อเนื่องในการหลับลึก: ${avg(continuities) ?? "—"}`,
    `  * คะแนนการหายใจ: ${avg(breathings) ?? "—"}`,
    `  * จำนวนครั้งที่ตื่น: ${avg(awakes) != null ? `${avg(awakes)} ครั้ง` : "—"}`,
    "",
    "---",
    "",
    "### 📅 รายการสรุปรายวัน",
    "",
  ];

  logs.forEach((log, idx) => {
    const scoreStr = typeof log.sleepScore === "number" ? `${log.sleepScore} คะแนน` : "—";
    const durStr = log.totalSleepText || formatThaiMinutesText(log.totalSleepMinutes);
    const timeStr =
      log.bedtime && log.wakeTime ? `เข้านอน ${log.bedtime} น. – ตื่นนอน ${log.wakeTime} น.` : "—";
    const deep = log.stages?.deep;
    const light = log.stages?.light;
    const rem = log.stages?.rem;
    const contStr = log.deepSleepContinuityScore ?? "—";
    const breathStr = log.breathingQualityScore ?? "—";
    const awakeStr = log.awakeCount != null ? `${log.awakeCount} ครั้ง` : "—";

    lines.push(`**${idx + 1}. ${formatThaiWeekdayDate(log.date)}**`);
    lines.push(`* **คะแนนการนอน:** ${scoreStr}`);
    lines.push(`* **ระยะเวลานอน:** ${durStr}`);
    lines.push(`* **ช่วงเวลา:** ${timeStr}`);
    lines.push("* **โครงสร้างการนอน:**");
    lines.push(
      `  * หลับลึก: ${deep?.durationText || formatThaiMinutesText(deep?.minutes)}${deep?.percent != null ? ` (${deep.percent}%)` : ""}`
    );
    lines.push(
      `  * หลับตื้น: ${light?.durationText || formatThaiMinutesText(light?.minutes)}${light?.percent != null ? ` (${light.percent}%)` : ""}`
    );
    lines.push(
      `  * REM: ${rem?.durationText || formatThaiMinutesText(rem?.minutes)}${rem?.percent != null ? ` (${rem.percent}%)` : ""}`
    );
    lines.push(
      `* **ตัวชี้วัดอื่น ๆ:** ต่อเนื่องหลับลึก ${contStr} | คะแนนหายใจ ${breathStr} | ตื่น ${awakeStr}`
    );
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push(
    "หากคุณผู้ใช้ต้องการให้มีน่าช่วยจัดการข้อมูลส่วนไหนเพิ่มเติม แจ้งมาได้เลยนะคะ ขอให้วันนี้เป็นวันที่สดใสค่ะ! ✨"
  );

  return lines.join("\n");
}

module.exports = {
  STANDARD_HUAWEI_FIELDS_TOTAL,
  toFiniteNumberOrNull,
  toCleanStringOrNull,
  shiftIsoDateDays,
  resolveSleepStartDate,
  sanitizeSleepStage,
  sanitizeScanSummary,
  countStandardHuaweiFields,
  buildRawSleepInfographic,
  sanitizeSleepRecord,
  SLEEP_DATE_DETECT_RESPONSE_SCHEMA,
  SLEEP_EXTRACT_RESPONSE_SCHEMA,
  SLEEP_ANALYZE_RESPONSE_SCHEMA,
  formatSleepLogsContext,
  formatThaiMinutesText,
  formatThaiFullDate,
  formatThaiWeekdayDate,
  buildDeterministicSleepSummary,
};

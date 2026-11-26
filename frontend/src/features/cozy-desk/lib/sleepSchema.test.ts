import test from 'node:test';
import assert from 'node:assert/strict';
import type { DailySleepRecord, RawSleepInfographic } from '../types/game';
import {
  buildRawSleepInfographic,
  countStandardHuaweiFields,
  mergeSleepRecordLists,
  parseRawSleepInfographicToRecord,
  resolveSleepStartDate,
  shiftIsoDateDays,
  STANDARD_HUAWEI_FIELDS_TOTAL,
} from './sleepSchema';

function makeFullHuaweiHealthRecord(): DailySleepRecord {
  return {
    id: 'sleep_2026-11-20',
    date: '2026-11-20',
    dateLabel: 'ศ. 20 พ.ย.',
    sourceApp: 'Huawei Health',
    userLabel: null,
    sleepScore: 89,
    percentileBeat: 99,
    bedtime: '06:43',
    wakeTime: '14:47',
    totalSleepMinutes: 466,
    totalSleepText: '7 ชั่วโมง 46 นาที',
    totalSleepStatus: 'ปกติ',
    totalSleepReference: 'ข้อมูลอ้างอิง: 6–10 ชม.',
    stages: {
      deep: {
        minutes: 127,
        durationText: '2 ชั่วโมง 7 นาที',
        percent: 27,
        status: 'ปกติ',
        referenceRange: 'ข้อมูลอ้างอิง: 20–60%',
      },
      light: {
        minutes: 239,
        durationText: '3 ชั่วโมง 59 นาที',
        percent: 51,
        status: 'ปกติ',
        referenceRange: 'ข้อมูลอ้างอิง: <55%',
      },
      rem: {
        minutes: 100,
        durationText: '1 ชั่วโมง 40 นาที',
        percent: 22,
        status: 'ปกติ',
        referenceRange: 'ข้อมูลอ้างอิง: 10–30%',
      },
    },
    deepSleepContinuityScore: 85,
    deepSleepContinuityStatus: 'ปกติ',
    deepSleepContinuityReference: 'ข้อมูลอ้างอิง: 70–100 คะแนน',
    awakeCount: 1,
    awakeStatus: 'ปกติ',
    awakeReference: 'ข้อมูลอ้างอิง: 0–1 ครั้ง',
    breathingQualityScore: 86,
    breathingQualityStatus: 'ปกติ',
    breathingQualityReference: 'ข้อมูลอ้างอิง: 70–100 คะแนน',
    previousDayStressScore: null,
    appInsights: [],
    appRecommendation: null,
    scanSummary: {
      isSleepScreenshot: true,
      detectedApp: 'Huawei Health',
      detectedLanguage: 'th',
      scannableSections: ['คะแนนการนอน', 'ช่วงเวลานอน', 'สเตจการนอน 3 ช่วง', 'ตัวชี้วัดย่อย 3 รายการ'],
      skippedSections: ['ชื่อบัญชีผู้ใช้', 'การวิเคราะห์และคำแนะนำ', 'ความเครียดเมื่อวาน'],
      confidence: 'high',
      standardFieldsFound: 10,
      standardFieldsTotal: STANDARD_HUAWEI_FIELDS_TOTAL,
    },
    rawInfographic: {
      record_header: {
        date_iso: '2026-11-20',
        date_short_th: '20 พ.ย.',
        weekday_short_th: 'ศ.',
        raw_header_text: 'ศ. 20 พ.ย.',
      },
      sleep_window: {
        sleep_start_date: '2026-11-20',
        sleep_start_time_24h: '06:43',
        sleep_start_hour: 6,
        sleep_start_minute: 43,
        sleep_start_raw_label: null,
        wake_up_date: '2026-11-20',
        wake_up_time_24h: '14:47',
        wake_up_hour: 14,
        wake_up_minute: 47,
        wake_up_raw_label: null,
      },
      total_sleep_duration: {
        hours: 7,
        minutes: 46,
        total_minutes: 466,
        total_seconds: 27960,
        decimal_hours: 7.7667,
        raw_text: '7 ชั่วโมง 46 นาที',
        status_label_th: 'ปกติ',
        reference_range: null,
      },
      sleep_score_raw: {
        score_value: 89,
        score_unit_th: 'คะแนน',
        better_than_users: { percent_value: 99, unit: '%', raw_text: 'ดีกว่า 99% ของผู้ใช้' },
        star_rating_raw: {
          full_stars: 4,
          half_stars: 1,
          total_displayed_stars: 5,
          derived_numeric_rating: 4.5,
        },
      },
      sleep_stages_raw: {
        deep_sleep: {
          stage_key: 'deep',
          label_th: 'นอนหลับสนิท',
          duration_hours: 2,
          duration_minutes: 7,
          duration_total_minutes: 127,
          duration_total_seconds: 7620,
          duration_raw_text: '2 ชั่วโมง 7 นาที',
          percentage_value: 27,
          percentage_unit: '%',
          percentage_raw_text: '27%',
          status_label_th: 'ปกติ',
          reference_range: null,
        },
        light_sleep: {
          stage_key: 'light',
          label_th: 'หลับตื้น',
          duration_hours: 3,
          duration_minutes: 59,
          duration_total_minutes: 239,
          duration_total_seconds: 14340,
          duration_raw_text: '3 ชั่วโมง 59 นาที',
          percentage_value: 51,
          percentage_unit: '%',
          percentage_raw_text: '51%',
          status_label_th: 'ปกติ',
          reference_range: null,
        },
        rem_sleep: {
          stage_key: 'rem',
          label_th: 'นอนหลับ REM',
          duration_hours: 1,
          duration_minutes: 40,
          duration_total_minutes: 100,
          duration_total_seconds: 6000,
          duration_raw_text: '1 ชั่วโมง 40 นาที',
          percentage_value: 22,
          percentage_unit: '%',
          percentage_raw_text: '22%',
          status_label_th: 'ปกติ',
          reference_range: null,
        },
      },
      sub_metrics_raw: {
        deep_sleep_continuity: {
          metric_key: 'deep_sleep_continuity',
          label_th: 'ความต่อเนื่องของการนอนหลับลึก',
          numeric_value: 85,
          unit_th: 'คะแนน',
          raw_text: '85 คะแนน',
          status_label_th: 'ปกติ',
          reference_range: null,
        },
        breathing_quality: {
          metric_key: 'breathing_quality',
          label_th: 'คุณภาพการหายใจ',
          numeric_value: 86,
          unit_th: 'คะแนน',
          raw_text: '86 คะแนน',
          status_label_th: 'ปกติ',
          reference_range: null,
        },
        awakenings_count: {
          metric_key: 'awakenings',
          label_th: 'จำนวนครั้งที่ตื่นนอน',
          numeric_value: 1,
          unit_th: 'ครั้ง',
          raw_text: '1 ครั้ง',
          status_label_th: 'ปกติ',
          reference_range: null,
        },
      },
    },
    createdAt: '2026-11-20T15:00:00.000Z',
    updatedAt: '2026-11-20T15:00:00.000Z',
  };
}

function makePartialAppleHealthRecord(): DailySleepRecord {
  return {
    id: 'sleep_2026-03-01',
    date: '2026-03-01',
    dateLabel: 'Sun 1 Mar',
    sourceApp: 'Apple Health',
    userLabel: null,
    sleepScore: null,
    percentileBeat: null,
    bedtime: '23:30',
    wakeTime: '07:05',
    totalSleepMinutes: 435,
    totalSleepText: '7h 15m',
    totalSleepStatus: null,
    totalSleepReference: null,
    stages: {
      deep: { minutes: 95, durationText: '1h 35m', percent: 22, status: null, referenceRange: null },
      light: { minutes: 245, durationText: '4h 05m', percent: 56, status: null, referenceRange: null },
      rem: { minutes: null, durationText: null, percent: null, status: null, referenceRange: null },
    },
    deepSleepContinuityScore: null,
    deepSleepContinuityStatus: null,
    deepSleepContinuityReference: null,
    awakeCount: null,
    awakeStatus: null,
    awakeReference: null,
    breathingQualityScore: null,
    breathingQualityStatus: null,
    breathingQualityReference: null,
    previousDayStressScore: null,
    appInsights: [],
    appRecommendation: null,
    scanSummary: {
      isSleepScreenshot: true,
      detectedApp: 'Apple Health',
      detectedLanguage: 'en',
      scannableSections: ['Time Asleep', 'Sleep Stages (Deep, Core)'],
      skippedSections: ['HRV (นอกมาตรฐาน Huawei Health)', 'SpO2 (นอกมาตรฐาน Huawei Health)', 'Awake Duration (นอกมาตรฐาน Huawei Health)'],
      confidence: 'medium',
      standardFieldsFound: 4,
      standardFieldsTotal: STANDARD_HUAWEI_FIELDS_TOTAL,
    },
    createdAt: '2026-03-01T07:10:00.000Z',
    updatedAt: '2026-03-01T07:10:00.000Z',
  };
}

test('resolveSleepStartDate shifts overnight bedtime across month and leap-year boundaries', () => {
  assert.equal(resolveSleepStartDate('2026-03-01', '23:30', '07:05'), '2026-02-28');
  assert.equal(resolveSleepStartDate('2024-03-01', '22:45', '06:30'), '2024-02-29');
  assert.equal(resolveSleepStartDate('2026-11-23', '01:15', '08:30'), '2026-11-23');
  assert.equal(resolveSleepStartDate('2026-11-20', '06:43', '14:47'), '2026-11-20');
  assert.equal(shiftIsoDateDays('2026-01-01', -1), '2025-12-31');
});

test('Huawei Health canonical schema captures all 10 standard metrics including sub-metric reference ranges and stars', () => {
  const input = makeFullHuaweiHealthRecord();
  assert.equal(countStandardHuaweiFields(input), 10);

  const raw = buildRawSleepInfographic(input);
  assert.equal(raw.schema_version, '2.1-huawei-standard');
  assert.equal(raw.scan_metadata?.standard, 'huawei_health_v1');
  assert.equal(raw.scan_metadata?.standard_fields_found, 10);
  assert.equal(raw.scan_metadata?.standard_fields_total, 10);
  assert.equal(raw.sleep_score_raw.star_rating_raw.derived_numeric_rating, 4.5);
  assert.equal(raw.sleep_score_raw.star_rating_raw.full_stars, 4);
  assert.equal(raw.sleep_score_raw.star_rating_raw.half_stars, 1);
  assert.equal(raw.sub_metrics_raw.deep_sleep_continuity.reference_range?.min_value, 70);
  assert.equal(raw.sub_metrics_raw.deep_sleep_continuity.reference_range?.max_value, 100);
  assert.equal(raw.sub_metrics_raw.awakenings_count.reference_range?.max_value, 1);
  assert.equal(raw.sub_metrics_raw.breathing_quality.reference_range?.min_value, 70);

  const restored = parseRawSleepInfographicToRecord(raw);
  assert.equal(restored.sourceApp, 'Huawei Health');
  assert.equal(restored.deepSleepContinuityReference, 'ข้อมูลอ้างอิง: 70–100 คะแนน');
  assert.equal(restored.awakeReference, 'ข้อมูลอ้างอิง: 0–1 ครั้ง');
  assert.equal(restored.breathingQualityReference, 'ข้อมูลอ้างอิง: 70–100 คะแนน');
  assert.equal(restored.rawInfographic?.sleep_score_raw.star_rating_raw.derived_numeric_rating, 4.5);
});

test('Non-Huawei apps map absent fields and stages to strict null and strip legacy non-standard keys on import', () => {
  const input = makePartialAppleHealthRecord();
  assert.equal(countStandardHuaweiFields(input), 4);

  const raw = buildRawSleepInfographic(input);
  assert.equal(raw.schema_version, '2.1-huawei-standard');
  assert.equal(raw.sleep_window.sleep_start_date, '2026-02-28');
  assert.equal(raw.sleep_score_raw.score_value, null);
  assert.equal(raw.sleep_score_raw.star_rating_raw.derived_numeric_rating, null);
  assert.equal(raw.sleep_score_raw.star_rating_raw.total_displayed_stars, null);
  assert.equal(raw.sleep_stages_raw.rem_sleep.duration_total_minutes, null);
  assert.equal(raw.sleep_stages_raw.rem_sleep.duration_raw_text, null);
  assert.equal(raw.sleep_stages_raw.deep_sleep.reference_range, null);
  assert.equal(raw.sub_metrics_raw.deep_sleep_continuity.numeric_value, null);
  assert.equal(raw.sub_metrics_raw.deep_sleep_continuity.reference_range, null);
  assert.equal('extracted_numeric_metrics' in raw, false);
  assert.equal('awake_time' in raw.sleep_stages_raw, false);

  // Importing a legacy v2.0 JSON with extra keys strips them cleanly
  const legacyPayload = {
    ...raw,
    extracted_numeric_metrics: [{ key: 'hrv', label: 'HRV', value: 65, unit: 'ms' }],
    sleep_stages_raw: {
      ...raw.sleep_stages_raw,
      awake_time: { stage_key: 'awake', duration_total_minutes: 20 },
    },
  } as unknown as RawSleepInfographic;

  const restored = parseRawSleepInfographicToRecord(legacyPayload);
  assert.equal(restored.sourceApp, 'Apple Health');
  assert.equal(restored.stages.rem.minutes, null);
  assert.equal('extracted_numeric_metrics' in (restored.rawInfographic ?? {}), false);
  assert.equal('awake_time' in (restored.rawInfographic?.sleep_stages_raw ?? {}), false);
});

test('mergeSleepRecordLists respects pending-delete tombstones and keeps newer server updates', () => {
  const recA = makeFullHuaweiHealthRecord();
  const recB: DailySleepRecord = {
    ...makePartialAppleHealthRecord(),
    id: 'sleep_2026-03-02',
    date: '2026-03-02',
    sleepScore: 80,
    updatedAt: '2026-03-02T08:00:00.000Z',
  };
  const recBNewer: DailySleepRecord = {
    ...recB,
    sleepScore: 91,
    updatedAt: '2026-03-02T09:00:00.000Z',
  };

  const merged = mergeSleepRecordLists([recA, recBNewer], [recA, recB], new Set([recA.id]));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'sleep_2026-03-02');
  assert.equal(merged[0].sleepScore, 91);
});

test('Huawei Health prototype reference (sporthealth-1) preserves awakeCount=0, low continuity status ต่ำ, and same-day 11:02-18:06 window', () => {
  const proto: DailySleepRecord = {
    id: 'sleep_2026-11-23',
    date: '2026-11-23',
    dateLabel: 'จ. 23 พ.ย.',
    sourceApp: 'Huawei Health',
    userLabel: null,
    sleepScore: 84,
    percentileBeat: 91,
    bedtime: '11:02',
    wakeTime: '18:06',
    totalSleepMinutes: 424,
    totalSleepText: '7 ชั่วโมง 4 นาที',
    totalSleepStatus: 'ปกติ',
    totalSleepReference: 'ข้อมูลอ้างอิง: 6–10 ชม.',
    stages: {
      deep: {
        minutes: 144,
        durationText: '2 ชั่วโมง 24 นาที',
        percent: 34,
        status: 'ปกติ',
        referenceRange: 'ข้อมูลอ้างอิง: 20–60%',
      },
      light: {
        minutes: 174,
        durationText: '2 ชั่วโมง 54 นาที',
        percent: 41,
        status: 'ปกติ',
        referenceRange: 'ข้อมูลอ้างอิง: <55%',
      },
      rem: {
        minutes: 106,
        durationText: '1 ชั่วโมง 46 นาที',
        percent: 25,
        status: 'ปกติ',
        referenceRange: 'ข้อมูลอ้างอิง: 10–30%',
      },
    },
    deepSleepContinuityScore: 67,
    deepSleepContinuityStatus: 'ต่ำ',
    deepSleepContinuityReference: 'ข้อมูลอ้างอิง: 70–100 คะแนน',
    awakeCount: 0,
    awakeStatus: 'ปกติ',
    awakeReference: 'ข้อมูลอ้างอิง: 0–1 ครั้ง',
    breathingQualityScore: 88,
    breathingQualityStatus: 'ปกติ',
    breathingQualityReference: 'ข้อมูลอ้างอิง: 70–100 คะแนน',
    previousDayStressScore: null,
    appInsights: [],
    appRecommendation: null,
    scanSummary: {
      isSleepScreenshot: true,
      detectedApp: 'Huawei Health',
      detectedLanguage: 'th',
      scannableSections: ['คะแนนการนอน', 'ช่วงเวลานอน', 'สเตจการนอน 3 ช่วง', 'ตัวชี้วัดย่อย 3 รายการ'],
      skippedSections: ['ชื่อบัญชีผู้ใช้', 'กราฟช่วงการหลับ', 'กราฟแท่งเปรียบเทียบย้อนหลัง', 'การวิเคราะห์และคำแนะนำ'],
      confidence: 'high',
      standardFieldsFound: 10,
      standardFieldsTotal: STANDARD_HUAWEI_FIELDS_TOTAL,
    },
    createdAt: '2026-11-23T18:28:16.000Z',
    updatedAt: '2026-11-23T18:28:16.000Z',
  };

  assert.equal(countStandardHuaweiFields(proto), 10);
  const raw = buildRawSleepInfographic(proto);
  assert.equal(raw.record_header.weekday_short_th, 'จ.');
  assert.equal(raw.record_header.date_short_th, '23 พ.ย.');
  assert.equal(raw.sleep_window.sleep_start_date, '2026-11-23');
  assert.equal(raw.sleep_window.wake_up_date, '2026-11-23');
  assert.equal(raw.total_sleep_duration.hours, 7);
  assert.equal(raw.total_sleep_duration.minutes, 4);
  assert.equal(raw.sleep_stages_raw.light_sleep.label_th, 'นอนหลับตื้น');
  assert.equal(raw.sleep_stages_raw.light_sleep.reference_range?.operator, 'less_than');
  assert.equal(raw.sleep_stages_raw.light_sleep.reference_range?.max_value, 55);
  assert.equal(raw.sub_metrics_raw.deep_sleep_continuity.numeric_value, 67);
  assert.equal(raw.sub_metrics_raw.deep_sleep_continuity.status_label_th, 'ต่ำ');
  assert.equal(raw.sub_metrics_raw.awakenings_count.numeric_value, 0);
  assert.equal(raw.sub_metrics_raw.awakenings_count.raw_text, '0 ครั้ง');
  assert.equal(raw.sub_metrics_raw.awakenings_count.reference_range?.min_value, 0);
  assert.equal(raw.sub_metrics_raw.awakenings_count.reference_range?.max_value, 1);

  const roundTrip = parseRawSleepInfographicToRecord(raw);
  assert.equal(roundTrip.awakeCount, 0);
  assert.equal(roundTrip.deepSleepContinuityStatus, 'ต่ำ');
  assert.equal(roundTrip.totalSleepMinutes, 424);
});


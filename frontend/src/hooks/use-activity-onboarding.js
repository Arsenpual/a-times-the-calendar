import { useEffect, useMemo, useState } from "react";
import { getWeekRange } from "../date-utils.js";

const ONBOARDING_VERSION = 1;
const ONBOARDING_ROLLOUT_AT = Date.parse("2026-08-21T00:00:00+07:00");
const DEFAULT_CATEGORY_IDS = ["work", "personal", "health", "family"];

const SAMPLE_ACTIVITY_BLUEPRINTS = [
  { day: 1, hour: 9, title: "ตัวอย่าง: วางแผนงานประจำสัปดาห์", categoryId: "work" },
  { day: 1, hour: 14, title: "ตัวอย่าง: ช่วงโฟกัสงาน", categoryId: "work" },
  { day: 2, hour: 7, title: "ตัวอย่าง: ออกกำลังกาย", categoryId: "health" },
  { day: 2, hour: 18, title: "ตัวอย่าง: เวลาส่วนตัว", categoryId: "personal" },
  { day: 3, hour: 10, title: "ตัวอย่าง: ประชุมทีม", categoryId: "work" },
  { day: 4, hour: 7, title: "ตัวอย่าง: ดูแลสุขภาพ", categoryId: "health" },
  { day: 4, hour: 12, title: "ตัวอย่าง: เวลาครอบครัว", categoryId: "family" },
  { day: 5, hour: 15, title: "ตัวอย่าง: เรียนรู้สิ่งใหม่", categoryId: "personal" },
  { day: 6, hour: 9, title: "ตัวอย่าง: กิจกรรมกับครอบครัว", categoryId: "family" },
  { day: 0, hour: 17, title: "ตัวอย่าง: ทบทวนสัปดาห์", categoryId: "personal" }
];

function storageKey(userId) {
  return `times-activity-onboarding:${userId}:v${ONBOARDING_VERSION}`;
}

function buildSamples(weekStart) {
  return SAMPLE_ACTIVITY_BLUEPRINTS.map((blueprint) => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + blueprint.day);
    start.setHours(blueprint.hour, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { ...blueprint, start: start.toISOString(), end: end.toISOString() };
  });
}

/**
 * Local-only first-run examples. They intentionally never write to Google
 * Calendar: a new account may have granted read access but not write access,
 * and onboarding must still explain the timeline without a permission error.
 */
export function useActivityOnboarding({ mode, firebaseUser, categories, cursorDate }) {
  const [samples, setSamples] = useState([]);

  useEffect(() => {
    if (mode !== "activity" || !firebaseUser?.uid) {
      setSamples([]);
      return;
    }
    const accountCreatedAt = Date.parse(firebaseUser.metadata?.creationTime || "");
    const availableDefaults = new Set(categories.map((category) => category.id));
    if (!Number.isFinite(accountCreatedAt) || accountCreatedAt < ONBOARDING_ROLLOUT_AT || !DEFAULT_CATEGORY_IDS.every((id) => availableDefaults.has(id))) {
      setSamples([]);
      return;
    }

    const key = storageKey(firebaseUser.uid);
    let record;
    try {
      record = JSON.parse(window.localStorage.getItem(key) || "null");
    } catch {
      record = null;
    }
    const nextSamples = Array.isArray(record?.samples) && record.samples.length === 10
      ? record.samples
      : buildSamples(getWeekRange(cursorDate)[0]);

    try {
      window.localStorage.setItem(key, JSON.stringify({
        version: ONBOARDING_VERSION,
        createdAt: record?.createdAt || new Date().toISOString(),
        samples: nextSamples,
        completedAt: record?.completedAt || new Date().toISOString()
      }));
    } catch {
      // Keep rendering the examples for this session even if storage is off.
    }
    setSamples(nextSamples);
  }, [mode, firebaseUser?.uid, firebaseUser?.metadata?.creationTime, categories, cursorDate]);

  const onboardingActivities = useMemo(() => samples.map((sample, index) => ({
    id: `local-onboarding-${firebaseUser?.uid || "guest"}-${index}`,
    summary: sample.title,
    start: { dateTime: sample.start },
    end: { dateTime: sample.end },
    isOnboardingSample: true
  })), [samples, firebaseUser?.uid]);

  const onboardingCategoryMap = useMemo(() => Object.fromEntries(samples.map((sample, index) => [
    `local-onboarding-${firebaseUser?.uid || "guest"}-${index}`,
    sample.categoryId
  ])), [samples, firebaseUser?.uid]);

  return { onboardingActivities, onboardingCategoryMap };
}

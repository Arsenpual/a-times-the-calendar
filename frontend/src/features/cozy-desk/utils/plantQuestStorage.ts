import type { DailyPlantWateringRecord } from '../types/game';
import { cozyStorageKey } from './cozyApi';
import { getLocalIsoDate } from './sleepLogsApi';

const PLANT_WATERING_STORAGE_KEY = 'cozy_desk_plant_watering_v1';

function isValidRecord(item: unknown): item is DailyPlantWateringRecord {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.date === 'string' &&
    typeof r.wateredCount === 'number' &&
    Number.isFinite(r.wateredCount) &&
    r.wateredCount > 0 &&
    typeof r.lastWateredAt === 'string' &&
    typeof r.lastWateredTimeLabel === 'string'
  );
}

export function formatThaiClockLabel(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} น.`;
}

export function loadPlantWateringHistory(): DailyPlantWateringRecord[] {
  try {
    const raw = window.localStorage.getItem(cozyStorageKey(PLANT_WATERING_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidRecord)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60);
  } catch {
    return [];
  }
}

export function savePlantWateringHistory(records: DailyPlantWateringRecord[]): void {
  try {
    const trimmed = [...records]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60);
    window.localStorage.setItem(cozyStorageKey(PLANT_WATERING_STORAGE_KEY), JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function findTodayPlantWatering(
  records: DailyPlantWateringRecord[],
  todayIsoDate = getLocalIsoDate()
): DailyPlantWateringRecord | null {
  return records.find((rec) => rec.date === todayIsoDate && rec.wateredCount > 0) ?? null;
}

export function recordPlantWateringToday(
  existingRecords: DailyPlantWateringRecord[],
  todayIsoDate = getLocalIsoDate()
): {
  records: DailyPlantWateringRecord[];
  todayRecord: DailyPlantWateringRecord;
  wasFirstToday: boolean;
} {
  const now = new Date();
  const timeLabel = formatThaiClockLabel(now);
  const existing = existingRecords.find((r) => r.date === todayIsoDate);
  const wasFirstToday = !existing || existing.wateredCount <= 0;

  const todayRecord: DailyPlantWateringRecord = {
    date: todayIsoDate,
    wateredCount: (existing?.wateredCount ?? 0) + 1,
    lastWateredAt: now.toISOString(),
    lastWateredTimeLabel: timeLabel,
  };

  const nextRecords = [
    todayRecord,
    ...existingRecords.filter((r) => r.date !== todayIsoDate),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  savePlantWateringHistory(nextRecords);

  return {
    records: nextRecords,
    todayRecord,
    wasFirstToday,
  };
}

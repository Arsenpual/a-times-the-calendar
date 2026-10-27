export function isWeatherSlotStillRecommended(slot, weatherPlan) {
  if (!slot?.start || !slot?.end) return false;
  const slots = weatherPlan?.recommendation?.slots;
  if (!Array.isArray(slots)) return false;
  return slots.some((latest) =>
    latest.start === slot.start &&
    latest.end === slot.end &&
    latest.score === slot.score &&
    JSON.stringify(latest.reasons || []) === JSON.stringify(slot.reasons || [])
  );
}

export async function assertWeatherDraftCurrent({ validation, activityBody, fetchPlan }) {
  if (!validation) return;
  const slot = validation.slot;
  const start = Date.parse(activityBody?.start?.dateTime);
  const end = Date.parse(activityBody?.end?.dateTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) ||
      start !== Date.parse(slot?.start) || end !== Date.parse(slot?.end)) {
    throw new Error("เวลาในร่างเปลี่ยนจากช่วงที่ตรวจอากาศ กรุณาดูอากาศและเลือกช่วงใหม่ก่อนบันทึก");
  }
  const latest = await fetchPlan({ ...validation.request, includeAdvice: false });
  if (!isWeatherSlotStillRecommended(slot, latest)) {
    throw new Error("พยากรณ์อากาศเปลี่ยนแล้ว กรุณาดูอากาศและเลือกช่วงใหม่ก่อนบันทึก");
  }
}

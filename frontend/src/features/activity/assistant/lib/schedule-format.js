export function formatScheduleRange(startLocal, endLocal) {
  if (typeof startLocal !== "string" || typeof endLocal !== "string") return "ช่วงเวลาใกล้เคียง";
  return `${startLocal.slice(11, 16)}–${endLocal.slice(11, 16)}`;
}

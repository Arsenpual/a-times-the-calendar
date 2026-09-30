export function formatScheduleRange(startLocal, endLocal) {
  if (typeof startLocal !== "string" || typeof endLocal !== "string") return "ช่วงเวลาใกล้เคียง";
  return `${startLocal.slice(11, 16)}–${endLocal.slice(11, 16)}`;
}

export function formatScheduleOption(startLocal, endLocal) {
  if (typeof startLocal !== "string" || typeof endLocal !== "string") return formatScheduleRange(startLocal, endLocal);
  return `${startLocal.slice(8, 10)}/${startLocal.slice(5, 7)} · ${formatScheduleRange(startLocal, endLocal)}`;
}

function formatSummaryDuration(totalMinutes) {
  const hours = Math.floor(Math.max(0, totalMinutes || 0) / 60);
  const minutes = Math.max(0, totalMinutes || 0) % 60;
  if (!hours) return `${minutes} นาที`;
  return `${hours} ชม.${minutes ? ` ${minutes} นาที` : ""}`;
}

function formatSummaryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

// Deterministic text for the compact assistant: it only formats the
// Calendar data already fetched by the app and never uses Gemini quota.
export function buildDailySummaryChat(summary, now = Date.now()) {
  const date = new Date(`${summary?.date || ""}T12:00:00`);
  const dateLabel = Number.isNaN(date.getTime())
    ? "วันนี้"
    : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const totalActivities = summary?.totalActivities || 0;
  if (!totalActivities) {
    return `สรุปกิจกรรมวันนี้ · ${dateLabel}\n\nวันนี้ยังไม่มีกิจกรรมที่วางแผนไว้\nคุณสามารถเพิ่มกิจกรรมจากปุ่ม “สร้างกิจกรรม” ได้เลย\n\nMini Timeline ด้านซ้ายพร้อมแสดงรายละเอียดของวันนี้`;
  }
  const lines = [`สรุปกิจกรรมวันนี้ · ${dateLabel}`, "", `วันนี้มี ${totalActivities} กิจกรรม`, `เวลาที่วางแผนรวม ${formatSummaryDuration(summary.totalMinutes)}`];
  const categories = (summary.byCategory || []).slice(0, 2);
  if (categories.length) lines.push(`หมวดหมู่หลัก: ${categories.map((category) => `${category.name} ${formatSummaryDuration(category.minutes)}`).join(" · ")}`);
  const upcoming = (summary.activities || []).find((activity) => !activity.allDay && new Date(activity.start).getTime() > now);
  if (upcoming) {
    const start = formatSummaryTime(upcoming.start);
    const end = formatSummaryTime(upcoming.end);
    const minutesUntil = Math.max(1, Math.ceil((new Date(upcoming.start).getTime() - now) / 60_000));
    lines.push("", "กิจกรรมถัดไป", `• ${upcoming.title} · ${start}${end ? `–${end}` : ""} · อีก ${minutesUntil} นาที`);
  } else lines.push("", "กิจกรรมตามเวลาของวันนี้สิ้นสุดแล้ว");
  lines.push("", "เปิด Mini Timeline ด้านซ้ายไว้ให้ดูรายละเอียดทั้งหมดแล้ว");
  return lines.join("\n");
}

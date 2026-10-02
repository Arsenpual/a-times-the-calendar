function numberValue(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function metric(key, label, value) {
  return { key, label, value: numberValue(value) };
}

export function parseDataLabInsightReport(text) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    throw new Error("ไฟล์นี้ไม่ใช่ JSON report ที่ถูกต้อง");
  }
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("ไม่พบโครงสร้าง Data Lab report");
  }
  const summary = report.summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    if (Array.isArray(report.activities)) {
      throw new Error("ไฟล์นี้เป็น Activity Export กรุณาวิเคราะห์ด้วย Python Data Lab ก่อน แล้วเลือกไฟล์ *-report.json");
    }
    throw new Error("ไม่พบ summary ใน Data Lab report");
  }
  if (Array.isArray(report.cases) && "totalCases" in summary) {
    return {
      type: "scheduling", title: "Scheduling Evaluation", metrics: [
        metric("totalCases", "กรณีที่ตรวจ", summary.totalCases), metric("passedCases", "ผ่าน", summary.passedCases), metric("failedCases", "ต้องตรวจเพิ่ม", summary.failedCases)
      ]
    };
  }
  if ("highConfidence" in summary) {
    return {
      type: "priority", title: "Priority Confidence", metrics: [
        metric("readyForHumanReview", "พร้อมให้คุณพิจารณา", summary.readyForHumanReview), metric("highConfidence", "บริบทสูง", summary.highConfidence),
        metric("moderateConfidence", "บริบทปานกลาง", summary.moderateConfidence), metric("lowConfidence", "ต้องเพิ่มบริบท", summary.lowConfidence)
      ]
    };
  }
  if ("totalScheduledMinutes" in summary) {
    return {
      type: "weekly", title: "Weekly Time Pattern", metrics: [
        metric("totalScheduledMinutes", "เวลาที่จัดไว้ (นาที)", summary.totalScheduledMinutes), metric("allDayActivities", "กิจกรรมทั้งวัน", summary.allDayActivities),
        metric("daysWithOverlap", "วันที่มีเวลาซ้อน", summary.daysWithOverlap), metric("invalidActivities", "ข้อมูลเวลาใช้ไม่ได้", summary.invalidActivities)
      ]
    };
  }
  if ("validActivities" in summary) {
    return {
      type: "quality", title: "Activity Data Quality", metrics: [
        metric("totalActivities", "กิจกรรมที่อ่านได้", summary.totalActivities), metric("validActivities", "ข้อมูลใช้ได้", summary.validActivities),
        metric("invalidActivities", "ข้อมูลใช้ไม่ได้", summary.invalidActivities), metric("priorityContextReadyActivities", "พร้อมสำหรับ priority review", summary.priorityContextReadyActivities)
      ]
    };
  }
  throw new Error("ไม่รู้จักรูปแบบ Data Lab report นี้");
}

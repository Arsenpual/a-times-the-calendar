import React, { useState } from "react";
import { requestDataLabExport } from "../api/data-lab-export.js";
import { defaultDataLabExportWindow, validateDataLabExportWindow } from "../lib/data-lab-export-window.js";

function downloadJson(data, windowStart, windowEnd) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `times-activity-export-${windowStart}-to-${windowEnd}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DataLabExport({ calendarConnected }) {
  const initialWindow = defaultDataLabExportWindow();
  const [windowStart, setWindowStart] = useState(initialWindow.windowStart);
  const [windowEnd, setWindowEnd] = useState(initialWindow.windowEnd);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const exportData = async () => {
    const validationError = validateDataLabExportWindow(windowStart, windowEnd);
    if (validationError) return setError(validationError);
    setError("");
    setStatus("");
    setPending(true);
    try {
      const data = await requestDataLabExport(windowStart, windowEnd);
      downloadJson(data, windowStart, windowEnd);
      setStatus(`ดาวน์โหลด ${data.activities?.length || 0} กิจกรรมแล้ว`);
    } catch (requestError) {
      setError(requestError.message || "ส่งออกข้อมูลไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  };

  return <section className="settings-section settings-data-lab-section">
    <h3 className="settings-section-title">Data Lab</h3>
    <div className="settings-data-lab-window">
      <label>
        <span>เริ่ม</span>
        <input type="date" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} aria-label="วันเริ่มต้นสำหรับส่งออก Data Lab" />
      </label>
      <label>
        <span>สิ้นสุด</span>
        <input type="date" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} aria-label="วันสิ้นสุดสำหรับส่งออก Data Lab" />
      </label>
    </div>
    <button type="button" className="settings-data-lab-download" disabled={!calendarConnected || pending} onClick={exportData}>
      {pending ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลดข้อมูลกิจกรรม"}
    </button>
    {status && <p className="settings-data-lab-status" role="status">{status}</p>}
    {error && <p className="settings-assistant-error" role="alert">{error}</p>}
  </section>;
}

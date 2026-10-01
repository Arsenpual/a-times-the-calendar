import React, { useState } from "react";
import { parseDataLabInsightReport } from "../lib/data-lab-insight-report.js";

const MAX_REPORT_BYTES = 2 * 1024 * 1024;

function isSelectedAssistantInsight(current, candidate) {
  return current?.type === candidate?.type
    && JSON.stringify(current.metrics) === JSON.stringify(candidate.metrics);
}

export default function DataLabInsights({ assistantInsight = null, onAssistantInsightChange }) {
  const [insight, setInsight] = useState(null);
  const [error, setError] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const importReport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_REPORT_BYTES) {
      setInsight(null);
      return setError("ไฟล์ report ต้องมีขนาดไม่เกิน 2 MB");
    }
    try {
      const nextInsight = parseDataLabInsightReport(await file.text());
      setInsight(nextInsight);
    } catch (parseError) {
      setInsight(null);
      setError(parseError.message || "อ่าน report ไม่สำเร็จ");
    }
  };

  return <section className="settings-section settings-data-lab-section">
    <h3 className="settings-section-title">Insight Review</h3>
    <label className="settings-data-lab-import">
      <span>เลือก Data Lab report</span>
      <input key={inputKey} type="file" accept="application/json,.json" onChange={importReport} aria-label="เลือก Data Lab report" />
    </label>
    {error && <p className="settings-assistant-error" role="alert">{error}</p>}
    {insight && <div className="settings-data-lab-insight" aria-live="polite">
      <div className="settings-data-lab-insight-header">
        <strong>{insight.title}</strong>
        <button type="button" onClick={() => { setInsight(null); onAssistantInsightChange?.(null); setInputKey((value) => value + 1); }}>ปิด</button>
      </div>
      <dl>
        {insight.metrics.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl>
      <label className="settings-data-lab-assistant-context">
        <input type="checkbox" checked={isSelectedAssistantInsight(assistantInsight, insight)} onChange={(event) => onAssistantInsightChange?.(event.target.checked ? insight : null)} />
        <span>ใช้ summary นี้เป็นบริบทผู้ช่วยใน session นี้</span>
      </label>
    </div>}
  </section>;
}

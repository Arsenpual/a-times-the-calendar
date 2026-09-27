import React from "react";

const numberFormatter = new Intl.NumberFormat("th-TH");

export default function FirestoreQuotaBanner({ quota }) {
  if (!quota) return null;
  const resetDate = new Date(quota.resetsAt);
  const resetLabel = Number.isNaN(resetDate.getTime())
    ? "รอบถัดไป"
    : new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(resetDate);

  return (
    <aside className="firestore-quota-banner" role="alert" aria-live="assertive">
      <strong>โควต้า Cloud Firestore หมดชั่วคราว</strong>
      <span>
        คงเหลือ <b>{numberFormatter.format(quota.remaining ?? 0)}</b>
        {" / "}{numberFormatter.format(quota.dailyLimit ?? 50_000)} reads
      </span>
      <span>รีเซ็ตประมาณ {resetLabel}</span>
      <small>ข้อมูลบนหน้าอาจยังไม่ซิงก์จนกว่าจะรีเซ็ตหรือเปิด Billing</small>
    </aside>
  );
}

import React from "react";
import { PopupLayerItem } from "../../shared/ui/popup-layer.jsx";

const numberFormatter = new Intl.NumberFormat("th-TH");

export default function FirestoreQuotaBanner({ quota }) {
  if (!quota) return null;
  const resetDate = new Date(quota.resetsAt || NaN);
  const resetLabel = Number.isNaN(resetDate.getTime())
    ? "ยังไม่ทราบ"
    : new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(resetDate);

  return (
    <PopupLayerItem id="firestore-quota" region="top-right" priority={95}>
      <aside className="firestore-quota-banner" role="alert" aria-live="assertive">
      <header className="firestore-quota-banner__header">
        <span className="firestore-quota-banner__icon" aria-hidden="true">!</span>
        <span>
          <strong>บริการข้อมูลถูกจำกัดชั่วคราว</strong>
          <small>ระบบพักการซิงก์ข้อมูลเพื่อไม่ให้ส่งคำขอซ้ำ</small>
        </span>
      </header>

      <div className="firestore-quota-banner__status-grid">
        <section className="firestore-quota-banner__status-item">
          <span className="firestore-quota-banner__label">โควต้าคงเหลือ</span>
          <strong className="firestore-quota-banner__value">
            {quota.remaining == null ? "ยังไม่ทราบ" : numberFormatter.format(quota.remaining)}
            {quota.dailyLimit != null && <small> / {numberFormatter.format(quota.dailyLimit)} {quota.metric === "documentReads" ? "reads" : ""}</small>}
          </strong>
        </section>
        <section className="firestore-quota-banner__status-item">
          <span className="firestore-quota-banner__label">คาดว่าจะรีเซ็ต</span>
          <time className="firestore-quota-banner__value" dateTime={quota.resetsAt || undefined}>{resetLabel}</time>
        </section>
      </div>

      {quota.remaining != null && quota.dailyLimit > 0 && <div className="firestore-quota-banner__meter" aria-label="สัดส่วนโควต้า Firestore คงเหลือ">
        <span style={{ width: `${Math.max(0, Math.min(100, ((quota.remaining ?? 0) / (quota.dailyLimit || 50_000)) * 100))}%` }} />
      </div>}
      <p>ระบบจะลองเชื่อมต่อใหม่หลังพักคำขอ หากยังเกิดปัญหา โปรดตรวจสอบ Usage และ Quotas ใน Firebase Console</p>
      </aside>
    </PopupLayerItem>
  );
}

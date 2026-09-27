import React from "react";
import { PopupLayerItem } from "../../shared/ui/popup-layer.jsx";

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
    <PopupLayerItem id="firestore-quota" region="top-right" priority={95}>
      <aside className="firestore-quota-banner" role="alert" aria-live="assertive">
      <header className="firestore-quota-banner__header">
        <span className="firestore-quota-banner__icon" aria-hidden="true">!</span>
        <span>
          <strong>โควต้า Cloud Firestore หมดชั่วคราว</strong>
          <small>ระบบพักการซิงก์ข้อมูลเพื่อไม่ให้ส่งคำขอซ้ำ</small>
        </span>
      </header>

      <div className="firestore-quota-banner__status-grid">
        <section className="firestore-quota-banner__status-item">
          <span className="firestore-quota-banner__label">โควต้าคงเหลือ</span>
          <strong className="firestore-quota-banner__value">
            {numberFormatter.format(quota.remaining ?? 0)}
            <small> / {numberFormatter.format(quota.dailyLimit ?? 50_000)} reads</small>
          </strong>
        </section>
        <section className="firestore-quota-banner__status-item">
          <span className="firestore-quota-banner__label">คาดว่าจะรีเซ็ต</span>
          <time className="firestore-quota-banner__value" dateTime={quota.resetsAt || undefined}>{resetLabel}</time>
        </section>
      </div>

      <div className="firestore-quota-banner__meter" aria-label="โควต้า Firestore คงเหลือ 0 เปอร์เซ็นต์">
        <span style={{ width: `${Math.max(0, Math.min(100, ((quota.remaining ?? 0) / (quota.dailyLimit || 50_000)) * 100))}%` }} />
      </div>
      <p>ข้อมูลบนหน้าอาจยังไม่ซิงก์จนกว่าโควต้าจะรีเซ็ตหรือเปิด Billing</p>
      </aside>
    </PopupLayerItem>
  );
}

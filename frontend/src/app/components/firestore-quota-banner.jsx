import React from "react";
import { PopupLayerItem } from "../../shared/ui/popup-layer.jsx";

export default function FirestoreQuotaBanner({ quota }) {
  if (!quota) return null;
  const resetDate = new Date(quota.dailyResetAt || quota.resetsAt || NaN);
  const resetLabel = Number.isNaN(resetDate.getTime()) ? null : new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(resetDate);

  return (
    <PopupLayerItem id="firestore-quota" region="top-right" priority={95}>
      <aside className="firestore-quota-banner" role="alert" aria-live="assertive">
        <header className="firestore-quota-banner__header">
          <span className="firestore-quota-banner__icon" aria-hidden="true">!</span>
          <span>
            <strong>ซิงก์ข้อมูลไม่ได้ชั่วคราว</strong>
            <small>บริการจัดเก็บข้อมูลจำกัดการใช้งาน ระบบจึงพักการเชื่อมต่อ</small>
          </span>
        </header>
        <section className="firestore-quota-banner__status-item">
          <span className="firestore-quota-banner__label">รอบรีเซ็ตโควต้ารายวัน (เวลาไทย)</span>
          <strong className="firestore-quota-banner__reset-time">
            {resetLabel ? <time dateTime={resetDate.toISOString()}>ประมาณ {resetLabel} น.</time> : "ประมาณ 14:00 น. หรือ 15:00 น. ของทุกวัน"}
          </strong>
          <small>ตรงกับเที่ยงคืนเวลาแปซิฟิก เวลาประเทศไทยจะเปลี่ยนตามเวลาออมแสงของสหรัฐฯ</small>
        </section>
        <p>ข้อมูลที่เห็นอาจยังไม่ใช่ข้อมูลล่าสุด และการบันทึกบางรายการอาจไม่สำเร็จ</p>
        <p><strong>ควรทำอย่างไร:</strong> หากโควต้ารายวันเต็ม ให้ลองอีกครั้งหลังเวลารีเซ็ต ไม่จำเป็นต้องรีเฟรชหน้าซ้ำ หากเพิ่งแก้ไขข้อมูล ให้ตรวจสอบว่าบันทึกสำเร็จก่อนปิดหน้า</p>
        <p>ระบบจะลองเชื่อมต่อเป็นระยะระหว่างรอ หากยังใช้งานไม่ได้หลังรอบรีเซ็ต โปรดแจ้งผู้ดูแลระบบ</p>
      </aside>
    </PopupLayerItem>
  );
}

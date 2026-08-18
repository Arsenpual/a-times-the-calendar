import React from "react";
import { formatStatsDuration } from "../reminder-stats.js";

export default function ReminderStatsPanel({ isOpen, onClose, stats }) {
  if (!isOpen) return null;
  return (
    <div className="reminder-stats-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="reminder-stats-panel" role="dialog" aria-modal="true" aria-label="สถิติ Reminder" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p>ภาพรวม Reminder</p><span>ข้อมูลสะสมในอุปกรณ์นี้ · 7 วันล่าสุด</span></div>
          <button type="button" onClick={onClose} aria-label="ปิดสถิติ">×</button>
        </header>
        <div className="reminder-stats-grid">
          <article><strong>{stats.active}</strong><span>กำลังทำงาน</span></article>
          <article><strong>{stats.paused}</strong><span>ปิดใช้งาน</span></article>
          <article><strong>{stats.completed}</strong><span>ทำเสร็จแล้ว</span></article>
          <article><strong>{stats.weeklyCompletions}</strong><span>ทำสำเร็จ 7 วัน</span></article>
        </div>
        <dl className="reminder-stats-details">
          <div><dt>Snooze บ่อยสุด</dt><dd>{stats.mostSnoozed ? `${stats.mostSnoozed[0]} · ${stats.mostSnoozed[1]} ครั้ง` : "ยังไม่มีข้อมูล"}</dd></div>
          <div><dt>Stopwatch เฉลี่ยต่อ session</dt><dd>{stats.averageStopwatchMs ? formatStatsDuration(stats.averageStopwatchMs) : "ยังไม่มีข้อมูล"}</dd></div>
          <div><dt>Routine ทำสำเร็จสัปดาห์นี้</dt><dd>{stats.routineTotal ? `${stats.routineCompleted} ครั้ง · มี ${stats.routineTotal} routine` : "ยังไม่มี routine"}</dd></div>
        </dl>
        <p className="reminder-stats-note">Analytics บน Firebase ยังคงเก็บ event ข้ามอุปกรณ์; หน้านี้ใช้ประวัติที่เริ่มเก็บจากเครื่องนี้เพื่อแสดงผลทันที</p>
      </section>
    </div>
  );
}

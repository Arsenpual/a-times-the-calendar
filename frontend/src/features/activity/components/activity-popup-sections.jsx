import React from "react";
import {
  ACTIVITY_SERIES_WARN_LIMIT,
  formatActivityDuration,
  formatActivityTimeLabel
} from "../lib/activity-popup-logic.js";

export function ActivityPopupHeader({ activity, start, end, displayColor, locked, isRecurring, tags, onClose }) {
  return (
    <div className="popup-header">
      <span className="popup-color-dot" style={{ background: displayColor }} />
      <div className="popup-header-text">
        <p className="popup-title">{activity.summary || "(ไม่มีชื่อ)"}</p>
        <p className="popup-subtitle">
          {formatActivityTimeLabel(start)} – {formatActivityTimeLabel(end)} · {formatActivityDuration(start, end)}
          {locked && <span className="popup-lock-chip">🔒 ล็อกอยู่</span>}
          {isRecurring && <span className="popup-recurring-chip">🔁 ซ้ำ</span>}
        </p>
        {tags?.length > 0 && (
          <span className="activity-tag-row">
            {tags.map((tag) => <span key={tag} className="activity-tag-chip">#{tag}</span>)}
          </span>
        )}
      </div>
      <button type="button" className="popup-close" onClick={onClose} aria-label="ปิด">✕</button>
    </div>
  );
}

export function ActivityPopupModePanels({
  mode,
  pendingAction,
  seriesCount,
  seriesCountLoading,
  actionError,
  busyAction,
  isRecurring,
  moveDate,
  setMoveDate,
  setMode,
  setPendingAction,
  handleActionThisOnly,
  handleActionSeries,
  handleOverrideLimitAndProceed,
  handleConfirmDelete,
  handleConfirmDeleteSeries,
  handleConfirmMove
}) {
  if (mode === "recurring-action") {
    return (
      <div className="popup-recurring-choice">
        <p className="popup-recurring-choice-title">
          {pendingAction === "delete" ? "ลบกิจกรรมที่ทำซ้ำนี้" : "แก้ไขกิจกรรมที่ทำซ้ำนี้"}
        </p>
        <p className="popup-recurring-choice-sub">
          {seriesCountLoading
            ? "กำลังตรวจสอบชุดกิจกรรม..."
            : seriesCount !== null
              ? `ชุดนี้มีทั้งหมด ${seriesCount} ครั้ง`
              : "ต้องการ" + (pendingAction === "delete" ? "ลบ" : "แก้ไข") + "แบบไหน?"}
        </p>
        {actionError && <p className="popup-action-error">{actionError}</p>}
        <div className="popup-recurring-choice-btns">
          <button type="button" className="popup-btn" onClick={handleActionThisOnly} disabled={seriesCountLoading}>แค่ครั้งนี้</button>
          <button
            type="button"
            className={`popup-btn ${pendingAction === "delete" ? "danger" : "primary"}`}
            onClick={handleActionSeries}
            disabled={seriesCountLoading}
          >
            ทั้งชุด ({seriesCountLoading ? "..." : seriesCount ?? "?"} ครั้ง)
          </button>
        </div>
        <button type="button" className="popup-btn-text" onClick={() => { setPendingAction(null); setMode("menu"); }}>ยกเลิก</button>
      </div>
    );
  }

  if (mode === "series-limit-warning") {
    return (
      <div className="popup-confirm-delete">
        <p>
          {seriesCount === null
            ? <>⚠ ไม่สามารถตรวจสอบจำนวนครั้งของชุดนี้ได้ — อาจมีมากกว่า {ACTIVITY_SERIES_WARN_LIMIT} ครั้ง</>
            : <>⚠ ชุดนี้มีถึง <b>{seriesCount} ครั้ง</b> (เกินขีดจำกัดแนะนำที่ {ACTIVITY_SERIES_WARN_LIMIT} ครั้ง)</>}
          {" "}— การ{pendingAction === "delete" ? "ลบ" : "แก้ไข"}ทั้งชุดจะ
          {pendingAction === "delete" ? "ลบกิจกรรมทั้งหมดออกจาก Google Calendar ทันทีและ" : "ใช้เวลานานและ"}
          <b> กู้คืนไม่ได้</b>
        </p>
        {actionError && <p className="popup-action-error">{actionError}</p>}
        <div className="popup-footer-row">
          <button type="button" className="popup-btn" onClick={() => setMode("recurring-action")} disabled={busyAction != null}>กลับ</button>
          <button type="button" className="popup-btn danger-solid" onClick={handleOverrideLimitAndProceed} disabled={busyAction != null}>ดำเนินการต่อ</button>
        </div>
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="popup-confirm-delete">
        <p>ลบกิจกรรม<b>ครั้งนี้</b>ใช่ไหม? การลบจะ sync กลับไปที่ Google Calendar ทันทีและ<b> กู้คืนไม่ได้</b></p>
        {actionError && <p className="popup-action-error">{actionError}</p>}
        <div className="popup-footer-row">
          <button type="button" className="popup-btn" onClick={() => setMode(isRecurring ? "recurring-action" : "menu")} disabled={busyAction === "delete"}>ยกเลิก</button>
          <button type="button" className="popup-btn danger-solid" onClick={handleConfirmDelete} disabled={busyAction === "delete"}>
            {busyAction === "delete" ? "กำลังลบ..." : "ลบครั้งนี้"}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "confirm-delete-series") {
    return (
      <div className="popup-confirm-delete">
        <p>ลบกิจกรรมที่ทำซ้ำนี้<b>ทั้งหมด {seriesCount != null ? `(${seriesCount} ครั้ง)` : ""}</b>{" "}ใช่ไหม? การลบจะ sync กลับไปที่ Google Calendar ทันทีและ<b> กู้คืนไม่ได้</b></p>
        {actionError && <p className="popup-action-error">{actionError}</p>}
        <div className="popup-footer-row">
          <button type="button" className="popup-btn" onClick={() => setMode("recurring-action")} disabled={busyAction === "delete-series"}>ยกเลิก</button>
          <button type="button" className="popup-btn danger-solid" onClick={handleConfirmDeleteSeries} disabled={busyAction === "delete-series"}>
            {busyAction === "delete-series" ? "กำลังลบทั้งชุด..." : "ลบทั้งชุด"}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "move-day") {
    return (
      <div className="popup-move-day">
        <label className="popup-field">
          <span className="popup-field-label">ย้ายไปวันที่</span>
          <input type="date" className="popup-select" value={moveDate} onChange={(event) => setMoveDate(event.target.value)} />
        </label>
        {actionError && <p className="popup-action-error">{actionError}</p>}
        <div className="popup-footer-row">
          <button type="button" className="popup-btn" onClick={() => setMode("menu")} disabled={busyAction === "move"}>ยกเลิก</button>
          <button type="button" className="popup-btn primary" onClick={handleConfirmMove} disabled={busyAction === "move"}>
            {busyAction === "move" ? "กำลังย้าย..." : "ยืนยันย้ายวัน"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function ActivityPopupMenu({
  activity,
  locked,
  isRecurring,
  restrictedToLock,
  busyAction,
  lockFeedback,
  actionError,
  categories,
  categoryId,
  selectedCategory,
  onAssignCategory,
  onClose,
  onEditActivity,
  onSelectSeriesDrag,
  onArchive,
  handleDuplicate,
  handleMoveToNextDay,
  handleOpenInGoogle,
  handleToggleLock,
  initiateRecurringAction,
  setMode
}) {
  const canReschedule = !locked;
  return (
    <>
      <div className="popup-quick-actions">
        <button type="button" className="quick-btn" onClick={handleDuplicate} disabled={restrictedToLock || busyAction !== null} title="ทำสำเนากิจกรรมนี้ในวันเดียวกัน">
          <span className="quick-btn-icon">⧉</span>
          <span className="quick-btn-label">{busyAction === "duplicate" ? "กำลังทำ..." : "ทำสำเนา"}</span>
        </button>
        {isRecurring && (
          <button type="button" className="quick-btn" onClick={() => { onSelectSeriesDrag?.(); onClose?.(); }} disabled={restrictedToLock || busyAction !== null} title="เปิดโหมดเลือกหลายรายการสำหรับลบ">
            <span className="quick-btn-icon">✓</span><span className="quick-btn-label">เลือกรายการ</span>
          </button>
        )}
        <button type="button" className="quick-btn" onClick={() => setMode("move-day")} disabled={restrictedToLock || !canReschedule || busyAction !== null} title={canReschedule ? "ย้ายกิจกรรมไปวันอื่น" : "ปลดล็อกก่อนย้ายวัน"}>
          <span className="quick-btn-icon">📅</span><span className="quick-btn-label">ย้ายวัน</span>
        </button>
        <button type="button" className="quick-btn" onClick={handleMoveToNextDay} disabled={restrictedToLock || !canReschedule || busyAction !== null} title={canReschedule ? "ย้ายกิจกรรมไปวันถัดไป" : "ปลดล็อกก่อนย้ายวัน"}>
          <span className="quick-btn-icon">⏭</span><span className="quick-btn-label">{busyAction === "move-next-day" ? "กำลังย้าย..." : "วันถัดไป"}</span>
        </button>
        <button type="button" className="quick-btn" onClick={handleOpenInGoogle} disabled={restrictedToLock || !activity.htmlLink} title="เปิดกิจกรรมนี้ใน Google Calendar">
          <span className="quick-btn-icon">↗</span><span className="quick-btn-label">เปิดใน GCal</span>
        </button>
        <button type="button" className="quick-btn" onClick={handleToggleLock} title={locked ? "ปลดล็อกกิจกรรม" : "ล็อกกิจกรรม"}>
          <span className={`quick-btn-icon${lockFeedback ? " is-lock-feedback" : ""}`}>{lockFeedback || (locked ? "🔓" : "🔒")}</span>
          <span className="quick-btn-label">{locked ? "ปลดล็อก" : "ล็อก"}</span>
        </button>
        <button type="button" className="quick-btn" onClick={() => { onArchive?.(); onClose?.(); }} disabled={restrictedToLock || busyAction !== null} title="เก็บสำเนากิจกรรมนี้ไว้ในคลัง">
          <span className="quick-btn-icon">▣</span><span className="quick-btn-label">เก็บเข้าคลัง</span>
        </button>
        <button type="button" className="quick-btn danger" onClick={() => isRecurring ? initiateRecurringAction("delete") : setMode("confirm-delete")} disabled={restrictedToLock || !canReschedule || busyAction !== null} title={canReschedule ? "ลบกิจกรรม" : "ปลดล็อกก่อนลบ"}>
          <span className="quick-btn-icon">🗑</span><span className="quick-btn-label">ลบ</span>
        </button>
      </div>

      {actionError && <p className="popup-action-error popup-action-error-menu">{actionError}</p>}
      <div className="popup-body">
        <label className="popup-field">
          <span className="popup-field-label">หมวดหมู่</span>
          <div className="popup-field-row">
            {selectedCategory && <span className="popup-category-swatch" style={{ background: selectedCategory.color }} title={selectedCategory.name} />}
            <select className="popup-select" value={categoryId || ""} onChange={(event) => onAssignCategory?.(event.target.value || null)} disabled={locked || restrictedToLock}>
              <option value="">ไม่ระบุ</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
        </label>
        {locked && <p className="popup-locked-note">🔒 กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเพื่อแก้ไข/ลบ</p>}
      </div>
      <div className="popup-footer">
        <button
          type="button"
          className="popup-btn primary"
          onClick={() => {
            if (isRecurring) initiateRecurringAction("edit");
            else { onClose?.(); onEditActivity?.(); }
          }}
          disabled={locked || restrictedToLock}
          title={locked ? "ปลดล็อกก่อนแก้ไข" : undefined}
        >
          {isRecurring ? "✏ แก้ไข (ชื่อ/เวลา)..." : "แก้ไขทั้งหมด (ชื่อ/เวลา)"}
        </button>
      </div>
    </>
  );
}

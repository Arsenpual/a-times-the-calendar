import React, { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_SERIES_WARN_LIMIT,
  formatActivityDuration,
  formatActivityTimeLabel
} from "../lib/activity-popup-logic.js";
import {
  ACTIVITY_POPUP_ACTION_GROUPS,
  createActivityPopupActions,
  groupActivityPopupActions
} from "../lib/activity-popup-actions.js";

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
  handleArchive,
  handleDuplicate,
  handleMoveToNextDay,
  handleOpenInGoogle,
  handleToggleLock,
  initiateRecurringAction,
  setMode
}) {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const actions = useMemo(() => createActivityPopupActions({
    activity,
    locked,
    isRecurring,
    restrictedToLock,
    busyAction,
    lockFeedback,
    handlers: {
      edit: () => {
        if (isRecurring) initiateRecurringAction("edit");
        else { onClose?.(); onEditActivity?.(); }
      },
      moveDay: () => setMode("move-day"),
      duplicate: handleDuplicate,
      selectSeries: () => { onSelectSeriesDrag?.(); onClose?.(); },
      moveNextDay: handleMoveToNextDay,
      openGoogle: handleOpenInGoogle,
      toggleLock: handleToggleLock,
      archive: handleArchive,
      delete: () => isRecurring ? initiateRecurringAction("delete") : setMode("confirm-delete")
    }
  }), [activity, locked, isRecurring, restrictedToLock, busyAction, lockFeedback, initiateRecurringAction, onClose, onEditActivity, onSelectSeriesDrag, setMode, handleDuplicate, handleMoveToNextDay, handleOpenInGoogle, handleToggleLock, handleArchive]);
  const groupedActions = useMemo(() => groupActivityPopupActions(actions), [actions]);
  const secondaryCount = groupedActions.manage.length + groupedActions.danger.length;

  useEffect(() => {
    if (restrictedToLock || locked) setShowMoreActions(false);
  }, [restrictedToLock, locked]);

  const renderAction = (action) => (
    <button
      key={action.id}
      type="button"
      className={`quick-btn${action.group === "danger" ? " danger" : ""}`}
      onClick={action.execute}
      disabled={action.disabled}
      title={action.title}
      data-action-id={action.id}
    >
      <span className={`quick-btn-icon${action.id.includes("lock") && lockFeedback ? " is-lock-feedback" : ""}`}>{action.icon}</span>
      <span className="quick-btn-label">{action.label}</span>
    </button>
  );

  return (
    <>
      <div className="popup-action-group" aria-label={ACTIVITY_POPUP_ACTION_GROUPS.frequent.label}>
        <span className="popup-action-group-label">{locked ? "คำสั่งที่ใช้ได้" : ACTIVITY_POPUP_ACTION_GROUPS.frequent.label}</span>
        <div className="popup-quick-actions">{groupedActions.frequent.map(renderAction)}</div>
      </div>

      {busyAction && <p className="popup-action-progress" role="status">กำลังดำเนินการ กรุณารอสักครู่…</p>}
      {actionError && <p className="popup-action-error popup-action-error-menu">{actionError}</p>}
      {locked && <p className="popup-locked-note">🔒 กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเพื่อใช้คำสั่งอื่น</p>}

      {!restrictedToLock && secondaryCount > 0 && (
        <button
          type="button"
          className="popup-more-actions-toggle"
          onClick={() => setShowMoreActions((current) => !current)}
          aria-expanded={showMoreActions}
        >
          <span>เพิ่มเติม</span><small>{secondaryCount} คำสั่ง</small><b aria-hidden="true">{showMoreActions ? "⌃" : "⌄"}</b>
        </button>

      )}

      {showMoreActions && (
        <div className="popup-secondary-actions">
          {groupedActions.manage.length > 0 && <section className="popup-action-group" aria-label={ACTIVITY_POPUP_ACTION_GROUPS.manage.label}>
            <span className="popup-action-group-label">{ACTIVITY_POPUP_ACTION_GROUPS.manage.label}</span>
            <div className="popup-quick-actions">{groupedActions.manage.map(renderAction)}</div>
          </section>}
          <div className="popup-body">
            <label className="popup-field">
              <span className="popup-field-label">หมวดหมู่</span>
              <div className="popup-field-row">
                {selectedCategory && <span className="popup-category-swatch" style={{ background: selectedCategory.color }} title={selectedCategory.name} />}
                <select className="popup-select" value={categoryId || ""} onChange={(event) => onAssignCategory?.(event.target.value || null)} disabled={locked || busyAction !== null}>
                  <option value="">ไม่ระบุ</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
            </label>
          </div>
          {groupedActions.danger.length > 0 && <section className="popup-action-group popup-action-group--danger" aria-label={ACTIVITY_POPUP_ACTION_GROUPS.danger.label}>
            <span className="popup-action-group-label">{ACTIVITY_POPUP_ACTION_GROUPS.danger.label}</span>
            <div className="popup-quick-actions">{groupedActions.danger.map(renderAction)}</div>
          </section>}
        </div>
      )}
    </>
  );
}

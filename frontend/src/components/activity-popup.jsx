import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { toDateInputValue } from "../date-utils.js";
// กิจกรรมซ้ำที่มี instance เกินกว่านี้จะเตือนก่อน แต่ยังอนุญาตให้ดำเนินการได้
const SERIES_WARN_LIMIT = 20;

function formatDuration(start, end) {
  const totalMin = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม.`;
  return `${h} ชม. ${m} นาที`;
}

function formatTimeLabel(date) {
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Popup แสดงการตั้งค่าของกิจกรรม เมื่อคลิกขวาใน TimelineEditor
 *
 * สำหรับ recurring event จะมี flow "แก้ครั้งนี้ / แก้ทั้งชุด" ก่อนทำ
 * แต่ละ action ที่กระทบชุด (ลบ, แก้ไข) โดยมี limit เตือนที่ 20 instances
 *
 * Props เพิ่มใหม่:
 * @param {number|null} seriesInstanceCount  จำนวน instance ที่โหลดมาแล้ว (null = ยังไม่รู้)
 * @param {() => Promise<number>} onFetchSeriesCount  ดึงจำนวน instance ทั้งชุด
 * @param {() => Promise<void>} onEditSeries  เปิด modal แก้ไขทั้งชุด (ส่ง recurringEventId)
 */
export default function ActivityPopup({
  activity,
  start,
  end,
  position,
  locked,
  categories,
  categoryId,
  tags,
  displayColor,
  onClose,
  onAssignCategory,
  onToggleLock,
  onEditActivity,
  onEditSeries,
  onDelete,
  onDeleteSeries,
  onSelectSeriesDrag,
  onDuplicate,
  onMoveToDay,
  onFetchSeriesCount,
  onArchive,
  restrictedToLock = false
}) {
  const popupRef = useRef(null);
  const [resolvedPosition, setResolvedPosition] = useState(position);
  const [mode, setMode] = useState("menu");
  const [busyAction, setBusyAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [moveDate, setMoveDate] = useState(() => toDateInputValue(start));

  // state สำหรับ recurring flow
  const [pendingAction, setPendingAction] = useState(null); // "delete" | "edit"
  const [seriesCount, setSeriesCount] = useState(null);
  const [seriesCountLoading, setSeriesCountLoading] = useState(false);
  const [lockFeedback, setLockFeedback] = useState(null);

  const canReschedule = !locked;
  const isRecurring = !!activity.recurringEventId;

  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Both Timeline surfaces can open this popup near any viewport edge.
  // Resolve its coordinates after layout because its height varies by mode.
  useLayoutEffect(() => {
    const rect = popupRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const x = Math.max(margin, Math.min(position?.x ?? margin, window.innerWidth - rect.width - margin));
    const y = Math.max(margin, Math.min(position?.y ?? margin, window.innerHeight - rect.height - margin));
    setResolvedPosition((current) => current?.x === x && current?.y === y ? current : { x, y });
  }, [position?.x, position?.y, mode, restrictedToLock]);

  // Escape ถอยกลับทีละขั้นให้ตรงกับปุ่ม "กลับ"/"ยกเลิก" ที่มีอยู่แล้วในแต่ละ
  // sub-mode — ลำดับชั้นจริงลึกกว่า 2 ระดับ (เช่น menu → recurring-action →
  // series-limit-warning → confirm-delete-series) และ "confirm-delete" เอง
  // ก็กลับไปคนละที่กันตาม isRecurring (ดูปุ่ม "ยกเลิก" ของมันเอง) จึงต้องเป็น
  // ฟังก์ชันแทนตารางคงที่ ปิด popup ทั้งอันเฉพาะตอนอยู่ที่เมนูหลักแล้วเท่านั้น
  const getPreviousMode = () => {
    switch (mode) {
      case "confirm-delete":
        return isRecurring ? "recurring-action" : "menu";
      case "series-limit-warning":
      case "confirm-delete-series":
        return "recurring-action";
      default:
        return "menu";
    }
  };
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (mode === "menu") {
        onClose?.();
      } else {
        setMode(getPreviousMode());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onClose, isRecurring]);

  const runQuickAction = async (key, fn) => {
    setBusyAction(key);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDuplicate = () => runQuickAction("duplicate", async () => {
    await onDuplicate?.();
    onClose?.();
  });

  const handleOpenInGoogle = () => {
    if (activity.htmlLink) {
      window.open(activity.htmlLink, "_blank", "noopener,noreferrer");
    }
  };

  const handleToggleLock = async () => {
    setLockFeedback(locked ? "🔓" : "🔒");
    try {
      await onToggleLock?.(!locked);
    } finally {
      window.setTimeout(() => setLockFeedback(null), 700);
    }
  };

  const handleConfirmMove = () => runQuickAction("move", async () => {
    const moved = await onMoveToDay?.(moveDate);
    if (moved !== false) onClose?.();
  });

  // ย้ายไปวันถัดไปทันที (start + 1 วัน) โดยไม่ต้องเปิด date picker — ทางลัด
  // สำหรับกรณีที่พบบ่อยที่สุด (เลื่อนงานไปพรุ่งนี้) ยังคงใช้ onMoveToDay
  // ตัวเดียวกับโหมด "ย้ายวัน" แบบเลือกวันเอง เพื่อให้ parent (app.jsx) จัดการ
  // แค่ทางเดียว ไม่ต้องเพิ่ม prop ใหม่
  const handleMoveToNextDay = () => runQuickAction("move-next-day", async () => {
    const nextDay = new Date(start);
    nextDay.setDate(nextDay.getDate() + 1);
    const moved = await onMoveToDay?.(toDateInputValue(nextDay));
    if (moved !== false) onClose?.();
  });

  const handleConfirmDelete = () => runQuickAction("delete", async () => {
    await onDelete?.();
    onClose?.();
  });

  const handleConfirmDeleteSeries = () => runQuickAction("delete-series", async () => {
    await onDeleteSeries?.();
    onClose?.();
  });

  /**
   * เมื่อกด "ลบ" หรือ "แก้ไข" บน recurring event:
   * ถ้าเป็น recurring → ถามก่อนว่าแก้แค่ครั้งนี้ หรือทั้งชุด
   * พร้อมดึงจำนวน instance เพื่อเตือนถ้าเกิน limit
   */
  const initiateRecurringAction = async (action) => {
    setPendingAction(action);
    setMode("recurring-action");
    setSeriesCount(null);
    setSeriesCountLoading(true);
    try {
      const count = await onFetchSeriesCount?.();
      setSeriesCount(count ?? null);
    } catch (e) {
      // ไม่รู้จำนวน — แสดง UI ได้ตามปกติแค่ไม่แสดงตัวเลข
    } finally {
      setSeriesCountLoading(false);
    }
  };

  // กดปุ่ม "แค่ครั้งนี้"
  const handleActionThisOnly = () => {
    if (pendingAction === "delete") {
      setMode("confirm-delete");
    } else if (pendingAction === "edit") {
      onClose?.();
      onEditActivity?.();
    }
  };

  // กดปุ่ม "ทั้งชุด"
  //
  // ถ้า seriesCount เป็น null (onFetchSeriesCount ล้มเหลว หรือไม่ได้ผ่าน
  // prop มาให้เลย) — เดิมโค้ดนี้ปล่อยผ่านตรงไปที่ confirm/onEditSeries
  // ทันทีโดยไม่เตือนเรื่อง limit เลย ทั้งที่ SERIES_WARN_LIMIT มีไว้ป้องกัน
  // การลบ/แก้ไขชุดใหญ่โดยไม่ตั้งใจโดยเฉพาะ — ไม่รู้จำนวนจริงไม่ควรถือว่า
  // "ปลอดภัยแน่นอน" จึงเตือนไปก่อนเป็นค่าเริ่มต้นที่ระมัดระวังกว่า (ผู้ใช้
  // ยังกด "ดำเนินการต่อ" ต่อได้ปกติจากหน้าเตือนนั้น)
  const handleActionSeries = () => {
    if (seriesCount === null || seriesCount > SERIES_WARN_LIMIT) {
      setMode("series-limit-warning");
    } else {
      if (pendingAction === "delete") {
        setMode("confirm-delete-series");
      } else if (pendingAction === "edit") {
        onClose?.();
        onEditSeries?.();
      }
    }
  };

  // กดยืนยันต่อแม้เกิน limit
  const handleOverrideLimitAndProceed = () => {
    if (pendingAction === "delete") {
      setMode("confirm-delete-series");
    } else if (pendingAction === "edit") {
      onClose?.();
      onEditSeries?.();
    }
  };

  return (
    <div
      ref={popupRef}
      className={`activity-popup${restrictedToLock ? " activity-popup--lock-only" : ""}`}
      style={{ top: resolvedPosition?.y ?? position?.y ?? 8, left: resolvedPosition?.x ?? position?.x ?? 8 }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ───── Header ───── */}
      <div className="popup-header">
        <span className="popup-color-dot" style={{ background: displayColor }} />
        <div className="popup-header-text">
          <p className="popup-title">{activity.summary || "(ไม่มีชื่อ)"}</p>
          <p className="popup-subtitle">
            {formatTimeLabel(start)} – {formatTimeLabel(end)} · {formatDuration(start, end)}
            {locked && <span className="popup-lock-chip">🔒 ล็อกอยู่</span>}
            {isRecurring && <span className="popup-recurring-chip">🔁 ซ้ำ</span>}
          </p>
          {tags && tags.length > 0 && (
            <span className="activity-tag-row">
              {tags.map((tag) => (
                <span key={tag} className="activity-tag-chip">#{tag}</span>
              ))}
            </span>
          )}
        </div>
        <button type="button" className="popup-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>
      </div>

      {/* ───── Mode: ถามว่าแก้แค่ครั้งนี้ หรือทั้งชุด ───── */}
      {mode === "recurring-action" && (
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
            <button
              type="button"
              className="popup-btn"
              onClick={handleActionThisOnly}
              disabled={seriesCountLoading}
            >
              แค่ครั้งนี้
            </button>
            <button
              type="button"
              className={`popup-btn ${pendingAction === "delete" ? "danger" : "primary"}`}
              onClick={handleActionSeries}
              disabled={seriesCountLoading}
            >
              ทั้งชุด ({seriesCountLoading ? "..." : seriesCount ?? "?"} ครั้ง)
            </button>
          </div>
          <button
            type="button"
            className="popup-btn-text"
            onClick={() => { setPendingAction(null); setMode("menu"); }}
          >
            ยกเลิก
          </button>
        </div>
      )}

      {/* ───── Mode: เตือนเกิน limit ───── */}
      {mode === "series-limit-warning" && (
        <div className="popup-confirm-delete">
          <p>
            {seriesCount === null ? (
              <>⚠ ไม่สามารถตรวจสอบจำนวนครั้งของชุดนี้ได้ — อาจมีมากกว่า {SERIES_WARN_LIMIT} ครั้ง</>
            ) : (
              <>⚠ ชุดนี้มีถึง <b>{seriesCount} ครั้ง</b> (เกินขีดจำกัดแนะนำที่ {SERIES_WARN_LIMIT} ครั้ง)</>
            )}
            {" "}— การ{pendingAction === "delete" ? "ลบ" : "แก้ไข"}ทั้งชุดจะ
            {pendingAction === "delete"
              ? "ลบกิจกรรมทั้งหมดออกจาก Google Calendar ทันทีและ"
              : "ใช้เวลานานและ"}
            <b> กู้คืนไม่ได้</b>
          </p>
          {actionError && <p className="popup-action-error">{actionError}</p>}
          <div className="popup-footer-row">
            <button
              type="button"
              className="popup-btn"
              onClick={() => setMode("recurring-action")}
              disabled={busyAction != null}
            >
              กลับ
            </button>
            <button
              type="button"
              className="popup-btn danger-solid"
              onClick={handleOverrideLimitAndProceed}
              disabled={busyAction != null}
            >
              ดำเนินการต่อ
            </button>
          </div>
        </div>
      )}

      {/* ───── Mode: ยืนยันลบครั้งเดียว ───── */}
      {mode === "confirm-delete" && (
        <div className="popup-confirm-delete">
          <p>
            ลบกิจกรรม<b>ครั้งนี้</b>ใช่ไหม? การลบจะ sync กลับไปที่ Google Calendar ทันทีและ
            <b> กู้คืนไม่ได้</b>
          </p>
          {actionError && <p className="popup-action-error">{actionError}</p>}
          <div className="popup-footer-row">
            <button
              type="button"
              className="popup-btn"
              onClick={() => setMode(isRecurring ? "recurring-action" : "menu")}
              disabled={busyAction === "delete"}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="popup-btn danger-solid"
              onClick={handleConfirmDelete}
              disabled={busyAction === "delete"}
            >
              {busyAction === "delete" ? "กำลังลบ..." : "ลบครั้งนี้"}
            </button>
          </div>
        </div>
      )}

      {/* ───── Mode: ยืนยันลบทั้งชุด ───── */}
      {mode === "confirm-delete-series" && (
        <div className="popup-confirm-delete">
          <p>
            ลบกิจกรรมที่ทำซ้ำนี้<b>ทั้งหมด {seriesCount != null ? `(${seriesCount} ครั้ง)` : ""}</b>
            {" "}ใช่ไหม? การลบจะ sync กลับไปที่ Google Calendar ทันทีและ<b> กู้คืนไม่ได้</b>
          </p>
          {actionError && <p className="popup-action-error">{actionError}</p>}
          <div className="popup-footer-row">
            <button
              type="button"
              className="popup-btn"
              onClick={() => setMode("recurring-action")}
              disabled={busyAction === "delete-series"}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="popup-btn danger-solid"
              onClick={handleConfirmDeleteSeries}
              disabled={busyAction === "delete-series"}
            >
              {busyAction === "delete-series" ? "กำลังลบทั้งชุด..." : "ลบทั้งชุด"}
            </button>
          </div>
        </div>
      )}

      {/* ───── Mode: ย้ายวัน ───── */}
      {mode === "move-day" && (
        <div className="popup-move-day">
          <label className="popup-field">
            <span className="popup-field-label">ย้ายไปวันที่</span>
            <input
              type="date"
              className="popup-select"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
            />
          </label>
          {actionError && <p className="popup-action-error">{actionError}</p>}
          <div className="popup-footer-row">
            <button type="button" className="popup-btn" onClick={() => setMode("menu")} disabled={busyAction === "move"}>
              ยกเลิก
            </button>
            <button type="button" className="popup-btn primary" onClick={handleConfirmMove} disabled={busyAction === "move"}>
              {busyAction === "move" ? "กำลังย้าย..." : "ยืนยันย้ายวัน"}
            </button>
          </div>
        </div>
      )}

      {/* ───── Mode: menu หลัก ───── */}
      {mode === "menu" && (
        <>
          {/* Quick actions */}
          <div className="popup-quick-actions">
            <button
              type="button" className="quick-btn"
              onClick={handleDuplicate}
              disabled={restrictedToLock || busyAction !== null}
              title="ทำสำเนากิจกรรมนี้ในวันเดียวกัน"
            >
              <span className="quick-btn-icon">⧉</span>
              <span className="quick-btn-label">{busyAction === "duplicate" ? "กำลังทำ..." : "ทำสำเนา"}</span>
            </button>
            {isRecurring && (
              <button type="button" className="quick-btn" onClick={() => { onSelectSeriesDrag?.(); onClose?.(); }} disabled={restrictedToLock || busyAction !== null} title="เปิดโหมดเลือกหลายรายการสำหรับลบ">
                <span className="quick-btn-icon">✓</span>
                <span className="quick-btn-label">เลือกรายการ</span>
              </button>
            )}
            <button
              type="button" className="quick-btn"
              onClick={() => setMode("move-day")}
              disabled={restrictedToLock || !canReschedule || busyAction !== null}
              title={canReschedule ? "ย้ายกิจกรรมไปวันอื่น" : "ปลดล็อกก่อนย้ายวัน"}
            >
              <span className="quick-btn-icon">📅</span>
              <span className="quick-btn-label">ย้ายวัน</span>
            </button>
            <button
              type="button" className="quick-btn"
              onClick={handleMoveToNextDay}
              disabled={restrictedToLock || !canReschedule || busyAction !== null}
              title={canReschedule ? "ย้ายกิจกรรมไปวันถัดไป" : "ปลดล็อกก่อนย้ายวัน"}
            >
              <span className="quick-btn-icon">⏭</span>
              <span className="quick-btn-label">{busyAction === "move-next-day" ? "กำลังย้าย..." : "วันถัดไป"}</span>
            </button>
            <button
              type="button" className="quick-btn"
              onClick={handleOpenInGoogle}
              disabled={restrictedToLock || !activity.htmlLink}
              title="เปิดกิจกรรมนี้ใน Google Calendar"
            >
              <span className="quick-btn-icon">↗</span>
              <span className="quick-btn-label">เปิดใน GCal</span>
            </button>
            <button
              type="button" className="quick-btn"
              onClick={handleToggleLock}
              title={locked ? "ปลดล็อกกิจกรรม" : "ล็อกกิจกรรม"}
            >
              <span className={`quick-btn-icon${lockFeedback ? " is-lock-feedback" : ""}`}>{lockFeedback || (locked ? "🔓" : "🔒")}</span>
              <span className="quick-btn-label">{locked ? "ปลดล็อก" : "ล็อก"}</span>
            </button>
            <button
              type="button" className="quick-btn"
              onClick={() => { onArchive?.(); onClose?.(); }}
              disabled={restrictedToLock || busyAction !== null}
              title="เก็บสำเนากิจกรรมนี้ไว้ในคลัง"
            >
              <span className="quick-btn-icon">▣</span>
              <span className="quick-btn-label">เก็บเข้าคลัง</span>
            </button>
            {/* ลบ: recurring → ถามก่อน, ปกติ → confirm โดยตรง */}
            <button
              type="button" className="quick-btn danger"
              onClick={() => isRecurring ? initiateRecurringAction("delete") : setMode("confirm-delete")}
              disabled={restrictedToLock || !canReschedule || busyAction !== null}
              title={canReschedule ? "ลบกิจกรรม" : "ปลดล็อกก่อนลบ"}
            >
              <span className="quick-btn-icon">🗑</span>
              <span className="quick-btn-label">ลบ</span>
            </button>
          </div>

          {actionError && <p className="popup-action-error popup-action-error-menu">{actionError}</p>}

          {/* ───── การตั้งค่าปัจจุบันของกิจกรรม ───── */}
          <div className="popup-body">

            {/* หมวดหมู่ */}
            <label className="popup-field">
              <span className="popup-field-label">หมวดหมู่</span>
              <div className="popup-field-row">
                {selectedCategory && (
                  <span
                    className="popup-category-swatch"
                    style={{ background: selectedCategory.color }}
                    title={selectedCategory.name}
                  />
                )}
                <select
                  className="popup-select"
                  value={categoryId || ""}
                  onChange={(e) => onAssignCategory?.(e.target.value || null)}
                  disabled={locked || restrictedToLock}
                >
                  <option value="">ไม่ระบุ</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </label>

            {/* Lock status */}
            {locked && (
              <p className="popup-locked-note">
                🔒 กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเพื่อแก้ไข/ลบ
              </p>
            )}
          </div>

          {/* ───── Footer: แก้ไขทั้งหมด ───── */}
          <div className="popup-footer">
            <button
              type="button"
              className="popup-btn primary"
              onClick={() => {
                if (isRecurring) {
                  initiateRecurringAction("edit");
                } else {
                  onClose?.();
                  onEditActivity?.();
                }
              }}
              disabled={locked || restrictedToLock}
              title={locked ? "ปลดล็อกก่อนแก้ไข" : undefined}
            >
              {isRecurring ? "✏ แก้ไข (ชื่อ/เวลา)..." : "แก้ไขทั้งหมด (ชื่อ/เวลา)"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

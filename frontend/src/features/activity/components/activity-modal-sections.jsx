import React from "react";
import { combineDateAndTime } from "../../../shared/lib/date-utils.js";
import { describeRepeat, RRULE_WEEKDAYS } from "../lib/rrule-utils.js";

const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function ActivityModalHeader({
  isEditing,
  onSyncGoogleCalendar,
  googleCalendarSyncing,
  onOpenAssistant,
  onClose
}) {
  return (
    <div className="modal-header">
      <h2 className="modal-title">{isEditing ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}</h2>
      <div className="modal-header-actions">
        {!isEditing && onSyncGoogleCalendar && (
          <button type="button" className="google-calendar-sync-btn" onClick={onSyncGoogleCalendar} disabled={googleCalendarSyncing} title="ดึงกิจกรรมของสัปดาห์นี้จาก Google Calendar">
            <img src={`${import.meta.env.BASE_URL}logo/google-calendar.svg`} alt="" />
            <span>{googleCalendarSyncing ? "กำลังดึง..." : "ดึงจาก Google Calendar"}</span>
          </button>
        )}
        {!isEditing && onOpenAssistant && (
          <button
            type="button"
            className="activity-modal-assistant-launch"
            onClick={onOpenAssistant}
            title="ให้ MR.Zettascale ช่วยเสนอรายละเอียดกิจกรรม"
          >
            <span aria-hidden="true">✦</span> ให้ MR.Zettascale ช่วย
          </button>
        )}
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>
      </div>
    </div>
  );
}

export function ActivityDateTimeFields({
  isAllDay,
  toggleAllDay,
  date,
  endDate,
  startTime,
  endTime,
  setDate,
  setEndDate,
  startMissing,
  endMissing,
  assistantHighlightField,
  datePlusDays,
  dateTimeValue,
  updateDateTime
}) {
  return (
    <>
      <button type="button" className={`all-day-activity-toggle${isAllDay ? " is-active" : ""}`} onClick={toggleAllDay} aria-pressed={isAllDay}>
        <span aria-hidden="true">◷</span>
        <span>กิจกรรมทั้งวัน</span>
      </button>

      <div className="modal-field-row">
        <label className={`modal-field${startMissing ? " is-required-missing" : ""}${["date", "time"].includes(assistantHighlightField) ? " is-assistant-highlight" : ""}`}>
          <span className="field-label">{isAllDay ? "วันเริ่ม" : "วันและเวลาเริ่ม"}</span>
          {isAllDay
            ? <input type="date" value={date} onChange={(event) => { setDate(event.target.value); if (!endDate || endDate <= event.target.value) setEndDate(datePlusDays(event.target.value, 1)); }} required />
            : <input key={`start-${dateTimeValue(date, startTime)}`} type="datetime-local" defaultValue={dateTimeValue(date, startTime)} onChange={(event) => updateDateTime("start", event.target.value)} required />}
        </label>
        <label className={`modal-field${endMissing ? " is-required-missing" : ""}${assistantHighlightField === "durationMinutes" ? " is-assistant-highlight" : ""}`}>
          <span className="field-label">{isAllDay ? "วันสิ้นสุด" : "วันและเวลาสิ้นสุด"}</span>
          {isAllDay
            ? <input type="date" value={endDate} min={datePlusDays(date, 1)} onChange={(event) => setEndDate(event.target.value)} required />
            : <input key={`end-${dateTimeValue(endDate, endTime)}`} type="datetime-local" defaultValue={dateTimeValue(endDate, endTime)} min={dateTimeValue(date, startTime)} onChange={(event) => updateDateTime("end", event.target.value)} required />}
        </label>
      </div>
      {isAllDay ? <p className="modal-hint">กิจกรรมทั้งวันใช้วันสิ้นสุดแบบไม่รวมวันนั้น เช่น 10 ก.ย. วันเดียว ระบบจะกำหนดสิ้นสุดเป็น 11 ก.ย.</p> : endDate === date && endTime <= startTime && (
        <p className="modal-hint">
          ⏰ เวลาสิ้นสุดอยู่ก่อนเวลาเริ่ม — ระบบจะถือว่ากิจกรรมนี้จบในวันถัดไป (ข้ามเที่ยงคืน)
        </p>
      )}
    </>
  );
}

export function ActivityCategoryField({
  categoryFieldRef,
  selectedCategory,
  categoryDropdownOpen,
  setCategoryDropdownOpen,
  categoryId,
  setCategoryId,
  categories,
  onCreateCategory,
  onDeleteCategory,
  deletingCategoryId,
  handleDeleteCategory,
  creatingCategory,
  setCreatingCategory,
  newCategoryName,
  setNewCategoryName,
  categoryColorSwatches,
  newCategoryColor,
  setNewCategoryColor,
  categoryError,
  setCategoryError,
  categorySaving,
  handleCreateCategory
}) {
  return (
    <div className="modal-field" ref={categoryFieldRef} style={{ position: "relative" }}>
      <span className="field-label">หมวดหมู่</span>
      <div className="category-select-wrap">
        {selectedCategory && <span className="category-swatch" style={{ background: selectedCategory.color }} />}
        <button
          type="button"
          className="category-dropdown-trigger"
          onClick={() => setCategoryDropdownOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={categoryDropdownOpen}
        >
          <span>{selectedCategory ? selectedCategory.name : "ไม่ระบุ"}</span>
          <span className="category-dropdown-arrow">{categoryDropdownOpen ? "▲" : "▼"}</span>
        </button>
      </div>

      {categoryDropdownOpen && (
        <ul className="category-dropdown-list" role="listbox">
          <li
            className={`category-dropdown-item${categoryId === "" ? " is-active" : ""}`}
            role="option"
            aria-selected={categoryId === ""}
            onClick={() => {
              setCategoryId("");
              setCategoryDropdownOpen(false);
            }}
          >
            <span className="category-dropdown-item-label">ไม่ระบุ</span>
          </li>
          {categories.map((category) => (
            <li
              key={category.id}
              className={`category-dropdown-item${categoryId === category.id ? " is-active" : ""}`}
              role="option"
              aria-selected={categoryId === category.id}
              onClick={() => {
                setCategoryId(category.id);
                setCategoryDropdownOpen(false);
              }}
            >
              <span className="category-dropdown-item-label">
                <span className="category-swatch" style={{ background: category.color }} />
                {category.name}
              </span>
              {onDeleteCategory && (
                <button
                  type="button"
                  className="category-delete-btn"
                  onClick={(event) => handleDeleteCategory(event, category)}
                  disabled={deletingCategoryId === category.id}
                  title={`ลบหมวดหมู่ "${category.name}"`}
                  aria-label={`ลบหมวดหมู่ ${category.name}`}
                >
                  {deletingCategoryId === category.id ? "…" : "✕"}
                </button>
              )}
            </li>
          ))}
          {onCreateCategory && (
            <li
              className="category-dropdown-item category-dropdown-create"
              role="option"
              onClick={() => {
                setCreatingCategory(true);
                setCategoryError(null);
                setCategoryDropdownOpen(false);
              }}
            >
              <span className="category-dropdown-item-label">+ สร้างหมวดหมู่ใหม่</span>
            </li>
          )}
        </ul>
      )}

      {creatingCategory && (
        <div className="new-category-form">
          <input
            type="text"
            className="new-category-name-input"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="ชื่อหมวดหมู่ เช่น งานอดิเรก"
            autoFocus
          />
          <div className="category-color-swatch-row">
            {categoryColorSwatches.map((hex) => (
              <button
                key={hex}
                type="button"
                className={`color-dot${newCategoryColor === hex ? " is-selected" : ""}`}
                style={{ background: hex, color: hex }}
                onClick={() => setNewCategoryColor(hex)}
                title={hex}
                aria-label={`เลือกสี ${hex}`}
              />
            ))}
            <label className="category-custom-color" title="เลือกสีเอง (color picker)">
              <input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} />
            </label>
          </div>
          {categoryError && <p className="modal-error">{categoryError}</p>}
          <div className="new-category-actions">
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={() => {
                setCreatingCategory(false);
                setCategoryError(null);
              }}
              disabled={categorySaving}
            >
              ยกเลิก
            </button>
            <button type="button" className="btn btn-primary btn-small" onClick={handleCreateCategory} disabled={categorySaving}>
              {categorySaving ? "กำลังสร้าง..." : "สร้างหมวดหมู่"}
            </button>
          </div>
        </div>
      )}

      {!creatingCategory && categoryError && <p className="modal-error">{categoryError}</p>}
    </div>
  );
}

export function ActivityTagField({ tags, tagDraft, setTagDraft, maxCount, addTagFromDraft, removeTag, handleTagInputKeyDown }) {
  return (
    <div className="modal-field">
      <span className="field-label">Tag</span>
      <div className="tag-input-wrap">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button type="button" className="tag-chip-remove" onClick={() => removeTag(tag)} aria-label={`ลบ tag ${tag}`}>
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          className="tag-input"
          value={tagDraft}
          onChange={(event) => setTagDraft(event.target.value)}
          onKeyDown={handleTagInputKeyDown}
          onBlur={addTagFromDraft}
          placeholder={tags.length >= maxCount ? "ครบจำนวน tag สูงสุดแล้ว" : "พิมพ์แล้วกด Enter..."}
          disabled={tags.length >= maxCount}
        />
      </div>
    </div>
  );
}

export function ActivityRepeatFields({
  recurrenceEditable,
  isEditing,
  wasUnlimitedRepeat,
  repeat,
  setRepeat,
  toggleWeekday,
  maxRepeatCount,
  repeatMaximumUntil,
  date,
  startTime
}) {
  if (!recurrenceEditable) {
    return isEditing ? (
      <p className="allday-hint">
        กิจกรรมนี้เป็นส่วนหนึ่งของชุดกิจกรรมที่ทำซ้ำอยู่แล้ว — การแก้ไขรูปแบบการทำซ้ำยังไม่รองรับในแอปนี้
        (แก้ไขได้โดยตรงใน Google Calendar)
      </p>
    ) : null;
  }

  return (
    <div className="modal-field">
      <span className="field-label">ทำซ้ำ</span>
      {wasUnlimitedRepeat && (
        <p className="modal-error" style={{ marginBottom: "6px" }}>
          ⚠ กิจกรรมนี้เดิมตั้งไว้แบบ "ไม่มีวันสิ้นสุด" — ฟังก์ชันนี้ปิดไว้ก่อน
          ถ้ากด "แก้ไข" ตอนนี้ การทำซ้ำจะถูกจำกัดเหลือ {repeat.count} ครั้งแทน
        </p>
      )}
      <div className="repeat-summary">
        <select
          value={repeat.mode === "none" ? "none" : "custom"}
          onChange={(event) => setRepeat((previous) => ({ ...previous, mode: event.target.value === "none" ? "none" : "custom" }))}
        >
          <option value="none">ไม่ซ้ำ</option>
          <option value="custom">กำหนดเอง</option>
        </select>
      </div>

      {repeat.mode === "custom" && (
        <div className="repeat-custom">
          <div className="repeat-freq-row">
            <span>ทำซ้ำทุก</span>
            <input
              type="number"
              min="1"
              value={repeat.interval}
              onChange={(event) => setRepeat((previous) => ({ ...previous, interval: Math.max(1, parseInt(event.target.value, 10) || 1) }))}
            />
            <select value={repeat.freq} onChange={(event) => setRepeat((previous) => ({ ...previous, freq: event.target.value }))}>
              <option value="DAILY">วัน</option>
              <option value="WEEKLY">สัปดาห์</option>
              <option value="MONTHLY">เดือน</option>
            </select>
          </div>

          {repeat.freq === "WEEKLY" && (
            <div className="modal-field" style={{ gap: "8px" }}>
              <span className="field-label">ในวัน</span>
              <div className="weekday-picker">
                {RRULE_WEEKDAYS.map((code, index) => (
                  <button
                    key={code}
                    type="button"
                    className={`weekday-chip${repeat.byDay.includes(code) ? " is-active" : ""}`}
                    onClick={() => toggleWeekday(code)}
                  >
                    {WEEKDAY_SHORT[index]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="modal-field" style={{ gap: "8px" }}>
            <span className="field-label">สิ้นสุด</span>
            <div className="repeat-end-row">
              <label className="radio-inline">
                <input type="radio" name="repeat-end" checked={repeat.end === "count"} onChange={() => setRepeat((previous) => ({ ...previous, end: "count" }))} />
                หลังจาก
              </label>
              <input
                type="number"
                min="1"
                max={maxRepeatCount}
                value={repeat.count}
                disabled={repeat.end !== "count"}
                onChange={(event) => setRepeat((previous) => ({
                  ...previous,
                  count: Math.min(maxRepeatCount, Math.max(1, parseInt(event.target.value, 10) || 1))
                }))}
              />
              <span>ครั้ง (สูงสุด {maxRepeatCount} ครั้ง)</span>
              <label className="radio-inline">
                <input type="radio" name="repeat-end" checked={repeat.end === "until"} onChange={() => setRepeat((previous) => ({ ...previous, end: "until" }))} />
                ในวันที่
              </label>
              <input
                type="date"
                disabled={repeat.end !== "until"}
                value={repeat.until}
                max={repeatMaximumUntil}
                onChange={(event) => setRepeat((previous) => ({ ...previous, until: event.target.value > repeatMaximumUntil ? repeatMaximumUntil : event.target.value }))}
              />
            </div>
            <p className="repeat-limit-note">จำกัดกิจกรรมทำซ้ำสูงสุด {maxRepeatCount} ครั้งต่อชุด{repeat.end === "until" ? ` · เลือกได้ไม่เกิน ${repeatMaximumUntil}` : ""}</p>
          </div>

          <p className="repeat-preview">{describeRepeat(repeat, combineDateAndTime(date, startTime || "00:00"))}</p>
        </div>
      )}
    </div>
  );
}

export function ActivityNotesField({ notesOpen, setNotesOpen, notes, setNotes }) {
  return (
    <div className="modal-field">
      <button type="button" className={`collapsible-trigger${notesOpen ? " is-open" : ""}`} onClick={() => setNotesOpen((value) => !value)}>
        <span className="chevron">▸</span> เพิ่มรายละเอียด / โน้ต
      </button>
      {notesOpen && (
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="รายละเอียดเพิ่มเติม เช่น ลิงก์ประชุม, สิ่งที่ต้องเตรียม..."
        />
      )}
    </div>
  );
}

export function ActivityModalActions({ isEditing, isRecurringOccurrence, saving, onDelete, onClose }) {
  return (
    <div className="modal-actions">
      {isEditing && (
        <button type="button" className="btn btn-danger" onClick={onDelete} disabled={saving}>
          {isRecurringOccurrence ? "ลบครั้งนี้" : "ลบ"}
        </button>
      )}
      <div className="modal-actions-right">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>ยกเลิก</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
      </div>
    </div>
  );
}

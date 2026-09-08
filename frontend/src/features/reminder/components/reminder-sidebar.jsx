import React, { useState } from "react";
import { useLanguage } from "../../../shared/i18n/i18n.jsx";
const GROUP_COLOR_PALETTE = ["#4285f4", "#34a853", "#ea4335", "#f9ab00", "#a142f4", "#00bcd4", "#e91e63", "#8d6e63"];
export default function ReminderSidebar({ reminders, groups, groupsError, addGroup, handleDeleteGroup, activeTypeFilter, setActiveTypeFilter, activeGroupFilter, setActiveGroupFilter, toggleGroupFilter, toggleTypeFilter, typeFilterOptions, dateView, setDateView, selectedDateKey, selectDate }) {
const { t } = useLanguage();
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLOR_PALETTE[0]);
  const submitNewGroup = async (event) => {
    event.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    try {
      await addGroup(trimmed, newGroupColor);
      setNewGroupName("");
      setIsAddingGroup(false);
    } catch {
      // groupsError จาก hook แสดงผลอยู่แล้วใน nav sidebar — ไม่ต้องทำอะไร
      // เพิ่มตรงนี้ แค่ไม่ปิดฟอร์มทิ้งเพื่อให้ผู้ใช้ลองใหม่ได้จากค่าที่พิมพ์ไว้เดิม
    }
  };


return (
        <nav className="nav-sidebar">
          <div>
            <p className="nav-section-title">{t("reminder.primaryViews")}</p>
            <button
              type="button"
              className={`nav-item ${dateView === "all" && activeTypeFilter === null && activeGroupFilter === null ? "is-active" : ""}`}
              onClick={() => {
                setDateView("all");
                setActiveTypeFilter(null);
                setActiveGroupFilter(null);
              }}
            >
              <span>{t("reminder.all")}</span>
              <span className="nav-item-count">{reminders.length}</span>
            </button>
            <button type="button" className={`nav-item ${dateView === "today" ? "is-active" : ""}`} onClick={() => setDateView("today")} aria-pressed={dateView === "today"}>
              <span>{t("reminder.today")}</span>
            </button>
            <label className="nav-item reminder-date-picker">
              <span>📅 {selectedDateKey}</span>
              <input type="date" aria-label="เลือกวันที่ / Select date" value={selectedDateKey} onChange={(event) => selectDate(event.target.value)} onClick={(event) => event.currentTarget.showPicker?.()} />
            </label>
          </div>

          <div>
            <p className="nav-section-title">{t("reminder.groups")}</p>
            {groupsError && <p className="nav-error-state">{groupsError}</p>}
            {groups.length === 0 && !isAddingGroup && <p className="nav-empty-state">{t("reminder.noGroups")}</p>}
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`nav-item ${activeGroupFilter === group.id ? "is-active" : ""}`}
                onClick={() => toggleGroupFilter(group.id)}
                aria-pressed={activeGroupFilter === group.id}
              >
                <span className="nav-item-group-label">
                  <span className="nav-item-group-dot" style={{ background: group.color }} />
                  {group.name}
                </span>
                <span className="nav-item-right-group">
                  <span className="nav-item-count">{reminders.filter((r) => r.groupId === group.id).length}</span>
                  {/* ปุ่มลบกลุ่ม — เผยออกด้วย hover เหมือน .reminder-card-actions
                      เดิม กด e.stopPropagation กันไม่ให้ trigger toggleGroupFilter
                      ของปุ่มแม่ไปพร้อมกัน */}
                  <span
                    role="button"
                    tabIndex={0}
                    className="nav-item-delete-group"
                    title={t("reminder.deleteGroup")}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(group.id);
                    }}
                  >
                    ✕
                  </span>
                </span>
              </button>
            ))}

            {isAddingGroup ? (
              <form className="nav-add-group-form" onSubmit={submitNewGroup}>
                <input
                  type="text"
                  className="nav-add-group-input"
                  placeholder={t("reminder.groupName")}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  maxLength={60}
                />
                <div className="nav-group-color-picker" role="group" aria-label={t("reminder.chooseGroupColor")}>
                  {GROUP_COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`nav-group-color-option${newGroupColor === color ? " is-selected" : ""}`}
                      style={{ "--group-color": color }}
                      onClick={() => setNewGroupColor(color)}
                      aria-label={`${t("reminder.chooseGroupColor")}: ${color}`}
                      aria-pressed={newGroupColor === color}
                    />
                  ))}
                  <label className="nav-group-custom-color" title={t("reminder.chooseCustomColor")}>
                    <input type="color" value={newGroupColor} onChange={(event) => setNewGroupColor(event.target.value)} aria-label={t("reminder.chooseCustomColor")} />
                    <span>+</span>
                  </label>
                </div>
                <div className="nav-add-group-actions">
                  <button type="submit" className="nav-add-group-confirm">{t("reminder.add")}</button>
                  <button
                    type="button"
                    className="nav-add-group-cancel"
                    onClick={() => {
                      setIsAddingGroup(false);
                      setNewGroupName("");
                    }}
                  >
                    {t("reminder.cancel")}
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="nav-item" onClick={() => setIsAddingGroup(true)}>
                <span>{t("reminder.addGroup")}</span>
              </button>
            )}
          </div>

          <div>
            <p className="nav-section-title">{t("reminder.typeFilters")}</p>
            {typeFilterOptions.map(({ type, labelKey }) => (
              <button
                key={type}
                type="button"
                className={`nav-item ${activeTypeFilter === type ? "is-active" : ""}`}
                onClick={() => toggleTypeFilter(type)}
                aria-pressed={activeTypeFilter === type}
              >
                <span>{t(labelKey)}</span>
                <span className="nav-item-count">{reminders.filter((r) => r.type === type).length}</span>
              </button>
            ))}
          </div>
        </nav>
);
}

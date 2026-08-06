import React from "react";
import { activityDate, formatTime, formatMonthYear } from "../date-utils.js";
import { getDisplayColor } from "../activity-colors.js";
import { normalizeActivityId } from "../id-utils.js";

/**
 * แสดงผลลัพธ์การค้นหาด้วย tag เป็นรายการเรียงตามวันที่ (ไม่ใช่กริด 7 วันแบบ
 * AgendaView ปกติ) เพราะผลลัพธ์อาจกระจายข้ามหลายสัปดาห์/เดือน — AgendaView
 * ยึดติดกับสัปดาห์เดียวเสมอ (anchorDate) จึงไม่เหมาะกับกรณีนี้ ใช้ component
 * แยกต่างหากแทนที่จะดัดแปลง AgendaView ให้ซับซ้อนขึ้นโดยไม่จำเป็น
 *
 * คลิกกิจกรรมแล้วเปิด ActivityModal แก้ไขได้เหมือนปกติ (onEditActivity เดียว
 * กับที่ AgendaView ใช้อยู่)
 */
export default function TagSearchResults({
  activities,
  categories,
  activityCategoryMap,
  activityTagMap,
  searchTerms,
  loading,
  error,
  onEditActivity
}) {
  const sorted = [...activities].sort((a, b) => {
    const dateA = activityDate(a.start);
    const dateB = activityDate(b.start);
    if (!dateA || !dateB) return 0;
    return dateA - dateB;
  });

  // จัดกลุ่มตามวันที่ (คีย์ "YYYY-MM-DD") เพื่อแสดงหัวข้อวันคั่นระหว่างกลุ่ม
  const groups = [];
  let currentKey = null;
  for (const activity of sorted) {
    const d = activityDate(activity.start);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== currentKey) {
      groups.push({ key, date: d, items: [] });
      currentKey = key;
    }
    groups[groups.length - 1].items.push(activity);
  }

  return (
    <div className="tag-search-results">
      {loading && <p className="tag-search-results-status">กำลังค้นหาในช่วง ±3 เดือน...</p>}
      {error && <p className="tag-search-results-status tag-search-results-error">{error}</p>}

      {!loading && !error && groups.length === 0 && (
        <p className="tag-search-results-status">
          ไม่พบกิจกรรมที่มี tag ตรงกับ {searchTerms.map((t) => `#${t}`).join(", ")}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.key} className="tag-search-group">
          <p className="tag-search-group-date">
            {group.date.getDate()} {formatMonthYear(group.date)}
          </p>
          {group.items.map((activity) => {
            const start = activityDate(activity.start);
            const end = activityDate(activity.end) || start;
            const color = getDisplayColor(activity, activityCategoryMap, categories);
            const tags = activityTagMap?.[normalizeActivityId(activity.id)] || [];
            return (
              <button
                key={activity.id}
                type="button"
                className="tag-search-result-item"
                style={{ borderLeftColor: color.border, background: color.bg }}
                onClick={() => onEditActivity?.(activity)}
              >
                <span className="tag-search-result-time">
                  {formatTime(start)} – {formatTime(end)}
                </span>
                <span className="tag-search-result-title">{activity.summary || "(ไม่มีชื่อ)"}</span>
                {tags.length > 0 && (
                  <span className="activity-tag-row">
                    {tags.map((tag) => (
                      <span key={tag} className="activity-tag-chip">#{tag}</span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

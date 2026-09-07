import React, { useState } from "react";

// Activity Mode redesign — "Focus + Rail"
// One day gets full focus (large detail card with hourly timeline), the other
// 6 days collapse into a thin horizontal rail above it for quick switching.
// Optimized for mobile / narrow screens and working within a single day
// rather than scanning the whole week at once.

const DAY_START = 6;
const DAY_END = 24;
const DAY_SPAN = DAY_END - DAY_START;

const CATEGORY_STYLES = {
  work: { fill: "#378ADD", label: "งาน" },
  fitness: { fill: "#639922", label: "ออกกำลังกาย" },
  personal: { fill: "#534AB7", label: "ส่วนตัว" },
};

const DAYS = [
  {
    label: "จ",
    full: "จันทร์",
    date: "18",
    items: [
      { name: "ประชุมทีม", cat: "work", start: 9, end: 10.5 },
      { name: "เขียนโค้ด", cat: "work", start: 11, end: 13.5 },
      { name: "วิ่ง", cat: "fitness", start: 18, end: 19 },
    ],
  },
  {
    label: "อ",
    full: "อังคาร",
    date: "19",
    items: [
      { name: "ทำงานลึก", cat: "work", start: 9, end: 12 },
      { name: "โยคะ", cat: "fitness", start: 7, end: 7.75 },
    ],
  },
  {
    label: "พ",
    full: "พุธ",
    date: "20",
    items: [
      { name: "ประชุมลูกค้า", cat: "work", start: 14, end: 15 },
      { name: "อ่านหนังสือ", cat: "personal", start: 21, end: 22.5 },
    ],
  },
  {
    label: "พฤ",
    full: "พฤหัสบดี",
    date: "21",
    items: [
      { name: "ประชุมทีม", cat: "work", start: 9, end: 10 },
      { name: "ยิม", cat: "fitness", start: 17.5, end: 19 },
      { name: "ทานข้าวเพื่อน", cat: "personal", start: 19.5, end: 21 },
    ],
  },
  {
    label: "ศ",
    full: "ศุกร์",
    date: "22",
    items: [
      { name: "ทำงานลึก", cat: "work", start: 9, end: 11.5 },
      { name: "รีวิวงาน", cat: "work", start: 13, end: 14 },
    ],
  },
  {
    label: "ส",
    full: "เสาร์",
    date: "23",
    items: [{ name: "เดินป่า", cat: "fitness", start: 8, end: 11.5 }],
  },
  {
    label: "อา",
    full: "อาทิตย์",
    date: "24",
    items: [],
  },
];

function formatTime(t) {
  const hh = Math.floor(t);
  const mm = Math.round((t - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToPct(t) {
  return Math.min(100, Math.max(0, ((t - DAY_START) / DAY_SPAN) * 100));
}

export default function ActivityModeFocusRail() {
  const [selected, setSelected] = useState(0);
  const day = DAYS[selected];
  const sortedItems = [...day.items].sort((a, b) => a.start - b.start);
  const hourMarks = [6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="max-w-md mx-auto p-5 bg-white rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">Activity Mode</div>
        <button
          className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition"
          onClick={() => {}}
        >
          <span className="text-base leading-none">+</span>
          เพิ่ม
        </button>
      </div>

      {/* rail — thin strip of all 7 days */}
      <div className="flex gap-1 mb-4">
        {DAYS.map((d, i) => {
          const isSelected = i === selected;
          const count = d.items.length;
          return (
            <button
              key={d.date}
              onClick={() => setSelected(i)}
              className="flex-1 flex flex-col items-center py-2 rounded-lg transition"
              style={{
                background: isSelected ? "#378ADD" : "#F7F7F5",
              }}
            >
              <span
                className="text-[11px]"
                style={{ color: isSelected ? "#E6F1FB" : "#9CA3AF" }}
              >
                {d.label}
              </span>
              <span
                className="text-sm font-medium mt-0.5"
                style={{ color: isSelected ? "#FFFFFF" : "#111827" }}
              >
                {d.date}
              </span>
              <span
                className="mt-1 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: count > 0 ? (isSelected ? "#FFFFFF" : "#378ADD") : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* focus card for selected day */}
      <div className="bg-gray-50 rounded-2xl p-4">
        <div className="text-base font-medium text-gray-900 mb-3">
          วัน{day.full} ที่ {day.date} ส.ค.
        </div>

        {/* hourly timeline */}
        <div className="relative mb-4" style={{ height: 6 }}>
          <div className="absolute inset-0 rounded-full bg-gray-200" />
          {day.items.map((it, idx) => (
            <div
              key={idx}
              className="absolute top-0 h-full rounded-full"
              style={{
                left: `${timeToPct(it.start)}%`,
                width: `${Math.max(1.5, timeToPct(it.end) - timeToPct(it.start))}%`,
                background: CATEGORY_STYLES[it.cat].fill,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mb-4">
          {hourMarks.map((h) => (
            <span key={h} className="text-[10px] text-gray-400">
              {h}
            </span>
          ))}
        </div>

        {/* agenda list */}
        {sortedItems.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">
            ไม่มีกิจกรรมในวันนี้ — แตะ "เพิ่ม" เพื่อสร้างกิจกรรมแรก
          </div>
        ) : (
          <div className="flex flex-col">
            {sortedItems.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 py-2.5 border-t border-gray-200 first:border-t-0"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: CATEGORY_STYLES[it.cat].fill }}
                />
                <span className="text-sm flex-1 text-gray-900">{it.name}</span>
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(it.start)} - {formatTime(it.end)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* legend */}
      <div className="flex gap-4 flex-wrap mt-3 justify-center">
        {Object.entries(CATEGORY_STYLES).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: val.fill }}
            />
            {val.label}
          </span>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useRef } from "react";

// Activity Mode redesign — "Week Spine" (interactive)
// Priority features included (v1 / MVP per prioritization discussion):
//   1. Drag on empty space to create an activity
//   2. Drag a block to move it / drag its bottom edge to resize
//   3. Week navigation (prev/next)
// Deliberately left out for v2: overlap layout, reminder badges,
// weekly/category summary, category filter.

const DAY_START = 6;
const DAY_END = 24;
const SPAN = DAY_END - DAY_START;
const SPINE_HEIGHT = 312;
const HOUR_MARKS = [6, 10, 14, 18, 22];

const CATEGORY_STYLES = {
  work: { fill: "#378ADD", label: "งาน" },
  fitness: { fill: "#639922", label: "ออกกำลังกาย" },
  personal: { fill: "#534AB7", label: "ส่วนตัว" },
};

const WEEKS = [
  {
    label: "18 - 24 ส.ค.",
    days: [
      { label: "จ", date: "18", items: [
        { id: 1, name: "ประชุมทีม", cat: "work", start: 9, end: 10.5 },
        { id: 2, name: "เขียนโค้ด", cat: "work", start: 11, end: 13.5 },
        { id: 3, name: "วิ่ง", cat: "fitness", start: 18, end: 19 },
      ]},
      { label: "อ", date: "19", items: [
        { id: 4, name: "ทำงานลึก", cat: "work", start: 9, end: 12 },
        { id: 5, name: "โยคะ", cat: "fitness", start: 7, end: 7.75 },
      ]},
      { label: "พ", date: "20", items: [
        { id: 6, name: "ประชุมลูกค้า", cat: "work", start: 14, end: 15 },
        { id: 7, name: "อ่านหนังสือ", cat: "personal", start: 21, end: 22.5 },
      ]},
      { label: "พฤ", date: "21", items: [
        { id: 8, name: "ประชุมทีม", cat: "work", start: 9, end: 10 },
        { id: 9, name: "ยิม", cat: "fitness", start: 17.5, end: 19 },
        { id: 10, name: "ทานข้าวเพื่อน", cat: "personal", start: 19.5, end: 21 },
      ]},
      { label: "ศ", date: "22", items: [
        { id: 11, name: "ทำงานลึก", cat: "work", start: 9, end: 11.5 },
        { id: 12, name: "รีวิวงาน", cat: "work", start: 13, end: 14 },
      ]},
      { label: "ส", date: "23", items: [
        { id: 13, name: "เดินป่า", cat: "fitness", start: 8, end: 11.5 },
      ]},
      { label: "อา", date: "24", items: [
        { id: 14, name: "เตรียมสัปดาห์หน้า", cat: "personal", start: 16, end: 17.5 },
      ]},
    ],
  },
  {
    label: "25 - 31 ส.ค.",
    days: [
      { label: "จ", date: "25", items: [
        { id: 15, name: "ทบทวนสัปดาห์", cat: "work", start: 9, end: 10 },
      ]},
      { label: "อ", date: "26", items: [] },
      { label: "พ", date: "27", items: [
        { id: 16, name: "วิ่ง", cat: "fitness", start: 6.5, end: 7.25 },
      ]},
      { label: "พฤ", date: "28", items: [] },
      { label: "ศ", date: "29", items: [
        { id: 17, name: "ประชุมทีม", cat: "work", start: 10, end: 11 },
      ]},
      { label: "ส", date: "30", items: [] },
      { label: "อา", date: "31", items: [] },
    ],
  },
];

let nextId = 100;

function timeToY(t) {
  return Math.max(0, ((t - DAY_START) / SPAN) * SPINE_HEIGHT);
}
function yToTime(y) {
  const t = DAY_START + (y / SPINE_HEIGHT) * SPAN;
  return Math.round(t * 4) / 4; // snap to 15 min
}
function formatTime(t) {
  const hh = Math.floor(t);
  const mm = Math.round((t - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function ActivityModeWeekSpineInteractive() {
  const [weekIdx, setWeekIdx] = useState(0);
  const [weeks, setWeeks] = useState(WEEKS);
  const [selected, setSelected] = useState(0);
  const [drag, setDrag] = useState(null); // { mode, dayIndex, ... }
  const spineRefs = useRef([]);

  const days = weeks[weekIdx].days;
  const day = days[selected];
  const sortedItems = [...day.items].sort((a, b) => a.start - b.start);

  function updateDayItems(dayIndex, updater) {
    setWeeks((prev) => {
      const next = prev.map((w) => ({ ...w, days: w.days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i })) })) }));
      next[weekIdx].days[dayIndex].items = updater(next[weekIdx].days[dayIndex].items);
      return next;
    });
  }

  function handleSpineMouseDown(e, dayIndex) {
    if (e.target.dataset.role) return; // handled by block/handle listeners
    const rect = spineRefs.current[dayIndex].getBoundingClientRect();
    const startT = yToTime(e.clientY - rect.top);
    setDrag({ mode: "create", dayIndex, startT, endT: startT + 0.25 });
  }

  function handleBlockMouseDown(e, dayIndex, item) {
    e.stopPropagation();
    const rect = spineRefs.current[dayIndex].getBoundingClientRect();
    setDrag({
      mode: "move",
      dayIndex,
      id: item.id,
      offsetY: e.clientY - rect.top - timeToY(item.start),
      duration: item.end - item.start,
    });
  }

  function handleResizeMouseDown(e, dayIndex, item) {
    e.stopPropagation();
    setDrag({ mode: "resize", dayIndex, id: item.id });
  }

  function handleMouseMove(e) {
    if (!drag) return;
    const rect = spineRefs.current[drag.dayIndex].getBoundingClientRect();

    if (drag.mode === "move") {
      let newStart = yToTime(e.clientY - rect.top - drag.offsetY);
      newStart = Math.max(DAY_START, Math.min(DAY_END - drag.duration, newStart));
      updateDayItems(drag.dayIndex, (items) =>
        items.map((it) =>
          it.id === drag.id ? { ...it, start: newStart, end: newStart + drag.duration } : it
        )
      );
    } else if (drag.mode === "resize") {
      updateDayItems(drag.dayIndex, (items) =>
        items.map((it) => {
          if (it.id !== drag.id) return it;
          const newEnd = Math.max(it.start + 0.25, Math.min(DAY_END, yToTime(e.clientY - rect.top)));
          return { ...it, end: newEnd };
        })
      );
    } else if (drag.mode === "create") {
      const endT = Math.max(drag.startT + 0.25, yToTime(e.clientY - rect.top));
      setDrag((d) => ({ ...d, endT }));
    }
  }

  function handleMouseUp() {
    if (drag && drag.mode === "create" && Math.abs(drag.endT - drag.startT) >= 0.25) {
      const start = Math.min(drag.startT, drag.endT);
      const end = Math.max(drag.startT, drag.endT);
      updateDayItems(drag.dayIndex, (items) => [
        ...items,
        { id: nextId++, name: "กิจกรรมใหม่", cat: "work", start, end },
      ]);
      setSelected(drag.dayIndex);
    }
    setDrag(null);
  }

  return (
    <div
      className="max-w-3xl mx-auto p-6 bg-white rounded-2xl select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30"
            onClick={() => { setWeekIdx((w) => Math.max(0, w - 1)); setSelected(0); }}
            disabled={weekIdx === 0}
          >
            ‹
          </button>
          <div>
            <div className="text-base font-medium text-gray-900">{weeks[weekIdx].label}</div>
            <div className="text-sm text-gray-500">Activity Mode</div>
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30"
            onClick={() => { setWeekIdx((w) => Math.min(weeks.length - 1, w + 1)); setSelected(0); }}
            disabled={weekIdx === weeks.length - 1}
          >
            ›
          </button>
        </div>
        <div className="text-xs text-gray-400 text-right">
          ลากพื้นที่ว่างเพื่อสร้าง
          <br />
          ลากบล็อกเพื่อย้าย/ปรับเวลา
        </div>
      </div>

      <div className="flex gap-1.5">
        {/* hour axis */}
        <div className="w-9 flex-shrink-0 relative" style={{ height: SPINE_HEIGHT }}>
          {HOUR_MARKS.map((h) => (
            <div key={h} className="absolute text-[11px] text-gray-400" style={{ top: timeToY(h) - 6 }}>
              {h}:00
            </div>
          ))}
        </div>

        {/* week spine */}
        <div className="flex-1 grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const isSelected = i === selected;
            const isDragCreateHere = drag && drag.mode === "create" && drag.dayIndex === i;
            return (
              <div key={d.date} className="flex flex-col items-center">
                <div className="text-[11px] text-gray-500 mb-0.5">{d.label}</div>
                <div className={"text-sm font-medium mb-1.5 " + (isSelected ? "text-blue-600" : "text-gray-900")}>
                  {d.date}
                </div>
                <div
                  ref={(el) => (spineRefs.current[i] = el)}
                  className="relative w-full rounded-md bg-gray-50 cursor-crosshair"
                  style={{
                    height: SPINE_HEIGHT,
                    border: isSelected ? "2px solid #378ADD" : "0.5px solid #E5E7EB",
                  }}
                  onMouseDown={(e) => { handleSpineMouseDown(e, i); setSelected(i); }}
                >
                  {d.items.map((it) => {
                    const top = timeToY(it.start);
                    const height = Math.max(6, timeToY(it.end) - timeToY(it.start));
                    return (
                      <div
                        key={it.id}
                        data-role="block"
                        className="absolute left-[3px] right-[3px] rounded cursor-grab active:cursor-grabbing overflow-hidden"
                        style={{ top, height, background: CATEGORY_STYLES[it.cat].fill }}
                        onMouseDown={(e) => handleBlockMouseDown(e, i, it)}
                      >
                        {height > 16 && (
                          <div className="text-[10px] text-white px-1 pt-0.5 truncate pointer-events-none">
                            {it.name}
                          </div>
                        )}
                        <div
                          data-role="handle"
                          className="absolute left-0 right-0 bottom-0 h-1.5 cursor-ns-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, i, it)}
                        />
                      </div>
                    );
                  })}

                  {isDragCreateHere && (
                    <div
                      className="absolute left-[3px] right-[3px] rounded border-2 border-dashed border-blue-400 pointer-events-none"
                      style={{
                        top: timeToY(Math.min(drag.startT, drag.endT)),
                        height: Math.max(4, Math.abs(timeToY(drag.endT) - timeToY(drag.startT))),
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* legend */}
      <div className="flex gap-4 flex-wrap mt-3">
        {Object.entries(CATEGORY_STYLES).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: val.fill }} />
            {val.label}
          </span>
        ))}
      </div>

      {/* detail panel */}
      <div className="mt-4 bg-gray-50 rounded-xl px-5 py-4">
        <div className="text-sm font-medium mb-1">
          วัน{day.label} ที่ {day.date}
        </div>
        {sortedItems.length === 0 ? (
          <div className="py-3 text-sm text-gray-400">ไม่มีกิจกรรมในวันนี้ — ลากพื้นที่ว่างในสไปน์เพื่อสร้าง</div>
        ) : (
          sortedItems.map((it) => (
            <div key={it.id} className="flex items-center gap-2.5 py-2 border-t border-gray-200 first:border-t-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_STYLES[it.cat].fill }} />
              <span className="text-sm flex-1">{it.name}</span>
              <span className="text-xs text-gray-400 font-mono">
                {formatTime(it.start)} - {formatTime(it.end)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

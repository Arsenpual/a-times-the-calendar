import React, { useState } from 'react';

const EVENTS = [
  { id: 1, title: 'ประชุมทีม', start: '09:00', end: '10:00', color: '#5B5FEF' },
  { id: 2, title: 'เขียนรายงาน', start: '09:30', end: '11:00', color: '#E8952E' },
  { id: 3, title: 'พักเบรก', start: '11:30', end: '11:45', color: '#9AA3AF' },
  { id: 4, title: 'รีวิวงาน', start: '13:00', end: '13:30', color: '#1E9E7C' },
  { id: 7, title: 'นัดหมายทันตแพทย์', start: '13:10', end: '13:50', color: '#C9469E' },
  { id: 5, title: 'โทรหาลูกค้า', start: '13:15', end: '13:45', color: '#D6455C' },
  { id: 6, title: 'ส่งอีเมลสรุป', start: '13:20', end: '13:40', color: '#7C5CD6' },
  { id: 8, title: 'ประชุมทบทวนบ่าย', start: '16:00', end: '17:00', color: '#2E8FC0' },
];

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Sweep-line grouping: chains of overlapping events (A~B, B~C) end up
// in the same cluster even if A and C don't touch directly.
function groupOverlapping(events) {
  const sorted = [...events].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const groups = [];
  let current = [];
  let currentMaxEnd = -Infinity;

  for (const ev of sorted) {
    const startMin = toMinutes(ev.start);
    const endMin = toMinutes(ev.end);
    if (current.length === 0 || startMin < currentMaxEnd) {
      current.push(ev);
      currentMaxEnd = Math.max(currentMaxEnd, endMin);
    } else {
      groups.push(current);
      current = [ev];
      currentMaxEnd = endMin;
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function Bracket() {
  return (
    <svg viewBox="0 0 20 100" preserveAspectRatio="none" className="w-4 h-full">
      <path
        d="M 16 3 C 8 3 8 12 8 25 C 8 38 2 40 2 50 C 2 60 8 62 8 75 C 8 88 8 97 16 97"
        fill="none"
        stroke="#C7CBD4"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EventRow({ ev, isFocused, isDimmed, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-stretch gap-2.5 py-2 px-2.5 rounded-lg transition-all duration-200 ${
        isFocused ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-black/[0.03]'
      } ${isDimmed ? 'opacity-35' : 'opacity-100'}`}
    >
      <span className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-slate-800 truncate">{ev.title}</span>
        <span className="block text-[11px] text-slate-400 mt-0.5 tabular-nums">
          {ev.start}–{ev.end}
        </span>
      </span>
    </button>
  );
}

export default function MiniTimelinePanel() {
  const [focusedId, setFocusedId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  const groups = groupOverlapping(EVENTS);

  const toggleExpand = (idx) => setExpandedGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const handleFocus = (id) => setFocusedId((prev) => (prev === id ? null : id));

  return (
    <div className="w-full max-w-[360px] mx-auto bg-[#FAFAF8] rounded-2xl border border-slate-200/70 p-4">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-[15px] font-semibold text-slate-900">วันนี้</h2>
        <span className="text-[12px] text-slate-400">9 กันยายน</span>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((group, idx) => {
          const isCluster = group.length > 1;
          const expanded = expandedGroups[idx];
          const visible = isCluster && !expanded ? group.slice(0, 3) : group;
          const hidden = isCluster && !expanded ? group.length - 3 : 0;
          const groupHasFocused = group.some((e) => e.id === focusedId);

          return (
            <div key={idx} className="flex gap-2">
              {isCluster ? (
                <div className="relative flex-shrink-0 w-4">
                  <Bracket />
                  <span
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                      flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium
                      whitespace-nowrap border transition-colors ${
                        groupHasFocused
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-[#FAFAF8] text-slate-500 border-slate-300'
                      }`}
                  >
                    <span aria-hidden>⧉</span>
                    {group.length}
                  </span>
                </div>
              ) : (
                <div className="w-4 flex-shrink-0" />
              )}

              <div className="flex-1 flex flex-col gap-1">
                {visible.map((ev) => (
                  <EventRow
                    key={ev.id}
                    ev={ev}
                    isFocused={focusedId === ev.id}
                    isDimmed={focusedId !== null && focusedId !== ev.id}
                    onClick={() => handleFocus(ev.id)}
                  />
                ))}
                {hidden > 0 && (
                  <button
                    onClick={() => toggleExpand(idx)}
                    className={`text-left px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-600 transition-opacity ${
                      focusedId !== null ? 'opacity-35' : ''
                    }`}
                  >
                    +{hidden} เพิ่มเติม
                  </button>
                )}
                {isCluster && expanded && (
                  <button
                    onClick={() => toggleExpand(idx)}
                    className={`text-left px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-600 transition-opacity ${
                      focusedId !== null ? 'opacity-35' : ''
                    }`}
                  >
                    ย่อกลับ
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

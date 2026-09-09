import React, { useState } from 'react';

// Concept E — Proportional Day Column.
// Rather than a flat list (A/B/C/D all kept row order = read order, not
// real time proportion), this concept draws a real vertical time axis.
// Overlapping activities split into side-by-side sub-columns sized by
// how many things collide *at that exact point*, and each box's height
// is proportional to its real duration. This is the same visual grammar
// as a calendar day view people already know, just narrow enough for a
// mini panel — so "which things collide, and by how much" reads
// instantly from shape alone, without doing the arithmetic on the time
// labels.
//
// No external packages, no Tailwind. All CSS is embedded below with the
// `daycol-mockup__` prefix. This file does not touch app.jsx.

const SPILLOVER_EVENTS = [
  { id: 0, title: 'สรุปเอกสารประชุม', start: '23:00', end: '01:30', color: '#5B5FEF' },
];

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

const AXIS_START = 9 * 60; // 09:00
const AXIS_END = 17 * 60; // 17:00
const PX_PER_MIN = 0.85;
const AXIS_PAD_TOP = 12;
const MAX_LANES_SHOWN = 3;

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function axisTop(min) {
  return (min - AXIS_START) * PX_PER_MIN + AXIS_PAD_TOP;
}

function boxHeight(startMin, endMin) {
  return Math.max((endMin - startMin) * PX_PER_MIN, 30);
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

// Greedy lane assignment (same idea Google Calendar's day view uses):
// walk events by start time, place each in the first lane whose previous
// occupant has already ended, otherwise open a new lane.
function assignLanes(group) {
  const sorted = [...group].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const laneEnds = [];
  const laneOf = {};
  sorted.forEach((ev) => {
    const start = toMinutes(ev.start);
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(toMinutes(ev.end));
    } else {
      laneEnds[lane] = toMinutes(ev.end);
    }
    laneOf[ev.id] = lane;
  });
  return { laneOf, laneCount: laneEnds.length };
}

export default function ActivityModeProportionalColumnMockup() {
  const [focusedId, setFocusedId] = useState(null);
  const [openFootnotes, setOpenFootnotes] = useState({});
  const [justExported, setJustExported] = useState(false);

  const groups = groupOverlapping(EVENTS);

  const blocks = [];
  const badges = [];
  const footnotes = [];

  groups.forEach((group, groupIdx) => {
    const { laneOf, laneCount } = assignLanes(group);
    const columnsShown = Math.min(laneCount, MAX_LANES_SHOWN);
    const groupStart = Math.min(...group.map((e) => toMinutes(e.start)));
    const groupEnd = Math.max(...group.map((e) => toMinutes(e.end)));

    group.forEach((ev) => {
      const lane = laneOf[ev.id];
      if (lane < columnsShown) {
        blocks.push({
          ev,
          groupIdx,
          top: axisTop(toMinutes(ev.start)),
          height: boxHeight(toMinutes(ev.start), toMinutes(ev.end)),
          leftPct: (lane / columnsShown) * 100,
          widthPct: (1 / columnsShown) * 100,
        });
      }
    });

    if (group.length > 1) {
      badges.push({ groupIdx, top: axisTop(groupStart) - 9, count: group.length });
    }

    if (laneCount > MAX_LANES_SHOWN) {
      const hidden = group.filter((e) => laneOf[e.id] >= columnsShown);
      footnotes.push({
        groupIdx,
        timeLabel: `${minutesToLabel(groupStart)}–${minutesToLabel(groupEnd)}`,
        hidden,
      });
    }
  });

  const hourLines = [];
  for (let h = AXIS_START / 60; h <= AXIS_END / 60; h++) {
    hourLines.push({ h, top: axisTop(h * 60) });
  }

  const axisPxHeight = axisTop(AXIS_END) + 6;

  const toggleFootnote = (idx) =>
    setOpenFootnotes((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const handleFocus = (id) => setFocusedId((prev) => (prev === id ? null : id));
  const handleExport = () => {
    setJustExported(true);
    setTimeout(() => setJustExported(false), 1600);
  };

  return (
    <div className="daycol-mockup__panel">
      <div className="daycol-mockup__header">
        <div className="daycol-mockup__header-left">
          <h2 className="daycol-mockup__title">วันนี้</h2>
          <span className="daycol-mockup__date">9 กันยายน</span>
        </div>
        <div className="daycol-mockup__export-wrap">
          <button onClick={handleExport} title="บันทึกภาพวันนี้เป็น PNG" className="daycol-mockup__export-btn">
            <span>📷</span>
          </button>
          {justExported && (
            <span className="daycol-mockup__export-toast">
              <span>✓</span> บันทึกภาพแล้ว
            </span>
          )}
        </div>
      </div>

      {SPILLOVER_EVENTS.length > 0 && (
        <div className="daycol-mockup__spillover-section">
          {SPILLOVER_EVENTS.map((ev) => (
            <button
              key={ev.id}
              onClick={() => handleFocus(ev.id)}
              className={`daycol-mockup__spillover-row ${
                focusedId !== null && focusedId !== ev.id ? 'is-dimmed' : ''
              } ${focusedId === ev.id ? 'is-focused' : ''}`}
            >
              <span className="daycol-mockup__spillover-bar" style={{ backgroundColor: ev.color }} />
              <span className="daycol-mockup__spillover-text">
                <span className="daycol-mockup__moon">🌙</span>
                <span className="daycol-mockup__spillover-title">{ev.title}</span>
                <span className="daycol-mockup__spillover-time">เมื่อคืน {ev.start} → {ev.end}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="daycol-mockup__axis-row">
        <div className="daycol-mockup__gutter" style={{ height: axisPxHeight }}>
          {hourLines.map(({ h, top }) => (
            <span key={h} className="daycol-mockup__hour-label" style={{ top: top - 6 }}>
              {h}:00
            </span>
          ))}
        </div>

        <div className="daycol-mockup__axis" style={{ height: axisPxHeight }}>
          {hourLines.map(({ h, top }) => (
            <span key={h} className="daycol-mockup__hour-line" style={{ top }} />
          ))}

          {blocks.map(({ ev, groupIdx, top, height, leftPct, widthPct }) => {
            const isFocused = focusedId === ev.id;
            const isDimmed = focusedId !== null && focusedId !== ev.id;
            return (
              <button
                key={ev.id}
                onClick={() => handleFocus(ev.id)}
                className={`daycol-mockup__block ${isFocused ? 'is-focused' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                style={{
                  top,
                  height,
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                  borderLeftColor: ev.color,
                  zIndex: isFocused ? 5 : 1,
                }}
              >
                <span className="daycol-mockup__block-title">{ev.title}</span>
                {height >= 44 && (
                  <span className="daycol-mockup__block-time">{ev.start}–{ev.end}</span>
                )}
              </button>
            );
          })}

          {badges.map(({ groupIdx, top, count }) => (
            <span key={groupIdx} className="daycol-mockup__badge" style={{ top }}>
              <span aria-hidden>⧉</span> {count}
            </span>
          ))}
        </div>
      </div>

      {footnotes.length > 0 && (
        <div className="daycol-mockup__footnotes">
          {footnotes.map(({ groupIdx, timeLabel, hidden }) => (
            <div key={groupIdx} className="daycol-mockup__footnote">
              <button
                onClick={() => toggleFootnote(groupIdx)}
                className="daycol-mockup__footnote-toggle"
              >
                {timeLabel} · ซ้อนเกิน 3 · แสดงอีก {hidden.length} รายการ {openFootnotes[groupIdx] ? '▲' : '▼'}
              </button>
              {openFootnotes[groupIdx] && (
                <ul className="daycol-mockup__footnote-list">
                  {hidden.map((ev) => (
                    <li key={ev.id}>
                      <span className="daycol-mockup__footnote-dot" style={{ backgroundColor: ev.color }} />
                      {ev.title} · {ev.start}–{ev.end}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="daycol-mockup__caption">
        ความกว้างของกล่อง = จำนวนงานที่ชนกัน ณ ช่วงเวลานั้น ยิ่งแคบยิ่งชนเยอะ
      </p>

      <style>{`
        .daycol-mockup__panel {
          width: 100%;
          max-width: 340px;
          margin: 0 auto;
          background: #FAFAF8;
          border-radius: 16px;
          border: 1px solid rgba(203, 213, 225, 0.7);
          padding: 16px;
          box-sizing: border-box;
          font-family: inherit;
        }
        .daycol-mockup__header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px; padding: 0 2px;
        }
        .daycol-mockup__header-left { display: flex; align-items: baseline; gap: 8px; }
        .daycol-mockup__title { font-size: 15px; font-weight: 600; color: #0f172a; margin: 0; }
        .daycol-mockup__date { font-size: 12px; color: #94a3b8; }
        .daycol-mockup__export-wrap { position: relative; }
        .daycol-mockup__export-btn {
          width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
          border-radius: 999px; border: none; background: transparent; color: #94a3b8;
          cursor: pointer; transition: background .2s; font-size: 12px; padding: 0;
        }
        .daycol-mockup__export-btn:hover { background: rgba(0,0,0,0.04); }
        .daycol-mockup__export-toast {
          position: absolute; right: 0; top: 30px; display: flex; align-items: center; gap: 4px;
          font-size: 11px; color: #059669; background: #fff; border: 1px solid #a7f3d0;
          border-radius: 6px; padding: 4px 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          white-space: nowrap; z-index: 10;
        }
        .daycol-mockup__spillover-section {
          display: flex; flex-direction: column; gap: 2px;
          margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0;
        }
        .daycol-mockup__spillover-row {
          display: flex; align-items: stretch; gap: 8px; text-align: left; width: 100%;
          border: none; background: transparent; border-radius: 8px; padding: 6px 8px;
          cursor: pointer; transition: background .2s, opacity .2s; opacity: 0.6; font-family: inherit;
        }
        .daycol-mockup__spillover-row:hover:not(.is-focused) { background: rgba(0,0,0,0.03); }
        .daycol-mockup__spillover-row.is-focused { opacity: 1; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .daycol-mockup__spillover-row.is-dimmed { opacity: 0.25; }
        .daycol-mockup__spillover-bar { width: 4px; border-radius: 999px; flex-shrink: 0; }
        .daycol-mockup__spillover-text { display: flex; flex-direction: column; gap: 2px; }
        .daycol-mockup__moon { font-size: 10px; margin-right: 4px; }
        .daycol-mockup__spillover-title { font-size: 13px; font-style: italic; color: #64748b; }
        .daycol-mockup__spillover-time { font-size: 11px; color: #94a3b8; }
        .daycol-mockup__axis-row { display: flex; gap: 6px; }
        .daycol-mockup__gutter { position: relative; width: 32px; flex-shrink: 0; }
        .daycol-mockup__hour-label {
          position: absolute; right: 4px; font-size: 10px; color: #b0b8c4; line-height: 12px;
        }
        .daycol-mockup__axis {
          position: relative; flex: 1; border-left: 1px solid #e2e8f0; min-width: 0;
        }
        .daycol-mockup__hour-line {
          position: absolute; left: 0; right: 0; height: 1px; background: #eef1f5;
        }
        .daycol-mockup__block {
          position: absolute; border: none; border-left: 3px solid; border-radius: 6px;
          background: #eef0f3; text-align: left; padding: 4px 6px; cursor: pointer;
          display: flex; flex-direction: column; justify-content: center; overflow: hidden;
          transition: background .2s, opacity .2s, box-shadow .2s; font-family: inherit;
        }
        .daycol-mockup__block:hover:not(.is-focused) { background: #e4e7eb; }
        .daycol-mockup__block.is-focused { background: #fff; box-shadow: 0 2px 6px rgba(15,23,42,0.12); }
        .daycol-mockup__block.is-dimmed { opacity: 0.3; }
        .daycol-mockup__block-title {
          font-size: 11px; font-weight: 500; color: #1e293b; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .daycol-mockup__block-time { font-size: 9px; color: #94a3b8; margin-top: 1px; }
        .daycol-mockup__badge {
          position: absolute; left: 2px; display: inline-flex; align-items: center; gap: 2px;
          font-size: 9px; font-weight: 500; color: #475569; background: #FAFAF8;
          border: 1px solid #cbd5e1; border-radius: 999px; padding: 1px 5px; z-index: 6;
        }
        .daycol-mockup__footnotes { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
        .daycol-mockup__footnote-toggle {
          width: 100%; text-align: left; font-size: 11px; color: #94a3b8; background: transparent;
          border: none; cursor: pointer; padding: 4px 2px; font-family: inherit;
        }
        .daycol-mockup__footnote-toggle:hover { color: #475569; }
        .daycol-mockup__footnote-list { list-style: none; margin: 0 0 4px; padding: 0 0 0 10px; display: flex; flex-direction: column; gap: 4px; }
        .daycol-mockup__footnote-list li { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #475569; }
        .daycol-mockup__footnote-dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
        .daycol-mockup__caption { margin: 12px 2px 0; font-size: 10px; color: #b0b8c4; }
      `}</style>
    </div>
  );
}

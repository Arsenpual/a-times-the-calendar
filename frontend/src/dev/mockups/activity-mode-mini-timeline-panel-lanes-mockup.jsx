import { useState } from "react";

// ── sample data (mirrors the scenario in the request) ──────────────
const EVENTS = [
  { id: "e1", title: "ประชุมทีม", start: "09:00", end: "10:00", category: "work" },
  { id: "e2", title: "เขียนรายงานประจำเดือน", start: "09:30", end: "11:00", category: "work" },
  { id: "e3", title: "โทรหาลูกค้า", start: "09:45", end: "10:15", category: "work" },
  { id: "e6", title: "ทานข้าวเที่ยง", start: "12:00", end: "13:00", category: "personal" },
  { id: "e4", title: "ซ้อมเสนองาน", start: "13:00", end: "14:00", category: "work" },
  { id: "e5", title: "เรียนภาษาญี่ปุ่น", start: "13:30", end: "15:00", category: "learn" },
  { id: "e7", title: "ออกกำลังกาย", start: "18:00", end: "19:00", category: "health" },
  { id: "e8", title: "ดูหนังกับเพื่อน", start: "19:30", end: "21:30", category: "personal" },
  { id: "e9", title: "โทรประชุมข้ามทีม", start: "20:00", end: "21:00", category: "work" },
  { id: "e10", title: "รีวิวโค้ด", start: "20:15", end: "21:15", category: "work" },
  { id: "e11", title: "ตอบอีเมลด่วน", start: "20:30", end: "21:00", category: "work" },
];

const CATEGORY_COLOR = {
  work: "#3a5a7a",
  personal: "#b4632a",
  learn: "#3f7d5c",
  health: "#8a4a9e",
};

const DAY_START = 8 * 60; // 08:00
const DAY_END = 22 * 60; // 22:00
const PX_PER_MIN = 0.9;

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Group events into connected-overlap clusters, then greedily assign lanes
// (cap 3 visible lanes; extras become an overflow count on the cluster).
function layout(events) {
  const sorted = [...events].sort((a, b) => toMin(a.start) - toMin(b.start));
  const clusters = [];
  let current = null;

  for (const ev of sorted) {
    const s = toMin(ev.start);
    const e = toMin(ev.end);
    if (current && s < current.end) {
      current.items.push(ev);
      current.end = Math.max(current.end, e);
    } else {
      current = { start: s, end: e, items: [ev] };
      clusters.push(current);
    }
  }

  return clusters.map((cluster) => {
    const laneEnds = [0, 0, 0];
    const placed = [];
    let overflow = 0;
    for (const ev of cluster.items) {
      const s = toMin(ev.start);
      const e = toMin(ev.end);
      const laneIdx = laneEnds.findIndex((end) => end <= s);
      if (laneIdx === -1) {
        overflow += 1;
        continue;
      }
      laneEnds[laneIdx] = e;
      placed.push({ ...ev, lane: laneIdx });
    }
    const laneCount = Math.max(1, ...placed.map((p) => p.lane + 1));
    return { ...cluster, items: placed, laneCount, overflow };
  });
}

export default function ActivityModeLanesMockup() {
  const [activeId, setActiveId] = useState(null);
  const clusters = layout(EVENTS);
  const totalMin = DAY_END - DAY_START;
  const hours = [];
  for (let h = 8; h <= 22; h += 2) hours.push(h);

  return (
    <div className="lanes-mockup">
      <style>{`
        .lanes-mockup {
          font-family: "IBM Plex Sans Thai", "Noto Sans Thai", system-ui, sans-serif;
          background: #fbfaf7;
          color: #1e2126;
          padding: 20px 16px 28px;
          width: 420px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 32px);
          overflow: auto;
          border-radius: 10px;
          border: 1px solid #e3e0d8;
          box-shadow: 0 12px 32px rgba(0,0,0,0.18);
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 9999;
        }
        .lanes-mockup__header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 14px;
        }
        .lanes-mockup__title {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .lanes-mockup__subtitle {
          font-size: 11.5px;
          color: #8a8578;
        }
        .lanes-mockup__body {
          position: relative;
          margin-left: 42px;
        }
        .lanes-mockup__hourline {
          position: absolute;
          left: -42px;
          right: 0;
          border-top: 1px solid #eae7de;
        }
        .lanes-mockup__hourlabel {
          position: absolute;
          left: -42px;
          top: -7px;
          font-size: 10.5px;
          color: #a39d8c;
          width: 34px;
          text-align: right;
        }
        .lanes-mockup__cluster {
          position: absolute;
          left: 0;
          right: 0;
          display: flex;
          gap: 3px;
        }
        .lanes-mockup__lane {
          flex: 1;
          position: relative;
        }
        .lanes-mockup__block {
          position: absolute;
          left: 0;
          right: 0;
          border-radius: 6px;
          padding: 4px 7px;
          color: #fff;
          font-size: 11px;
          line-height: 1.35;
          overflow: hidden;
          cursor: pointer;
          box-sizing: border-box;
          border: 1.5px solid rgba(255,255,255,0.25);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .lanes-mockup__block:hover,
        .lanes-mockup__block--active {
          transform: scale(1.03);
          box-shadow: 0 3px 10px rgba(0,0,0,0.18);
          z-index: 5;
        }
        .lanes-mockup__block-title {
          font-weight: 600;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .lanes-mockup__block-time {
          font-size: 9.5px;
          opacity: 0.85;
        }
        .lanes-mockup__overflow {
          position: absolute;
          right: 2px;
          top: -16px;
          font-size: 9.5px;
          background: #1e2126;
          color: #fff;
          padding: 1px 5px;
          border-radius: 8px;
          font-weight: 600;
        }
        .lanes-mockup__legend {
          display: flex;
          gap: 12px;
          margin-top: 18px;
          padding-top: 12px;
          border-top: 1px solid #eae7de;
          flex-wrap: wrap;
        }
        .lanes-mockup__legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          color: #6b6658;
        }
        .lanes-mockup__dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }
      `}</style>

      <div className="lanes-mockup__header">
        <div>
          <div className="lanes-mockup__title">10 กันยายน 2569</div>
          <div className="lanes-mockup__subtitle">คอนเซปต์: Lane ตามสัดส่วนเวลา</div>
        </div>
      </div>

      <div
        className="lanes-mockup__body"
        style={{ height: totalMin * PX_PER_MIN }}
      >
        {hours.map((h) => {
          const top = (h * 60 - DAY_START) * PX_PER_MIN;
          return (
            <div key={h}>
              <div className="lanes-mockup__hourline" style={{ top }} />
              <div className="lanes-mockup__hourlabel" style={{ top }}>
                {String(h).padStart(2, "0")}:00
              </div>
            </div>
          );
        })}

        {clusters.map((cluster, ci) => {
          const top = (cluster.start - DAY_START) * PX_PER_MIN;
          const height = (cluster.end - cluster.start) * PX_PER_MIN;
          return (
            <div
              key={ci}
              className="lanes-mockup__cluster"
              style={{ top, height }}
            >
              {cluster.overflow > 0 && (
                <div className="lanes-mockup__overflow">+{cluster.overflow}</div>
              )}
              {Array.from({ length: cluster.laneCount }).map((_, laneIdx) => (
                <div className="lanes-mockup__lane" key={laneIdx}>
                  {cluster.items
                    .filter((it) => it.lane === laneIdx)
                    .map((it) => {
                      const s = toMin(it.start);
                      const e = toMin(it.end);
                      const blockTop = (s - cluster.start) * PX_PER_MIN;
                      const blockHeight = Math.max(
                        26,
                        (e - s) * PX_PER_MIN
                      );
                      return (
                        <div
                          key={it.id}
                          className={
                            "lanes-mockup__block" +
                            (activeId === it.id
                              ? " lanes-mockup__block--active"
                              : "")
                          }
                          style={{
                            top: blockTop,
                            height: blockHeight,
                            background: CATEGORY_COLOR[it.category],
                          }}
                          onClick={() =>
                            setActiveId(activeId === it.id ? null : it.id)
                          }
                        >
                          <div className="lanes-mockup__block-title">
                            {it.title}
                          </div>
                          <div className="lanes-mockup__block-time">
                            {it.start}–{it.end}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="lanes-mockup__legend">
        {Object.entries(CATEGORY_COLOR).map(([cat, color]) => (
          <div className="lanes-mockup__legend-item" key={cat}>
            <span className="lanes-mockup__dot" style={{ background: color }} />
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
}

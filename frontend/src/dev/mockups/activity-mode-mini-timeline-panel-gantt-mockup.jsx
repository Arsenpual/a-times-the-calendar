import { useState } from "react";

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

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const MAX_TRACKS = 3;
const ROW_HEIGHT = 40;
const ROW_GAP = 6;

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Global greedy track assignment across the whole visible window — a track
// is reused the moment it frees up, so this reads like a video-editor
// timeline rather than per-cluster lanes. Anything that can't fit in
// MAX_TRACKS becomes an overflow tick under the last track.
function assignTracks(events) {
  const sorted = [...events].sort((a, b) => toMin(a.start) - toMin(b.start));
  const trackEnds = Array(MAX_TRACKS).fill(0);
  const placed = [];
  const overflow = [];
  for (const ev of sorted) {
    const s = toMin(ev.start);
    const e = toMin(ev.end);
    const trackIdx = trackEnds.findIndex((end) => end <= s);
    if (trackIdx === -1) {
      overflow.push(ev);
      continue;
    }
    trackEnds[trackIdx] = e;
    placed.push({ ...ev, track: trackIdx });
  }
  return { placed, overflow };
}

export default function ActivityModeGanttMockup() {
  const [zoom, setZoom] = useState(1.4);
  const [activeId, setActiveId] = useState(null);
  const { placed, overflow } = assignTracks(EVENTS);
  const totalMin = DAY_END - DAY_START;
  const trackWidth = totalMin * zoom;
  const hours = [];
  for (let h = 8; h <= 22; h++) hours.push(h);

  return (
    <div className="gantt-mockup">
      <style>{`
        .gantt-mockup {
          font-family: "IBM Plex Sans Thai", "Noto Sans Thai", system-ui, sans-serif;
          background: #fbfaf7;
          color: #1e2126;
          padding: 18px 16px 22px;
          width: 560px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 32px);
          border-radius: 10px;
          border: 1px solid #e3e0d8;
          box-shadow: 0 12px 32px rgba(0,0,0,0.18);
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 9999;
          display: flex;
          flex-direction: column;
        }
        .gantt-mockup__header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
        }
        .gantt-mockup__title {
          font-size: 15px;
          font-weight: 600;
        }
        .gantt-mockup__subtitle {
          font-size: 11.5px;
          color: #8a8578;
        }
        .gantt-mockup__zoom {
          display: flex;
          gap: 4px;
        }
        .gantt-mockup__zoom-btn {
          font-size: 11px;
          border: 1px solid #d8d4c8;
          background: #fff;
          border-radius: 5px;
          padding: 3px 9px;
          cursor: pointer;
          color: #4a473e;
        }
        .gantt-mockup__zoom-btn--active {
          background: #1e2126;
          color: #fff;
          border-color: #1e2126;
        }
        .gantt-mockup__scroll {
          overflow-x: auto;
          overflow-y: hidden;
          border-radius: 6px;
          border: 1px solid #eae7de;
        }
        .gantt-mockup__canvas {
          position: relative;
        }
        .gantt-mockup__axis {
          position: relative;
          height: 22px;
          border-bottom: 1px solid #eae7de;
        }
        .gantt-mockup__tick {
          position: absolute;
          top: 0;
          bottom: 0;
          border-left: 1px solid #eee;
        }
        .gantt-mockup__tick-label {
          position: absolute;
          top: 2px;
          left: 3px;
          font-size: 9.5px;
          color: #a39d8c;
          white-space: nowrap;
        }
        .gantt-mockup__tracks {
          position: relative;
        }
        .gantt-mockup__track-bg {
          position: absolute;
          left: 0;
          right: 0;
          border-bottom: 1px dashed #f0eee6;
        }
        .gantt-mockup__bar {
          position: absolute;
          border-radius: 6px;
          padding: 4px 8px;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.3;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          cursor: pointer;
          box-sizing: border-box;
          border: 1.5px solid rgba(255,255,255,0.25);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .gantt-mockup__bar:hover,
        .gantt-mockup__bar--active {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          z-index: 5;
        }
        .gantt-mockup__bar-time {
          font-weight: 400;
          opacity: 0.85;
          font-size: 9.5px;
          margin-left: 5px;
        }
        .gantt-mockup__overflow-row {
          position: absolute;
          left: 0;
          right: 0;
        }
        .gantt-mockup__overflow-tick {
          position: absolute;
          top: 2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #c2492f;
          border: 2px solid #fbfaf7;
          cursor: default;
        }
        .gantt-mockup__legend {
          display: flex;
          gap: 12px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .gantt-mockup__legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          color: #6b6658;
        }
        .gantt-mockup__dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }
        .gantt-mockup__hint {
          font-size: 10px;
          color: #a39d8c;
          margin-top: 6px;
        }
      `}</style>

      <div className="gantt-mockup__header">
        <div>
          <div className="gantt-mockup__title">10 กันยายน 2569</div>
          <div className="gantt-mockup__subtitle">
            คอนเซปต์: Horizontal Micro-Gantt
          </div>
        </div>
        <div className="gantt-mockup__zoom">
          {[0.9, 1.4, 2.2].map((z) => (
            <button
              key={z}
              className={
                "gantt-mockup__zoom-btn" +
                (zoom === z ? " gantt-mockup__zoom-btn--active" : "")
              }
              onClick={() => setZoom(z)}
            >
              {z === 0.9 ? "ย่อ" : z === 1.4 ? "ปกติ" : "ขยาย"}
            </button>
          ))}
        </div>
      </div>

      <div className="gantt-mockup__scroll">
        <div className="gantt-mockup__canvas" style={{ width: trackWidth }}>
          <div className="gantt-mockup__axis">
            {hours.map((h) => {
              const left = (h * 60 - DAY_START) * zoom;
              return (
                <div key={h}>
                  <div className="gantt-mockup__tick" style={{ left }} />
                  <div className="gantt-mockup__tick-label" style={{ left }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="gantt-mockup__tracks"
            style={{ height: MAX_TRACKS * (ROW_HEIGHT + ROW_GAP) + 14 }}
          >
            {Array.from({ length: MAX_TRACKS }).map((_, i) => (
              <div
                key={i}
                className="gantt-mockup__track-bg"
                style={{ top: i * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT }}
              />
            ))}

            {placed.map((ev) => {
              const s = toMin(ev.start);
              const e = toMin(ev.end);
              const left = (s - DAY_START) * zoom;
              const width = Math.max(30, (e - s) * zoom);
              const top = ev.track * (ROW_HEIGHT + ROW_GAP);
              return (
                <div
                  key={ev.id}
                  className={
                    "gantt-mockup__bar" +
                    (activeId === ev.id ? " gantt-mockup__bar--active" : "")
                  }
                  style={{
                    left,
                    width,
                    top,
                    height: ROW_HEIGHT,
                    background: CATEGORY_COLOR[ev.category],
                  }}
                  onClick={() =>
                    setActiveId(activeId === ev.id ? null : ev.id)
                  }
                  title={`${ev.title} · ${ev.start}–${ev.end}`}
                >
                  {ev.title}
                  <span className="gantt-mockup__bar-time">
                    {ev.start}–{ev.end}
                  </span>
                </div>
              );
            })}

            {overflow.length > 0 && (
              <div
                className="gantt-mockup__overflow-row"
                style={{ top: MAX_TRACKS * (ROW_HEIGHT + ROW_GAP) }}
              >
                {overflow.map((ev) => {
                  const s = toMin(ev.start);
                  const left = (s - DAY_START) * zoom;
                  return (
                    <div
                      key={ev.id}
                      className="gantt-mockup__overflow-tick"
                      style={{ left }}
                      title={`+1: ${ev.title} (${ev.start}–${ev.end})`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {overflow.length > 0 && (
        <div className="gantt-mockup__hint">
          จุดแดงด้านล่าง = กิจกรรมที่ชนเกิน {MAX_TRACKS} รายการ ({overflow.length}{" "}
          รายการ) — วางเมาส์เพื่อดูชื่อ
        </div>
      )}

      <div className="gantt-mockup__legend">
        {Object.entries(CATEGORY_COLOR).map(([cat, color]) => (
          <div className="gantt-mockup__legend-item" key={cat}>
            <span className="gantt-mockup__dot" style={{ background: color }} />
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
}

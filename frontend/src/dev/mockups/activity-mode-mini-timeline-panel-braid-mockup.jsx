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
const PX_PER_MIN = 0.95;
const OFFSET_UNIT = 30; // px between adjacent strands when split apart
const SAMPLE_STEP = 4; // minutes between path samples

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function easeInOut(f) {
  return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
}

// Connected-overlap clustering, same idea as the lane mockups: a run of
// mutually-overlapping events becomes one "braid" that splits and rejoins.
function clusterEvents(events) {
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
  return clusters;
}

function assignStrands(cluster) {
  const laneEnds = [0, 0, 0];
  const placed = [];
  const overflow = [];
  for (const ev of cluster.items) {
    const s = toMin(ev.start);
    const e = toMin(ev.end);
    const idx = laneEnds.findIndex((end) => end <= s);
    if (idx === -1) {
      overflow.push(ev);
      continue;
    }
    laneEnds[idx] = e;
    placed.push({ ...ev, lane: idx });
  }
  const laneCount = Math.max(1, ...placed.map((p) => p.lane + 1));
  return { placed, overflow, laneCount };
}

// Build a filled ribbon path for one event: center line at its own start
// and end, tapering out to its assigned strand offset in between.
function ribbonPath(ev, target, taperMin) {
  const s = toMin(ev.start);
  const e = toMin(ev.end);
  const duration = e - s;
  const width = Math.min(15, 6 + duration / 30);
  const taper = Math.min(taperMin, duration / 2.2);

  const xAt = (t) => {
    if (target === 0) return 0;
    if (t - s < taper) return target * easeInOut((t - s) / taper);
    if (e - t < taper) return target * easeInOut((e - t) / taper);
    return target;
  };

  const samples = [];
  for (let t = s; t < e; t += SAMPLE_STEP) samples.push(t);
  samples.push(e);

  const left = samples.map((t) => [
    xAt(t) - width / 2,
    (t - DAY_START) * PX_PER_MIN,
  ]);
  const right = samples
    .map((t) => [xAt(t) + width / 2, (t - DAY_START) * PX_PER_MIN])
    .reverse();

  const pts = [...left, ...right];
  const d =
    "M " + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ") + " Z";
  return d;
}

export default function ActivityModeBraidMockup() {
  const [hoverId, setHoverId] = useState(null);
  const clusters = clusterEvents(EVENTS);
  const totalMin = DAY_END - DAY_START;
  const canvasHeight = totalMin * PX_PER_MIN;
  const canvasCenter = 150;
  const hours = [];
  for (let h = 8; h <= 22; h += 2) hours.push(h);

  const ribbons = [];
  const overflowNotes = [];
  for (const cluster of clusters) {
    const { placed, overflow, laneCount } = assignStrands(cluster);
    for (const ev of placed) {
      const target =
        laneCount > 1 ? (ev.lane - (laneCount - 1) / 2) * OFFSET_UNIT : 0;
      ribbons.push({ ev, target });
    }
    if (overflow.length > 0) {
      overflowNotes.push({
        y: (cluster.start - DAY_START) * PX_PER_MIN,
        count: overflow.length,
        names: overflow.map((o) => o.title).join(", "),
      });
    }
  }

  return (
    <div className="braid-mockup">
      <style>{`
        .braid-mockup {
          font-family: "IBM Plex Sans Thai", "Noto Sans Thai", system-ui, sans-serif;
          background: #fbfaf7;
          color: #1e2126;
          padding: 18px 16px 20px;
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
        .braid-mockup__title {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .braid-mockup__subtitle {
          font-size: 11.5px;
          color: #8a8578;
          margin-bottom: 14px;
        }
        .braid-mockup__canvas-wrap {
          position: relative;
        }
        .braid-mockup__hourlabel {
          position: absolute;
          left: 0;
          font-size: 10px;
          color: #a39d8c;
        }
        .braid-mockup__ribbon {
          cursor: pointer;
          stroke: rgba(255,255,255,0.55);
          stroke-width: 1;
          transition: opacity 0.12s ease;
        }
        .braid-mockup__ribbon--dim {
          opacity: 0.35;
        }
        .braid-mockup__tooltip {
          position: absolute;
          background: #1e2126;
          color: #fff;
          font-size: 10.5px;
          padding: 4px 8px;
          border-radius: 5px;
          white-space: nowrap;
          pointer-events: none;
          transform: translate(-50%, -130%);
          z-index: 10;
        }
        .braid-mockup__overflow {
          position: absolute;
          right: 2px;
          font-size: 9px;
          background: #c2492f;
          color: #fff;
          padding: 1px 5px;
          border-radius: 8px;
          font-weight: 600;
        }
        .braid-mockup__legend {
          display: flex;
          gap: 12px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #eae7de;
          flex-wrap: wrap;
        }
        .braid-mockup__legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          color: #6b6658;
        }
        .braid-mockup__dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }
        .braid-mockup__hint {
          font-size: 10px;
          color: #a39d8c;
          margin-top: 8px;
        }
      `}</style>

      <div className="braid-mockup__title">10 กันยายน 2569</div>
      <div className="braid-mockup__subtitle">
        คอนเซปต์: Braid — เส้นแยกตอนชนกัน รวมกลับเมื่อโล่ง
      </div>

      <div
        className="braid-mockup__canvas-wrap"
        style={{ height: canvasHeight, marginLeft: 34 }}
      >
        {hours.map((h) => (
          <div
            key={h}
            className="braid-mockup__hourlabel"
            style={{
              top: (h * 60 - DAY_START) * PX_PER_MIN - 5,
              left: -34,
            }}
          >
            {String(h).padStart(2, "0")}:00
          </div>
        ))}

        <svg
          width="100%"
          height={canvasHeight}
          viewBox={`0 -8 ${canvasCenter * 2} ${canvasHeight + 8}`}
          style={{ overflow: "visible" }}
        >
          {hours.map((h) => (
            <line
              key={h}
              x1={0}
              x2={canvasCenter * 2}
              y1={(h * 60 - DAY_START) * PX_PER_MIN}
              y2={(h * 60 - DAY_START) * PX_PER_MIN}
              stroke="#eae7de"
              strokeWidth={1}
            />
          ))}
          {/* trunk reference line: where every strand starts and ends */}
          <line
            x1={canvasCenter}
            x2={canvasCenter}
            y1={0}
            y2={canvasHeight}
            stroke="#d8d4c8"
            strokeWidth={1}
            strokeDasharray="2 4"
          />

          {ribbons.map(({ ev, target }) => (
            <g key={ev.id} transform={`translate(${canvasCenter}, 0)`}>
              <path
                d={ribbonPath(ev, target, 14)}
                fill={CATEGORY_COLOR[ev.category]}
                className={
                  "braid-mockup__ribbon" +
                  (hoverId && hoverId !== ev.id
                    ? " braid-mockup__ribbon--dim"
                    : "")
                }
                onMouseEnter={() => setHoverId(ev.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <title>
                  {ev.title} · {ev.start}–{ev.end}
                </title>
              </path>
            </g>
          ))}
        </svg>

        {overflowNotes.map((n, i) => (
          <div
            key={i}
            className="braid-mockup__overflow"
            style={{ top: n.y - 14 }}
            title={n.names}
          >
            +{n.count}
          </div>
        ))}
      </div>

      <div className="braid-mockup__hint">
        เส้นประกลางคือ "ลำต้น" — ตอนวันโล่งทุกเส้นจะทับกันตรงกลาง พอมีงานชนกัน
        เส้นจะแยกออกเป็นคู่/สาม แล้วกลับมารวมกันเมื่อพ้นช่วงชน วางเมาส์บนเส้นเพื่อดูชื่องาน
      </div>

      <div className="braid-mockup__legend">
        {Object.entries(CATEGORY_COLOR).map(([cat, color]) => (
          <div className="braid-mockup__legend-item" key={cat}>
            <span className="braid-mockup__dot" style={{ background: color }} />
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
}

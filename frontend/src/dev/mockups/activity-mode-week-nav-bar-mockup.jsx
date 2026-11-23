import React, { useEffect, useState } from "react";
import "./activity-mode-week-nav-bar-mockup.css";

const SAMPLE_DAYS = [
  { key: "sun", short: "อา", date: 15, count: 1 },
  { key: "mon", short: "จ", date: 16, count: 3 },
  { key: "tue", short: "อ", date: 17, count: 2 },
  { key: "wed", short: "พ", date: 18, count: 4 },
  { key: "thu", short: "พฤ", date: 19, count: 2 },
  { key: "fri", short: "ศ", date: 20, count: 3, isToday: true },
  { key: "sat", short: "ส", date: 21, count: 0 },
];

const CONCEPTS = [
  {
    id: 1,
    name: "Concept 1 · Minimal Hairline Strip",
    desc: "แบนสนิท ไม่มีกรอบปุ่ม ใช้เส้นบางคั่นและขีดเส้นใต้จุดที่เลือก",
  },
  {
    id: 2,
    name: "Concept 2 · Segmented 7-Day Rail",
    desc: "แบ่งพื้นที่ตรงกลางเป็นราง 7 ช่องเท่ากัน พร้อมจุดบอกวันที่มีกิจกรรม",
  },
  {
    id: 3,
    name: "Concept 3 · Flat Command Dock",
    desc: "พื้นหลังขาวสะอาด แถบเลือกวันทรงแคปซูลตรงกลาง และกลุ่มนำทางด้านขวา",
  },
  {
    id: 4,
    name: "Concept 4 · Context + Week Progress",
    desc: "เพิ่มแถบความคืบหน้าของสัปดาห์ด้านซ้าย และปุ่มวัน 2 บรรทัดตรงกลาง",
  },
  {
    id: 5,
    name: "Concept 5 · Compact Power-User Bar",
    desc: "กะทัดรัด ความสูงต่ำ พร้อมป้ายรหัสสัปดาห์ (W47/53) และคำใบ้คีย์ลัด",
  },
];

export default function ActivityModeWeekNavBarMockup() {
  const [dark, setDark] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(5);
  const [weekOffset, setWeekOffset] = useState(0);
  const [highlightedConcept, setHighlightedConcept] = useState(null);

  const weekNumber = 47 + weekOffset;

  const stepDay = (delta) => {
    setSelectedIndex((prev) => {
      const next = prev + delta;
      if (next < 0) {
        setWeekOffset((w) => w - 1);
        return 6;
      }
      if (next > 6) {
        setWeekOffset((w) => w + 1);
        return 0;
      }
      return next;
    });
  };

  const goToday = () => {
    setWeekOffset(0);
    setSelectedIndex(5);
  };

  useEffect(() => {
    const onKey = (event) => {
      if (["1", "2", "3", "4", "5"].includes(event.key)) {
        setHighlightedConcept(Number(event.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const progressPct = Math.round(((selectedIndex + 1) / 7) * 100);

  return (
    <div className={`wnb-mockup-page${dark ? " is-dark" : ""}`}>
      <header className="wnb-mockup-header">
        <div>
          <h1>WeekNavBar · 5 Concepts Mockup</h1>
          <p>
            เปิดหน้านี้ได้ทุกเมื่อด้วยคีย์ลัด <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>N</kbd> · กดเลข <kbd>1</kbd>–<kbd>5</kbd> เพื่อเน้น Concept หรือคลิกวัน/ปุ่มนำทางเพื่อลองใช้งานจริง
          </p>
        </div>
        <div className="wnb-mockup-actions">
          <button type="button" className="wnb-theme-toggle" onClick={() => setDark((d) => !d)}>
            {dark ? "☀ โหมดสว่าง" : "🌙 โหมดมืด"}
          </button>
        </div>
      </header>

      <div className="wnb-concept-list">
        {CONCEPTS.map((concept) => {
          const activeDay = SAMPLE_DAYS[selectedIndex];
          return (
            <section
              key={concept.id}
              className={`wnb-concept-card${highlightedConcept === concept.id ? " is-highlighted" : ""}`}
            >
              <div className="wnb-concept-meta">
                <h2 className="wnb-concept-title">
                  <span className="wnb-concept-badge">#{concept.id}</span>
                  {concept.name}
                </h2>
                <p className="wnb-concept-desc">{concept.desc}</p>
              </div>

              <div className="wnb-preview-spine-stub">
                <span>
                  {activeDay.short} {activeDay.date + weekOffset * 7} พ.ย.
                </span>
                <div className="wnb-preview-spine-stub-track">
                  <span className="wnb-preview-spine-stub-chip">09:00–10:30 Deep Work</span>
                  <span className="wnb-preview-spine-stub-chip">14:00–15:00 Sync</span>
                </div>
              </div>

              {concept.id === 1 && (
                <nav className="lonth-nav-bar week-nav-bar wnb-bar" aria-label={concept.name}>
                  <div className="wnb-c1-left">
                    <button type="button" className="wnb-week-name">สัปดาห์ที่ {weekNumber} ของปี 2026</button>
                    <span className="wnb-period">สัปดาห์ที่ {weekNumber}/53</span>
                  </div>
                  <div className="wnb-c1-days">
                    {SAMPLE_DAYS.map((d, idx) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`wnb-c1-day${idx === selectedIndex ? " is-selected" : ""}${d.isToday && weekOffset === 0 ? " is-today" : ""}`}
                        onClick={() => setSelectedIndex(idx)}
                      >
                        <span>{d.short}</span>
                        <strong>{d.date + weekOffset * 7}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="wnb-c1-tools">
                    <button type="button" className="wnb-c1-btn" onClick={() => setWeekOffset((w) => w - 1)} title="สัปดาห์ก่อนหน้า">«</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => stepDay(-1)} title="วันก่อนหน้า">‹</button>
                    <button type="button" className="wnb-c1-btn wnb-c1-today" onClick={goToday}>วันนี้</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => stepDay(1)} title="วันถัดไป">›</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => setWeekOffset((w) => w + 1)} title="สัปดาห์ถัดไป">»</button>
                  </div>
                </nav>
              )}

              {concept.id === 2 && (
                <nav className="lonth-nav-bar week-nav-bar wnb-bar wnb-c2-bar" aria-label={concept.name}>
                  <div className="wnb-c2-left">
                    <button type="button" className="wnb-week-name" style={{ textAlign: "left", padding: 0 }}>
                      สัปดาห์ที่ {weekNumber} ของปี 2026
                    </button>
                    <span className="wnb-period">สัปดาห์ที่ {weekNumber}/53 · 7 วัน</span>
                  </div>
                  <div className="wnb-c2-rail">
                    {SAMPLE_DAYS.map((d, idx) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`wnb-c2-day${idx === selectedIndex ? " is-selected" : ""}`}
                        onClick={() => setSelectedIndex(idx)}
                      >
                        <span>{d.short}</span>
                        <strong>{d.date + weekOffset * 7}</strong>
                        {d.count > 0 && <i className="wnb-c2-dot" />}
                      </button>
                    ))}
                  </div>
                  <div className="wnb-c2-tools">
                    <button type="button" className="wnb-c1-btn" onClick={() => setWeekOffset((w) => w - 1)}>«</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => stepDay(-1)}>‹</button>
                    <button type="button" className="wnb-c1-btn wnb-c1-today" onClick={goToday}>วันนี้</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => stepDay(1)}>›</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => setWeekOffset((w) => w + 1)}>»</button>
                  </div>
                </nav>
              )}

              {concept.id === 3 && (
                <nav className="lonth-nav-bar week-nav-bar wnb-bar wnb-c3-bar" aria-label={concept.name}>
                  <div className="wnb-c3-left">
                    <button type="button" className="wnb-week-name">สัปดาห์ที่ {weekNumber} ของปี 2026</button>
                    <span className="wnb-period">({weekNumber}/53)</span>
                  </div>
                  <div className="wnb-c3-pill-track">
                    {SAMPLE_DAYS.map((d, idx) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`wnb-c3-day${idx === selectedIndex ? " is-selected" : ""}`}
                        onClick={() => setSelectedIndex(idx)}
                      >
                        <span>{d.short}</span>
                        <strong>{d.date + weekOffset * 7}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="wnb-c3-tools">
                    <div className="wnb-c3-group">
                      <button type="button" onClick={() => setWeekOffset((w) => w - 1)} title="สัปดาห์ก่อนหน้า">« สัปดาห์</button>
                      <button type="button" onClick={() => stepDay(-1)} title="วันก่อนหน้า">‹</button>
                      <button type="button" className="is-today-pill" onClick={goToday}>วันนี้</button>
                      <button type="button" onClick={() => stepDay(1)} title="วันถัดไป">›</button>
                      <button type="button" onClick={() => setWeekOffset((w) => w + 1)} title="สัปดาห์ถัดไป">สัปดาห์ »</button>
                    </div>
                  </div>
                </nav>
              )}

              {concept.id === 4 && (
                <nav className="lonth-nav-bar week-nav-bar wnb-bar" aria-label={concept.name}>
                  <div className="wnb-c4-left">
                    <div className="wnb-c4-title-row">
                      <button type="button" className="wnb-week-name" style={{ padding: 0 }}>
                        สัปดาห์ที่ {weekNumber}
                      </button>
                      <span className="wnb-period">· {weekNumber}/53 ({progressPct}%)</span>
                    </div>
                    <div className="wnb-c4-progress" aria-hidden="true">
                      <div className="wnb-c4-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  <div className="wnb-c4-days">
                    {SAMPLE_DAYS.map((d, idx) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`wnb-c4-day${idx === selectedIndex ? " is-selected" : ""}`}
                        onClick={() => setSelectedIndex(idx)}
                      >
                        <span>{d.short}</span>
                        <strong>{d.date + weekOffset * 7}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="wnb-c1-tools">
                    <button type="button" className="wnb-c1-btn" onClick={() => setWeekOffset((w) => w - 1)}>«</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => stepDay(-1)}>‹</button>
                    <button type="button" className="wnb-c1-btn wnb-c1-today" onClick={goToday}>วันนี้</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => stepDay(1)}>›</button>
                    <button type="button" className="wnb-c1-btn" onClick={() => setWeekOffset((w) => w + 1)}>»</button>
                  </div>
                </nav>
              )}

              {concept.id === 5 && (
                <nav className="lonth-nav-bar week-nav-bar wnb-bar wnb-c5-bar" aria-label={concept.name}>
                  <div className="wnb-c1-left">
                    <span className="wnb-c5-tag">W{weekNumber}/53</span>
                    <button type="button" className="wnb-week-name">สัปดาห์ที่ {weekNumber} ของปี 2026</button>
                  </div>
                  <div className="wnb-c5-days">
                    {SAMPLE_DAYS.map((d, idx) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`wnb-c5-day${idx === selectedIndex ? " is-selected" : ""}`}
                        onClick={() => setSelectedIndex(idx)}
                      >
                        <span>{d.short}</span>
                        <strong>{d.date + weekOffset * 7}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="wnb-c5-tools">
                    <button type="button" className="wnb-c5-keybtn" onClick={() => setWeekOffset((w) => w - 1)}>
                      <kbd>←</kbd><span>«</span>
                    </button>
                    <button type="button" className="wnb-c5-keybtn" onClick={() => stepDay(-1)}>
                      <kbd>↑</kbd><span>‹</span>
                    </button>
                    <button type="button" className="wnb-c5-keybtn wnb-c1-today" onClick={goToday}>
                      <span>วันนี้</span>
                    </button>
                    <button type="button" className="wnb-c5-keybtn" onClick={() => stepDay(1)}>
                      <span>›</span><kbd>↓</kbd>
                    </button>
                    <button type="button" className="wnb-c5-keybtn" onClick={() => setWeekOffset((w) => w + 1)}>
                      <span>»</span><kbd>→</kbd>
                    </button>
                  </div>
                </nav>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

import React from "react";

/**
 * โหมด Reminder — ยังเป็นแค่ mockup ล้วนๆ ณ ตอนนี้ (ดู firebase-migration-plan.md
 * ระยะ 4 — ยังไม่เริ่มพัฒนาจริง รอ commit เรื่องความสัมพันธ์กับ Pomodoro ก่อน)
 *
 * เนื้อหาทั้งหมดใน component นี้แปลงมาจาก reminder-mode-mockup.html แบบคงหน้าตา
 * เดิมไว้ทุกจุด (ตัวเลข, ข้อความ, layout) — ไม่มี state, ไม่มี event handler
 * ที่ทำงานจริงเลยสักปุ่มเดียว ปุ่ม/toggle ทุกอันเป็นแค่ placeholder ให้เห็นภาพ
 * ว่าหน้าตาจะเป็นแบบไหน ไม่ใช่ของจริงที่กดแล้วมีผล
 *
 * Styles ทั้งหมด scope ไว้ใต้ .reminder-mockup เพื่อไม่ให้ชนกับ index.css
 * ของแอปหลัก (คัดลอกมาจาก <style> เดิมใน .html เกือบทั้งหมด แค่เติม prefix
 * .reminder-mockup นำหน้าทุก selector)
 */
export default function ReminderModeMockup() {
  return (
    <div className="reminder-mockup">
      <style>{`
        .reminder-mockup {
          --rm-blue: #1557b0;
          --rm-border: #dadce0;
          --rm-text-primary: #3c4043;
          --rm-text-secondary: #5f6368;
          --rm-bg: #e8eaed;
          --rm-bg-muted: #ffffff;
          --rm-hover: #e8eaed;
          --rm-amber: #e8710a;
          --rm-amber-dark: #b85a08;
          --rm-amber-tint: #fdf0e3;
          --rm-green: #1e8e3e;
          --rm-green-tint: #e6f4ea;
          font-family: "Google Sans", "Roboto", Arial, sans-serif;
          color: var(--rm-text-primary);
          background: var(--rm-bg);
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .reminder-mockup .mockup-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--rm-amber-tint);
          color: var(--rm-amber-dark);
          border-bottom: 1px solid var(--rm-amber);
          font-size: 13px;
          font-weight: 500;
        }

        .reminder-mockup .mockup-banner .badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .04em;
          text-transform: uppercase;
          background: var(--rm-amber);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .reminder-mockup .rm-dashboard {
          flex: 1;
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 16px;
          padding: 16px;
          overflow: hidden;
        }

        .reminder-mockup .btn {
          font-family: inherit;
          font-size: 14px;
          padding: 8px 16px;
          border-radius: 4px;
          border: 1px solid var(--rm-border);
          background: var(--rm-bg-muted);
          color: var(--rm-text-primary);
          cursor: not-allowed;
          opacity: .85;
        }

        .reminder-mockup .btn.primary {
          background: var(--rm-amber);
          border-color: var(--rm-amber);
          color: white;
        }

        .reminder-mockup .tape-panel {
          background: var(--rm-bg-muted);
          border: 1px solid var(--rm-border);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .reminder-mockup .tape-header { padding: 16px 16px 12px; border-bottom: 1px solid var(--rm-border); }
        .reminder-mockup .tape-label { font-size: 12px; color: var(--rm-text-secondary); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 6px; }
        .reminder-mockup .tape-session-name { font-size: 16px; font-weight: 500; margin: 0 0 2px; }
        .reminder-mockup .tape-session-sub { font-size: 12px; color: var(--rm-text-secondary); }
        .reminder-mockup .tape-big-clock { font-family: "Roboto Mono", monospace; font-size: 40px; font-weight: 500; letter-spacing: -0.02em; color: var(--rm-amber-dark); margin: 10px 0 2px; }
        .reminder-mockup .tape-phase-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 12px; background: var(--rm-green-tint); color: var(--rm-green); }
        .reminder-mockup .tape-phase-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--rm-green); animation: rm-pulse 1.6s ease-in-out infinite; }

        @keyframes rm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

        .reminder-mockup .tape-scroll { flex: 1; overflow-y: auto; padding: 8px 0; position: relative; }
        .reminder-mockup .tape-track { position: relative; padding-left: 56px; }
        .reminder-mockup .tape-now-line { position: absolute; left: 0; right: 0; top: 132px; height: 2px; background: var(--rm-amber); z-index: 3; }
        .reminder-mockup .tape-now-line::before {
          content: "ตอนนี้"; position: absolute; left: 8px; top: -9px; font-size: 10px; font-weight: 700;
          color: white; background: var(--rm-amber); padding: 1px 6px; border-radius: 8px;
        }
        .reminder-mockup .tape-minute { position: relative; height: 44px; border-top: 1px solid var(--rm-border); }
        .reminder-mockup .tape-minute.elapsed { background: linear-gradient(90deg, var(--rm-amber-tint), transparent 70%); }
        .reminder-mockup .tape-minute-label { position: absolute; left: -48px; top: -7px; width: 40px; text-align: right; font-family: "Roboto Mono", monospace; font-size: 11px; color: var(--rm-text-secondary); }
        .reminder-mockup .tape-minute.major .tape-minute-label { font-weight: 700; color: var(--rm-text-primary); }
        .reminder-mockup .tape-flag {
          position: absolute; left: 8px; top: 4px; display: flex; align-items: center; gap: 6px; font-size: 12px;
          background: var(--rm-bg-muted); border: 1px solid var(--rm-amber); color: var(--rm-amber-dark);
          padding: 3px 8px 3px 6px; border-radius: 12px; white-space: nowrap; max-width: 210px; overflow: hidden; text-overflow: ellipsis;
        }
        .reminder-mockup .tape-flag .flag-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--rm-amber); flex-shrink: 0; }
        .reminder-mockup .tape-footer { padding: 12px 16px; border-top: 1px solid var(--rm-border); display: flex; gap: 8px; }
        .reminder-mockup .tape-footer .btn { flex: 1; font-size: 13px; padding: 8px; }

        .reminder-mockup .reminder-panel { background: var(--rm-bg-muted); border: 1px solid var(--rm-border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
        .reminder-mockup .reminder-toolbar { padding: 16px; border-bottom: 1px solid var(--rm-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .reminder-mockup .reminder-toolbar h2 { font-size: 18px; font-weight: 500; margin: 0; }
        .reminder-mockup .reminder-toolbar-sub { font-size: 12px; color: var(--rm-text-secondary); margin-top: 2px; }
        .reminder-mockup .reminder-list { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .reminder-mockup .reminder-row { display: grid; grid-template-columns: 44px 1fr auto auto; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--rm-border); border-radius: 8px; background: var(--rm-bg-muted); }
        .reminder-mockup .reminder-row.active { border-color: var(--rm-amber); background: var(--rm-amber-tint); }
        .reminder-mockup .reminder-freq-badge { font-family: "Roboto Mono", monospace; font-size: 11px; font-weight: 700; text-align: center; background: #e8f0fe; color: var(--rm-blue); border-radius: 6px; padding: 6px 2px; line-height: 1.15; }
        .reminder-mockup .reminder-row.active .reminder-freq-badge { background: var(--rm-amber); color: white; }
        .reminder-mockup .reminder-freq-badge .n { display: block; font-size: 14px; }
        .reminder-mockup .reminder-freq-badge .u { display: block; font-size: 8px; opacity: .8; }
        .reminder-mockup .reminder-info .title { font-size: 14px; font-weight: 500; margin: 0 0 2px; }
        .reminder-mockup .reminder-info .meta { font-size: 12px; color: var(--rm-text-secondary); }
        .reminder-mockup .reminder-toggle { width: 36px; height: 20px; border-radius: 10px; background: var(--rm-border); position: relative; cursor: not-allowed; border: none; }
        .reminder-mockup .reminder-toggle.on { background: var(--rm-green); }
        .reminder-mockup .reminder-toggle::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: left .15s ease; }
        .reminder-mockup .reminder-toggle.on::after { left: 18px; }
        .reminder-mockup .reminder-row-actions { display: flex; gap: 4px; }
        .reminder-mockup .icon-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--rm-text-secondary); cursor: not-allowed; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .reminder-mockup .reminder-section-label { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--rm-text-secondary); margin: 12px 0 2px; padding: 0 4px; }

        .reminder-mockup .composer { margin: 0 16px 16px; border: 1px dashed var(--rm-border); border-radius: 8px; padding: 14px; display: grid; grid-template-columns: 1.4fr 1fr auto; gap: 10px; align-items: end; background: #fafbfc; }
        .reminder-mockup .composer label { font-size: 11px; color: var(--rm-text-secondary); display: block; margin-bottom: 4px; }
        .reminder-mockup .composer input, .reminder-mockup .composer select { width: 100%; font-family: inherit; font-size: 13px; padding: 8px 10px; border: 1px solid var(--rm-border); border-radius: 6px; background: white; }
        .reminder-mockup .composer .freq-row { display: flex; gap: 6px; }
        .reminder-mockup .composer .freq-row input { width: 56px; flex: none; }

        @media (max-width: 900px) {
          .reminder-mockup .rm-dashboard { grid-template-columns: 1fr; overflow: auto; }
          .reminder-mockup .tape-panel { max-height: 320px; }
        }
      `}</style>

      <div className="mockup-banner">
        <span className="badge">Mockup</span>
        นี่ยังเป็นแค่ภาพตัวอย่างหน้าตา (mockup) เท่านั้น — ยังใช้งานจริงไม่ได้ ปุ่มและสวิตช์ทุกอันในหน้านี้ไม่มีผลใดๆ
        (ดูสถานะจริงในแผนที่ระยะ 4 ของ <code>firebase-migration-plan.md</code>)
      </div>

      <div className="rm-dashboard">
        {/* ================= LEFT: minute-tape + pomodoro (view only, mockup data) ================= */}
        <aside className="tape-panel">
          <div className="tape-header">
            <p className="tape-label">Pomodoro กำลังทำงาน</p>
            <p className="tape-session-name">โฟกัส: เตรียมสไลด์ประชุม</p>
            <p className="tape-session-sub">รอบที่ 2 จาก 4 · พัก 5 นาทีหลังจบรอบนี้</p>
            <div className="tape-big-clock">18:42</div>
            <span className="tape-phase-pill">
              <span className="dot"></span> กำลังโฟกัส
            </span>
          </div>

          <div className="tape-scroll">
            <div className="tape-track">
              <div className="tape-now-line"></div>

              <div className="tape-minute major"><span className="tape-minute-label">14:05</span></div>
              <div className="tape-minute elapsed"><span className="tape-minute-label">:06</span></div>
              <div className="tape-minute elapsed">
                <span className="tape-minute-label">:07</span>
                <span className="tape-flag"><span className="flag-dot"></span>ดื่มน้ำ</span>
              </div>
              <div className="tape-minute elapsed"><span className="tape-minute-label">:08</span></div>
              <div className="tape-minute elapsed"><span className="tape-minute-label">:09</span></div>
              <div className="tape-minute major elapsed"><span className="tape-minute-label">14:10</span></div>
              <div className="tape-minute elapsed"><span className="tape-minute-label">:11</span></div>
              <div className="tape-minute elapsed">
                <span className="tape-minute-label">:12</span>
                <span className="tape-flag"><span className="flag-dot"></span>ยืดตัว 30 วิ</span>
              </div>
              <div className="tape-minute"><span className="tape-minute-label">:13</span></div>
              <div className="tape-minute"><span className="tape-minute-label">:14</span></div>
              <div className="tape-minute major"><span className="tape-minute-label">14:15</span></div>
              <div className="tape-minute"><span className="tape-minute-label">:16</span></div>
              <div className="tape-minute">
                <span className="tape-minute-label">:17</span>
                <span className="tape-flag"><span className="flag-dot"></span>ดื่มน้ำ</span>
              </div>
              <div className="tape-minute"><span className="tape-minute-label">:18</span></div>
              <div className="tape-minute"><span className="tape-minute-label">:19</span></div>
              <div className="tape-minute major"><span className="tape-minute-label">14:20</span></div>
              <div className="tape-minute"><span className="tape-minute-label">:21</span></div>
              <div className="tape-minute">
                <span className="tape-minute-label">:22</span>
                <span className="tape-flag"><span className="flag-dot"></span>ยืดตัว 30 วิ</span>
              </div>
              <div className="tape-minute"><span className="tape-minute-label">:23</span></div>
            </div>
          </div>

          <div className="tape-footer">
            <button className="btn" disabled title="mockup เท่านั้น — ยังกดใช้งานจริงไม่ได้">หยุดชั่วคราว</button>
            <button className="btn primary" disabled title="mockup เท่านั้น — ยังกดใช้งานจริงไม่ได้">ข้ามไปพัก</button>
          </div>
        </aside>

        {/* ================= RIGHT: reminder controls (large, mockup data) ================= */}
        <section className="reminder-panel">
          <div className="reminder-toolbar">
            <div>
              <h2>Reminder ทั้งหมด</h2>
              <p className="reminder-toolbar-sub">4 รายการ · 3 กำลังทำงาน</p>
            </div>
            <button className="btn primary" disabled title="mockup เท่านั้น — ยังกดใช้งานจริงไม่ได้">
              + เพิ่ม Reminder
            </button>
          </div>

          <div className="reminder-list">
            <p className="reminder-section-label">กำลังทำงาน</p>

            <div className="reminder-row active">
              <div className="reminder-freq-badge"><span className="n">1</span><span className="u">นาที</span></div>
              <div className="reminder-info">
                <p className="title">ดื่มน้ำ</p>
                <p className="meta">ทุก 1 นาที · เตือนครั้งถัดไปใน 0:18</p>
              </div>
              <button className="reminder-toggle on" disabled aria-label="ปิดการทำงาน (mockup)"></button>
              <div className="reminder-row-actions">
                <button className="icon-btn" disabled title="แก้ไข (mockup)">✎</button>
                <button className="icon-btn" disabled title="ลบ (mockup)">🗑</button>
              </div>
            </div>

            <div className="reminder-row active">
              <div className="reminder-freq-badge"><span className="n">5</span><span className="u">นาที</span></div>
              <div className="reminder-info">
                <p className="title">ยืดตัว 30 วินาที</p>
                <p className="meta">ทุก 5 นาที · เตือนครั้งถัดไปใน 2:18</p>
              </div>
              <button className="reminder-toggle on" disabled aria-label="ปิดการทำงาน (mockup)"></button>
              <div className="reminder-row-actions">
                <button className="icon-btn" disabled title="แก้ไข (mockup)">✎</button>
                <button className="icon-btn" disabled title="ลบ (mockup)">🗑</button>
              </div>
            </div>

            <div className="reminder-row active">
              <div className="reminder-freq-badge"><span className="n">20</span><span className="u">นาที</span></div>
              <div className="reminder-info">
                <p className="title">พักสายตา มองไกล 20 ฟุต</p>
                <p className="meta">ทุก 20 นาที · เตือนครั้งถัดไปใน 12:18</p>
              </div>
              <button className="reminder-toggle on" disabled aria-label="ปิดการทำงาน (mockup)"></button>
              <div className="reminder-row-actions">
                <button className="icon-btn" disabled title="แก้ไข (mockup)">✎</button>
                <button className="icon-btn" disabled title="ลบ (mockup)">🗑</button>
              </div>
            </div>

            <p className="reminder-section-label">ปิดอยู่</p>

            <div className="reminder-row">
              <div className="reminder-freq-badge"><span className="n">2</span><span className="u">ชม.</span></div>
              <div className="reminder-info">
                <p className="title">เช็คอีเมล</p>
                <p className="meta">ทุก 2 ชั่วโมง · ปิดอยู่</p>
              </div>
              <button className="reminder-toggle" disabled aria-label="เปิดการทำงาน (mockup)"></button>
              <div className="reminder-row-actions">
                <button className="icon-btn" disabled title="แก้ไข (mockup)">✎</button>
                <button className="icon-btn" disabled title="ลบ (mockup)">🗑</button>
              </div>
            </div>

            <div className="composer">
              <div>
                <label>ชื่อ Reminder</label>
                <input type="text" placeholder="เช่น ลุกยืดเส้น" disabled />
              </div>
              <div>
                <label>ความถี่</label>
                <div className="freq-row">
                  <input type="number" min="1" defaultValue={10} disabled />
                  <select disabled defaultValue="นาที">
                    <option>นาที</option>
                    <option>ชั่วโมง</option>
                  </select>
                </div>
              </div>
              <button className="btn primary" style={{ height: 38 }} disabled title="mockup เท่านั้น — ยังกดใช้งานจริงไม่ได้">
                เพิ่ม
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

import React from "react";

const items = [
  ["Start-time List", "รายการเวลาเริ่ม", "• ทำการบ้าน                 20:00\n• อ่านหนังสือ                 21:00\n• เข้านอน                     23:00"],
  ["Timeline Rail", "เส้นเวลาแนวตั้ง", "09:00   ● ประชุมทีม\n12:00   ● พักกลางวัน\n18:00   ● ออกกำลังกาย"],
  ["Color Dot List", "จุดสีหมวดหมู่", "●  ประชุมทีม                  09:00\n●  เขียนรายงาน                10:30\n●  ออกกำลังกาย                18:00"],
  ["Compact Schedule Grid", "แบ่งช่วงวัน", "เช้า     • ประชุมทีม 09:00\nบ่าย     • เขียนรายงาน 13:00\nเย็น     • ออกกำลังกาย 18:00"],
  ["Activity Density Map", "แถบความหนาแน่น", "06 ───▌────────────\n12 ──────▌▌─────────\n18 ─────────▌▌▌─────\n22 ─────────────▌───"]
];

const colors = ["#d85a30", "#4f8cc9", "#3f8a68", "#a87935", "#8957a8"];

export default function ActivityModeMiniTimelineConceptsMockup() {
  return <section className="concepts-mockup">
    <style>{`*
      { box-sizing:border-box; }
      .concepts-mockup{min-height:100%;padding:28px;background:#1c1c1a;color:#f2f1ed;font-family:system-ui,sans-serif}
      .concepts-heading{margin:0 0 6px;font-size:24px}.concepts-sub{margin:0 0 22px;color:#9c9c97;font-size:13px}
      .concepts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;max-width:980px}
      .concept-card{border:1px solid #3a3a38;border-radius:14px;background:#252523;padding:16px;min-height:170px;box-shadow:0 8px 18px #0002}
      .concept-card h3{margin:0;color:#e8703f;font-size:15px}.concept-card small{display:block;margin-top:3px;color:#9c9c97}
      .concept-art{white-space:pre-wrap;margin:18px 0 0;color:#f2f1ed;font:13px/2.2 ui-monospace,SFMono-Regular,monospace;min-height:100px}
      .concept-art::first-line{color:#d85a30}.concept-note{margin-top:20px;color:#9c9c97;font-size:12px}
      @media(max-width:560px){.concepts-mockup{padding:18px}.concepts-grid{grid-template-columns:1fr}}
    `}</style>
    <h2 className="concepts-heading">Mini Timeline Concepts</h2>
    <p className="concepts-sub">เปรียบเทียบรูปแบบการแสดงกิจกรรมทั้ง 5 แนวคิด</p>
    <div className="concepts-grid">
      {items.map(([title, subtitle, art], index) => <article className="concept-card" key={title}>
        <h3><span style={{ color: colors[index], marginRight: 7 }}>●</span>{title}</h3>
        <small>{subtitle}</small>
        <pre className="concept-art">{art}</pre>
      </article>)}
    </div>
    <p className="concept-note">ตัวอย่างนี้เป็น mockup แบบ static สำหรับเปรียบเทียบหน้าตาเท่านั้น ยังไม่เชื่อมข้อมูลจริง</p>
  </section>;
}

import React, { useState } from 'react';

export default function ReminderDashboardNewLayout() {
  const [activeTab, setActiveTab] = useState('active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* =========================================
          1. Top Bar: Global Overlay & Action Bar
         ========================================= */}
      <header style={{ backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#fff', letterSpacing: '-0.5px' }}>ReminderOS</div>
          
          {/* ใหม่: Omnibar สำหรับค้นหาหรือพิมพ์คำสั่งสร้างด่วน */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '8px', color: '#888' }}>⚡</span>
            <input 
              type="text" 
              placeholder="พิมพ์เพื่อสร้างด่วน (เช่น 'เตือนดื่มน้ำทุก 1 ชม.')" 
              style={{ width: '400px', padding: '8px 16px 8px 36px', borderRadius: '20px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', outline: 'none' }} 
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '14px' }}>📊 สถิติ</button>
          <button style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '14px' }}>⚙️ ตั้งค่า</button>
        </div>
      </header>

      {/* Due Alert Banner - แสดงแถบสีแดงเมื่อถึงเวลา (ยังคงแนวคิดเดิมแต่จัดระเบียบให้เข้ากับ Layout ใหม่) */}
      <div style={{ backgroundColor: '#ef4444', color: '#fff', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', fontWeight: '500', fontSize: '14px' }}>
        <span>🔔 <strong>ถอดปลั๊กเตารีด</strong> ครบกำหนดเมื่อ 2 นาทีที่แล้ว</span>
        <button style={{ backgroundColor: '#b91c1c', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>เตือนอีกครั้ง (10 นาที)</button>
        <button style={{ backgroundColor: 'transparent', border: '1px solid #fff', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>ทำเสร็จแล้ว</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* =========================================
            2. Left Column: Navigation & Filters
           ========================================= */}
        <aside style={{ width: '260px', backgroundColor: '#1e1e1e', borderRight: '1px solid #333', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto' }}>
          
          <div>
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '8px' }}>มุมมองหลัก</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li style={{ padding: '8px 12px', backgroundColor: '#2a2a2a', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontWeight: '500' }}>📌 ทั้งหมด</li>
              <li style={{ padding: '8px 12px', color: '#aaa', cursor: 'pointer' }}>📅 ของวันนี้</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '8px' }}>กลุ่ม / โปรเจกต์ (ใหม่)</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: '#aaa' }}>
              <li style={{ padding: '8px 12px', cursor: 'pointer' }}>💼 การทำงาน</li>
              <li style={{ padding: '8px 12px', cursor: 'pointer' }}>💪 สุขภาพ</li>
              <li style={{ padding: '8px 12px', cursor: 'pointer' }}>🏠 งานบ้าน</li>
              <li style={{ padding: '8px 12px', cursor: 'pointer', color: '#666' }}>+ เพิ่มกลุ่มใหม่</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '8px' }}>ตัวกรองประเภท</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: '#aaa' }}>
              <li style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>⏱️ Interval</span> <span style={{ color: '#555' }}>2</span></li>
              <li style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🗓️ Weekly</span> <span style={{ color: '#555' }}>5</span></li>
              <li style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>⏳ Countdown</span> <span style={{ color: '#555' }}>1</span></li>
              <li style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>⏱️ Stopwatch</span> <span style={{ color: '#555' }}>0</span></li>
              <li style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>✅ Routine</span> <span style={{ color: '#555' }}>1</span></li>
              <li style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🎯 Event-anchored</span> <span style={{ color: '#555' }}>0</span></li>
              <li style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}><span>🔔 Once-at</span> <span style={{ color: '#555' }}>3</span></li>
            </ul>
          </div>
        </aside>

        {/* =========================================
            3. Middle Column: Main Workspace
           ========================================= */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', backgroundColor: '#121212', position: 'relative' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#fff', fontWeight: 'bold' }}>จัดการการแจ้งเตือน</h1>
              <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>คุณมี 4 รายการที่กำลังทำงานอยู่</p>
            </div>
            <button style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}>
              + สร้าง Reminder ใหม่
            </button>
          </div>

          {/* ใหม่: ระบบ Tabs แยกสถานะแทนการเรียงบนลงล่าง */}
          <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '24px' }}>
            <div style={{ padding: '12px 24px', borderBottom: '2px solid #3b82f6', color: '#3b82f6', fontWeight: '500', cursor: 'pointer' }}>กำลังทำงาน (4)</div>
            <div style={{ padding: '12px 24px', color: '#888', cursor: 'pointer' }}>ปิดใช้งาน (12)</div>
            <div style={{ padding: '12px 24px', color: '#888', cursor: 'pointer' }}>ทำเสร็จแล้ว</div>
          </div>

          {/* List of Reminders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Card: Countdown */}
            <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333', borderLeft: '4px solid #eab308', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#2a2a2a', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>⏳</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', fontWeight: '500' }}>ทำสมาธิช่วงบ่าย</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#aaa' }}>
                    <span style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>Countdown</span>
                    <span>เหลือเวลาอีก <span style={{ color: '#eab308', fontFamily: 'monospace', fontSize: '14px' }}>14:32</span></span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button style={{ background: '#333', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>หยุดชั่วคราว</button>
                <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>⋮</button>
              </div>
            </div>

            {/* Card: Interval */}
            <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333', borderLeft: '4px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#2a2a2a', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>💧</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', fontWeight: '500' }}>ดื่มน้ำ (1 แก้ว)</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#aaa' }}>
                    <span style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>Interval</span>
                    <span>ทุก 1 ชั่วโมง (ถัดไป: 14:00)</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {/* Toggle Switch Mock */}
                <div style={{ width: '44px', height: '24px', backgroundColor: '#3b82f6', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', right: '2px' }}></div>
                </div>
                <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>⋮</button>
              </div>
            </div>

            {/* Card: Routine */}
            <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333', borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#2a2a2a', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>✅</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', fontWeight: '500' }}>เคลียร์โต๊ะทำงาน</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#aaa' }}>
                    <span style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>Routine</span>
                    <span>ขั้นตอน 2/5: เก็บเศษกระดาษ</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button style={{ background: '#10b981', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>ขั้นต่อไป ➔</button>
                <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>⋮</button>
              </div>
            </div>

          </div>
        </main>

        {/* =========================================
            4. Right Column: Time Visualizer
           ========================================= */}
        <aside style={{ width: '320px', backgroundColor: '#151515', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e1e' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>Timeline 24 ชม.</span>
              <span style={{ fontSize: '12px', color: '#888' }}>ซิงค์ตามเวลาจริง</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#2a2a2a', padding: '4px', borderRadius: '6px' }}>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '4px' }}>-</button>
              <button style={{ background: '#444', border: 'none', color: '#fff', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '4px' }}>+</button>
            </div>
          </div>
          
          {/* Timeline Track (จำลองภาพการทำงาน) */}
          <div style={{ flex: 1, position: 'relative', overflowY: 'hidden' }}>
             
             {/* เส้นบอกเวลาปัจจุบัน (Now Indicator) - ตรึงกลางหน้าจอเสมอ */}
             <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '2px solid #ef4444', zIndex: 10 }}>
               <div style={{ position: 'absolute', top: '-12px', left: '16px', backgroundColor: '#ef4444', color: '#fff', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>13:45</div>
             </div>
             
             {/* จำลองแถบเวลา (Time Slots) */}
             <div style={{ position: 'absolute', top: '15%', left: '20px', color: '#555', fontSize: '12px', fontFamily: 'monospace' }}>13:00</div>
             <div style={{ position: 'absolute', top: '35%', left: '20px', color: '#555', fontSize: '12px', fontFamily: 'monospace' }}>13:30</div>
             <div style={{ position: 'absolute', top: '75%', left: '20px', color: '#555', fontSize: '12px', fontFamily: 'monospace' }}>14:00</div>
             <div style={{ position: 'absolute', top: '95%', left: '20px', color: '#555', fontSize: '12px', fontFamily: 'monospace' }}>14:30</div>

             {/* จำลองเส้น Running Timer ของ Stopwatch / Countdown */}
             <div style={{ position: 'absolute', top: '25%', bottom: '50%', left: '80px', width: '6px', backgroundColor: '#eab308', borderRadius: '3px', boxShadow: '0 0 8px rgba(234, 179, 8, 0.4)' }}></div>
             <div style={{ position: 'absolute', top: '25%', left: '94px', color: '#eab308', fontSize: '11px', whiteSpace: 'nowrap' }}>ทำสมาธิ (Shrinking)</div>

             <div style={{ position: 'absolute', top: '50%', bottom: '20%', left: '110px', width: '6px', backgroundColor: '#3b82f6', borderRadius: '3px' }}></div>
             <div style={{ position: 'absolute', top: '80%', left: '124px', color: '#3b82f6', fontSize: '11px', whiteSpace: 'nowrap' }}>จับเวลาอ่านหนังสือ (Growing)</div>

             {/* จุด Marker สำหรับ Interval */}
             <div style={{ position: 'absolute', top: '75%', left: '77px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '3px solid #151515' }}></div>
             <div style={{ position: 'absolute', top: '74%', left: '94px', color: '#888', fontSize: '11px', whiteSpace: 'nowrap' }}>ดื่มน้ำ (Due)</div>

          </div>
        </aside>

      </div>
    </div>
  );
}

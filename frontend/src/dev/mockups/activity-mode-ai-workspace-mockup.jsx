import React, { useCallback, useEffect, useRef, useState } from 'react';
import './activity-mode-ai-workspace-mockup.css';

/* ======================================================================
   Mockup: AI Mode (PC) — Concept 2 "Chat + Work Rail"
   + แถบขั้นตอนจาก Concept 5 (แสดงในแผงขวาเฉพาะโหมดวางแผนกิจกรรม)

   - ใช้ข้อมูลตัวอย่างและ React state ภายในไฟล์นี้เท่านั้น
   - ไม่เรียก backend / Gemini / Firebase / Telegram / Google Calendar
   - ไม่ import component จากระบบ production
   ====================================================================== */

const cx = (...names) =>
  names
    .filter(Boolean)
    .map((n) => `ai-workspace-mockup-${n}`)
    .join(' ');

/* ---------------------------- ข้อมูลตัวอย่าง ---------------------------- */

let _id = 1;
const nid = () => _id++;

const fmt = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const NOW = 12 * 60 + 40; // เวลาจำลอง 12:40
const DAY_END = 18 * 60;

const DAYS = {
  today: {
    key: 'today',
    short: 'วันนี้',
    long: 'วันนี้ · อังคาร 27 ต.ค.',
    windowStart: 13 * 60,
    events: [
      { s: 9 * 60, e: 10 * 60, t: 'ประชุมทีมสัปดาห์' },
      { s: 12 * 60, e: 13 * 60, t: 'พักกลางวัน' },
      { s: 15 * 60, e: 16 * 60 + 30, t: 'รีวิวโค้ดกับทีม' },
    ],
  },
  tomorrow: {
    key: 'tomorrow',
    short: 'พรุ่งนี้',
    long: 'พรุ่งนี้ · พุธ 28 ต.ค.',
    windowStart: 8 * 60,
    events: [
      { s: 10 * 60, e: 11 * 60 + 30, t: 'นัดลูกค้า' },
      { s: 14 * 60, e: 15 * 60, t: 'เตรียมสไลด์นำเสนอ' },
    ],
  },
};

const DURS = [
  { m: 30, l: '30 นาที' },
  { m: 60, l: '1 ชั่วโมง' },
  { m: 90, l: '1 ชั่วโมงครึ่ง' },
  { m: 240, l: '4 ชั่วโมง' },
];
const durLabel = (m) => (DURS.find((d) => d.m === m) || { l: `${m} นาที` }).l;

const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => 8 * 60 + i * 30);

function findSlots(dur) {
  const out = [];
  Object.values(DAYS).forEach((day) => {
    let cursor = day.windowStart;
    const evs = [...day.events].sort((a, b) => a.s - b.s);
    evs.forEach((e) => {
      if (e.e <= cursor) return;
      if (e.s - cursor >= dur) out.push({ day: day.key, start: cursor });
      cursor = Math.max(cursor, e.e);
    });
    if (DAY_END - cursor >= dur) out.push({ day: day.key, start: cursor });
  });
  return out.slice(0, 5).map((s, i) => ({
    ...s,
    id: `slot-${dur}-${i}`,
    end: s.start + dur,
  }));
}

const slotLabel = (s) => `${DAYS[s.day].short} ${fmt(s.start)}–${fmt(s.end)}`;

function conflictsOf(d) {
  return DAYS[d.day].events.filter(
    (e) => d.start < e.e && d.start + d.duration > e.s,
  );
}

const PRESETS = [
  {
    id: 'p1',
    q: 'T.i.M.E.S. ทำอะไรได้บ้าง',
    source: 'คำตอบสำเร็จรูป',
    a: 'T.i.M.E.S. ช่วยดูและจัดการตารางกิจกรรมของคุณ\n• ดูตารางวันนี้และพรุ่งนี้\n• ค้นหาช่วงเวลาว่าง\n• ร่างกิจกรรมให้ตรวจก่อนบันทึก\n(ข้อความตัวอย่างของ mockup)',
  },
  {
    id: 'p2',
    q: 'กฎเวลาชนกันทำงานอย่างไร',
    source: 'ข้อมูล/กฎในเว็บ',
    a: 'ถ้ากิจกรรมใหม่ซ้อนกับกิจกรรมเดิม ระบบจะแสดงคำเตือนก่อนบันทึก ให้คุณเลือกแก้เวลา หรือรับทราบแล้วยืนยันเอง (ข้อความตัวอย่างของ mockup)',
  },
  {
    id: 'p3',
    q: 'ข้อความ Telegram อยู่ตรงไหน',
    source: 'ข้อมูล/กฎในเว็บ',
    a: 'สำเนาข้อความ Telegram อยู่ในส่วนพับได้ท้ายแผงงานด้านขวา แยกจากแชท AI และไม่ถูกล้างเมื่อเริ่มแชท AI ใหม่ (ข้อความตัวอย่างของ mockup)',
  },
  {
    id: 'p4',
    q: 'ข่าวหรืออากาศวันนี้',
    source: 'ข้อมูล/กฎในเว็บ',
    unsupported: true,
    a: 'ตอนนี้ AI Mode ยังไม่มีเครื่องมือข่าวหรืออากาศสด จึงตอบเรื่องนี้ไม่ได้ ลองใช้ “ดูตาราง” หรือ “หาเวลาว่าง” แทน',
  },
];

const TOOLS = [
  { id: 'schedule', icon: 'calendar', name: 'ดูตาราง', desc: 'ดูกิจกรรมของวันนี้หรือพรุ่งนี้', ai: true },
  { id: 'summary', icon: 'spark', name: 'สรุปวันนี้', desc: 'สรุปสิ่งที่เหลือของวันนี้', ai: true },
  { id: 'find', icon: 'clock', name: 'หาเวลาว่าง', desc: 'ค้นหาช่วงว่างตามระยะเวลา', ai: true },
  { id: 'create', icon: 'plus', name: 'สร้างกิจกรรม', desc: 'ร่าง ตรวจ แล้วค่อยยืนยัน', ai: true },
  { id: 'presets', icon: 'list', name: 'คำถามสำเร็จรูป', desc: 'คำตอบที่ไม่ใช้โควต้า AI', ai: false },
];

const TG_MESSAGES = [
  { t: '07:30', from: 'ระบบเตือน', text: 'เช้านี้มี 3 กิจกรรม เริ่มต้นด้วยประชุมทีมสัปดาห์ 09:00' },
  { t: '08:05', from: 'ระบบเตือน', text: 'อีก 55 นาที: ประชุมทีมสัปดาห์' },
  { t: '11:45', from: 'ระบบเตือน', text: 'พักกลางวัน 12:00–13:00' },
  { t: 'เมื่อวาน 18:20', from: 'คุณ', text: 'พรุ่งนี้ช่วยเตือนเรื่องนัดลูกค้าด้วย' },
  { t: 'เมื่อวาน 18:20', from: 'ระบบเตือน', text: 'รับทราบ จะเตือนก่อนนัดลูกค้า 30 นาที' },
  { t: 'เมื่อวาน 15:00', from: 'ระบบเตือน', text: 'ส่งสรุปกิจกรรมประจำวันเรียบร้อย' },
  { t: 'เมื่อวาน 09:00', from: 'ระบบเตือน', text: 'ถึงเวลา: ทบทวนงานประจำสัปดาห์' },
  { t: 'เมื่อวาน 08:30', from: 'ระบบเตือน', text: 'อีก 30 นาที: ทบทวนงานประจำสัปดาห์' },
];

const WELCOME =
  'สวัสดี ฉันคือ MR.Zettascale ผู้ช่วยในหน้านี้\n• “คุยอิสระ” ถามเรื่องทั่วไปกับ AI (ตอนนี้จำกัดสิทธิ์สำหรับนักพัฒนา)\n• “วางแผนกิจกรรม” ให้ฉันช่วยร่างกิจกรรม ทุกกิจกรรมจะรอให้คุณตรวจและยืนยันก่อนเสมอ\nตอนนี้ฉันยังดูข่าวหรืออากาศสดไม่ได้';

const LONG_ANSWER =
  'ได้เลย นี่คือแนวทางจัดลำดับความสำคัญของงานทั้งสัปดาห์แบบละเอียด (คำตอบจำลอง)\n\n1) แยกงานเป็น 3 กลุ่ม\n• งานที่มีกำหนดส่งชัดเจน เช่น รายงานที่ต้องส่งวันศุกร์\n• งานที่ต้องใช้สมาธิยาว เช่น เตรียมสไลด์นำเสนอ\n• งานเล็กที่จบได้เร็ว เช่น ตอบอีเมล เก็บเอกสาร\n\n2) วางงานใหญ่ในช่วงที่พลังงานดีที่สุด\nส่วนใหญ่ช่วงเช้าเหมาะกับงานที่ใช้สมาธิ ส่วนช่วงบ่ายเหมาะกับประชุมและงานประสานงาน ลองกันช่วงเช้า 2 ชั่วโมงไว้สำหรับงานใหญ่อย่างน้อยวันละครั้ง\n\n3) เผื่อเวลาเหลื่อม\nทุกกิจกรรมที่ยาวเกิน 1 ชั่วโมงควรเว้นอย่างน้อย 15 นาทีก่อนกิจกรรมถัดไป เพื่อไม่ให้เวลาชนกันเมื่อบางงานเลยเวลา\n\n4) ทบทวนสั้นๆ ตอนท้ายวัน\nใช้เวลา 5 นาทีดูว่างานไหนเสร็จ งานไหนต้องเลื่อน แล้วย้ายไปวันถัดไปทันที จะช่วยให้เช้าวันต่อมาเริ่มได้เลย\n\n5) ใช้เครื่องมือช่วย\nถ้าอยากรู้ว่าสัปดาห์นี้ว่างตรงไหน เปิดเครื่องมือ “หาเวลาว่าง” แล้วเลือกช่วงที่สะดวก จากนั้นให้ฉันร่างกิจกรรมให้ตรวจก่อนบันทึก';

const SRC_CLASS = {
  AI: 'src-ai',
  'ข้อมูล/กฎในเว็บ': 'src-rule',
  คำตอบสำเร็จรูป: 'src-preset',
  'AI · ปฏิทิน': 'src-cal',
};

const STEPS = ['ถาม', 'เลือกเวลา', 'ร่าง', 'ตรวจ', 'ยืนยัน'];
const STAGE_STEP = { title: 0, duration: 0, time: 1, review: 3, done: 5 };

const SCENARIOS = [
  { key: 'start', label: '1 · หน้าเริ่มต้น' },
  { key: 'conversation', label: '2 · บทสนทนาหลายข้อความ' },
  { key: 'waiting', label: '3 · กำลังรอ AI' },
  { key: 'long', label: '4 · คำตอบยาว' },
  { key: 'tools', label: '5 · เครื่องมือเปิดอยู่' },
  { key: 'draft', label: '6 · ร่างกิจกรรมรอตรวจ' },
  { key: 'noslots', label: '7 · ไม่พบช่วงเวลาว่าง' },
  { key: 'error', label: '8 · ข้อผิดพลาด' },
  { key: 'quota', label: '9 · โควต้า AI หมด' },
  { key: 'noaccess', label: '10 · ยังไม่มีสิทธิ์ใช้ AI' },
];

/* ------------------------------- ไอคอน ------------------------------- */

const ICONS = {
  back: <path d="M15 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  tools: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5 9-10" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  refresh: <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" />,
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  edit: <path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4" />,
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </>
  ),
  telegram: <path d="M21 4L3 11l6 2 2 6 3-4 5 4z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
};

function Icon({ name, size = 18 }) {
  return (
    <svg
      className={cx('icon')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* --------------------------- ส่วนประกอบย่อย --------------------------- */

function SourceTag({ source }) {
  return (
    <span className={cx('src', SRC_CLASS[source])}>
      <span className={cx('src-dot')} aria-hidden="true" />
      {source}
    </span>
  );
}

function RichText({ text }) {
  return text.split('\n').map((line, i) => {
    if (line === '') return <div key={i} className={cx('gap')} />;
    if (line.startsWith('• ')) {
      return (
        <div key={i} className={cx('li')}>
          <span aria-hidden="true">•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    return (
      <p key={i} className={cx('p')}>
        {line}
      </p>
    );
  });
}

function Stepper({ current }) {
  return (
    <ol className={cx('steps')} aria-label="ขั้นตอนสร้างกิจกรรม">
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={cx('step', i < current && 'step--done', i === current && 'step--current')}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className={cx('step-dot')}>
            {i < current ? <Icon name="check" size={12} /> : i + 1}
          </span>
          <span className={cx('step-label')}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function ScheduleCard({ dayKey }) {
  const day = DAYS[dayKey];
  return (
    <div className={cx('card')}>
      <div className={cx('card-title')}>
        <Icon name="calendar" size={16} /> ตาราง{day.long}
      </div>
      <ul className={cx('events')}>
        {day.events.map((e) => {
          const state = dayKey === 'today' ? (e.e <= NOW ? 'past' : e.s <= NOW ? 'now' : 'next') : 'next';
          return (
            <li key={e.t} className={cx('event', `event--${state}`)}>
              <span className={cx('event-time')}>
                {fmt(e.s)}–{fmt(e.e)}
              </span>
              <span className={cx('event-title')}>{e.t}</span>
              {state === 'past' && <em className={cx('event-flag')}>ผ่านแล้ว</em>}
              {state === 'now' && <em className={cx('event-flag')}>กำลังดำเนินอยู่</em>}
            </li>
          );
        })}
      </ul>
      <div className={cx('card-note')}>ข้อมูลจากปฏิทินตัวอย่างใน mockup ไม่ใช่ข้อมูลจริง</div>
    </div>
  );
}

function QuestionCard({ card, onAnswer }) {
  const answered = card.answered !== undefined && card.answered !== null;
  return (
    <div className={cx('chips')} role="group" aria-label="ตัวเลือกคำตอบ">
      {card.options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          disabled={answered}
          className={cx('chip', answered && card.answered === o.v && 'chip--on')}
          onClick={() => onAnswer(o)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function SlotsCard({ card, onPick, onCreate }) {
  const picked = card.slots.find((s) => s.id === card.picked);
  const locked = card.context === 'create' && card.picked;
  return (
    <div className={cx('card')}>
      <div className={cx('card-title')}>
        <Icon name="clock" size={16} /> ช่วงว่างยาว {durLabel(card.dur)}
      </div>
      <div className={cx('slots')} role="group" aria-label="เลือกช่วงเวลา">
        {card.slots.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={locked}
            className={cx('slot', card.picked === s.id && 'slot--on')}
            aria-pressed={card.picked === s.id}
            onClick={() => onPick(s)}
          >
            <span className={cx('slot-day')}>{DAYS[s.day].short}</span>
            <span className={cx('slot-time')}>
              {fmt(s.start)}–{fmt(s.end)}
            </span>
          </button>
        ))}
      </div>
      {card.context === 'find' && (
        <div className={cx('card-foot')}>
          {picked ? (
            <>
              <span>
                เลือกแล้ว: <strong>{slotLabel(picked)}</strong>
              </span>
              <button type="button" className={cx('btn', 'btn--primary', 'btn--sm')} onClick={() => onCreate(picked)}>
                สร้างกิจกรรมในช่วงนี้
              </button>
            </>
          ) : (
            <span className={cx('muted')}>เลือกหนึ่งช่วงเพื่อสร้างกิจกรรม (ยังไม่มีอะไรถูกบันทึก)</span>
          )}
        </div>
      )}
      <div className={cx('card-note')}>คำนวณจากปฏิทินตัวอย่างใน mockup</div>
    </div>
  );
}

function NoSlotsCard({ card, onShorter, onAgain }) {
  return (
    <div className={cx('card', 'card--warn')} role="status">
      <div className={cx('card-title')}>
        <Icon name="alert" size={16} /> ไม่พบช่วงเวลาว่างยาว {durLabel(card.dur)}
      </div>
      <p className={cx('p')}>ใน 2 วันนี้ (วันนี้–พรุ่งนี้) ไม่มีช่วงว่างต่อเนื่องที่ยาวพอ ลองลดระยะเวลาลง หรือแบ่งกิจกรรมเป็นหลายช่วง</p>
      <div className={cx('row')}>
        <button type="button" className={cx('btn', 'btn--primary', 'btn--sm')} onClick={onShorter}>
          ลองลดเหลือ 1 ชั่วโมงครึ่ง
        </button>
        {card.context === 'create' && (
          <button type="button" className={cx('btn', 'btn--sm')} onClick={onAgain}>
            เลือกระยะเวลาใหม่
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ card, onRetry, onDismiss }) {
  return (
    <div className={cx('card', 'card--danger')} role="alert">
      <div className={cx('card-title')}>
        <Icon name="alert" size={16} /> เชื่อมต่อ AI ไม่สำเร็จ
      </div>
      <p className={cx('p')}>ข้อความของคุณยังอยู่ ไม่ได้หายไป ลองส่งใหม่ได้ หรือใช้ “คำถามสำเร็จรูป” ที่ไม่ต้องใช้ AI ระหว่างรอ</p>
      <div className={cx('row')}>
        <button type="button" className={cx('btn', 'btn--primary', 'btn--sm')} onClick={onRetry}>
          <Icon name="refresh" size={14} /> ลองส่งใหม่
        </button>
        <button type="button" className={cx('btn', 'btn--sm')} onClick={onDismiss}>
          ปิดข้อความนี้
        </button>
      </div>
      <div className={cx('card-note')}>รหัสตัวอย่าง: AI-503 (จำลอง)</div>
    </div>
  );
}

function DraftCard({ draft, editing, onEdit, onCancel, onConfirm, onAck }) {
  if (!draft) return null;
  const conflicts = conflictsOf(draft);
  const end = draft.start + draft.duration;
  const closed = draft.status !== 'pending';
  const needAck = conflicts.length > 0 && !draft.ack;
  return (
    <div className={cx('card', 'draft', closed && `draft--${draft.status}`)}>
      <div className={cx('draft-head')}>
        <span className={cx('card-title')}>
          <Icon name="edit" size={16} /> ร่างกิจกรรม
        </span>
        <span className={cx('badge', draft.status === 'pending' && 'badge--warn', draft.status === 'submitted' && 'badge--ok')}>
          {draft.status === 'pending' && 'ร่าง · ยังไม่บันทึก'}
          {draft.status === 'submitted' && 'ส่งเข้าขั้นตอนตรวจบันทึกแล้ว'}
          {draft.status === 'cancelled' && 'ยกเลิกแล้ว'}
        </span>
      </div>
      <dl className={cx('draft-grid')}>
        <dt>ชื่อ</dt>
        <dd>{draft.title}</dd>
        <dt>วัน</dt>
        <dd>{DAYS[draft.day].long}</dd>
        <dt>เวลา</dt>
        <dd>
          {fmt(draft.start)}–{fmt(end)}
        </dd>
        <dt>ระยะเวลา</dt>
        <dd>{durLabel(draft.duration)}</dd>
      </dl>
      {conflicts.length > 0 && !closed && (
        <div className={cx('conflict')} role="alert">
          <Icon name="alert" size={16} />
          <div>
            <strong>เวลาชนกับกิจกรรมเดิม</strong>
            <div>
              {conflicts.map((c) => `${c.t} (${fmt(c.s)}–${fmt(c.e)})`).join(', ')}
            </div>
            <label className={cx('check')}>
              <input type="checkbox" checked={draft.ack} onChange={(e) => onAck(e.target.checked)} />
              รับทราบ และยืนยันทั้งที่เวลาชน
            </label>
          </div>
        </div>
      )}
      {!closed && (
        <div className={cx('row', 'row--end')}>
          <button type="button" className={cx('btn', 'btn--ghost', 'btn--sm')} onClick={onCancel}>
            ยกเลิกร่าง
          </button>
          <button type="button" className={cx('btn', 'btn--sm', editing && 'btn--on')} onClick={onEdit}>
            <Icon name="edit" size={14} /> {editing ? 'กำลังแก้ไขที่แผงขวา' : 'แก้ไข'}
          </button>
          <button type="button" className={cx('btn', 'btn--primary', 'btn--sm')} disabled={needAck} onClick={onConfirm}>
            ยืนยัน · ส่งตรวจบันทึก
          </button>
        </div>
      )}
      {!closed && <div className={cx('card-note')}>การกดยืนยันจะส่งเข้าขั้นตอนตรวจบันทึกก่อน ยังไม่สร้างรายการในปฏิทินทันที</div>}
    </div>
  );
}

function Message({ m, children }) {
  const [open, setOpen] = useState(false);
  if (m.role === 'sys') {
    return (
      <div className={cx('sys')} role="status">
        {m.text}
      </div>
    );
  }
  if (m.role === 'user') {
    return (
      <div className={cx('msg', 'msg--user')}>
        <div className={cx('bubble', 'bubble--user')}>
          <RichText text={m.text} />
        </div>
      </div>
    );
  }
  const long = m.text && m.text.length > 520;
  return (
    <div className={cx('msg')}>
      <div className={cx('avatar')} aria-hidden="true">
        Z
      </div>
      <div className={cx('bubble-col')}>
        <div className={cx('msg-meta')}>
          <span className={cx('msg-name')}>MR.Zettascale</span>
          {m.source && <SourceTag source={m.source} />}
        </div>
        <div className={cx('bubble', 'bubble--ai')}>
          {m.text && (
            <div className={cx(long && !open && 'clamp')}>
              <RichText text={m.text} />
            </div>
          )}
          {long && (
            <button type="button" className={cx('link')} onClick={() => setOpen((v) => !v)}>
              {open ? 'ย่อคำตอบ' : 'แสดงคำตอบทั้งหมด'}
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ ตัวหลัก ------------------------------ */

function buildScenario(key) {
  const mk = (m) => ({ id: nid(), ...m });
  const welcome = () => mk({ role: 'ai', source: 'คำตอบสำเร็จรูป', text: WELCOME });
  const base = {
    messages: [],
    mode: 'free',
    flow: null,
    drafts: {},
    railOpen: true,
    railView: 'idle',
    thinking: false,
    access: 'ok',
    quotaLeft: 12,
    editingId: null,
    waitingReply: null,
  };
  const w = welcome();

  if (key === 'conversation' || key === 'quota') {
    const msgs = [
      w,
      mk({ role: 'user', text: 'สัปดาห์นี้ควรเริ่มจากงานไหนก่อนดี มีทั้งรายงาน ประชุม และเตรียมสไลด์' }),
      mk({
        role: 'ai',
        source: 'AI',
        text: 'แนะนำให้เริ่มจากงานที่มีกำหนดส่งใกล้ที่สุดก่อน คือรายงาน แล้วกันช่วงเช้าไว้สำหรับสไลด์ ส่วนประชุมให้จัดในช่วงบ่าย (คำตอบจำลอง)',
      }),
    ];
    if (key === 'quota') return { ...base, messages: msgs, quotaLeft: 0 };
    return {
      ...base,
      messages: [
        ...msgs,
        mk({ role: 'user', text: 'ดูตารางวันนี้', viaTool: true }),
        mk({ role: 'ai', source: 'AI · ปฏิทิน', text: 'นี่คือตารางของวันนี้ มี 1 กิจกรรมที่กำลังดำเนินอยู่ และ 1 กิจกรรมที่ยังไม่ถึง', card: { kind: 'schedule', day: 'today' } }),
        mk({ role: 'user', text: 'T.i.M.E.S. จัดการเวลาชนกันอย่างไร' }),
        mk({ role: 'ai', source: 'ข้อมูล/กฎในเว็บ', text: PRESETS[1].a }),
      ],
    };
  }
  if (key === 'waiting') {
    return {
      ...base,
      messages: [w, mk({ role: 'user', text: 'ช่วยสรุปวิธีจัดลำดับความสำคัญของงานหน่อย' })],
      thinking: true,
      waitingReply: { role: 'ai', source: 'AI', text: LONG_ANSWER },
    };
  }
  if (key === 'long') {
    return {
      ...base,
      messages: [w, mk({ role: 'user', text: 'ช่วยอธิบายวิธีจัดลำดับความสำคัญของงานทั้งสัปดาห์แบบละเอียด' }), mk({ role: 'ai', source: 'AI', text: LONG_ANSWER })],
    };
  }
  if (key === 'tools') return { ...base, messages: [w], railView: 'tools' };
  if (key === 'draft') {
    const draftId = nid();
    return {
      ...base,
      mode: 'plan',
      flow: { stage: 'review', title: 'จัดระเบียบเอกสารโปรเจกต์', duration: 90 },
      railView: 'flow',
      drafts: {
        [draftId]: { id: draftId, title: 'จัดระเบียบเอกสารโปรเจกต์', day: 'tomorrow', start: 11 * 60 + 30, duration: 90, status: 'pending', ack: false },
      },
      messages: [
        w,
        mk({ role: 'user', text: 'สร้างกิจกรรม จัดระเบียบเอกสารโปรเจกต์ 1 ชั่วโมงครึ่ง' }),
        mk({ role: 'ai', source: 'AI · ปฏิทิน', text: 'ร่างกิจกรรมพร้อมแล้ว ตรวจชื่อ วัน เวลา และระยะเวลา ก่อนกดยืนยัน — ยังไม่มีอะไรถูกบันทึกลงปฏิทิน', card: { kind: 'draft', draftId } }),
      ],
    };
  }
  if (key === 'noslots') {
    return {
      ...base,
      messages: [w, mk({ role: 'user', text: 'หาเวลาว่างยาว 4 ชั่วโมง', viaTool: true }), mk({ role: 'ai', source: 'AI · ปฏิทิน', text: 'ฉันตรวจตารางวันนี้และพรุ่งนี้แล้ว', card: { kind: 'noslots', dur: 240, context: 'find' } })],
    };
  }
  if (key === 'error') {
    return {
      ...base,
      messages: [w, mk({ role: 'user', text: 'ช่วยสรุปวิธีจัดลำดับความสำคัญของงานหน่อย' }), mk({ role: 'ai', source: 'AI', text: '', card: { kind: 'error' } })],
    };
  }
  if (key === 'noaccess') return { ...base, messages: [w], access: 'noaccess' };
  return { ...base, messages: [w] };
}

export default function AiWorkspaceMockup() {
  const [init] = useState(() => buildScenario('start'));
  const [scenario, setScenario] = useState('start');
  const [messages, setMessages] = useState(init.messages);
  const [mode, setMode] = useState(init.mode);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(init.thinking);
  const [access, setAccess] = useState(init.access);
  const [quotaLeft, setQuotaLeft] = useState(init.quotaLeft);
  const [flow, setFlow] = useState(init.flow);
  const [drafts, setDrafts] = useState(init.drafts);
  const [editingId, setEditingId] = useState(init.editingId);
  const [railOpen, setRailOpen] = useState(init.railOpen);
  const [railView, setRailView] = useState(init.railView);
  const [findDur, setFindDur] = useState(60);
  const [scheduleDay, setScheduleDay] = useState('today');
  const [tgOpen, setTgOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [toast, setToast] = useState('');

  const replyTimer = useRef(null);
  const toastTimer = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  const blocked = access === 'noaccess' || quotaLeft <= 0;
  const blockReason =
    access === 'noaccess'
      ? 'บัญชีนี้ยังไม่มีสิทธิ์ใช้ AI — “คุยอิสระ” เปิดเฉพาะนักพัฒนาในตอนนี้'
      : 'โควต้า AI วันนี้หมดแล้ว — โควต้าจะกลับมาพรุ่งนี้';

  /* ---------- พื้นฐาน ---------- */

  const pushMsg = useCallback((m) => {
    const id = nid();
    setMessages((ms) => [...ms, { id, ...m }]);
    return id;
  }, []);

  const updateCard = useCallback((id, patch) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, card: { ...m.card, ...patch } } : m)));
  }, []);

  const aiReply = useCallback(
    (msg, delay = 1100) => {
      setThinking(true);
      clearTimeout(replyTimer.current);
      replyTimer.current = setTimeout(() => {
        setThinking(false);
        pushMsg(msg);
      }, delay);
    },
    [pushMsg],
  );

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3400);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(replyTimer.current);
      clearTimeout(toastTimer.current);
    },
    [],
  );

  // เลื่อนไปท้ายแชทเมื่อมีข้อความใหม่
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, thinking]);

  // สถานะ "กำลังรอ AI" ในสถานะตัวอย่าง จะตอบเองหลังรอสักพัก
  const loadScenario = useCallback(
    (key) => {
      clearTimeout(replyTimer.current);
      const s = buildScenario(key);
      setScenario(key);
      setMessages(s.messages);
      setMode(s.mode);
      setFlow(s.flow);
      setDrafts(s.drafts);
      setEditingId(s.editingId);
      setRailOpen(s.railOpen);
      setRailView(s.railView);
      setThinking(s.thinking);
      setAccess(s.access);
      setQuotaLeft(s.quotaLeft);
      setInput('');
      setConfirmNew(false);
      setTgOpen(false);
      if (s.waitingReply) {
        replyTimer.current = setTimeout(() => {
          setThinking(false);
          pushMsg(s.waitingReply);
        }, 9000);
      }
    },
    [pushMsg],
  );

  /* ---------- เครื่องมือ ---------- */

  const runSchedule = (dayKey) => {
    pushMsg({ role: 'user', text: `ดูตาราง${DAYS[dayKey].short}`, viaTool: true });
    aiReply(
      {
        role: 'ai',
        source: 'AI · ปฏิทิน',
        text: `นี่คือตารางของ${DAYS[dayKey].short} มี ${DAYS[dayKey].events.length} กิจกรรม`,
        card: { kind: 'schedule', day: dayKey },
      },
      800,
    );
    setRailView('idle');
  };

  const runSummary = () => {
    pushMsg({ role: 'user', text: 'สรุปวันนี้', viaTool: true });
    const upcoming = DAYS.today.events.filter((e) => e.e > NOW);
    const next = upcoming.find((e) => e.s > NOW);
    const free = findSlots(30).filter((s) => s.day === 'today');
    aiReply(
      {
        role: 'ai',
        source: 'AI · ปฏิทิน',
        text: `วันนี้เหลืออีก ${upcoming.length} กิจกรรม\n• ตอนนี้: พักกลางวัน (จบ 13:00)\n• ถัดไป: ${next ? `${next.t} ${fmt(next.s)}–${fmt(next.e)}` : 'ไม่มี'}\n• ช่วงว่างหลังจากนี้: ${free.map((s) => `${fmt(s.start)}`).join(' และ ')} เป็นต้นไป\n(คำนวณจากปฏิทินตัวอย่างใน mockup)`,
      },
      900,
    );
    setRailView('idle');
  };

  const runFind = (dur) => {
    pushMsg({ role: 'user', text: `หาเวลาว่างยาว ${durLabel(dur)}`, viaTool: true });
    const slots = findSlots(dur);
    if (!slots.length) {
      aiReply({ role: 'ai', source: 'AI · ปฏิทิน', text: 'ฉันตรวจตารางวันนี้และพรุ่งนี้แล้ว', card: { kind: 'noslots', dur, context: 'find' } }, 900);
    } else {
      aiReply(
        {
          role: 'ai',
          source: 'AI · ปฏิทิน',
          text: `เจอ ${slots.length} ช่วงว่างยาว ${durLabel(dur)} ใน 2 วันนี้ เลือกหนึ่งช่วงเพื่อใช้สร้างกิจกรรมได้`,
          card: { kind: 'slots', slots, dur, context: 'find', picked: null },
        },
        900,
      );
    }
    setRailView('idle');
  };

  const runPreset = (p) => {
    pushMsg({ role: 'user', text: p.q, viaTool: true });
    aiReply({ role: 'ai', source: p.source, text: p.a }, 450);
    setRailView('idle');
  };

  /* ---------- สร้างกิจกรรม (ต้องตรวจและยืนยันก่อนเสมอ) ---------- */

  const startCreate = (slot = null) => {
    setMode('plan');
    setRailOpen(true);
    setRailView('flow');
    setFlow({ stage: 'title', slot });
    pushMsg({ role: 'user', text: slot ? `สร้างกิจกรรมในช่วง ${slotLabel(slot)}` : 'สร้างกิจกรรม', viaTool: true });
    aiReply(
      {
        role: 'ai',
        source: 'AI · ปฏิทิน',
        text: slot ? `ตั้งชื่อกิจกรรมสำหรับช่วง ${slotLabel(slot)} ว่าอะไรดี? พิมพ์ในช่องด้านล่าง หรือเลือกตัวอย่าง` : 'อยากเพิ่มกิจกรรมอะไร? พิมพ์ชื่อในช่องด้านล่าง หรือเลือกตัวอย่าง',
        card: {
          kind: 'question',
          qid: 'title',
          options: ['อ่านหนังสือ', 'ออกกำลังกาย', 'ทบทวนงานประจำสัปดาห์'].map((t) => ({ v: t, l: t })),
          answered: null,
        },
      },
      600,
    );
  };

  const makeDraft = (title, slot, duration) => {
    const id = nid();
    setDrafts((d) => ({ ...d, [id]: { id, title, day: slot.day, start: slot.start, duration, status: 'pending', ack: false } }));
    setFlow({ stage: 'review', title, duration, slot: null });
    setRailView('flow');
    aiReply(
      {
        role: 'ai',
        source: 'AI · ปฏิทิน',
        text: 'ร่างกิจกรรมพร้อมแล้ว ตรวจชื่อ วัน เวลา และระยะเวลา ก่อนกดยืนยัน — ยังไม่มีอะไรถูกบันทึกลงปฏิทิน',
        card: { kind: 'draft', draftId: id },
      },
      800,
    );
  };

  const askDuration = (title) => {
    aiReply(
      {
        role: 'ai',
        source: 'AI · ปฏิทิน',
        text: `“${title}” ใช้เวลานานแค่ไหน?`,
        card: { kind: 'question', qid: 'duration', options: DURS.map((d) => ({ v: d.m, l: d.l })), answered: null },
      },
      650,
    );
  };

  const handleTitle = (title) => {
    if (flow && flow.slot) {
      makeDraft(title, flow.slot, flow.slot.end - flow.slot.start);
      return;
    }
    setFlow({ stage: 'duration', title, slot: null });
    askDuration(title);
  };

  const handleDuration = (m, title) => {
    const slots = findSlots(m);
    const t = title || (flow && flow.title) || 'กิจกรรมใหม่';
    if (!slots.length) {
      setFlow({ stage: 'duration', title: t, duration: m, slot: null });
      aiReply({ role: 'ai', source: 'AI · ปฏิทิน', text: 'ฉันตรวจตารางวันนี้และพรุ่งนี้แล้ว', card: { kind: 'noslots', dur: m, context: 'create' } }, 900);
      return;
    }
    setFlow({ stage: 'time', title: t, duration: m, slot: null });
    aiReply(
      {
        role: 'ai',
        source: 'AI · ปฏิทิน',
        text: `เจอ ${slots.length} ช่วงว่างยาว ${durLabel(m)} เลือกช่วงที่สะดวกได้เลย`,
        card: { kind: 'slots', slots, dur: m, context: 'create', picked: null },
      },
      900,
    );
  };

  const answerQuestion = (m, opt) => {
    updateCard(m.id, { answered: opt.v });
    pushMsg({ role: 'user', text: opt.l });
    if (m.card.qid === 'title') handleTitle(opt.v);
    else if (m.card.qid === 'duration') handleDuration(opt.v);
  };

  const pickSlot = (m, slot) => {
    updateCard(m.id, { picked: slot.id });
    if (m.card.context === 'create') {
      pushMsg({ role: 'user', text: `เลือก ${slotLabel(slot)}` });
      makeDraft((flow && flow.title) || 'กิจกรรมใหม่', slot, m.card.dur);
    }
  };

  const noSlotsShorter = (m) => {
    pushMsg({ role: 'user', text: 'ลดเหลือ 1 ชั่วโมงครึ่ง' });
    if (m.card.context === 'create') handleDuration(90);
    else runFind(90);
  };

  const noSlotsAgain = () => {
    askDuration((flow && flow.title) || 'กิจกรรมใหม่');
  };

  const updateDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const editDraft = (id) => {
    setEditingId(id);
    setRailOpen(true);
    setRailView('draftEdit');
  };

  const cancelDraft = (id) => {
    updateDraft(id, { status: 'cancelled' });
    setEditingId(null);
    setFlow(null);
    setRailView('flow');
    pushMsg({ role: 'sys', text: 'ยกเลิกร่างกิจกรรมแล้ว ไม่มีอะไรถูกบันทึก' });
  };

  const confirmDraft = (id) => {
    const d = drafts[id];
    if (!d) return;
    if (conflictsOf(d).length && !d.ack) return;
    updateDraft(id, { status: 'submitted' });
    setEditingId(null);
    setFlow((f) => ({ ...(f || {}), stage: 'done' }));
    setRailView('flow');
    aiReply(
      {
        role: 'ai',
        source: 'AI · ปฏิทิน',
        text: `ส่ง “${d.title}” (${DAYS[d.day].short} ${fmt(d.start)}–${fmt(d.start + d.duration)}) เข้าขั้นตอนตรวจบันทึกแล้ว\nนี่เป็นการจำลอง — ยังไม่มีรายการถูกสร้างในปฏิทินจริง`,
      },
      700,
    );
  };

  /* ---------- ส่งข้อความ ---------- */

  const send = () => {
    const text = input.trim();
    if (!text || thinking || blocked) return;
    pushMsg({ role: 'user', text });
    setInput('');

    if (mode === 'free') {
      setQuotaLeft((q) => Math.max(0, q - 1));
      if (/ข่าว|อากาศ|ฝน|พยากรณ์/.test(text)) {
        aiReply({ role: 'ai', source: 'ข้อมูล/กฎในเว็บ', text: PRESETS[3].a }, 700);
      } else {
        const short = text.length > 28 ? `${text.slice(0, 28)}…` : text;
        aiReply(
          {
            role: 'ai',
            source: 'AI',
            text: `ตัวอย่างคำตอบจาก AI (จำลอง) เรื่อง “${short}”\n• เริ่มจากสิ่งที่มีกำหนดเวลาชัดเจนก่อน\n• แบ่งงานใหญ่เป็นชิ้นละไม่เกิน 1–2 ชั่วโมง\n• เว้นช่วงพักระหว่างงาน\nถ้าอยากลงตารางจริง เปิดเครื่องมือ “หาเวลาว่าง” ได้เลย`,
          },
          1500,
        );
      }
      return;
    }

    // โหมดวางแผนกิจกรรม
    const stage = flow && flow.stage;
    if (!stage || stage === 'title' || stage === 'done') {
      setRailView('flow');
      const title = text.length > 48 ? text.slice(0, 48) : text;
      if (stage === 'title' && flow.slot) handleTitle(title);
      else {
        setFlow({ stage: 'duration', title, slot: null });
        askDuration(title);
      }
    } else {
      aiReply({ role: 'ai', source: 'AI · ปฏิทิน', text: stage === 'review' ? 'ตอนนี้มีร่างรอตรวจอยู่ ใช้ปุ่ม “แก้ไข” “ยกเลิกร่าง” หรือ “ยืนยัน” ที่การ์ดร่างด้านบน' : 'เลือกจากตัวเลือกด้านบนก่อนนะ แล้วฉันจะไปขั้นตอนถัดไป' }, 500);
    }
  };

  const stopReply = () => {
    clearTimeout(replyTimer.current);
    setThinking(false);
    pushMsg({ role: 'sys', text: 'หยุดการตอบแล้ว — ข้อความของคุณยังอยู่ ส่งใหม่หรือแก้ไขได้' });
  };

  const retryError = (m) => {
    setMessages((ms) => ms.filter((x) => x.id !== m.id));
    aiReply({ role: 'ai', source: 'AI', text: 'ขอโทษที่ล่าช้า รอบนี้เชื่อมต่อได้แล้ว (จำลอง) แนวทางสั้นๆ: เริ่มจากงานที่ใกล้กำหนดส่ง แบ่งงานใหญ่เป็นชิ้นเล็ก และเว้นช่วงพักระหว่างงาน' }, 1100);
  };

  const newChat = () => {
    clearTimeout(replyTimer.current);
    setMessages([{ id: nid(), role: 'ai', source: 'คำตอบสำเร็จรูป', text: WELCOME }]);
    setThinking(false);
    setFlow(null);
    setDrafts({});
    setEditingId(null);
    setRailView('idle');
    setConfirmNew(false);
    showToast(`เริ่มแชท AI ใหม่แล้ว · สำเนา Telegram ยังอยู่ (${TG_MESSAGES.length} ข้อความ)`);
  };

  const openTools = () => {
    if (railOpen && railView === 'tools') {
      setRailView('idle');
      return;
    }
    setRailOpen(true);
    setRailView('tools');
  };

  const changeMode = (next) => {
    setMode(next);
    inputRef.current && inputRef.current.focus();
  };

  /* ---------- ข้อความที่แสดงตามสถานะ ---------- */

  let statusTone = 'ok';
  let statusText = 'พร้อมคุย · ใช้ AI';
  if (access === 'noaccess') {
    statusTone = 'warn';
    statusText = 'ยังไม่มีสิทธิ์ใช้ AI';
  } else if (quotaLeft <= 0) {
    statusTone = 'warn';
    statusText = 'โควต้า AI หมดวันนี้';
  } else if (thinking) {
    statusTone = 'busy';
    statusText = 'กำลังคิด…';
  }

  const showQuotaChip = access === 'ok' && mode === 'free' && quotaLeft <= 3;

  const stage = flow && flow.stage;
  let placeholder;
  if (blocked) placeholder = 'ส่งหา AI ไม่ได้ในตอนนี้ — ดูทางเลือกด้านบน';
  else if (mode === 'free') placeholder = 'ถาม MR.Zettascale เรื่องทั่วไป เช่น ช่วยสรุปวิธีจัดลำดับงาน';
  else if (stage === 'review') placeholder = 'มีร่างรอตรวจอยู่ — กดแก้ไข ยกเลิก หรือยืนยันที่การ์ดร่าง';
  else if (stage === 'duration' || stage === 'time') placeholder = 'เลือกจากตัวเลือกในแชทก่อน';
  else placeholder = 'พิมพ์ชื่อกิจกรรม เช่น ประชุมทีมพรุ่งนี้บ่าย';

  const suggestions =
    mode === 'free'
      ? ['ช่วยสรุปวิธีจัดลำดับความสำคัญของงาน', 'ช่วยคิดคำอวยพรวันเกิดสั้นๆ']
      : ['ประชุมทีมสั้นๆ', 'อ่านหนังสือ'];
  const showSuggestions = messages.length <= 1 && !blocked && !thinking && !(mode === 'plan' && stage && stage !== 'title');

  const stepCurrent = stage ? STAGE_STEP[stage] : 0;
  const editingDraft = editingId ? drafts[editingId] : null;

  /* ---------- เรนเดอร์การ์ดในข้อความ ---------- */

  const renderCard = (m) => {
    const c = m.card;
    if (!c) return null;
    if (c.kind === 'schedule') return <ScheduleCard dayKey={c.day} />;
    if (c.kind === 'question') return <QuestionCard card={c} onAnswer={(o) => answerQuestion(m, o)} />;
    if (c.kind === 'slots') return <SlotsCard card={c} onPick={(s) => pickSlot(m, s)} onCreate={(s) => startCreate(s)} />;
    if (c.kind === 'noslots') return <NoSlotsCard card={c} onShorter={() => noSlotsShorter(m)} onAgain={noSlotsAgain} />;
    if (c.kind === 'error') return <ErrorCard card={c} onRetry={() => retryError(m)} onDismiss={() => setMessages((ms) => ms.filter((x) => x.id !== m.id))} />;
    if (c.kind === 'draft') {
      const d = drafts[c.draftId];
      return (
        <DraftCard
          draft={d}
          editing={editingId === c.draftId && railView === 'draftEdit'}
          onEdit={() => editDraft(c.draftId)}
          onCancel={() => cancelDraft(c.draftId)}
          onConfirm={() => confirmDraft(c.draftId)}
          onAck={(v) => updateDraft(c.draftId, { ack: v })}
        />
      );
    }
    return null;
  };

  /* ---------- แผงงานด้านขวา ---------- */

  const backToTools = (
    <button type="button" className={cx('link', 'link--back')} onClick={() => setRailView('tools')}>
      <Icon name="back" size={14} /> เครื่องมือทั้งหมด
    </button>
  );

  const railBody = () => {
    if (railView === 'tools') {
      return (
        <div className={cx('panel')}>
          <h3 className={cx('panel-title')}>เครื่องมือ</h3>
          <ul className={cx('tool-list')}>
            {TOOLS.map((t) => {
              const off = t.ai && blocked;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={cx('tool')}
                    disabled={off}
                    onClick={() => {
                      if (t.id === 'schedule') setRailView('schedule');
                      else if (t.id === 'summary') runSummary();
                      else if (t.id === 'find') setRailView('find');
                      else if (t.id === 'create') startCreate();
                      else setRailView('presets');
                    }}
                  >
                    <span className={cx('tool-icon')}>
                      <Icon name={t.icon} />
                    </span>
                    <span className={cx('tool-text')}>
                      <span className={cx('tool-name')}>{t.name}</span>
                      <span className={cx('tool-desc')}>{off ? 'ต้องใช้ AI — ใช้ไม่ได้ในตอนนี้' : t.desc}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={cx('hint')}>ข่าวและอากาศสดยังไม่มีในเครื่องมือชุดนี้</p>
          <button type="button" className={cx('link')} onClick={() => setRailView('idle')}>
            ปิดเครื่องมือ
          </button>
        </div>
      );
    }
    if (railView === 'schedule') {
      return (
        <div className={cx('panel')}>
          {backToTools}
          <h3 className={cx('panel-title')}>ดูตาราง</h3>
          <div className={cx('seg')} role="group" aria-label="เลือกวัน">
            {Object.values(DAYS).map((d) => (
              <button key={d.key} type="button" aria-pressed={scheduleDay === d.key} className={cx('seg-btn', scheduleDay === d.key && 'seg-btn--on')} onClick={() => setScheduleDay(d.key)}>
                {d.short}
              </button>
            ))}
          </div>
          <button type="button" className={cx('btn', 'btn--primary', 'btn--block')} onClick={() => runSchedule(scheduleDay)}>
            แสดงตารางในแชท
          </button>
          <p className={cx('hint')}>ผลลัพธ์จะขึ้นในแชทด้านซ้าย คุณยังอ่านบทสนทนาต่อได้</p>
        </div>
      );
    }
    if (railView === 'find') {
      return (
        <div className={cx('panel')}>
          {backToTools}
          <h3 className={cx('panel-title')}>หาเวลาว่าง</h3>
          <div className={cx('field-label')}>ต้องการช่วงว่างยาวเท่าไร</div>
          <div className={cx('chips')} role="group" aria-label="ระยะเวลา">
            {DURS.map((d) => (
              <button key={d.m} type="button" aria-pressed={findDur === d.m} className={cx('chip', findDur === d.m && 'chip--on')} onClick={() => setFindDur(d.m)}>
                {d.l}
              </button>
            ))}
          </div>
          <button type="button" className={cx('btn', 'btn--primary', 'btn--block')} onClick={() => runFind(findDur)}>
            ค้นหาใน 2 วันนี้
          </button>
          <p className={cx('hint')}>ลองเลือก “4 ชั่วโมง” เพื่อดูกรณีไม่พบช่วงว่าง</p>
        </div>
      );
    }
    if (railView === 'presets') {
      return (
        <div className={cx('panel')}>
          {backToTools}
          <h3 className={cx('panel-title')}>คำถามสำเร็จรูป</h3>
          <ul className={cx('tool-list')}>
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button type="button" className={cx('tool', 'tool--plain')} onClick={() => runPreset(p)}>
                  <span className={cx('tool-text')}>
                    <span className={cx('tool-name')}>{p.q}</span>
                    <span className={cx('tool-desc')}>{p.unsupported ? 'ยังไม่รองรับ — กดเพื่อดูคำอธิบาย' : p.source}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (railView === 'flow') {
      const lastDraft = Object.values(drafts).slice(-1)[0];
      return (
        <div className={cx('panel')}>
          {backToTools}
          <h3 className={cx('panel-title')}>สร้างกิจกรรม</h3>
          {(!stage || stage === 'title') && <p className={cx('p')}>ขั้นที่ 1: บอกชื่อกิจกรรมในช่องแชท หรือเลือกตัวอย่างในแชท</p>}
          {stage === 'duration' && <p className={cx('p')}>ขั้นที่ 1: เลือกระยะเวลาของกิจกรรมในแชท</p>}
          {stage === 'time' && <p className={cx('p')}>ขั้นที่ 2: เลือกช่วงเวลาว่างในแชท แชทยังเลื่อนอ่านได้ตามปกติ</p>}
          {stage === 'review' && lastDraft && (
            <>
              <p className={cx('p')}>ตรวจร่างที่การ์ดในแชท ถ้าต้องแก้ไขให้เปิดฟอร์มที่นี่ได้</p>
              <div className={cx('row')}>
                <button type="button" className={cx('btn', 'btn--sm')} onClick={() => editDraft(lastDraft.id)}>
                  <Icon name="edit" size={14} /> แก้ไขร่าง
                </button>
                <button type="button" className={cx('btn', 'btn--ghost', 'btn--sm')} onClick={() => cancelDraft(lastDraft.id)}>
                  ยกเลิกร่าง
                </button>
              </div>
            </>
          )}
          {stage === 'done' && (
            <>
              <p className={cx('p')}>ส่งเข้าขั้นตอนตรวจบันทึกแล้ว (จำลอง) ยังไม่มีรายการในปฏิทินจริง</p>
              <button type="button" className={cx('btn', 'btn--primary', 'btn--sm')} onClick={() => startCreate()}>
                สร้างกิจกรรมอื่น
              </button>
            </>
          )}
        </div>
      );
    }
    if (railView === 'draftEdit' && editingDraft) {
      const d = editingDraft;
      const conflicts = conflictsOf(d);
      return (
        <div className={cx('panel')}>
          <button type="button" className={cx('link', 'link--back')} onClick={() => setRailView('flow')}>
            <Icon name="back" size={14} /> เสร็จการแก้ไข
          </button>
          <h3 className={cx('panel-title')}>แก้ไขร่างกิจกรรม</h3>
          <label className={cx('field')}>
            <span className={cx('field-label')}>ชื่อกิจกรรม</span>
            <input className={cx('input')} value={d.title} onChange={(e) => updateDraft(d.id, { title: e.target.value })} />
          </label>
          <label className={cx('field')}>
            <span className={cx('field-label')}>วัน</span>
            <select className={cx('input')} value={d.day} onChange={(e) => updateDraft(d.id, { day: e.target.value, ack: false })}>
              {Object.values(DAYS).map((x) => (
                <option key={x.key} value={x.key}>
                  {x.long}
                </option>
              ))}
            </select>
          </label>
          <div className={cx('field-pair')}>
            <label className={cx('field')}>
              <span className={cx('field-label')}>เริ่ม</span>
              <select className={cx('input')} value={d.start} onChange={(e) => updateDraft(d.id, { start: Number(e.target.value), ack: false })}>
                {TIME_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className={cx('field')}>
              <span className={cx('field-label')}>ระยะเวลา</span>
              <select className={cx('input')} value={d.duration} onChange={(e) => updateDraft(d.id, { duration: Number(e.target.value), ack: false })}>
                {DURS.map((x) => (
                  <option key={x.m} value={x.m}>
                    {x.l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {conflicts.length > 0 ? (
            <div className={cx('conflict')} role="alert">
              <Icon name="alert" size={16} />
              <div>
                <strong>เวลาชน</strong> กับ {conflicts.map((c) => `${c.t} (${fmt(c.s)}–${fmt(c.e)})`).join(', ')}
              </div>
            </div>
          ) : (
            <p className={cx('hint')}>ลองเปลี่ยนเป็นพรุ่งนี้ 14:00 เพื่อดูคำเตือนเวลาชน</p>
          )}
          <p className={cx('hint')}>การ์ดร่างในแชทอัปเดตตามที่แก้ทันที</p>
        </div>
      );
    }
    // idle
    return (
      <div className={cx('panel')}>
        <h3 className={cx('panel-title')}>เครื่องมือ</h3>
        <p className={cx('p')}>ดูตาราง · สรุปวันนี้ · หาเวลาว่าง · สร้างกิจกรรม · คำถามสำเร็จรูป</p>
        <button type="button" className={cx('btn', 'btn--primary', 'btn--block')} onClick={() => setRailView('tools')}>
          <Icon name="tools" size={16} /> เปิดเครื่องมือ
        </button>
        <p className={cx('hint')}>เปิดเมื่อต้องใช้ แล้วแผงนี้จะกลับมาว่างเพื่อให้แชทเป็นจุดสนใจ</p>
      </div>
    );
  };

  /* ---------- โครงหน้า ---------- */

  return (
    <div className={cx('root')}>
      {/* แถบสำหรับสลับสถานะตัวอย่าง (เฉพาะ mockup) */}
      <div className={cx('demo-bar')}>
        <span className={cx('demo-tag')}>MOCKUP</span>
        <label className={cx('demo-label')}>
          สลับสถานะตัวอย่าง
          <select className={cx('demo-select')} value={scenario} onChange={(e) => loadScenario(e.target.value)}>
            {SCENARIOS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className={cx('demo-note')}>คำตอบ ตาราง และ Telegram ทั้งหมดเป็นข้อมูลจำลอง · เวลาจำลอง 12:40 วันอังคาร 27 ต.ค.</span>
      </div>

      {/* แถบเมนูหลักของ T.i.M.E.S. (จำลอง) */}
      <header className={cx('appbar')}>
        <span className={cx('logo')}>T.i.M.E.S.</span>
        <nav className={cx('nav')} aria-label="เมนูหลัก">
          {['ปฏิทิน', 'กิจกรรม', 'AI Mode', 'ตั้งค่า'].map((n) => (
            <button
              key={n}
              type="button"
              className={cx('nav-item', n === 'AI Mode' && 'nav-item--on')}
              aria-current={n === 'AI Mode' ? 'page' : undefined}
              onClick={() => n !== 'AI Mode' && showToast(`ตัวอย่าง: จะไปหน้า “${n}” (mockup ไม่เปลี่ยนหน้าจริง)`)}
            >
              {n}
            </button>
          ))}
        </nav>
      </header>

      <div className={cx('main', !railOpen && 'main--rail-closed')}>
        {/* ============ คอลัมน์แชท ============ */}
        <section className={cx('chat')} aria-label="แชทกับ MR.Zettascale">
          <div className={cx('chat-head')}>
            <button type="button" className={cx('icon-btn')} aria-label="กลับหน้าก่อนหน้า" onClick={() => showToast('ตัวอย่าง: กลับไปหน้าปฏิทิน (mockup ไม่เปลี่ยนหน้าจริง)')}>
              <Icon name="back" />
            </button>
            <div className={cx('avatar', 'avatar--lg')} aria-hidden="true">
              Z
            </div>
            <div className={cx('ident')}>
              <div className={cx('ident-name')}>MR.Zettascale</div>
              <div className={cx('ident-status', `tone-${statusTone}`)}>
                <span className={cx('status-dot')} aria-hidden="true" /> {statusText}
              </div>
            </div>
            <div className={cx('head-actions')}>
              {showQuotaChip && (
                <span className={cx('quota')} title="โควต้า AI ของวันนี้">
                  AI เหลือ {quotaLeft} ครั้ง
                </span>
              )}
              <button type="button" className={cx('btn', 'btn--sm', railOpen && 'btn--on')} aria-pressed={railOpen} onClick={() => setRailOpen((v) => !v)}>
                <Icon name="panel" size={16} /> แผงงาน
                {!railOpen && <span className={cx('count')}>{TG_MESSAGES.length}</span>}
              </button>
              <div className={cx('pop-anchor')}>
                <button type="button" className={cx('btn', 'btn--sm')} aria-expanded={confirmNew} onClick={() => setConfirmNew((v) => !v)}>
                  <Icon name="plus" size={16} /> แชท AI ใหม่
                </button>
                {confirmNew && (
                  <div className={cx('pop')} role="dialog" aria-label="ยืนยันเริ่มแชท AI ใหม่">
                    <strong>เริ่มแชท AI ใหม่?</strong>
                    <p className={cx('p')}>ล้างเฉพาะบทสนทนากับ AI สำเนาข้อความ Telegram ({TG_MESSAGES.length} ข้อความ) จะไม่ถูกลบ</p>
                    <div className={cx('row', 'row--end')}>
                      <button type="button" className={cx('btn', 'btn--sm')} onClick={() => setConfirmNew(false)}>
                        ไม่ล้าง
                      </button>
                      <button type="button" className={cx('btn', 'btn--primary', 'btn--sm')} onClick={newChat}>
                        เริ่มแชท AI ใหม่
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={cx('log')} ref={logRef} role="log" aria-live="polite" aria-label="บทสนทนา">
            <div className={cx('log-inner')}>
              {messages.map((m) => (
                <Message key={m.id} m={m}>
                  {renderCard(m)}
                </Message>
              ))}
              {showSuggestions && (
                <div className={cx('suggest')}>
                  <span className={cx('muted')}>{mode === 'free' ? 'ลองถามเรื่องทั่วไป:' : 'ลองเริ่มจากชื่อกิจกรรม:'}</span>
                  {suggestions.map((s) => (
                    <button key={s} type="button" className={cx('chip')} onClick={() => { setInput(s); inputRef.current && inputRef.current.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {thinking && (
                <div className={cx('msg')} aria-live="polite">
                  <div className={cx('avatar')} aria-hidden="true">
                    Z
                  </div>
                  <div className={cx('bubble', 'bubble--ai', 'bubble--typing')}>
                    <span className={cx('dots')} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>กำลังคิด…</span>
                    <button type="button" className={cx('btn', 'btn--sm', 'btn--ghost')} onClick={stopReply}>
                      <Icon name="stop" size={14} /> หยุด
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ช่องพิมพ์ — ติดล่างตลอด */}
          <div className={cx('composer-wrap')}>
            <div className={cx('composer')}>
              {blocked && (
                <div className={cx('banner')} role="status">
                  <Icon name="lock" size={16} />
                  <div className={cx('banner-text')}>
                    <strong>{blockReason}</strong>
                    <span>ยังใช้ “คำถามสำเร็จรูป” ที่ไม่ใช้โควต้า AI ได้</span>
                  </div>
                  <button
                    type="button"
                    className={cx('btn', 'btn--primary', 'btn--sm')}
                    onClick={() => {
                      setRailOpen(true);
                      setRailView('presets');
                    }}
                  >
                    เปิดคำถามสำเร็จรูป
                  </button>
                </div>
              )}
              <div className={cx('composer-top')}>
                <div className={cx('seg')} role="group" aria-label="โหมดการพิมพ์">
                  <button type="button" aria-pressed={mode === 'free'} className={cx('seg-btn', mode === 'free' && 'seg-btn--on')} onClick={() => changeMode('free')}>
                    คุยอิสระ
                  </button>
                  <button type="button" aria-pressed={mode === 'plan'} className={cx('seg-btn', mode === 'plan' && 'seg-btn--on')} onClick={() => changeMode('plan')}>
                    วางแผนกิจกรรม
                  </button>
                </div>
                <span className={cx('composer-hint')}>
                  {mode === 'free' ? 'คุยอิสระใช้ AI · ตอนนี้จำกัดสิทธิ์สำหรับนักพัฒนา' : 'ร่างกิจกรรมจะไม่ถูกบันทึกจนกว่าคุณจะตรวจและยืนยัน'}
                </span>
              </div>
              <div className={cx('composer-row')}>
                <button type="button" className={cx('btn', 'btn--tool', railOpen && railView !== 'idle' && 'btn--on')} aria-pressed={railOpen && railView === 'tools'} onClick={openTools}>
                  <Icon name="tools" size={18} /> เครื่องมือ
                </button>
                <textarea
                  ref={inputRef}
                  className={cx('textarea')}
                  rows={2}
                  value={input}
                  disabled={blocked}
                  placeholder={placeholder}
                  aria-label="ข้อความถึง MR.Zettascale"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button type="button" className={cx('send')} disabled={blocked || thinking || !input.trim()} onClick={send}>
                  <Icon name="up" size={18} />
                  <span className={cx('send-text')}>
                    <span>{thinking ? 'กำลังส่ง…' : 'ส่งให้ AI'}</span>
                    <small>{blocked ? 'ส่งไม่ได้' : 'MR.Zettascale'}</small>
                  </span>
                </button>
              </div>
              <div className={cx('composer-foot')}>Enter ส่ง · Shift + Enter ขึ้นบรรทัดใหม่</div>
            </div>
          </div>
        </section>

        {/* ============ แผงงานด้านขวา ============ */}
        {railOpen && (
          <aside className={cx('rail')} aria-label="แผงงาน">
            <div className={cx('rail-head')}>
              <span>แผงงาน</span>
              <button type="button" className={cx('icon-btn')} aria-label="ซ่อนแผงงาน" onClick={() => setRailOpen(false)}>
                <Icon name="close" size={16} />
              </button>
            </div>
            {mode === 'plan' && (
              <div className={cx('rail-steps')}>
                <Stepper current={stepCurrent} />
              </div>
            )}
            <div className={cx('rail-body')}>{railBody()}</div>

            {/* Telegram — แยกจากแชท AI */}
            <section className={cx('tg', tgOpen && 'tg--open')} aria-label="ข้อความ Telegram">
              <button type="button" className={cx('tg-head')} aria-expanded={tgOpen} onClick={() => setTgOpen((v) => !v)}>
                <Icon name="telegram" size={16} />
                <span className={cx('tg-title')}>
                  ข้อความ Telegram <span className={cx('count', 'count--tg')}>{TG_MESSAGES.length}</span>
                </span>
                <span className={cx('tg-action')}>{tgOpen ? 'พับเก็บ' : 'ดูสำเนา'}</span>
                <span className={cx('tg-chev', tgOpen && 'tg-chev--up')}>
                  <Icon name="chevron" size={16} />
                </span>
              </button>
              {tgOpen && (
                <div className={cx('tg-body')}>
                  <p className={cx('tg-note')}>สำเนาอ่านอย่างเดียว แยกจากแชท AI · ไม่ถูกล้างเมื่อเริ่มแชท AI ใหม่</p>
                  <ul className={cx('tg-list')}>
                    {TG_MESSAGES.map((t, i) => (
                      <li key={i} className={cx('tg-item', t.from === 'คุณ' && 'tg-item--me')}>
                        <span className={cx('tg-meta')}>
                          {t.from} · {t.t}
                        </span>
                        <span>{t.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </aside>
        )}
      </div>

      {toast && (
        <div className={cx('toast')} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

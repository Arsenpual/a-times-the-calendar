import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "times-reminders-v1";
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const DEFAULT_REMINDERS = [
  { id: "water", title: "ดื่มน้ำ", amount: 30, unit: "minutes", enabled: true },
  { id: "stretch", title: "ยืดตัว 30 วินาที", amount: 60, unit: "minutes", enabled: true },
  { id: "eyes", title: "พักสายตา มองไกล 20 ฟุต", amount: 20, unit: "minutes", enabled: true }
];

function intervalMs(reminder) {
  return reminder.amount * (reminder.unit === "hours" ? 60 * 60 * 1000 : 60 * 1000);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function intervalLabel(reminder) {
  const unit = reminder.unit === "hours" ? "ชั่วโมง" : "นาที";
  return `ทุก ${reminder.amount} ${unit}`;
}

function createDraft(reminder) {
  return reminder
    ? { title: reminder.title, amount: String(reminder.amount), unit: reminder.unit }
    : { title: "", amount: "10", unit: "minutes" };
}

/**
 * Functional first version of Reminder mode. Reminders and their schedules
 * persist in localStorage and alert while this tab is open. Browser/FCM
 * notifications intentionally remain a later phase because they need user
 * permission plus server-side scheduling to work after the tab is closed.
 */
export default function ReminderMode() {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {
      // Use the starter reminders if storage is unavailable or corrupt.
    }
    const now = Date.now();
    return DEFAULT_REMINDERS.map((reminder) => ({
      ...reminder,
      nextDueAt: now + intervalMs(reminder)
    }));
  });
  const [now, setNow] = useState(Date.now());
  const [draft, setDraft] = useState(createDraft());
  const [editingId, setEditingId] = useState(null);
  const [pomodoro, setPomodoro] = useState({
    phase: "focus",
    remainingSeconds: FOCUS_SECONDS,
    endsAt: null,
    rounds: 0
  });
  const [pomodoroNotice, setPomodoroNotice] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch {
      // The screen remains usable even if persistence is unavailable.
    }
  }, [reminders]);

  const pomodoroRemaining = pomodoro.endsAt
    ? Math.max(0, Math.ceil((pomodoro.endsAt - now) / 1000))
    : pomodoro.remainingSeconds;

  useEffect(() => {
    if (!pomodoro.endsAt || pomodoroRemaining > 0) return;
    const completedFocus = pomodoro.phase === "focus";
    setPomodoro({
      phase: completedFocus ? "break" : "focus",
      remainingSeconds: completedFocus ? BREAK_SECONDS : FOCUS_SECONDS,
      endsAt: null,
      rounds: completedFocus ? pomodoro.rounds + 1 : pomodoro.rounds
    });
    setPomodoroNotice(
      completedFocus
        ? "ครบช่วงโฟกัสแล้ว — ถึงเวลาพัก 5 นาที"
        : "พักครบแล้ว — พร้อมเริ่มช่วงโฟกัสใหม่"
    );
  }, [pomodoro.endsAt, pomodoro.phase, pomodoro.rounds, pomodoroRemaining]);

  const dueReminders = useMemo(
    () => reminders.filter((reminder) => reminder.enabled && reminder.nextDueAt <= now),
    [reminders, now]
  );

  const activeReminders = reminders.filter((reminder) => reminder.enabled);
  const pausedReminders = reminders.filter((reminder) => !reminder.enabled);

  const scheduleNext = (id) => {
    setReminders((previous) =>
      previous.map((reminder) =>
        reminder.id === id ? { ...reminder, nextDueAt: Date.now() + intervalMs(reminder) } : reminder
      )
    );
  };

  const toggleReminder = (id) => {
    setReminders((previous) =>
      previous.map((reminder) => {
        if (reminder.id !== id) return reminder;
        const enabled = !reminder.enabled;
        return {
          ...reminder,
          enabled,
          nextDueAt: enabled ? Date.now() + intervalMs(reminder) : null
        };
      })
    );
  };

  const removeReminder = (id) => {
    setReminders((previous) => previous.filter((reminder) => reminder.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(createDraft());
    }
  };

  const startEditing = (reminder) => {
    setEditingId(reminder.id);
    setDraft(createDraft(reminder));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(createDraft());
  };

  const saveReminder = (event) => {
    event.preventDefault();
    const title = draft.title.trim();
    const amount = Number(draft.amount);
    if (!title || !Number.isFinite(amount) || amount < 1) return;

    if (editingId) {
      setReminders((previous) =>
        previous.map((reminder) =>
          reminder.id === editingId
            ? {
                ...reminder,
                title,
                amount,
                unit: draft.unit,
                nextDueAt: reminder.enabled ? Date.now() + amount * (draft.unit === "hours" ? 3600000 : 60000) : null
              }
            : reminder
        )
      );
    } else {
      const reminder = {
        id: crypto.randomUUID(),
        title,
        amount,
        unit: draft.unit,
        enabled: true
      };
      setReminders((previous) => [...previous, { ...reminder, nextDueAt: Date.now() + intervalMs(reminder) }]);
    }
    cancelEditing();
  };

  const startPomodoro = () => {
    setPomodoro((previous) => ({
      ...previous,
      endsAt: Date.now() + previous.remainingSeconds * 1000
    }));
  };

  const pausePomodoro = () => {
    setPomodoro((previous) => ({
      ...previous,
      remainingSeconds: Math.max(0, Math.ceil(((previous.endsAt || Date.now()) - Date.now()) / 1000)),
      endsAt: null
    }));
  };

  const skipPomodoro = () => {
    setPomodoro((previous) => {
      const completedFocus = previous.phase === "focus";
      return {
        phase: completedFocus ? "break" : "focus",
        remainingSeconds: completedFocus ? BREAK_SECONDS : FOCUS_SECONDS,
        endsAt: null,
        rounds: completedFocus ? previous.rounds + 1 : previous.rounds
      };
    });
  };

  const renderReminder = (reminder) => {
    const remaining = reminder.enabled ? Math.max(0, reminder.nextDueAt - now) : null;
    return (
      <div className={`reminder-row${reminder.enabled ? " active" : ""}`} key={reminder.id}>
        <div className="reminder-freq-badge">
          <span className="n">{reminder.amount}</span>
          <span className="u">{reminder.unit === "hours" ? "ชม." : "นาที"}</span>
        </div>
        <div className="reminder-info">
          <p className="title">{reminder.title}</p>
          <p className="meta">
            {reminder.enabled ? `${intervalLabel(reminder)} · อีก ${formatDuration(remaining)}` : "ปิดอยู่"}
          </p>
        </div>
        <button
          type="button"
          className={`reminder-toggle${reminder.enabled ? " on" : ""}`}
          onClick={() => toggleReminder(reminder.id)}
          aria-label={`${reminder.enabled ? "ปิด" : "เปิด"} ${reminder.title}`}
          aria-pressed={reminder.enabled}
        />
        <div className="reminder-row-actions">
          <button type="button" className="icon-btn" onClick={() => startEditing(reminder)} title="แก้ไข">✎</button>
          <button type="button" className="icon-btn" onClick={() => removeReminder(reminder.id)} title="ลบ">🗑</button>
        </div>
      </div>
    );
  };

  return (
    <div className="reminder-mockup reminder-mode">
      <style>{`
        .reminder-mode { --rm-blue:#1557b0; --rm-border:#dadce0; --rm-text-primary:#3c4043; --rm-text-secondary:#5f6368; --rm-bg:#e8eaed; --rm-bg-muted:#fff; --rm-amber:#e8710a; --rm-amber-dark:#b85a08; --rm-amber-tint:#fdf0e3; --rm-green:#1e8e3e; --rm-green-tint:#e6f4ea; font-family:"Google Sans","Roboto",Arial,sans-serif; color:var(--rm-text-primary); background:var(--rm-bg); display:flex; flex-direction:column; flex:1; min-height:0; }
        .reminder-mode .reminder-banner,.reminder-mode .reminder-alert { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; font-weight:500; }
        .reminder-mode .reminder-banner { background:var(--rm-amber-tint); color:var(--rm-amber-dark); border-bottom:1px solid var(--rm-amber); }
        .reminder-mode .reminder-banner .badge { font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; background:var(--rm-amber); color:#fff; padding:2px 8px; border-radius:10px; flex-shrink:0; }
        .reminder-mode .reminder-alert { background:var(--rm-amber-tint); color:var(--rm-amber-dark); border-bottom:1px solid var(--rm-amber); justify-content:space-between; }
        .reminder-mode .reminder-alert-actions { display:flex; gap:8px; }
        .reminder-mode .rm-dashboard { flex:1; display:grid; grid-template-columns:300px 1fr; gap:16px; padding:16px; overflow:hidden; }
        .reminder-mode .btn { font:inherit; font-size:14px; padding:8px 16px; border-radius:6px; border:1px solid var(--rm-border); background:var(--rm-bg-muted); color:var(--rm-text-primary); cursor:pointer; }
        .reminder-mode .btn.primary { background:var(--rm-amber); border-color:var(--rm-amber); color:#fff; }
        .reminder-mode .btn:hover { filter:brightness(.97); }
        .reminder-mode .tape-panel,.reminder-mode .reminder-panel { background:var(--rm-bg-muted); border:1px solid var(--rm-border); border-radius:8px; display:flex; flex-direction:column; overflow:hidden; }
        .reminder-mode .tape-header { padding:16px; }
        .reminder-mode .tape-label,.reminder-mode .reminder-toolbar-sub,.reminder-mode .meta { color:var(--rm-text-secondary); }
        .reminder-mode .tape-label { font-size:12px; text-transform:uppercase; letter-spacing:.04em; margin:0 0 6px; }
        .reminder-mode .tape-session-name { font-size:16px; font-weight:500; margin:0 0 2px; }
        .reminder-mode .tape-session-sub { font-size:12px; color:var(--rm-text-secondary); }
        .reminder-mode .tape-big-clock { font:500 40px "Roboto Mono",monospace; letter-spacing:-.02em; color:var(--rm-amber-dark); margin:12px 0 4px; }
        .reminder-mode .tape-phase-pill { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:500; padding:3px 10px; border-radius:12px; background:var(--rm-green-tint); color:var(--rm-green); }
        .reminder-mode .tape-phase-pill .dot { width:6px; height:6px; border-radius:50%; background:var(--rm-green); }
        .reminder-mode .tape-scroll { flex:1; overflow-y:auto; padding:8px 0; position:relative; }
        .reminder-mode .tape-track { position:relative; padding-left:56px; }
        .reminder-mode .tape-now-line { position:absolute; left:0; right:0; top:132px; height:2px; background:var(--rm-amber); z-index:3; }
        .reminder-mode .tape-now-line::before { content:"ตอนนี้"; position:absolute; left:8px; top:-9px; font-size:10px; font-weight:700; color:#fff; background:var(--rm-amber); padding:1px 6px; border-radius:8px; }
        .reminder-mode .tape-minute { position:relative; height:44px; border-top:1px solid var(--rm-border); }
        .reminder-mode .tape-minute.elapsed { background:linear-gradient(90deg,var(--rm-amber-tint),transparent 70%); }
        .reminder-mode .tape-minute-label { position:absolute; left:-48px; top:-7px; width:40px; text-align:right; font-family:"Roboto Mono",monospace; font-size:11px; color:var(--rm-text-secondary); }
        .reminder-mode .tape-minute.major .tape-minute-label { font-weight:700; color:var(--rm-text-primary); }
        .reminder-mode .tape-flag { position:absolute; left:8px; top:4px; display:flex; align-items:center; gap:6px; font-size:12px; background:var(--rm-bg-muted); border:1px solid var(--rm-amber); color:var(--rm-amber-dark); padding:3px 8px 3px 6px; border-radius:12px; white-space:nowrap; max-width:210px; overflow:hidden; text-overflow:ellipsis; }
        .reminder-mode .tape-flag .flag-dot { width:6px; height:6px; border-radius:50%; background:var(--rm-amber); flex-shrink:0; }
        .reminder-mode .tape-footer { margin-top:auto; padding:12px 16px; border-top:1px solid var(--rm-border); display:flex; gap:8px; }
        .reminder-mode .tape-footer .btn { flex:1; }
        .reminder-mode .reminder-toolbar { padding:16px; border-bottom:1px solid var(--rm-border); display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .reminder-mode .reminder-toolbar h2 { font-size:18px; font-weight:500; margin:0; }
        .reminder-mode .reminder-toolbar-sub { font-size:12px; margin:2px 0 0; }
        .reminder-mode .reminder-list { flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:8px; }
        .reminder-mode .reminder-section-label { font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--rm-text-secondary); margin:12px 0 2px; padding:0 4px; }
        .reminder-mode .reminder-row { display:grid; grid-template-columns:44px 1fr auto auto; align-items:center; gap:12px; padding:10px 12px; border:1px solid var(--rm-border); border-radius:8px; background:var(--rm-bg-muted); }
        .reminder-mode .reminder-row.active { border-color:var(--rm-amber); background:var(--rm-amber-tint); }
        .reminder-mode .reminder-freq-badge { font-family:"Roboto Mono",monospace; font-size:11px; font-weight:700; text-align:center; background:#e8f0fe; color:var(--rm-blue); border-radius:6px; padding:6px 2px; line-height:1.15; }
        .reminder-mode .active .reminder-freq-badge { background:var(--rm-amber); color:#fff; }
        .reminder-mode .reminder-freq-badge .n,.reminder-mode .reminder-freq-badge .u { display:block; }
        .reminder-mode .reminder-freq-badge .n { font-size:14px; }
        .reminder-mode .reminder-freq-badge .u { font-size:8px; opacity:.8; }
        .reminder-mode .reminder-info .title { font-size:14px; font-weight:500; margin:0 0 2px; }
        .reminder-mode .meta { font-size:12px; margin:0; }
        .reminder-mode .reminder-toggle { width:36px; height:20px; border-radius:10px; background:var(--rm-border); position:relative; cursor:pointer; border:none; }
        .reminder-mode .reminder-toggle.on { background:var(--rm-green); }
        .reminder-mode .reminder-toggle::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left .15s ease; }
        .reminder-mode .reminder-toggle.on::after { left:18px; }
        .reminder-mode .reminder-row-actions { display:flex; gap:4px; }
        .reminder-mode .icon-btn { width:28px; height:28px; border-radius:6px; border:none; background:transparent; color:var(--rm-text-secondary); cursor:pointer; font-size:14px; }
        .reminder-mode .icon-btn:hover { background:#e8eaed; color:var(--rm-text-primary); }
        .reminder-mode .composer { margin:8px 0 4px; border:1px dashed var(--rm-border); border-radius:8px; padding:14px; display:grid; grid-template-columns:1.4fr 1fr auto; gap:10px; align-items:end; background:#fafbfc; }
        .reminder-mode .composer label { font-size:11px; color:var(--rm-text-secondary); display:block; margin-bottom:4px; }
        .reminder-mode .composer input,.reminder-mode .composer select { width:100%; box-sizing:border-box; font:inherit; font-size:13px; padding:8px 10px; border:1px solid var(--rm-border); border-radius:6px; background:#fff; }
        .reminder-mode .freq-row { display:flex; gap:6px; }
        .reminder-mode .freq-row input { width:58px; flex:none; }
        @media (max-width:900px) { .reminder-mode .rm-dashboard { grid-template-columns:1fr; overflow:auto; } .reminder-mode .tape-panel { min-height:230px; } }
      `}</style>

      <div className="reminder-banner">
        <span className="badge">Live</span>
        Reminder ทำงานในแท็บนี้ · Pomodoro และ reminder ใช้ระบบแจ้งเตือนเดียวกัน
      </div>
      {(dueReminders.length > 0 || pomodoroNotice) && (
        <div className="reminder-alert" role="alert">
          <span>{pomodoroNotice || `ถึงเวลา: ${dueReminders.map((reminder) => reminder.title).join(", ")}`}</span>
          <div className="reminder-alert-actions">
            {dueReminders.map((reminder) => <button key={reminder.id} className="btn" onClick={() => scheduleNext(reminder.id)}>เตือนอีกครั้ง</button>)}
            {pomodoroNotice && <button className="btn" onClick={() => setPomodoroNotice(null)}>รับทราบ</button>}
          </div>
        </div>
      )}

      <div className="rm-dashboard">
        <aside className="tape-panel">
          <div className="tape-header">
            <p className="tape-label">Pomodoro กำลังทำงาน</p>
            <p className="tape-session-name">โฟกัส: {pomodoro.phase === "focus" ? "งานที่กำลังทำอยู่" : "พักระหว่างรอบ"}</p>
            <p className="tape-session-sub">รอบโฟกัสที่ {pomodoro.rounds + 1} · reminder ที่เปิดอยู่จะทำงานควบคู่กัน</p>
            <div className="tape-big-clock">{formatDuration(pomodoroRemaining * 1000)}</div>
            <span className="tape-phase-pill"><span className="dot" />{pomodoro.endsAt ? "กำลังทำงาน" : "หยุดชั่วคราว"}</span>
          </div>
          <div className="tape-scroll">
            <div className="tape-track">
              <div className="tape-now-line" />
              {Array.from({ length: 19 }, (_, index) => {
                const minute = index + 5;
                const flag = minute === 7 ? "ดื่มน้ำ" : minute === 12 ? "ยืดตัว 30 วิ" : minute === 17 ? "ดื่มน้ำ" : minute === 22 ? "ยืดตัว 30 วิ" : null;
                return (
                  <div key={minute} className={`tape-minute${index < 8 ? " elapsed" : ""}${minute % 5 === 0 ? " major" : ""}`}>
                    <span className="tape-minute-label">{minute % 5 === 0 ? `14:${String(minute).padStart(2, "0")}` : `:${String(minute).padStart(2, "0")}`}</span>
                    {flag && <span className="tape-flag"><span className="flag-dot" />{flag}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="tape-footer">
            {pomodoro.endsAt ? <button className="btn" onClick={pausePomodoro}>หยุดชั่วคราว</button> : <button className="btn primary" onClick={startPomodoro}>เริ่ม {pomodoro.phase === "focus" ? "โฟกัส" : "พัก"}</button>}
            <button className="btn" onClick={skipPomodoro}>ข้ามช่วง</button>
          </div>
        </aside>

        <section className="reminder-panel">
          <div className="reminder-toolbar"><div><h2>Reminder ทั้งหมด</h2><p className="reminder-toolbar-sub">{reminders.length} รายการ · {activeReminders.length} กำลังทำงาน</p></div><button type="button" className="btn primary" onClick={() => document.getElementById("reminder-title")?.focus()}>+ เพิ่ม Reminder</button></div>
          <div className="reminder-list">
            {activeReminders.length > 0 && <><p className="reminder-section-label">กำลังทำงาน</p>{activeReminders.map(renderReminder)}</>}
            {pausedReminders.length > 0 && <><p className="reminder-section-label">ปิดอยู่</p>{pausedReminders.map(renderReminder)}</>}
            <form className="composer" onSubmit={saveReminder}>
              <div><label htmlFor="reminder-title">ชื่อ Reminder</label><input id="reminder-title" value={draft.title} onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))} placeholder="เช่น ลุกยืดเส้น" /></div>
              <div><label htmlFor="reminder-amount">ความถี่</label><div className="freq-row"><input id="reminder-amount" type="number" min="1" value={draft.amount} onChange={(event) => setDraft((previous) => ({ ...previous, amount: event.target.value }))} /><select value={draft.unit} onChange={(event) => setDraft((previous) => ({ ...previous, unit: event.target.value }))}><option value="minutes">นาที</option><option value="hours">ชั่วโมง</option></select></div></div>
              <div>{editingId && <button className="btn" type="button" onClick={cancelEditing}>ยกเลิก</button>}<button className="btn primary" type="submit">{editingId ? "บันทึก" : "เพิ่ม"}</button></div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

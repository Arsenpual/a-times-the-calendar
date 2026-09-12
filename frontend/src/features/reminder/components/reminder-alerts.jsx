import { SNOOZE_OPTIONS_MINUTES } from "../lib/reminder-config.js";
export default function ReminderAlerts({ t, cardMenu, snoozeMenuForId, closeAllMenus, dueReminders, toggleSnoozeMenu, scheduleNext, closeSnoozeMenu, markCompleted }) {
return (<>
      {(cardMenu || snoozeMenuForId) && (
        <div className="dropdown-backdrop" onClick={closeAllMenus} />
      )}

      {/* Alert Banner */}
      {dueReminders.length > 0 && (
        <div className="due-alert-banner" role="alert">
          <span>🔔 {t("reminder.due", { titles: dueReminders.map((r) => r.title).join(", ") })}</span>
          <div className="due-alert-actions">
            {dueReminders.map((r) => (
              <span key={r.id} className="due-alert-item-actions">
                <div className="snooze-dropdown-wrap">
                  <button
                    type="button"
                    className="btn-snooze"
                    onClick={() => toggleSnoozeMenu(r.id)}
                    aria-haspopup="true"
                    aria-expanded={snoozeMenuForId === r.id}
                  >
                    {t("reminder.snooze", { title: r.title })}
                  </button>
                  {snoozeMenuForId === r.id && (
                    <div className="snooze-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { scheduleNext(r.id); closeSnoozeMenu(); }}>
                        {t("reminder.normalSchedule")}
                      </button>
                      {SNOOZE_OPTIONS_MINUTES.map((m) => (
                        <button key={m} type="button" role="menuitem" onClick={() => { scheduleNext(r.id, m); closeSnoozeMenu(); }}>
                          {t("reminder.snoozeMinutes", { minutes: m })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* migration plan v2 เฟส 4 — ผูก markCompleted() จริงแล้ว
                    (เดิมเป็น placeholder disabled รอ field completedAt) */}
                <button type="button" className="btn-mark-done" onClick={() => markCompleted(r.id)}>
                  ✓ {t("reminder.complete")}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}


</>);
}

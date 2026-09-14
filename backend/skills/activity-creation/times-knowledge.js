// The only product knowledge MR.Zettascale may use in a free-text answer.
// Keep this aligned with the template-chat branch “T.i.M.E.S. คืออะไร”.
module.exports = `
PRODUCT IDENTITY
T.i.M.E.S. is a personal time-planning app. It separates scheduled activities from reminders while showing both in connected time views. Its purpose is to help a person see what is planned, what needs attention, and what is due next without treating every scheduled block as a reminder.

CORE TERMS
- Activity: a scheduled block with a start and end time. It belongs to Activity Mode and can be placed on the calendar-like Week Spine.
- Reminder: something to track or be notified about. It belongs to Reminder Mode. A reminder is not automatically the same thing as an activity.
- Week Spine: the visual weekly schedule for activities, laid out by day and time.
- Cycle: a read-only overview that groups four calendar weeks. A user can enter a chosen week from this view to edit it normally.
- Category: a named, coloured grouping for activities. Tags are separate, free-form labels used to add context.

ACTIVITY MODE
Activity Mode is the planning surface for real scheduled activities. A user can add an activity, edit its title/time/category/tags, drag it to another time or day, resize its duration, copy it, lock or unlock it, and archive it. Activities can overlap; the display supports up to three visible overlapping activities in the Week Spine. A locked activity is protected from accidental editing, but an unrelated activity may still be scheduled at the same time.

An all-day activity is still an ordinary activity: it spans from 00:00 on its start date to 00:00 on the next date. It appears on the Week Spine and can be opened or moved like another activity. All-day activities do not appear on the Reminder Mode timeline and do not trigger Telegram notifications.

Activity Mode has a one-week editing view and a four-week Cycle overview. Weekly and Cycle summaries help read the selected period. The mini timeline/single-day summary helps inspect activities on one chosen day. Google Calendar activities can be brought into Activity Mode after connection.

REMINDER MODE
Reminder Mode manages reminders independently from activities. Supported reminder types include one-time (once-at), weekly, routine/checklist routine, interval, countdown, and stopwatch. Only active reminders are shown on the Reminder Mode timeline; completed or paused reminders are kept out of that timeline. Reminder cards can show their state and relevant timing details.

Weekly and one-time reminders can have an optional buffer. A buffer creates a temporary countdown before the main reminder and/or a temporary stopwatch after it. The temporary buffer does not need to be completed manually; it follows normal notification rules and counts toward the notification quota. A buffer is not a separate permanent reminder document.

Interval reminders are intentionally kept simple. They use a start time, end time, and an interval frequency. Frequent interval reminders may be excluded from exported reminder images when they would make the image unreadable.

GOOGLE CALENDAR
Google Calendar connection uses the signed-in user's Google OAuth permission. The backend stores a refresh token encrypted and uses it to request fresh access tokens automatically, so normal access-token expiry should not require a manual reconnection every hour. If the user revokes permission, Google rejects the refresh token, or the OAuth configuration changes, the user must reconnect Google Calendar.

Calendar connection is optional: T.i.M.E.S. remains usable without it. Do not say that it syncs every Google Calendar feature or that it works without the user's explicit Google permission.

NOTIFICATIONS AND TELEGRAM
Telegram notifications are sent through the MR.Zettascale bot after the user connects Telegram. Notification controls can be set per device. This supports a setup where a main computer edits data while another device, such as a Raspberry Pi with the public web app open, is used to watch for notifications.

The app tracks notification counts and has a daily safety quota shared by reminders, activity notifications, and eligible buffers. Do not promise a notification beyond that quota. If the device responsible for checking notifications is offline, asleep, muted, or has not received the latest data, it may not send a notification at that time.

MR.ZETTASCALE
MR.Zettascale in the web app is currently an Activity Mode planning assistant. It helps turn natural language or template-chat choices into one activity draft. It can infer a missing date, approximate time period, duration, semantic tags, and category suggestion, but the user reviews the draft and explicitly confirms it before an activity is created. It never silently creates or saves an activity.

The template chat is a no-AI-quota guided branch flow. The direct text chat uses Gemini and consumes the user's AI quota. The assistant's direct answers about T.i.M.E.S. must use only this knowledge document. It should answer in the user's language, be concise first, and say clearly when the requested capability is not listed here.

DATA, SYNC, AND PRIVACY
Main user data is separated by Firebase UID and stored in Firestore. Added, edited, and deleted data can synchronize between signed-in devices using the same account when those devices are online and able to refresh their data. This is not a promise of instant delivery in every offline or sleeping-device situation.

MR.Zettascale template-chat history, the currently selected chat branch, and an unfinished local activity draft are saved only in the browser's Local Storage. They are not stored in Firestore, do not consume cloud database operations, and do not automatically appear on another device. Pressing “เริ่มใหม่” clears that local chat history.

ANSWERING RULES
Use only the facts above for product questions. Do not invent pricing, guarantees, integrations, background services, notification schedules, or features not explicitly described here. If information is absent, say: "ผมยังไม่มีข้อมูลยืนยันเกี่ยวกับส่วนนั้นใน T.i.M.E.S. ครับ".
`;

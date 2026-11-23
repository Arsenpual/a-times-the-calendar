# Project Directory Structure (T.i.M.E.S.)

โครงสร้างไฟล์จริงของโปรเจกต์หลังจัดระเบียบตาม Feature-based Architecture และแยกทิศทาง Dependency (`app/` → `features/*` → `shared/*`)

```text
a-times-the-calendar/
├── AGENTS.md
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── backend/
│   ├── index.js                              # Express entry point & route wiring
│   ├── package.json
│   ├── docs/                                 # เอกสารตั้งค่า OAuth, Weather, Auto-deploy, Backend.md
│   ├── lib/                                  # Infrastructure & domain modules
│   │   ├── announcement-config.js
│   │   ├── calendar-oauth.js
│   │   ├── calendar-question.js
│   │   ├── cozy-desk-prompts.js              # Cozy Desk AI system instructions & safe workspace reader
│   │   ├── cozy-desk-sleep.js                # Cozy Desk sleep record sanitizer, schemas & summary
│   │   ├── cozy-desk-state.js                # Cozy Desk character runtime & daily token quota state
│   │   ├── firestore-db.js
│   │   ├── firestore-quota.js
│   │   ├── gemini-api.js
│   │   ├── gemini-chat.js
│   │   ├── google-news.js
│   │   ├── google-weather.js
│   │   ├── startup-task.js
│   │   ├── telegram-fetch.js
│   │   ├── telegram-news-controller.js       # Telegram News controller UI, pagination & formatters
│   │   ├── telegram-product-questions.js     # Telegram product FAQ nodes & announcement panel formatters
│   │   ├── telegram-weather.js
│   │   ├── weather-planning.js
│   │   └── zettascale-persona.js
│   ├── middleware/
│   │   └── require-auth.js
│   ├── routes/                               # Express routers แยกตาม endpoint
│   ├── skills/
│   │   └── activity-creation/                # AI Assistant prompt, schema, validator
│   └── tests/                                # Node test runner suites (19 ไฟล์, 163 tests)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── scripts/
│   │   ├── generate-brand-assets.mjs
│   │   └── run-tests.mjs
│   ├── src/
│   │   ├── main.jsx
│   │   ├── index.css                         # CSS manifest หลัก
│   │   ├── app/                              # App Shell & Account Composition
│   │   │   ├── app.jsx
│   │   │   ├── account-app.jsx
│   │   │   ├── dev-mockups.production.jsx
│   │   │   ├── components/                   # app-header, app-taskbar, activity-auth-state, firestore-quota-banner
│   │   │   ├── hooks/                        # use-app-navigation, use-app-shell-ui
│   │   │   └── styles/                       # app-shell.css, app-header.css, app-taskbar.css
│   │   ├── features/
│   │   │   ├── activity/                     # Activity Mode (Week Spine, Daily Planner, Summaries, Archive)
│   │   │   │   ├── api/
│   │   │   │   ├── assistant/                # MR.Zettascale AI Assistant sub-feature
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/                    # รวมถึง use-activity-workspace.js
│   │   │   │   ├── lib/
│   │   │   │   ├── services/
│   │   │   │   └── styles/
│   │   │   ├── announcements/                # Announcement ticker (api, components, hooks, styles)
│   │   │   ├── auth/                         # Firebase & Google Auth (api, hooks, styles)
│   │   │   ├── calendar-connection/          # Calendar token/reauth overlays (components, styles)
│   │   │   ├── cozy-desk/                    # Cozy Desk Mode (api, components, game, hooks, lib, styles, types — ทุกไฟล์ ≤ 800 บรรทัด)
│   │   │   ├── notifications/                # Push & Telegram notifications (api, components, hooks, lib)
│   │   │   ├── reminder/                     # Reminder Mode (api, components, hooks, lib, styles)
│   │   │   └── settings/                     # Settings Drawer & Data Lab (api, components, hooks, lib)
│   │   ├── shared/                           # โค้ดส่วนกลาง (ไม่มี dependency ย้อนกลับไป features/ หรือ app/)
│   │   │   ├── api/                          # client.js, google-calendar.js, firestore-quota-status.js, in-flight-reads.js
│   │   │   ├── config/                       # firebase-config.js, firebase-auth.js, assistant-preference-fields.js
│   │   │   ├── hooks/                        # use-session-task-guard.js
│   │   │   ├── i18n/                         # i18n.jsx, i18n-catalog.js
│   │   │   ├── lib/                          # date-utils.js, id-utils.js, lonth-engine.js, activity-colors.js, timeline-layout.js
│   │   │   ├── styles/                       # global.css, popup-layer.css, portal-theme.css
│   │   │   └── ui/                           # auto-shrink-text.jsx, brand-wordmark.jsx, popup-layer.jsx
│   │   └── dev/
│   │       └── mockups/                      # Dev-only UI mockups (ถูกแยกออกจาก production bundle)
│   └── tests/
│       ├── integration/                      # Integration & architecture boundary test suites (*.test.mjs)
│       ├── browser/                          # Playwright headless Chrome regression suites (*-browser.mjs)
│       └── fixtures/                         # HTML/JSX test harnesses
├── functions/                                # Firebase Cloud Functions & shared reminder domain logic
│   ├── index.js
│   └── domain/                               # reminder-due-logic.js, interval-schedule.js
├── cloud-run-reminder-worker/                # Cloud Run worker สำหรับส่งแจ้งเตือน
├── mr-zettascale/                            # Python Data Lab (`mr_zettascale_data`) และเอกสารตัวละคร
├── docs/                                     # เอกสารสถาปัตยกรรม, Deep Dive, OAuth verification, และ archive
└── diagram/                                  # แผนภาพสถาปัตยกรรม (Mermaid / SVG / PDF)
```

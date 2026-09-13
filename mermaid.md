```mermaid
[flowchart TD

subgraph group_frontend["React frontend"]
  node_web_entry["Vite entry<br/>React bootstrap<br/>[main.jsx]"]
  node_app_shell["App shell &amp; navigation<br/>React shell<br/>[app.jsx]"]
  node_api_client["Shared API client<br/>browser API boundary<br/>[client.js]"]
  node_firebase_browser["Firebase auth/config<br/>browser identity<br/>[firebase-auth.js]"]
  node_activity_workspace["Activity workspace<br/>feature module"]
  node_timeline_views["Timeline views<br/>visualization"]
  node_reminder_workspace["Reminder workspace<br/>feature module<br/>[reminder-mode.jsx]"]
  node_reminder_sync["Reminder store &amp; sync<br/>feature hook"]
  node_client_due_logic["Client due logic<br/>schedule domain"]
  node_fcm_service_worker["FCM service worker<br/>push receiver"]
end

subgraph group_backend["Node API"]
  node_api_entry["Node API server<br/>HTTP service<br/>[index.js]"]
  node_auth_middleware["Auth middleware<br/>request guard<br/>[require-auth.js]"]
  node_firestore_access[("Firestore access layer<br/>persistence adapter<br/>[firestore-db.js]")]
  node_calendar_oauth["Calendar OAuth<br/>integration adapter<br/>[calendar-oauth.js]"]
  node_api_routes["Domain route groups<br/>HTTP routes<br/>[reminders.js]"]
end

subgraph group_delivery["Reminder delivery"]
  node_functions{{"Firebase Functions<br/>scheduled orchestration<br/>[index.js]"}}
  node_worker["Cloud Run reminder worker<br/>delivery worker<br/>[index.js]"]
end

node_firebase_auth(("Firebase Authentication<br/>identity provider"))
node_firestore[("Cloud Firestore<br/>managed database<br/>[firestore.rules]")]
node_google_calendar(("Google Calendar<br/>calendar provider"))
node_notification_channels(("Push &amp; Telegram<br/>notification providers"))
node_gemini(("Gemini<br/>AI provider"))

node_web_entry -->|"mounts"| node_app_shell
node_app_shell -->|"Activity mode"| node_activity_workspace
node_app_shell -->|"Reminder mode"| node_reminder_workspace
node_activity_workspace -->|"planning data"| node_timeline_views
node_reminder_workspace -->|"coordinates state"| node_reminder_sync
node_reminder_sync -->|"calculates due state"| node_client_due_logic
node_activity_workspace -->|"domain requests"| node_api_client
node_reminder_sync -->|"syncs reminders"| node_api_client
node_api_client -->|"authenticated HTTP"| node_api_entry
node_firebase_browser -->|"sign-in"| node_firebase_auth
node_firebase_browser -->|"auth token"| node_api_client
node_api_entry -->|"protects requests"| node_auth_middleware
node_auth_middleware -->|"verifies identity"| node_firebase_auth
node_auth_middleware -->|"authorizes handlers"| node_api_routes
node_api_routes -->|"persists domain data"| node_firestore_access
node_firestore_access -->|"reads/writes"| node_firestore
node_api_routes -->|"calendar connection"| node_calendar_oauth
node_calendar_oauth -->|"OAuth &amp; events"| node_google_calendar
node_api_routes -->|"tokens &amp; Telegram"| node_notification_channels
node_api_routes -->|"activity drafts"| node_gemini
node_notification_channels -->|"browser push"| node_fcm_service_worker
node_functions -->|"scheduled reminder data"| node_firestore
node_functions -->|"dispatches delivery work"| node_worker
node_worker -->|"delivers reminders"| node_notification_channels

click node_web_entry "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/main.jsx"
click node_app_shell "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/app/app.jsx"
click node_api_client "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/shared/api/client.js"
click node_firebase_browser "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/shared/config/firebase-auth.js"
click node_activity_workspace "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/features/activity/hooks/use-activity-archive.js"
click node_timeline_views "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/features/activity/components/activity-mode-week-spine.jsx"
click node_reminder_workspace "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/features/reminder/components/reminder-mode.jsx"
click node_reminder_sync "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/features/reminder/hooks/use-reminders-sync.js"
click node_client_due_logic "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/src/features/reminder/lib/reminder-due-logic.js"
click node_fcm_service_worker "https://github.com/arsenpual/a-times-the-calendar/blob/main/frontend/public/firebase-messaging-sw.js"
click node_api_entry "https://github.com/arsenpual/a-times-the-calendar/blob/main/backend/index.js"
click node_auth_middleware "https://github.com/arsenpual/a-times-the-calendar/blob/main/backend/middleware/require-auth.js"
click node_firestore_access "https://github.com/arsenpual/a-times-the-calendar/blob/main/backend/firestore-db.js"
click node_calendar_oauth "https://github.com/arsenpual/a-times-the-calendar/blob/main/backend/calendar-oauth.js"
click node_api_routes "https://github.com/arsenpual/a-times-the-calendar/blob/main/backend/routes/reminders.js"
click node_functions "https://github.com/arsenpual/a-times-the-calendar/blob/main/functions/index.js"
click node_worker "https://github.com/arsenpual/a-times-the-calendar/blob/main/cloud-run-reminder-worker/index.js"
click node_firestore "https://github.com/arsenpual/a-times-the-calendar/blob/main/firestore.rules"

classDef toneNeutral fill:#f8fafc,stroke:#334155,stroke-width:1.5px,color:#0f172a
classDef toneBlue fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#172554
classDef toneAmber fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f
classDef toneMint fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d
classDef toneRose fill:#ffe4e6,stroke:#e11d48,stroke-width:1.5px,color:#881337
classDef toneIndigo fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#312e81
classDef toneTeal fill:#ccfbf1,stroke:#0f766e,stroke-width:1.5px,color:#134e4a
class node_web_entry,node_app_shell,node_api_client,node_firebase_browser,node_activity_workspace,node_timeline_views,node_reminder_workspace,node_reminder_sync,node_client_due_logic,node_fcm_service_worker toneBlue
class node_api_entry,node_auth_middleware,node_firestore_access,node_calendar_oauth,node_api_routes toneAmber
class node_functions,node_worker toneMint
class node_firebase_auth,node_firestore,node_google_calendar,node_notification_channels,node_gemini toneNeutral]

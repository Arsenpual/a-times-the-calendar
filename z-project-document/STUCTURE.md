Directory structure:
└── arsenpual-a-times-the-calendar/
    ├── firebase.json
    ├── firestore.indexes.json
    ├── firestore.rules
    ├── package.json
    ├── session-summary.md
    ├── .firebaserc
    ├── backend/
    │   ├── firestore-db.js
    │   ├── index.js
    │   ├── package.json
    │   ├── .env.example
    │   ├── middleware/
    │   │   └── require-auth.js
    │   ├── routes/
    │   │   ├── activity-categories.js
    │   │   ├── categories.js
    │   │   ├── fcm-tokens.js
    │   │   ├── reminder-groups.js
    │   │   ├── reminders.js
    │   │   └── summary.js
    │   └── scripts/
    │       └── firestore-rules.test.js
    ├── frontend/
    │   ├── index.html
    │   ├── package.json
    │   ├── vite.config.js
    │   ├── .env.example
    │   ├── public/
    │   │   ├── firebase-messaging-sw.js
    │   │   ├── privacy.html
    │   │   ├── robots.txt
    │   │   └── sitemap.xml
    │   └── src/
    │       ├── activity-colors.js
    │       ├── api.js
    │       ├── app.jsx
    │       ├── date-utils.js
    │       ├── export-day-image.js
    │       ├── firebase-config.js
    │       ├── google-calendar.js
    │       ├── i18n.jsx
    │       ├── id-utils.js
    │       ├── main.jsx
    │       ├── reminder-due-logic.js
    │       ├── reminder-telemetry.js
    │       ├── rrule-utils.js
    │       ├── timeline-layout.js
    │       ├── components/
    │       │   ├── activity-modal.jsx
    │       │   ├── activity-mode.jsx
    │       │   ├── activity-popup.jsx
    │       │   ├── announcement-ticker.jsx
    │       │   ├── auto-shrink-text.jsx
    │       │   ├── mini-timeline-panel.jsx
    │       │   ├── reminder-dashboard-mockup.jsx
    │       │   ├── settings-drawer.jsx
    │       │   ├── tag-search-results.jsx
    │       │   ├── timeline-editor.jsx
    │       │   └── weekly-summary-panel.jsx
    │       └── hooks/
    │           ├── use-activity-modal.js
    │           ├── use-activity-mutations.js
    │           ├── use-auth.js
    │           ├── use-calendar-data.js
    │           ├── use-push-notifications.js
    │           ├── use-reminder-groups.js
    │           ├── use-reminders-sync.js
    │           ├── use-tag-search.js
    │           └── use-week-navigation.js
    ├── functions/
    │   ├── README.md
    │   ├── index.js
    │   ├── package.json
    │   └── reminder-due-logic.js
    ├── z-database-document/
    │   └── DATA-MODEL.md
    └── .github/
        └── workflows/
            └── deploy-frontend.yml
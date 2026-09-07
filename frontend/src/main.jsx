import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/app.jsx";
import { LanguageProvider } from "./shared/i18n/i18n.jsx";
import "./index.css";
import "./dev/mockups/activity-mode-mockup-support.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);

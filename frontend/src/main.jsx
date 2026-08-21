import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app.jsx";
import { LanguageProvider } from "./i18n.jsx";
import "./index.css";
import "./styles/activity-mode-mockup-support.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);

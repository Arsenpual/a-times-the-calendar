import React from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider, useLanguage } from "../../src/shared/i18n/i18n.jsx";

function Fixture() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <main>
      <output data-testid="language">{language}</output>
      <p data-testid="today">{t("header.today")}</p>
      <button type="button" onClick={() => setLanguage("th")}>ไทย</button>
      <button type="button" onClick={() => setLanguage("en")}>English</button>
      <button type="button" onClick={() => setLanguage("invalid")}>Invalid</button>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <LanguageProvider><Fixture /></LanguageProvider>
);

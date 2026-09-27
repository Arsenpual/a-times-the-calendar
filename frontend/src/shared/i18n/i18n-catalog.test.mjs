import assert from "node:assert/strict";
import {
  DEFAULT_LANGUAGE,
  MONTHS,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  WEEKDAYS_SHORT,
  displayYear,
  translate
} from "./i18n-catalog.js";

assert.deepEqual(SUPPORTED_LANGUAGES, ["th", "en"]);
assert.equal(DEFAULT_LANGUAGE, "th");
assert.deepEqual(Object.keys(TRANSLATIONS.th).sort(), Object.keys(TRANSLATIONS.en).sort(), "Thai and English keys must stay in sync");
assert.equal(translate("th", "agenda.activityCountShort", { count: 3 }), "3 กิจกรรม");
assert.equal(translate("en", "agenda.activityCountShort", { count: 3 }), "3 activities");
assert.equal(translate("unknown", "header.today"), "วันนี้", "unsupported language falls back to Thai");
assert.equal(translate("en", "missing.key"), "missing.key", "missing key remains visible");
assert.equal(MONTHS.th.length, 12);
assert.equal(MONTHS.en.length, 12);
assert.equal(WEEKDAYS_SHORT.th.length, 7);
assert.equal(WEEKDAYS_SHORT.en.length, 7);
assert.equal(displayYear(2027, "th"), 2570);
assert.equal(displayYear(2027, "en"), 2027);

console.log("PASS: i18n language parity, interpolation, fallback and locale data");

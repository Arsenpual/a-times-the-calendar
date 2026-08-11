// ระบบ i18n กลางของแอป — เก็บทั้ง UI string dictionary และ locale data
// สำหรับวันที่ (ชื่อเดือน/วันในสัปดาห์/ปี พ.ศ.-ค.ศ.) ไว้ในไฟล์เดียว เพื่อไม่
// ให้ date-utils.js ต้องรู้จัก React Context เอง — ฟังก์ชัน format วันที่
// ทุกตัวรับ `lang` เป็นพารามิเตอร์ตรงๆ (ปกติ "th"|"en") แทนที่จะอ่านจาก
// context ภายในตัวเอง เพื่อให้ยังเป็น pure function เรียกใช้แยกจาก React
// component ได้เหมือนเดิม (เช่น export-day-image.js ที่วาดลง canvas)
//
// การเพิ่มภาษาที่ 3 ในอนาคต: เพิ่ม key ใหม่ในทุก object ด้านล่าง
// (STRINGS, MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, WEEKDAYS_FULL) แล้วเพิ่ม
// ตัวเลือกใน settings-drawer.jsx — ไม่ต้องแก้ไฟล์อื่นเลยตราบใดที่ทุกจุดใน
// แอปเรียกผ่าน t()/formatMonthYear()/ฯลฯ เท่านั้น ไม่ hardcode ข้อความไทย
// ตรงๆ อีก

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export const SUPPORTED_LANGUAGES = ["th", "en"];
export const DEFAULT_LANGUAGE = "th";
const STORAGE_KEY = "language";

// ---------------------------------------------------------------------------
// Locale data สำหรับวันที่ — แยกจาก STRINGS (UI labels) เพราะโครงสร้างต่างกัน
// (array ตามลำดับเดือน/วัน ไม่ใช่ key-value ตาม UI concept)
// ---------------------------------------------------------------------------

export const MONTHS = {
  th: ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],
  en: ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]
};

export const MONTHS_SHORT = {
  th: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
};

// Sunday-first เสมอทั้งสองภาษา (ตรงกับ Date.getDay() และ getWeekRange ใน
// date-utils.js ที่ผูกกับ Sunday-start week อยู่แล้วในทุกจุดของแอป)
export const WEEKDAYS_SHORT = {
  th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

export const WEEKDAYS_FULL = {
  th: ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
};

/**
 * แปลงปี ค.ศ. (JS Date.getFullYear()) เป็นปีที่ควรแสดงผลตามภาษา — ไทยใช้
 * พ.ศ. (ค.ศ. + 543) เสมอ, อังกฤษใช้ ค.ศ. ตรงๆ ศูนย์กลางจุดเดียวสำหรับ +543
 * แทนที่จะกระจาย "+ 543" ไว้ทั่วทุกไฟล์แบบเดิม (date-utils.js เคยทำแบบนั้น
 * ในหลายฟังก์ชัน) ลดความเสี่ยงลืมแปลงจุดใดจุดหนึ่งตอนเพิ่มภาษา
 */
export function displayYear(ceYear, lang) {
  return lang === "th" ? ceYear + 543 : ceYear;
}

// ---------------------------------------------------------------------------
// UI string dictionary — key เป็น dot-path ตามหมวดหมู่ (header, agenda,
// activity, settings, ฯลฯ) เพื่อให้จัดกลุ่มดูง่ายและกันชื่อชนกัน
// ---------------------------------------------------------------------------

const STRINGS = {
  th: {
    "header.prevWeek": "สัปดาห์ก่อนหน้า",
    "header.nextWeek": "สัปดาห์ถัดไป",
    "header.today": "วันนี้",
    "header.addActivity": "เพิ่มกิจกรรม",
    "header.signOut": "ออกจากระบบ",
    "header.settings": "การตั้งค่า",
    "settings.title": "การตั้งค่า",
    "settings.close": "ปิดการตั้งค่า",
    "settings.display": "การแสดงผล",
    "settings.darkMode": "Dark Mode",
    "settings.darkModeDesc": "เปลี่ยนธีมเป็นโหมดมืด ลดแสงจ้าตอนใช้งานตอนกลางคืน",
    "settings.language": "ภาษา",
    "settings.languageDesc": "เปลี่ยนภาษาที่ใช้แสดงผลทั้งแอป รวมถึงวันที่และชื่อเดือน",
    "settings.languageTh": "ไทย",
    "settings.languageEn": "English",
    "agenda.addActivity": "เพิ่มกิจกรรม",
    "agenda.empty": "ว่างทั้งวัน 🌤️",
    "agenda.activityCount": "กิจกรรม",
    "agenda.editTimes": "แก้ไขเวลากิจกรรม",
    "agenda.closeEditTimes": "ปิดโหมดแก้ไขเวลากิจกรรม",
    "agenda.openEditTimes": "เปิดโหมดแก้ไขเวลากิจกรรม",
    "agenda.selectDay": "เลือกวันที่ {date} — มี {count} กิจกรรม",
    "agenda.viewMiniTimeline": "ดู mini timeline วันที่ {date} — มี {count} กิจกรรม",
    "agenda.activityCountShort": "{count} กิจกรรม",
    "app.brandCalendar": "ปฏิทิน",
    "app.brandOf": "ของ",
    "app.brandMe": "ฉัน",
    "app.loginHeadline": "สรุปชีวิตคุณ ทุกสัปดาห์",
    "app.checkingLogin": "กำลังตรวจสอบสถานะการเข้าสู่ระบบ...",
    "app.reauthNeeded": "ต้องยืนยันตัวตนกับ Google Calendar อีกครั้งเพื่อดึงปฏิทินของคุณมาแสดง",
    "app.modeSwitch": "สลับโหมด",
    "app.mockupOnly": "ยังเป็นแค่ mockup — ใช้งานจริงไม่ได้",
    "app.prevWeek": "สัปดาห์ก่อนหน้า",
    "app.nextWeek": "สัปดาห์ถัดไป",
    "app.tagSearchPlaceholderEmpty": "ค้นหาด้วย tag...",
    "app.tagSearchPlaceholderFilled": "เพิ่ม tag...",
    "app.tagSearchAriaLabel": "ค้นหากิจกรรมด้วย tag — พิมพ์แล้วกด Enter เพื่อค้นหาได้หลาย tag พร้อมกัน",
    "app.clearAllSearch": "ล้างคำค้นหาทั้งหมด",
    "app.removeSearchTerm": "ลบคำค้นหา {term}",
    "app.openSettings": "เปิดการตั้งค่า",
    "app.settingsTitle": "การตั้งค่า",
    "app.loginGuideAriaLabel": "วิธีเข้าสู่ระบบ Google",
    "app.close": "ปิด",
    "app.stepImageAlt": "ขั้นตอนที่ {number}",
    "app.errorActivityLockedCategory": "กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเปลี่ยนหมวดหมู่",
    "app.errorActivityConflictOverwritten": "กิจกรรมนี้ถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว",
    "app.errorActivityLockedEditDelete": "กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไขหรือลบ",
    "app.errorCalendarTokenExpiredSaving": "สิทธิ์เข้าถึง Google Calendar หมดอายุระหว่างบันทึก — กรุณายืนยันตัวตนอีกครั้งแล้วลองอีกครั้ง",
    "app.errorSomeLockedSomeConflict": "บางกิจกรรมถูกล็อกไว้จึงข้ามไป และบางกิจกรรมถูกแก้ไขที่อื่น — บันทึกทับข้อมูลนั้นแล้ว",
    "app.errorSomeLockedNotSaved": "บางกิจกรรมถูกล็อกไว้จึงไม่ถูกบันทึก",
    "app.errorSomeConflictOverwritten": "บางกิจกรรมถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว",
    "app.errorActivityLockedEdit": "กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไข",
    "app.errorLoadSeriesFailed": "โหลดข้อมูลชุดกิจกรรมไม่สำเร็จ: {message}",
    "app.errorActivityLockedDelete": "กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนลบ",
    "app.errorSeriesLockedDelete": "บางกิจกรรมในชุดนี้ถูกล็อกไว้ — ปลดล็อกทั้งหมดก่อนลบทั้งชุด",
    "app.errorActivityLockedMove": "กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนย้ายวัน",
    "app.errorActivityLockedColor": "กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเปลี่ยนสี",
    "app.errorCategorySaveFailed": "บันทึกหมวดหมู่ไม่สำเร็จ: {message}",
    "app.errorTagSaveFailed": "บันทึก tag ไม่สำเร็จ: {message}",
    "app.errorActivityConflictOnSaveNamed": "กิจกรรม \"{name}\" ถูกแก้ไขที่อื่นหลังจากเปิดฟอร์มนี้ — บันทึกทับข้อมูลล่าสุดแล้ว",
    "app.errorSomeTimesFailed": "ปรับเวลาบางกิจกรรมไม่สำเร็จ — {reasons}",
    "app.errorDuplicateCategorySaveFailed": "ทำสำเนากิจกรรมสำเร็จ แต่บันทึกหมวดหมู่ของสำเนาไม่สำเร็จ: {message}",
    "app.errorDuplicateTagSaveFailed": "ทำสำเนากิจกรรมสำเร็จ แต่บันทึก tag ของสำเนาไม่สำเร็จ: {message}",
    "app.tokenExpiredMarker": "หมดอายุ",
    "app.errorLockToggleFailed": "{action}กิจกรรมไม่สำเร็จ: {message}",
    "app.lockActionLock": "ล็อก",
    "app.lockActionUnlock": "ปลดล็อก",
    "app.tokenNearExpiryAriaLabel": "แจ้งเตือนสิทธิ์เข้าถึง Google Calendar ใกล้หมดอายุ",
    "app.tokenExpiredAriaLabel": "ต้องยืนยันตัวตนกับ Google Calendar อีกครั้ง",
    "app.tokenNearExpiryMessage": "สิทธิ์เข้าถึง Google Calendar ใกล้หมดอายุ — ต่ออายุตอนนี้เพื่อไม่ให้การใช้งานสะดุด",
    "app.tokenExpiredMessage": "สิทธิ์เข้าถึง Google Calendar หมดอายุแล้ว — ยืนยันตัวตนอีกครั้งเพื่อดึงปฏิทินของคุณกลับมาแสดง",
    "app.renewNow": "ต่ออายุตอนนี้",
    "app.reauthenticate": "ยืนยันตัวตน",
    "app.loginSubtext": "เข้าสู่ระบบด้วย Google เพื่อ sync ปฏิทินของคุณโดยตรง — ปลอดภัย ไม่มีการเก็บสำเนาข้อมูลกิจกรรมไว้ที่อื่น",
    "app.signInWithGoogle": "เข้าสู่ระบบด้วย Google",
    "app.loginGuideTitle": "📌 วิธีเข้าใช้งานครั้งแรก (3 ขั้นตอนง่ายๆ)",
    "app.loginGuideNote": "เนื่องจากระบบกำลังอยู่ในช่วงยื่นขอการยืนยันสิทธิ์จาก Google ท่านสามารถกดข้ามตามขั้นตอนด้านล่างเพื่อเข้าใช้งานได้อย่างปลอดภัย",
    "app.loginGuideStepPlaceholder": "รูปประกอบ Step {number}",
    "app.loginGuideStepLabel": "Step {number}:",
    "app.loginGuideFootnote": "📌 หมายเหตุ:",
    "app.loginGuideFootnoteText": "ทำขั้นตอนเหล่านี้แค่ครั้งแรกที่เข้าสู่ระบบเท่านั้น เมื่อเข้าสู่ระบบสำเร็จแล้ว ครั้งถัดไปจะเข้าหน้าแอปได้ทันทีโดยไม่ขึ้นหน้าเตือนนี้อีก",
    "app.loginGuideStep1": "เมื่อเจอหน้าเตือนสีแดง ให้กดปุ่ม \"ขั้นสูง\" ที่มุมซ้ายล่าง",
    "app.loginGuideStep2": "เลื่อนลงล่างสุด แล้วคลิก \"ไปที่ times-the-calendar.firebaseapp.com (ไม่ปลอดภัย)\"",
    "app.loginGuideStep3": "กดปุ่ม \"ดำเนินต่อ\" ที่มุมขวาล่างเพื่ออนุญาตสิทธิ์ปฏิทิน",
    "app.loading": "กำลังโหลด...",
    "app.tagSearchResultsCount": "พบ {count} กิจกรรมที่มี tag ตรงกับ {terms} (ค้นหาช่วง ±3 เดือนจากวันนี้)",
    "app.devSimulateExpiryAriaLabel": "[ทดสอบ] จำลอง token ใกล้หมดอายุ",
    "app.devSimulateExpiryTitle": "[DEV] จำลอง token ใกล้หมดอายุ (เหลือ 4 นาที) — ลบปุ่มนี้ก่อน deploy จริง",
    "app.orWordJoiner": "หรือ",
    "app.untitledActivity": "(ไม่มีชื่อ)"
  },
  en: {
    "header.prevWeek": "Previous week",
    "header.nextWeek": "Next week",
    "header.today": "Today",
    "header.addActivity": "Add activity",
    "header.signOut": "Sign out",
    "header.settings": "Settings",
    "settings.title": "Settings",
    "settings.close": "Close settings",
    "settings.display": "Display",
    "settings.darkMode": "Dark Mode",
    "settings.darkModeDesc": "Switch to a dark theme to reduce glare at night.",
    "settings.language": "Language",
    "settings.languageDesc": "Change the language used across the app, including dates and month names.",
    "settings.languageTh": "ไทย",
    "settings.languageEn": "English",
    "agenda.addActivity": "Add activity",
    "agenda.empty": "Free all day 🌤️",
    "agenda.activityCount": "activities",
    "agenda.editTimes": "Edit activity times",
    "agenda.closeEditTimes": "Close time editor",
    "agenda.openEditTimes": "Open time editor",
    "agenda.selectDay": "Select {date} — {count} activities",
    "agenda.viewMiniTimeline": "View mini timeline for {date} — {count} activities",
    "agenda.activityCountShort": "{count} activities",
    "app.brandCalendar": "Cal",
    "app.brandOf": "of",
    "app.brandMe": "Me",
    "app.loginHeadline": "Your life, summarized every week",
    "app.checkingLogin": "Checking sign-in status...",
    "app.reauthNeeded": "You need to re-authenticate with Google Calendar to load your calendar",
    "app.modeSwitch": "Switch mode",
    "app.mockupOnly": "Still just a mockup — not functional yet",
    "app.prevWeek": "Previous week",
    "app.nextWeek": "Next week",
    "app.tagSearchPlaceholderEmpty": "Search by tag...",
    "app.tagSearchPlaceholderFilled": "Add tag...",
    "app.tagSearchAriaLabel": "Search activities by tag — type and press Enter to search multiple tags at once",
    "app.clearAllSearch": "Clear all search terms",
    "app.removeSearchTerm": "Remove search term {term}",
    "app.openSettings": "Open settings",
    "app.settingsTitle": "Settings",
    "app.loginGuideAriaLabel": "How to sign in with Google",
    "app.close": "Close",
    "app.stepImageAlt": "Step {number}",
    "app.errorActivityLockedCategory": "This activity is locked — unlock it before changing its category",
    "app.errorActivityConflictOverwritten": "This activity was edited elsewhere after the latest load — your save overwrote that change",
    "app.errorActivityLockedEditDelete": "This activity is locked — unlock it before editing or deleting",
    "app.errorCalendarTokenExpiredSaving": "Google Calendar access expired while saving — please re-authenticate and try again",
    "app.errorSomeLockedSomeConflict": "Some activities were locked and skipped, and some were edited elsewhere — those changes were overwritten",
    "app.errorSomeLockedNotSaved": "Some activities were locked and not saved",
    "app.errorSomeConflictOverwritten": "Some activities were edited elsewhere after the latest load — those changes were overwritten",
    "app.errorActivityLockedEdit": "This activity is locked — unlock it before editing",
    "app.errorLoadSeriesFailed": "Failed to load the activity series: {message}",
    "app.errorActivityLockedDelete": "This activity is locked — unlock it before deleting",
    "app.errorSeriesLockedDelete": "Some activities in this series are locked — unlock all of them before deleting the series",
    "app.errorActivityLockedMove": "This activity is locked — unlock it before moving it to another day",
    "app.errorActivityLockedColor": "This activity is locked — unlock it before changing its color",
    "app.errorCategorySaveFailed": "Failed to save category: {message}",
    "app.errorTagSaveFailed": "Failed to save tags: {message}",
    "app.errorActivityConflictOnSaveNamed": "\"{name}\" was edited elsewhere after this form was opened — your save overwrote the latest change",
    "app.errorSomeTimesFailed": "Failed to adjust some activity times — {reasons}",
    "app.errorDuplicateCategorySaveFailed": "Activity duplicated, but saving the copy's category failed: {message}",
    "app.errorDuplicateTagSaveFailed": "Activity duplicated, but saving the copy's tags failed: {message}",
    "app.tokenExpiredMarker": "expired",
    "app.errorLockToggleFailed": "Failed to {action} activity: {message}",
    "app.lockActionLock": "lock",
    "app.lockActionUnlock": "unlock",
    "app.tokenNearExpiryAriaLabel": "Google Calendar access is about to expire",
    "app.tokenExpiredAriaLabel": "You need to re-authenticate with Google Calendar",
    "app.tokenNearExpiryMessage": "Google Calendar access is about to expire — renew now to avoid interruption",
    "app.tokenExpiredMessage": "Google Calendar access has expired — re-authenticate to load your calendar again",
    "app.renewNow": "Renew now",
    "app.reauthenticate": "Re-authenticate",
    "app.loginSubtext": "Sign in with Google to sync your calendar directly — secure, with no copy of your activity data stored elsewhere",
    "app.signInWithGoogle": "Sign in with Google",
    "app.loginGuideTitle": "📌 First-time sign-in guide (3 easy steps)",
    "app.loginGuideNote": "Since the app is currently pending Google's verification review, you can safely proceed through the steps below to sign in.",
    "app.loginGuideStepPlaceholder": "Step {number} illustration",
    "app.loginGuideStepLabel": "Step {number}:",
    "app.loginGuideFootnote": "📌 Note:",
    "app.loginGuideFootnoteText": "You only need to do this the first time you sign in. Once signed in successfully, you'll go straight to the app on future visits without seeing this warning again.",
    "app.loginGuideStep1": "When you see the red warning screen, click \"Advanced\" in the bottom-left corner",
    "app.loginGuideStep2": "Scroll to the bottom and click \"Go to times-the-calendar.firebaseapp.com (unsafe)\"",
    "app.loginGuideStep3": "Click \"Continue\" in the bottom-right corner to grant calendar access",
    "app.loading": "Loading...",
    "app.tagSearchResultsCount": "Found {count} activities matching tag {terms} (searching ±3 months from today)",
    "app.devSimulateExpiryAriaLabel": "[Test] Simulate token nearing expiry",
    "app.devSimulateExpiryTitle": "[DEV] Simulate token nearing expiry (4 minutes left) — remove this button before deploying",
    "app.orWordJoiner": "or",
    "app.untitledActivity": "(Untitled)"
  }
};

/**
 * ดึงข้อความตาม key สำหรับภาษาที่ระบุ — คืน key ตรงๆ (ไม่ throw) ถ้าไม่พบ
 * ทั้งใน lang ที่ขอและ fallback "th" เพื่อให้เห็น key ที่ขาดชัดเจนในตัว UI
 * เอง แทนที่จะพังทั้งหน้าหรือแสดงค่าว่างเปล่าเงียบๆ
 *
 * รองรับ interpolation อย่างง่ายผ่าน vars: แทนที่ {name} ในข้อความด้วย
 * vars.name — พอสำหรับ UI ทั่วไปในแอปนี้ (แทรกตัวเลข/ชื่อวันเดี่ยวๆ) โดยไม่
 * ต้องพึ่ง library แยกต่างหากอย่าง i18next ที่ overkill สำหรับ dictionary
 * ขนาดเท่านี้
 */
export function translate(lang, key, vars) {
  let text = STRINGS[lang]?.[key] ?? STRINGS[DEFAULT_LANGUAGE]?.[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

// ---------------------------------------------------------------------------
// React Context — ให้ทุก component ดึงภาษาปัจจุบัน + ฟังก์ชัน t() ผ่าน
// useLanguage() แทนที่จะส่ง `language` เป็น prop ไล่ทุกชั้น (prop drilling)
// ---------------------------------------------------------------------------

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    // lang attribute บน <html> ช่วยทั้ง SEO/accessibility (screen reader
    // อ่านออกเสียงตามภาษาที่ถูกต้อง) และ CSS ที่อาจต้องพึ่ง :lang() selector
    // ในอนาคต — ตั้งไว้ตรงนี้จุดเดียว เหมือนที่ app.jsx ตั้ง data-theme ให้
    // dark mode ไว้แล้ว
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;
    setLanguageState(lang);
  }, []);

  const t = useCallback((key, vars) => translate(language, key, vars), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * @returns {{ language: "th"|"en", setLanguage: (lang: string) => void, t: (key: string) => string }}
 */
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage() ต้องเรียกภายใต้ <LanguageProvider> เท่านั้น");
  }
  return ctx;
}

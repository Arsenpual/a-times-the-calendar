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
    "agenda.activityCountShort": "{count} กิจกรรม"
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
    "agenda.activityCountShort": "{count} activities"
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

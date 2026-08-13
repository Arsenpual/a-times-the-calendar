import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReminders, saveReminder, deleteReminderRemote } from "../api.js";

/**
 * เบื้องต้น sync แค่ "วัน/เวลา" ของ reminder เข้า Firebase — ดู
 * routes/reminders.js ฝั่ง backend สำหรับรายชื่อฟิลด์ที่ถือว่าเป็น
 * schedule field เทียบกับ runtime field (startedAt, accumulatedMs,
 * currentIndex, lastTriggeredAt, nextDueAt) ที่ยังอยู่ localStorage
 * อย่างเดียว ไม่ส่งขึ้น backend ในเฟสนี้
 *
 * ออกแบบเป็น hook แยกต่างหาก ไม่ผูกกับ localStorage โดยตรง — ตัว
 * ReminderDashboard component ยังเป็นเจ้าของ `reminders` state และ
 * localStorage persistence เหมือนเดิมทั้งหมด (ดู reminder-mode-mockup.jsx)
 * hook นี้แค่เสริมสองอย่าง:
 *   1. ตอน login (firebaseUser เปลี่ยนจาก null เป็น user) — ดึง schedule
 *      fields ที่เคย sync ไว้จาก Firebase มาคืนให้ผ่าน remoteReminders,
 *      แล้วให้ผู้เรียก (ReminderDashboard) เป็นคนตัดสินใจ merge เข้ากับ
 *      localStorage state ของตัวเอง — hook นี้ไม่ setReminders ตรงๆ
 *      เพราะไม่รู้จัก shape ทั้งก้อนของ reminder (runtime fields อยู่ใน
 *      component เจ้าของ state)
 *   2. syncScheduleFields(reminderId, fields) — เรียกทุกครั้งที่ schedule
 *      field ของ reminder ตัวใดตัวหนึ่งเปลี่ยน (สร้างใหม่/แก้ไขผ่าน
 *      composer) เพื่อ push ขึ้น backend แบบ fire-and-forget (ไม่ block
 *      UI, error ไม่ทำให้ local save ล้มเหลวตาม — localStorage ยังเป็น
 *      source of truth หลักในเฟสนี้ Firebase เป็นแค่ mirror)
 *
 * @param {object} deps
 * @param {import("firebase/auth").User|null} deps.firebaseUser
 */
export function useRemindersSync({ firebaseUser }) {
  const [remoteReminders, setRemoteReminders] = useState(null); // null = ยังไม่เคยโหลด, {} = โหลดแล้วแต่ไม่มีข้อมูล
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!firebaseUser) {
      // ออกจากระบบ — เคลียร์ remoteReminders กลับเป็น null (ยังไม่เคยโหลด)
      // ไม่ใช่ {} เพราะ {} มีความหมายว่า "โหลดแล้วแต่ว่างเปล่า" ซึ่งผิด —
      // ตอนนี้ยังไม่รู้เลยว่าตอน login ครั้งถัดไปจะมีข้อมูลหรือไม่
      setRemoteReminders(null);
      return;
    }
    let cancelled = false;
    fetchReminders()
      .then((data) => {
        if (!cancelled) setRemoteReminders(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  // Debounce ต่อ reminder id — กันไม่ให้พิมพ์ในฟอร์ม composer แล้วยิง PUT
  // ทุก keystroke (ถ้าผู้เรียกเลือกเรียก syncScheduleFields ทุกครั้งที่
  // draft เปลี่ยนแทนที่จะเรียกตอน submit เท่านั้น) — เก็บ timer แยกตาม id
  // เพราะ reminder หลายตัวอาจถูกแก้ไขใกล้เคียงกันในเวลาสั้นๆ ไม่ควรให้
  // timer ของ id หนึ่งไปยกเลิก timer ของอีก id หนึ่ง
  const debounceTimers = useRef({});
  const SYNC_DEBOUNCE_MS = 800;

  /**
   * Push schedule fields ของ reminder หนึ่งตัวขึ้น Firebase — fire-and-
   * forget โดยตั้งใจ (ไม่ throw ให้ผู้เรียก, ไม่ block การบันทึก local)
   * เพราะ localStorage ยังเป็น source of truth หลักในเฟสนี้ ถ้า sync ขึ้น
   * backend ล้มเหลว (เช่น เน็ตหลุดชั่วคราว) reminder ยังใช้งานได้ปกติใน
   * เครื่องนี้ แค่ยังไม่ถูก mirror ขึ้น cloud เท่านั้น — ครั้งถัดไปที่ฟิลด์
   * เปลี่ยนแปลงอีก (หรือ retry ในอนาคตเมื่อมี sync queue จริงจังกว่านี้)
   * จะลองใหม่เอง
   * @param {string} reminderId
   * @param {object} fields schedule fields เท่านั้น (allow-list บังคับฝั่ง backend อยู่แล้ว)
   * @param {object} [options]
   * @param {boolean} [options.immediate] ข้าม debounce — ใช้ตอน submit ฟอร์ม (ไม่ใช่ตอนพิมพ์)
   */
  const syncScheduleFields = useCallback((reminderId, fields, options = {}) => {
    if (!firebaseUser) return; // ยังไม่ login — ไม่มี backend ให้ sync ไปหา

    const run = () => {
      saveReminder(reminderId, fields).catch((e) => {
        console.error(`[useRemindersSync] sync reminder ${reminderId} ไม่สำเร็จ:`, e.message);
      });
    };

    if (options.immediate) {
      clearTimeout(debounceTimers.current[reminderId]);
      delete debounceTimers.current[reminderId];
      run();
      return;
    }

    clearTimeout(debounceTimers.current[reminderId]);
    debounceTimers.current[reminderId] = setTimeout(() => {
      delete debounceTimers.current[reminderId];
      run();
    }, SYNC_DEBOUNCE_MS);
  }, [firebaseUser]);

  /** ลบ reminder ออกจาก Firebase — fire-and-forget เช่นเดียวกับ syncScheduleFields */
  const deleteRemoteReminder = useCallback((reminderId) => {
    if (!firebaseUser) return;
    clearTimeout(debounceTimers.current[reminderId]);
    delete debounceTimers.current[reminderId];
    deleteReminderRemote(reminderId).catch((e) => {
      console.error(`[useRemindersSync] ลบ reminder ${reminderId} บน backend ไม่สำเร็จ:`, e.message);
    });
  }, [firebaseUser]);

  // เคลียร์ debounce timer ทั้งหมดตอน unmount กัน setTimeout callback ที่
  // เหลือค้างพยายามเรียก saveReminder หลัง component หายไปแล้ว
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  return {
    remoteReminders,
    loadError,
    syncScheduleFields,
    deleteRemoteReminder
  };
}

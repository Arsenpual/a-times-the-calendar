import { useCallback, useEffect, useState } from "react";
import { firebaseApp, firebaseConfig } from "../firebase-config.js";
import { registerFcmToken, unregisterFcmToken } from "../api.js";

// ⚠️ SCAFFOLD — เขียนโครงไว้ก่อนตามที่ผู้ใช้ขอ (migration plan v2 เฟส 5)
// เพราะ Cloud Function ฝั่ง server (functions/index.js) ยัง deploy ไม่ได้
// ในสภาพแวดล้อมนี้ ทำให้ทดสอบ end-to-end แบบเต็มวงจรไม่ได้ (ต้องมี Firebase
// project จริง + VAPID key จริง + Cloud Function ที่ deploy แล้วจริง) —
// ส่วนที่ทดสอบได้จริงและทดสอบแล้ว (permission state, error handling,
// เรียก backend ถูก endpoint): ครบ ส่วนที่ทดสอบไม่ได้ในนี้: getToken()
// ของ Firebase Messaging SDK จริง (ต้องมี VAPID key จริง), การได้รับ push
// จริงตอนปิดแท็บ (ต้องมี Cloud Function ที่ deploy แล้วจริง)
//
// VAPID key ต้องตั้งเป็น env var ใหม่ VITE_FIREBASE_VAPID_KEY (หาได้จาก
// Firebase Console > Project Settings > Cloud Messaging > Web configuration
// > Web Push certificates) — ยังไม่ได้เพิ่มใน .env.example เพราะเฟสนี้
// ยังไม่ deploy จริง เพิ่มไว้เป็น TODO ให้ทำตอน deploy จริง

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const SERVICE_WORKER_PATH = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;

function messagingServiceWorkerUrl() {
  const url = new URL(SERVICE_WORKER_PATH, window.location.origin);
  // Service worker รันนอก Vite module graph จึงรับ config ผ่าน query string
  // (ค่า Firebase web config เป็น public identifier ไม่ใช่ secret)
  Object.entries(firebaseConfig).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

/**
 * Owns push-notification permission state + FCM token lifecycle
 * (migration plan v2 เฟส 5.2) — แยกจาก useRemindersSync/useReminderGroups
 * โดยตั้งใจ เพราะเป็นคนละ concern กันชัดเจน (permission ของเบราว์เซอร์ +
 * token ของอุปกรณ์ ไม่ใช่ข้อมูล reminder)
 *
 * ไม่ auto-request permission ตอน mount — ต้องให้ผู้ใช้กดเปิดเองผ่าน UI
 * (เช่น toggle ใน Settings) เท่านั้น เพราะ browser permission prompt ที่
 * โผล่มาเองโดยไม่มีบริบทมักโดนปฏิเสธ (ตามที่ระบุไว้ในแผน 5.2)
 */
export function usePushNotifications({ firebaseUser }) {
  // "unsupported" = เบราว์เซอร์นี้ไม่รองรับ Notification API เลย (เช่น
  // Safari เก่า หรือ iOS ที่ยังไม่ใช่ PWA แบบ installed) — ต้องเช็คก่อน
  // แตะ window.Notification เสมอ ไม่งั้น throw ทันทีบนเบราว์เซอร์ที่ไม่รองรับ
  const [permission, setPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission; // "default" | "granted" | "denied"
  });
  const [fcmToken, setFcmToken] = useState(null);
  const [error, setError] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);

  // ถ้า permission เคย "granted" มาก่อนแล้ว (จากรอบก่อนหน้า) และมี
  // firebaseUser อยู่แล้วตอนเปิดแอปครั้งนี้ — ลงทะเบียน token ให้อัตโนมัติ
  // โดยไม่ต้องกดปุ่มซ้ำ (permission ที่ "granted" แล้วไม่ต้องขอใหม่ ต่างจาก
  // "default" ที่ต้องรอผู้ใช้กดเอง)
  useEffect(() => {
    if (permission === "granted" && firebaseUser && !fcmToken) {
      registerCurrentDevice().catch((e) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, firebaseUser]);

  const registerCurrentDevice = useCallback(async () => {
    if (!VAPID_KEY) {
      // ยัง deploy จริงไม่ได้ในสภาพแวดล้อมนี้ (ไม่มี Firebase project จริง)
      // — โยน error ที่อธิบายชัดเจนแทนที่จะพยายามเรียก getToken() แล้วพัง
      // แบบเข้าใจยาก
      throw new Error("ยังไม่ได้ตั้งค่า VITE_FIREBASE_VAPID_KEY — ฟีเจอร์นี้ยังไม่พร้อมใช้งานจริง (รอ deploy เฟส 5)");
    }
    // Import แบบ dynamic เพราะ firebase/messaging ใช้ไม่ได้ในเบราว์เซอร์ที่
    // ไม่รองรับ Service Worker เลย (import แบบ static จะทำให้ทั้งไฟล์พังตั้งแต่
    // โหลด module แม้ในเบราว์เซอร์ที่ไม่ได้ใช้ push ก็ตาม)
    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
    const registration = await navigator.serviceWorker.register(messagingServiceWorkerUrl());
    const messaging = getMessaging(firebaseApp);
    // เมื่อแอปอยู่ foreground FCM จะมาถึง handler นี้เท่านั้น เราไม่เรียก
    // showNotification เพื่อให้ใช้ due banner ใน React เพียงจุดเดียว.
    onMessage(messaging, () => {});
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) {
      throw new Error("ไม่ได้รับ FCM token จาก Firebase — ลองใหม่อีกครั้ง");
    }
    await registerFcmToken(token);
    setFcmToken(token);
    return token;
  }, []);

  /**
   * ขอ permission จากผู้ใช้ (ต้องเรียกจาก direct user interaction เช่น
   * onClick ของปุ่ม — เบราว์เซอร์บล็อก prompt ที่เรียกจากที่อื่น) แล้ว
   * ลงทะเบียน token ต่อทันทีถ้าได้รับอนุญาต
   */
  const requestPermission = useCallback(async () => {
    if (permission === "unsupported") {
      setError("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Push");
      return;
    }
    setIsRequesting(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await registerCurrentDevice();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsRequesting(false);
    }
  }, [permission, registerCurrentDevice]);

  /** ปิดการแจ้งเตือนของอุปกรณ์นี้ — เลิกลงทะเบียน token ออกจาก backend (permission ของเบราว์เซอร์เองยังคง "granted" อยู่ แค่เราหยุดส่งไปหา token นี้แล้ว) */
  const disableNotifications = useCallback(async () => {
    if (!fcmToken) return;
    try {
      await unregisterFcmToken(fcmToken);
      setFcmToken(null);
    } catch (e) {
      setError(e.message);
    }
  }, [fcmToken]);

  return {
    permission, // "unsupported" | "default" | "granted" | "denied"
    fcmToken,
    error,
    isRequesting,
    requestPermission,
    disableNotifications
  };
}

// ⚠️ SCAFFOLD — migration plan v2 เฟส 5.2 — ยัง deploy/ทดสอบจริงไม่ได้ใน
// สภาพแวดล้อมนี้ (ต้องมี Firebase project จริงถึงจะเห็น push แสดงผลจริง)
//
// ไฟล์นี้ต้องอยู่ที่ root ของเว็บ (public/firebase-messaging-sw.js →
// build แล้วต้องเสิร์ฟที่ https://<domain>/firebase-messaging-sw.js ตรงๆ
// ไม่ใช่ใต้ path ย่อย) เพราะ Firebase Messaging SDK ค้นหา service worker
// ที่ path ตายตัวนี้เป็นค่า default (เว้นแต่จะ pass serviceWorkerRegistration
// เองตอนเรียก getToken() ซึ่ง use-push-notifications.js ทำอยู่แล้ว แต่
// ยังต้องมีไฟล์อยู่ที่ path นี้ให้ navigator.serviceWorker.register()
// เรียกได้ตั้งแต่แรก)
//
// รับ push แจ้งเตือนตอนแท็บ**ไม่ได้ focus อยู่**เท่านั้น (background) —
// ตอนแท็บเปิด/focus อยู่ Firebase Messaging SDK จะยิง onMessage() callback
// ในหน้าเว็บปกติแทน (ดู use-push-notifications.js) ไม่ผ่าน service worker
// นี้ — ป้องกัน notification ซ้อนกันตามที่ระบุไว้ในแผนเฟส 5.4
//
// GOTCHA สำคัญ: importScripts ด้านล่างต้อง match version ของ firebase SDK
// ที่ frontend/package.json ใช้อยู่ (firebase/messaging) — ถ้า major
// version ไม่ตรงกันระหว่างสองที่นี้ อาจมีพฤติกรรมไม่ตรงกันเรื่อง token
// format หรือ message payload shape ควรอัปเดตคู่กันเสมอตอน bump
// firebase package

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// service worker รันแยก context จึง import firebase-config.js ตรงๆ ไม่ได้.
// หน้าเว็บส่ง Firebase web config ผ่าน query string ตอน register (ค่าเหล่านี้
// เป็น public identifier) เพื่อไม่ต้อง hardcode config ซ้ำใน public file.
const configParams = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: configParams.get("apiKey"),
  authDomain: configParams.get("authDomain"),
  projectId: configParams.get("projectId"),
  storageBucket: configParams.get("storageBucket"),
  messagingSenderId: configParams.get("messagingSenderId"),
  appId: configParams.get("appId")
});

const messaging = firebase.messaging();

// จัดการ background message — payload มาจาก Cloud Function (functions/index.js,
// ยัง scaffold อยู่) ที่ยิง admin.messaging().sendEachForMulticast() ด้วย
// { notification: { title, body } } เป็นอย่างน้อย
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || "ถึงเวลาแล้ว";
  const options = {
    body: payload.data?.body || "",
    icon: new URL("logo/icon-512.png", self.registration.scope).toString(),
    tag: payload.data?.reminderId || "times-reminder" // tag เดียวกันทับ notification เก่าของ reminder เดียวกัน กัน spam ถ้า due ซ้ำถี่ๆ
  };
  self.registration.showNotification(title, options);
});

// คลิก notification แล้วเปิด/โฟกัสแท็บแอปที่เปิดอยู่ (ถ้ามี) แทนที่จะเปิด
// แท็บใหม่ซ้ำซ้อนทุกครั้ง
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(self.registration.scope);
    })
  );
});

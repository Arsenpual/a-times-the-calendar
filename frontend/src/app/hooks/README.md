# App hooks

- `use-app-shell-ui.js`: state ของ account menu, Activity reading mode, scroll กลับจุดบนสุด และความละเอียด Week Spine ที่เก็บใน localStorage

State นี้เป็นเรื่องของเปลือกแอพและไม่ได้เป็นเจ้าของข้อมูล Activity หรือ Reminder โดยตรง จึงแยกจาก `app.jsx` โดยคง prop และพฤติกรรมเดิม

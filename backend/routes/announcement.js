const express = require("express");
const { announcementDoc } = require("../firestore-db.js");

const router = express.Router();

// ส่งข้อความประกาศที่บอทตั้งไว้ให้ frontend ที่ผ่าน Firebase Auth แล้วเท่านั้น.
// `configured` แยกจาก `message` เพื่อให้ client รู้ต่างกันระหว่าง "ยังไม่เคย
// ตั้ง" (ใช้ข้อความ default ใน source) และ "ผู้ดูแลสั่งปิดประกาศ" (message null).
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await announcementDoc().get();
    const data = snapshot.data();
    res.json({
      configured: snapshot.exists,
      message: typeof data?.message === "string" ? data.message : null
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

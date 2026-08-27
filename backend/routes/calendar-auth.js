const express = require("express");
const {
  createAuthorizationUrl,
  verifyState,
  exchangeCode,
  storeRefreshToken,
  connectionStatus
} = require("../calendar-oauth.js");

const router = express.Router();

router.get("/status", async (req, res, next) => {
  try { res.json(await connectionStatus(req.userId)); } catch (error) { next(error); }
});

// Frontend เรียก endpoint นี้พร้อม Firebase ID token แล้วนำ URL ที่ได้ไป
// redirect เอง จึงไม่ต้องยอมรับ bearer token ใน Google callback URL.
router.post("/authorization-url", (req, res, next) => {
  try { res.json({ authorizationUrl: createAuthorizationUrl(req.userId) }); } catch (error) { next(error); }
});

module.exports = router;

module.exports.callback = async function calendarOAuthCallback(req, res) {
  const frontendUrl = process.env.FRONTEND_URL;
  try {
    if (req.query.error) throw new Error(`Google OAuth ถูกยกเลิก: ${req.query.error}`);
    const { uid } = verifyState(req.query.state);
    if (!req.query.code) throw new Error("Google OAuth ไม่ได้ส่ง authorization code");
    await storeRefreshToken(uid, await exchangeCode(req.query.code));
    return res.redirect(`${frontendUrl}?calendar-connected=1`);
  } catch (error) {
    console.error("[calendar-oauth] callback ล้มเหลว:", error.message);
    return res.redirect(`${frontendUrl}?calendar-connected=0`);
  }
};

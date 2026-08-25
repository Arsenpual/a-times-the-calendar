const express = require("express");
const { activityNotificationsCol } = require("../firestore-db.js");
const router = express.Router();

function validPayload(body) {
  if (!body || typeof body !== "object") return null;
  if (typeof body.activityId !== "string" || !body.activityId.trim() || body.activityId.length > 500) return null;
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 300) return null;
  if (!Number.isFinite(body.startAt)) return null;
  if (body.endAt !== undefined && body.endAt !== null && !Number.isFinite(body.endAt)) return null;
  return { activityId: body.activityId, title: body.title.trim(), startAt: body.startAt, endAt: body.endAt ?? null };
}

router.put("/:activityId", async (req, res, next) => {
  try {
    const payload = validPayload(req.body);
    if (!payload || payload.activityId !== req.params.activityId) return res.status(400).json({ error: "ข้อมูลแจ้งเตือนกิจกรรมไม่ถูกต้อง" });
    const enabled = payload.startAt > Date.now();
    const data = { ...payload, type: "activity-notification", enabled, nextDueAt: enabled ? payload.startAt : null, updatedAt: Date.now() };
    await activityNotificationsCol(req.userId).doc(payload.activityId).set(data, { merge: true });
    res.json({ id: payload.activityId, ...data });
  } catch (error) { next(error); }
});

router.delete("/:activityId", async (req, res, next) => {
  try { await activityNotificationsCol(req.userId).doc(req.params.activityId).delete(); res.status(204).send(); }
  catch (error) { next(error); }
});

module.exports = router;

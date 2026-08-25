const express = require("express");
const { activityArchiveCol } = require("../firestore-db.js");

const router = express.Router();
const MAX_TITLE_LENGTH = 300;
const MAX_TAGS = 30;

function sanitizeArchiveItem(body) {
  if (!body || typeof body !== "object" || typeof body.archiveId !== "string" || !body.archiveId || body.archiveId.includes("/")) return null;
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > MAX_TITLE_LENGTH) return null;
  if (body.calendarId !== null && body.calendarId !== undefined && typeof body.calendarId !== "string") return null;
  if (body.start !== null && body.start !== undefined && typeof body.start !== "string") return null;
  if (body.end !== null && body.end !== undefined && typeof body.end !== "string") return null;
  if (body.categoryId !== null && body.categoryId !== undefined && typeof body.categoryId !== "string") return null;
  if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > MAX_TAGS || !body.tags.every((tag) => typeof tag === "string" && tag.length <= 80))) return null;
  return {
    archiveId: body.archiveId,
    calendarId: body.calendarId || null,
    title: body.title.trim(),
    start: body.start || null,
    end: body.end || null,
    categoryId: body.categoryId || null,
    tags: body.tags || [],
    color: typeof body.color === "string" ? body.color : "#5f6368",
    isDraft: Boolean(body.isDraft),
    archivedAt: typeof body.archivedAt === "string" ? body.archivedAt : new Date().toISOString(),
    durationUnit: body.durationUnit === "day" ? "day" : "hour"
  };
}

router.get("/", async (req, res, next) => {
  try {
    const snapshot = await activityArchiveCol(req.userId).orderBy("archivedAt", "desc").get();
    res.json(snapshot.docs.map((doc) => doc.data()));
  } catch (error) { next(error); }
});

router.put("/:archiveId", async (req, res, next) => {
  try {
    if (req.params.archiveId !== req.body?.archiveId) return res.status(400).json({ error: "archiveId ไม่ตรงกับ path" });
    const item = sanitizeArchiveItem(req.body);
    if (!item) return res.status(400).json({ error: "ข้อมูลคลังกิจกรรมไม่ถูกต้อง" });
    await activityArchiveCol(req.userId).doc(item.archiveId).set(item);
    res.json(item);
  } catch (error) { next(error); }
});

router.delete("/:archiveId", async (req, res, next) => {
  try {
    if (!req.params.archiveId || req.params.archiveId.includes("/")) return res.status(400).json({ error: "archiveId ไม่ถูกต้อง" });
    await activityArchiveCol(req.userId).doc(req.params.archiveId).delete();
    res.status(204).send();
  } catch (error) { next(error); }
});

module.exports = router;

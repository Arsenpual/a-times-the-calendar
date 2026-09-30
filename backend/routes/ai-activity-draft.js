const express = require("express");
const { generateContent } = require("../gemini-api.js");
const { readCalendarQuestionContext, isCalendarQuestion, isDeterministicCalendarQuestion, answerDeterministicCalendarQuestion } = require("../calendar-question.js");

const { schema, buildPrompt, prepareContext, finishResult, validateDraft, assessDraftSchedule, findFreeTimeOptions } = require("../skills/activity-creation");
const { answerTimesQuestion } = require("../skills/activity-creation/times-knowledge.js");

function createActivityAssistantRouter({
  claimChatUsage = (...args) => require("../gemini-chat.js").claimGeminiChatUsage(...args),
  releaseChatUsage = (...args) => require("../gemini-chat.js").releaseGeminiChatUsage(...args),
  claimDraftUsage = (...args) => require("../gemini-chat.js").claimGeminiDraftUsage(...args),
  releaseDraftUsage = (...args) => require("../gemini-chat.js").releaseGeminiDraftUsage(...args),
  getChatStatus = (...args) => require("../gemini-chat.js").getGeminiChatStatus(...args),
  readCalendarQuestion = readCalendarQuestionContext,
  answerDeterministicCalendar = answerDeterministicCalendarQuestion,
  generateActivity,
  generateCalendarAnswer,
  answerKnowledge = answerTimesQuestion
} = {}) {
const router = express.Router();
// Default assignment happens inside the factory body because default parameter
// expressions cannot reference a function declared later in that same body.
generateActivity ||= generateActivityWithGemini;
generateCalendarAnswer ||= generateCalendarAnswerWithGemini;

router.post("/activity-validate", (req, res) => {
  try { res.json({ draft: validateDraft(req.body.draft, req.body.categories || []) }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

// Activity Mode owns the visible control now.  Keep this under /api/ai so
// it does not depend on Telegram being connected just to plan an activity.
router.get("/activity-assistant-status", async (req, res, next) => {
  try { res.json({ aiChat: await getChatStatus(req.userId) }); }
  catch (error) { next(error); }
});

function templateFallback(context, { title, date, time, durationMinutes, categoryName = "" }) {
  return finishResult({
    ready: true,
    reply: "ร่างกิจกรรมจากตัวเลือกพร้อมตรวจสอบแล้วครับ",
    draft: { title, date, startTime: time, startLocal: "", endLocal: "", durationMinutes, allDay: false, categoryName, tags: [], notes: "", assumptions: ["สร้างจากข้อความสำเร็จรูป"] }
  }, context);
}

function calendarDateAfter(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function explicitDateFromText(text, referenceDate) {
  const isoDate = String(text).match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (isoDate) return isoDate;
  if (/พรุ่งนี้|\btomorrow\b/i.test(text)) return calendarDateAfter(referenceDate, 1);
  if (/วันนี้|\btoday\b/i.test(text)) return referenceDate;
  return "";
}

function durationMinutesFromText(text) {
  const hours = String(text).match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b|(\d+(?:\.\d+)?)\s*(?:ชั่วโมง|ชม\.?)/i);
  if (hours) return Math.round(Number(hours[1] || hours[2]) * 60);
  const minutes = String(text).match(/\b(\d+)\s*(?:minutes?|mins?)\b|(\d+)\s*นาที/i);
  return minutes ? Number(minutes[1] || minutes[2]) : 0;
}

function explicitTimeFromText(text) {
  const match = String(text).match(/\b([01]?\d|2[0-3])[.:]([0-5]\d)\b/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function completeActivityRequest(context) {
  const { text, referenceDate } = context;
  const date = explicitDateFromText(text, referenceDate);
  const startTime = explicitTimeFromText(text);
  const durationMinutes = durationMinutesFromText(text);
  // This strict branch intentionally accepts only a complete, explicit
  // request. Anything ambiguous still goes to Gemini for a conversation.
  if (!date || !startTime || durationMinutes < 1 || durationMinutes > 720) return null;
  const title = String(text)
    .replace(/\b([01]?\d|2[0-3])[.:]([0-5]\d)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b|\d+(?:\.\d+)?\s*(?:ชั่วโมง|ชม\.?)/gi, " ")
    .replace(/\b\d+\s*(?:minutes?|mins?)\b|\d+\s*นาที/gi, " ")
    .replace(/พรุ่งนี้|วันนี้|\btomorrow\b|\btoday\b|\b\d{4}-\d{2}-\d{2}\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  if (!title || title.length > 200) return null;
  return finishResult({
    ready: true,
    reply: `ร่างกิจกรรม “${title}” สำเร็จแล้วครับ ตรวจสอบรายละเอียดได้ใน Activity Popup`,
    draft: { title, date, startTime, startLocal: "", endLocal: "", durationMinutes, allDay: false, categoryName: "", tags: [], notes: "", assumptions: ["สร้างจากข้อมูลวัน เวลา และระยะเวลาที่ระบุครบถ้วน"] }
  }, context);
}

function isFindTimeRequest(text) {
  return /หา\s*(?:ช่วง)?เวลา(?:ว่าง)?|หาช่วงว่าง|find\s+(?:a\s+)?free\s+time/i.test(String(text));
}

function titleFromFindTimeRequest(text) {
  return String(text)
    .replace(/ช่วย?\s*หา\s*(?:ช่วง)?เวลา(?:ว่าง)?|ช่วย?\s*หาช่วงว่าง|find\s+(?:a\s+)?free\s+time(?:\s+for)?/gi, " ")
    .replace(/พรุ่งนี้|วันนี้|\btomorrow\b|\btoday\b|\b\d{4}-\d{2}-\d{2}\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b|\d+(?:\.\d+)?\s*(?:ชั่วโมง|ชม\.?)|\b\d+\s*(?:minutes?|mins?)\b|\d+\s*นาที/gi, " ")
    .replace(/(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*ชั่วโมง(?:ครึ่ง)?|ครึ่ง\s*ชั่วโมง/gi, " ")
    .replace(/\s+/g, " ").replace(/^[\s:：-]+/, "").trim().slice(0, 200);
}

function thaiDurationMinutes(text) {
  const compact = String(text).replace(/\s+/g, "");
  if (/ครึ่งชั่วโมง/.test(compact)) return 30;
  const names = { "หนึ่ง": 1, "สอง": 2, "สาม": 3, "สี่": 4, "ห้า": 5, "หก": 6, "เจ็ด": 7, "แปด": 8, "เก้า": 9, "สิบ": 10 };
  const match = compact.match(/(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)ชั่วโมง(ครึ่ง)?/);
  return match ? names[match[1]] * 60 + (match[2] ? 30 : 0) : 0;
}

function findTimeRequest(context) {
  if (!isFindTimeRequest(context.text)) return null;
  const durationMinutes = durationMinutesFromText(context.text) || thaiDurationMinutes(context.text);
  const title = titleFromFindTimeRequest(context.text);
  if (!title || durationMinutes < 30 || durationMinutes > 720) return null;
  const requestedDate = explicitDateFromText(context.text, context.referenceDate);
  const options = findFreeTimeOptions(context.scheduleContext, durationMinutes, requestedDate).map((slot) => {
    const draft = finishResult({
      ready: true,
      reply: "",
      draft: {
        title,
        startLocal: slot.startLocal,
        endLocal: slot.endLocal,
        allDay: false,
        categoryName: "",
        tags: [],
        notes: "",
        assumptions: ["เลือกจากช่วงเวลาว่างในตารางที่ส่งมา"]
      }
    }, context).draft;
    return { ...slot, draft };
  });
  return {
    ready: false,
    draft: null,
    source: "scheduling",
    reply: options.length
      ? `พบช่วงเวลาว่างสำหรับ “${title}” ${options.length} ตัวเลือก เลือกช่วงที่สะดวก แล้วตรวจสอบรายละเอียดก่อนบันทึกได้เลยครับ`
      : `ยังไม่พบช่วงเวลาว่างที่ยาว ${durationMinutes} นาทีในช่วงที่ตรวจสอบ ลองเลือกวันอื่นหรือปรับระยะเวลาได้ครับ`,
    scheduling: { title, durationMinutes, requestedDate, options }
  };
}

function isPlanListRequest(text) {
  return /(?:ช่วย\s*)?วางแผน|\bplan\s+(?:my\s+)?(?:tasks?|day)\b/i.test(String(text));
}

function planTaskFromText(text) {
  const durationMinutes = durationMinutesFromText(text) || thaiDurationMinutes(text);
  const title = String(text)
    .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b|\d+(?:\.\d+)?\s*(?:ชั่วโมง|ชม\.?)|\b\d+\s*(?:minutes?|mins?)\b|\d+\s*นาที/gi, " ")
    .replace(/(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*ชั่วโมง(?:ครึ่ง)?|ครึ่ง\s*ชั่วโมง/gi, " ")
    .replace(/\s+/g, " ").replace(/^[\s:：-]+/, "").trim().slice(0, 200);
  return title && durationMinutes >= 30 && durationMinutes <= 720 ? { title, durationMinutes } : null;
}

function planListRequest(context) {
  if (!isPlanListRequest(context.text)) return null;
  const requestedDate = explicitDateFromText(context.text, context.referenceDate);
  const listText = String(context.text)
    .replace(/(?:ช่วย\s*)?วางแผน(?:ให้)?|\bplan\s+(?:my\s+)?(?:tasks?|day)\b/gi, " ")
    .replace(/พรุ่งนี้|วันนี้|\btomorrow\b|\btoday\b|\b\d{4}-\d{2}-\d{2}\b/gi, " ");
  const tasks = listText.split(/[;,\n]+/).map(planTaskFromText).filter(Boolean).slice(0, 5);
  if (tasks.length < 2) return null;

  const planningContext = { ...context.scheduleContext, activities: [...context.scheduleContext.activities] };
  const drafts = [];
  const unscheduled = [];
  for (const task of tasks) {
    const slot = findFreeTimeOptions(planningContext, task.durationMinutes, requestedDate)[0];
    if (!slot) {
      unscheduled.push({ title: task.title, durationMinutes: task.durationMinutes });
      continue;
    }
    const draft = finishResult({
      ready: true,
      reply: "",
      draft: {
        title: task.title,
        startLocal: slot.startLocal,
        endLocal: slot.endLocal,
        allDay: false,
        categoryName: "",
        tags: [],
        notes: "",
        assumptions: ["วางต่อจากช่วงเวลาว่างในตารางที่ส่งมา"]
      }
    }, context).draft;
    drafts.push(draft);
    planningContext.activities.push({ id: `plan-${drafts.length}`, title: draft.title, startLocal: draft.startLocal, endLocal: draft.endLocal, locked: false });
  }
  return {
    ready: false,
    draft: null,
    source: "planning",
    reply: drafts.length
      ? `วางร่างกิจกรรมได้ ${drafts.length} รายการ ตรวจ แก้ไข หรือตัดออกทีละรายการก่อนกดสร้างทั้งชุดได้เลยครับ${unscheduled.length ? `\nยังหาเวลาให้ ${unscheduled.map((task) => `“${task.title}”`).join(", ")} ไม่ได้` : ""}`
      : "ยังไม่พบช่วงเวลาว่างพอสำหรับรายการที่ส่งมา ลองเปลี่ยนวันหรือปรับระยะเวลาได้ครับ",
    planning: { drafts, unscheduled, requestedDate }
  };
}

const FOCUS_BLOCK_MINUTES = 90;
const FOCUS_BREAK_MINUTES = 15;

function isSplitTaskRequest(text) {
  return /(?:ช่วย\s*)?แบ่งงาน|\bsplit\s+(?:this\s+)?task\b/i.test(String(text));
}

function splitTaskRequest(context) {
  if (!isSplitTaskRequest(context.text)) return null;
  const totalMinutes = durationMinutesFromText(context.text) || thaiDurationMinutes(context.text);
  const title = String(context.text)
    .replace(/(?:ช่วย\s*)?แบ่งงาน|\bsplit\s+(?:this\s+)?task\b/gi, " ")
    .replace(/พรุ่งนี้|วันนี้|\btomorrow\b|\btoday\b|\b\d{4}-\d{2}-\d{2}\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b|\d+(?:\.\d+)?\s*(?:ชั่วโมง|ชม\.?)|\b\d+\s*(?:minutes?|mins?)\b|\d+\s*นาที/gi, " ")
    .replace(/(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*ชั่วโมง(?:ครึ่ง)?|ครึ่ง\s*ชั่วโมง/gi, " ")
    .replace(/\s+/g, " ").replace(/^[\s:：-]+/, "").trim().slice(0, 200);
  if (!title || totalMinutes <= FOCUS_BLOCK_MINUTES || totalMinutes > 12 * 60) return null;

  const requestedDate = explicitDateFromText(context.text, context.referenceDate);
  const planningContext = { ...context.scheduleContext, activities: [...context.scheduleContext.activities] };
  const drafts = [];
  const unscheduled = [];
  let remaining = totalMinutes;
  let blockIndex = 0;
  const blockCount = Math.ceil(totalMinutes / FOCUS_BLOCK_MINUTES);
  while (remaining > 0) {
    const focusMinutes = Math.min(FOCUS_BLOCK_MINUTES, remaining);
    const needsBreak = remaining > focusMinutes;
    const reservedMinutes = focusMinutes + (needsBreak ? FOCUS_BREAK_MINUTES : 0);
    const slot = findFreeTimeOptions(planningContext, reservedMinutes, requestedDate, FOCUS_BREAK_MINUTES)[0];
    if (!slot) {
      unscheduled.push({ title: `${title} (${blockIndex + 1}/${blockCount})`, durationMinutes: focusMinutes });
      break;
    }
    blockIndex += 1;
    const focusEnd = new Date(`${slot.startLocal}:00Z`).getTime() + focusMinutes * 60_000;
    const focusDraft = finishResult({
      ready: true,
      reply: "",
      draft: {
        title: `${title} (${blockIndex}/${blockCount})`,
        startLocal: slot.startLocal,
        endLocal: new Date(focusEnd).toISOString().slice(0, 16),
        allDay: false,
        categoryName: "",
        tags: ["focus"],
        notes: "",
        assumptions: [`แบ่งงานเป็นช่วงโฟกัส ${focusMinutes} นาที`]
      }
    }, context).draft;
    drafts.push(focusDraft);
    planningContext.activities.push({ id: `focus-${blockIndex}`, title: focusDraft.title, startLocal: focusDraft.startLocal, endLocal: focusDraft.endLocal, locked: false });
    if (needsBreak) {
      const breakEnd = new Date(focusEnd + FOCUS_BREAK_MINUTES * 60_000).toISOString().slice(0, 16);
      const breakDraft = finishResult({
        ready: true,
        reply: "",
        draft: {
          title: `พัก ${FOCUS_BREAK_MINUTES} นาที`,
          startLocal: focusDraft.endLocal,
          endLocal: breakEnd,
          allDay: false,
          categoryName: "",
          tags: ["break"],
          notes: "",
          assumptions: ["คั่นระหว่างช่วงโฟกัส"]
        }
      }, context).draft;
      drafts.push(breakDraft);
      planningContext.activities.push({ id: `break-${blockIndex}`, title: breakDraft.title, startLocal: breakDraft.startLocal, endLocal: breakDraft.endLocal, locked: false });
    }
    remaining -= focusMinutes;
  }
  return {
    ready: false,
    draft: null,
    source: "planning",
    reply: drafts.length
      ? `แบ่ง “${title}” เป็นช่วงโฟกัส ${FOCUS_BLOCK_MINUTES} นาที และพัก ${FOCUS_BREAK_MINUTES} นาทีแล้ว ตรวจ แก้ไข หรือตัดแต่ละรายการก่อนสร้างทั้งชุดได้เลยครับ${unscheduled.length ? "\nบางช่วงยังหาเวลาว่างให้ไม่ได้" : ""}`
      : `ยังไม่พบช่วงว่างสำหรับแบ่ง “${title}” ลองเปลี่ยนวันหรือปรับระยะเวลาได้ครับ`,
    planning: { drafts, unscheduled, requestedDate, focusMinutes: FOCUS_BLOCK_MINUTES, breakMinutes: FOCUS_BREAK_MINUTES }
  };
}

// The guided flow collects mandatory facts without Gemini. At summary time it
// may use the application's separate AI budget to enrich category and tags.
router.post("/activity-template-draft", async (req, res) => {
  let claim = null;
  try {
    const { title, date, time, durationMinutes, categoryName = "", categories = [] } = req.body || {};
    if (typeof title !== "string" || !title.trim()) throw new Error("ต้องระบุชื่อกิจกรรม");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("วันที่ไม่ถูกต้อง");
    if (!/^\d{2}:\d{2}$/.test(time || "")) throw new Error("เวลาไม่ถูกต้อง");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 720) throw new Error("ระยะเวลาต้องอยู่ระหว่าง 30 ถึง 720 นาที");
    const context = prepareContext({ text: `${title} ${date} ${time} ${durationMinutes} นาที`, referenceDate: date, timeZone: req.body.timeZone || "Asia/Bangkok", categories, scheduleContext: req.body.scheduleContext, assistantPreferences: req.body.assistantPreferences });
    claim = await claimDraftUsage(req.userId);
    if (claim.status === "claimed") {
      try {
        const result = finishResult(await generateActivity(context), context);
        if (result.ready) return res.json({ ...result, schedule: assessDraftSchedule(result.draft, context.scheduleContext), summarySource: "system-ai" });
      } catch (error) {
        await releaseDraftUsage(claim).catch(() => {});
        claim = null;
      }
    }
    const result = templateFallback(context, { title, date, time, durationMinutes, categoryName });
    return res.json({ ...result, schedule: assessDraftSchedule(result.draft, context.scheduleContext), summarySource: "deterministic" });
  } catch (error) {
    if (claim?.status === "claimed") await releaseDraftUsage(claim).catch(() => {});
    res.status(400).json({ error: error.message });
  }
});

function jsonFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งร่างกิจกรรมกลับมา");
  return JSON.parse(text);
}

function textFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งคำตอบกลับมา");
  return text;
}

async function generateActivityWithGemini(context) {
  const instruction = buildPrompt(context);
  const payload = await generateContent({ systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(context) }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.25 } });
  return jsonFromGemini(payload);
}

async function generateCalendarAnswerWithGemini({ text, calendarContext, timeZone }) {
  // A very full calendar can contain thousands of rows. The question already
  // has an explicit bounded date range; cap the model context as a second
  // guard so one request cannot consume an unbounded amount of AI quota.
  const events = calendarContext.events.slice(0, 400);
  const compactContext = { ...calendarContext, events, truncatedForAi: calendarContext.events.length > events.length };
  const instruction = [
    "คุณคือ MR.Zettascale ผู้ช่วยอ่าน Google Calendar ของเจ้าของบัญชี T.i.M.E.S.",
    "ตอบจากข้อมูล JSON ที่ได้รับเท่านั้น ห้ามแต่งข้อมูล ห้ามกล่าวว่าคุณเห็นข้อมูลอื่นนอกช่วงวันที่นี้.",
    "ข้อมูลเป็นชื่อกิจกรรม เวลา และชื่อปฏิทินเท่านั้น ห้ามขอหรืออ้างถึงคำอธิบาย ผู้เข้าร่วม ลิงก์ หรือข้อมูลส่วนตัวที่ไม่มีอยู่.",
    "คุณมีสิทธิ์อ่านอย่างเดียว ห้ามสร้าง แก้ไข ลบ หรือยืนยันการเปลี่ยน Calendar.",
    "ตอบภาษาเดียวกับคำถาม กระชับ ใช้เวลาใน timezone ที่ระบุ. ถ้าถามเวลาว่าง ให้หาเฉพาะช่องว่างภายในช่วงวันที่ที่ส่งมา และแจ้งว่านี่เป็นการประเมินจากกิจกรรมที่อ่านได้."
  ].join(" ");
  const payload = await generateContent({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ question: text, timeZone, calendar: compactContext }) }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 700 }
  });
  return textFromGemini(payload);
}

/**
 * A guided, web-only Activity Mode conversation.  It returns a proposal but
 * never writes Calendar data; the browser must still open ActivityModal and
 * the person must submit that form to create the activity.
 */
router.post("/activity-conversation", async (req, res, next) => {
  let claim = null;
  try {
    const context = prepareContext(req.body);
    // Product FAQ answers are deterministic local lookups. They do not call
    // Gemini, so they never consume the person's AI quota.
    const knowledgeReply = answerKnowledge(context.text);
    if (knowledgeReply) return res.json({ reply: knowledgeReply, ready: false, draft: null, source: "knowledge" });
    const deterministicDraft = completeActivityRequest(context);
    if (deterministicDraft) {
      return res.json({ ...deterministicDraft, schedule: assessDraftSchedule(deterministicDraft.draft, context.scheduleContext), source: "deterministic" });
    }
    const planningResult = planListRequest(context);
    if (planningResult) return res.json(planningResult);
    const splitResult = splitTaskRequest(context);
    if (splitResult) return res.json(splitResult);
    const schedulingResult = findTimeRequest(context);
    if (schedulingResult) return res.json(schedulingResult);
    // Factual Calendar questions are answered directly from a small bounded
    // event set.  This reads no more data than the AI branch, but never calls
    // Gemini and therefore does not consume the user's AI quota.
    if (isDeterministicCalendarQuestion(context.text)) {
      const calendarContext = await readCalendarQuestion(req.userId, context);
      const reply = answerDeterministicCalendar(context.text, calendarContext, context.timeZone);
      if (reply) return res.json({ reply, ready: false, draft: null, source: "deterministic", calendarRange: calendarContext.range });
    }
    // Interpretive Calendar questions are an explicit, read-only AI branch.
    // Claim the normal chat quota first, then fetch only the event fields and
    // date range needed for this one question; neither OAuth tokens nor full
    // Calendar objects are ever sent to the browser or Gemini.
    if (isCalendarQuestion(context.text)) {
      claim = await claimChatUsage(req.userId);
      if (claim.status !== "claimed") {
        const errors = {
          "globally-disabled": "AI ถูกปิดชั่วคราวโดยระบบ",
          "not-allowed": "AI อยู่ระหว่างทดสอบสำหรับนักพัฒนา กรุณาใช้คำถามสำเร็จรูปหรือสร้างกิจกรรมจากตัวเลือก",
          "window-limited": "ใช้ AI ครบโควต้าช่วง 15 นาทีแล้ว",
          "day-limited": "ใช้ AI ครบโควต้าประจำวันแล้ว",
          "global-limited": "โควต้า AI ของระบบวันนี้เต็มแล้ว"
        };
        return res.status(claim.status === "not-allowed" ? 403 : 429).json({
          ...(claim.status === "not-allowed" ? { code: "AI_DEVELOPER_ONLY" } : {}),
          error: errors[claim.status] || "AI ใช้งานไม่ได้ในขณะนี้",
          ...(claim.retryAfterSeconds ? { retryAfterSeconds: claim.retryAfterSeconds, retryAfterAt: new Date(claim.resetAt).toISOString() } : {})
        });
      }
      const calendarContext = await readCalendarQuestion(req.userId, context);
      const reply = await generateCalendarAnswer({ text: context.text, calendarContext, timeZone: context.timeZone });
      return res.json({ reply, ready: false, draft: null, source: "calendar", calendarRange: calendarContext.range });
    }
    claim = await claimChatUsage(req.userId);
    if (claim.status !== "claimed") {
      const errors = {
        "globally-disabled": "AI ถูกปิดชั่วคราวโดยระบบ",
        "not-allowed": "AI อยู่ระหว่างทดสอบสำหรับนักพัฒนา กรุณาใช้คำถามสำเร็จรูปหรือสร้างกิจกรรมจากตัวเลือก",
        "window-limited": "ใช้ AI ครบโควต้าช่วง 15 นาทีแล้ว",
        "day-limited": "ใช้ AI ครบโควต้าประจำวันแล้ว",
        "global-limited": "โควต้า AI ของระบบวันนี้เต็มแล้ว"
      };
      return res.status(claim.status === "not-allowed" ? 403 : 429).json({
        ...(claim.status === "not-allowed" ? { code: "AI_DEVELOPER_ONLY" } : {}),
        error: errors[claim.status] || "AI ใช้งานไม่ได้ในขณะนี้",
        ...(claim.retryAfterSeconds ? { retryAfterSeconds: claim.retryAfterSeconds, retryAfterAt: new Date(claim.resetAt).toISOString() } : {})
      });
    }

    const result = finishResult(await generateActivity(context), context);
    res.json(result.ready ? { ...result, schedule: assessDraftSchedule(result.draft, context.scheduleContext) } : result);
  } catch (error) {
    if (claim?.status === "claimed") await releaseChatUsage(claim).catch(() => {});
    if (error?.code === "CALENDAR_REAUTH_REQUIRED") {
      return res.status(428).json({ code: error.code, error: error.message });
    }
    res.status(error.status || 502).json({ error: error.message });
  }
});

return router;
}

const router = createActivityAssistantRouter();
module.exports = router;
module.exports.createActivityAssistantRouter = createActivityAssistantRouter;

import { useCallback, useEffect, useRef, useState } from "react";
import {
  continueActivityAssistant,
  continueFreeConversation,
  createActivityTemplateDraft,
  getActivityAssistantStatus,
  fetchProductKnowledge,
  fetchWeatherPlan,
} from "../api/activity-assistant-api.js";
import { toDateInputValue } from "../../../../shared/lib/date-utils.js";
import {
  getActivityAssistantConversationNode,
  getActivityAssistantKnowledgeFollowUps,
  getActivityAssistantRootQuestions,
} from "../config/activity-assistant-conversation-tree.js";
import { buildDailySummaryChat } from "../lib/daily-summary-chat.js";
import { createActivityPopupHandoff } from "../lib/activity-popup-handoff.js";
import {
  INITIAL_ASSISTANT_MESSAGE,
  useInitialAssistantChat,
  usePersistAssistantChat,
} from "../hooks/use-assistant-chat-storage.js";
import {
  assessAssistantDraftOverlap,
  buildAssistantScheduleContext,
  collectUserTags,
} from "../lib/activity-schedule-context.js";

import { formatScheduleOption, formatScheduleRange } from "../lib/schedule-format.js";
import { assistantSourceLabel } from "../lib/assistant-source-label.js";
import { validateGuidedActivity } from "../lib/guided-activity-validation.js";
import { isWeatherSlotStillRecommended } from "../lib/weather-slot-validation.js";

function toAssistantInsightContext(insight) {
  if (!insight || typeof insight.type !== "string") return null;
  const metrics = (Array.isArray(insight.metrics) ? insight.metrics : [])
    .slice(0, 4)
    .filter((metric) => metric && typeof metric.key === "string" && Number.isInteger(metric.value))
    .map(({ key, value }) => ({ key, value }));
  return metrics.length ? { type: insight.type, metrics } : null;
}

function describeScheduleConflict(schedule) {
  const conflicts = Array.isArray(schedule?.conflicts)
    ? schedule.conflicts
    : [];
  const labels = conflicts
    .slice(0, 3)
    .map((activity) => `${activity.title}${activity.locked ? " 🔒" : ""}`);
  const suffix =
    conflicts.length > 3 ? ` และอีก ${conflicts.length - 3} กิจกรรม` : "";
  return `ช่วงเวลาที่ร่างไว้มีงานซ้อนกันเกิน 3 รายการ${labels.length ? `: ${labels.join(", ")}${suffix}` : ""}\nเลือกช่วงเวลาใกล้เคียงด้านล่าง หรือแก้ไขเวลาเองในฟอร์มได้ครับ`;
}

function resolveGuidedDateInput(text, today = new Date()) {
  const value = text.trim();
  const offsets = { "วันนี้": 0, "พรุ่งนี้": 1, "มะรืน": 2, "มะรืนนี้": 2, "สัปดาห์หน้า": 7 };
  const daysFromNow = /^อีก\s*(\d{1,2})\s*วัน$/.exec(value);
  const offset = offsets[value] ?? (daysFromNow ? Number(daysFromNow[1]) : null);
  if (Number.isInteger(offset) && offset >= 0 && offset <= 31) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return toDateInputValue(date);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : "";
}

export function useActivityAssistantConversation({
  userId,
  open,
  closeOnEscape = true,
  clearTelegramOnReset = true,
  freeConversation = false,
  openFormOnGuidedStart = true,
  createTemplateDraft = createActivityTemplateDraft,
  continueFreeChat = continueFreeConversation,
  continuePlanningChat = continueActivityAssistant,
  weatherPlanRequest = fetchWeatherPlan,
  onClose,
  categories,
  activities = [],
  activityTagMap = {},
  lockedActivities = {},
  assistantPreferences = {},
  assistantInsight = null,
  onOpenTelegramChat,
  onSendTelegramMessage,
  onClearTelegramMessages,
  onOpenActivityForm,
  onUpdateActivityForm,
  onConfirmActivityPlan,
  onOpenDailySummary,
  activityFormOpen = false,
  startActivityCreationRequest = 0,
  startDailySummaryRequest = 0,
}) {
  const initialChat = useInitialAssistantChat(userId);
  const [messages, setMessages] = useState(initialChat.messages);
  const [input, setInput] = useState("");
  const [chatStyle, setChatStyle] = useState(freeConversation ? "free" : "planning");
  const [pending, setPending] = useState(false);
  const [pendingSource, setPendingSource] = useState("");
  const [error, setError] = useState("");
  const [calendarFailure, setCalendarFailure] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [guidedActivity, setGuidedActivity] = useState(
    initialChat.guidedActivity,
  );
  const [conversationNodeId, setConversationNodeId] = useState(
    initialChat.conversationNodeId,
  );
  const [guidedConversationMode, setGuidedConversationMode] = useState(
    initialChat.guidedConversationMode,
  );
  const [scheduleResolution, setScheduleResolution] = useState(null);
  const [now, setNow] = useState(Date.now());
  const bottomRef = useRef(null);
  const activeSessionRef = useRef({ open, userId, version: 0 });
  const conversationEpochRef = useRef(0);
  useEffect(() => {
    const version = activeSessionRef.current.version + 1;
    activeSessionRef.current = { open, userId, version };
    if (!open) {
      setPending(false);
      setPendingSource("");
    }
    return () => { activeSessionRef.current = { open: false, userId: null, version: version + 1 }; };
  }, [open, userId]);
  const isCurrentConversation = (version, epoch) =>
    activeSessionRef.current.open &&
    activeSessionRef.current.userId === userId &&
    activeSessionRef.current.version === version &&
    conversationEpochRef.current === epoch;
  const handledStartActivityCreationRequest = useRef(
    startActivityCreationRequest,
  );
  const handledStartDailySummaryRequest = useRef(startDailySummaryRequest);
  const runDailySummary = useCallback(async () => {
    if (!onOpenDailySummary || pending) return;
    const requestVersion = activeSessionRef.current.version;
    const requestEpoch = conversationEpochRef.current;
    const isCurrent = () =>
      activeSessionRef.current.open && activeSessionRef.current.userId === userId &&
      activeSessionRef.current.version === requestVersion && conversationEpochRef.current === requestEpoch;
    setMessages((current) => [
      ...current,
      { role: "user", text: "สรุปกิจกรรมวันนี้", source: "template", commandTone: "calendar" },
    ]);
    setPending(true);
    setPendingSource("template");
    setError("");
    setCalendarFailure(null);
    try {
      const summary = await onOpenDailySummary();
      if (!isCurrent()) return;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: buildDailySummaryChat(summary),
          source: "template",
          commandTone: "calendar",
        },
      ]);
    } catch (requestError) {
      if (isCurrent()) setCalendarFailure({
        kind: requestError.code === "CALENDAR_REAUTH_REQUIRED" || /สิทธิ์|เชื่อม Google Calendar/.test(requestError.message || "") ? "reauth" : "unavailable",
        requestKind: "daily-summary",
      });
    } finally {
      if (isCurrent()) {
        setPending(false);
        setPendingSource("");
      }
    }
  }, [onOpenDailySummary, pending, userId]);
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, pending, error]);
  useEffect(() => {
    if (!open || !closeOnEscape) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, closeOnEscape]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getActivityAssistantStatus()
      .then((result) => { if (!cancelled) setAiStatus(result.aiChat); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [open, userId]);
  useEffect(() => {
    if (open) onOpenTelegramChat?.();
  }, [open, onOpenTelegramChat]);
  // Opening the assistant from an empty Activity Popup is a deliberate
  // create-activity intent, not a generic chat launch. Keep the chat history
  // intact, but add the same two normal chat turns that selecting the
  // "สร้างกิจกรรม" quick reply would have produced.
  useEffect(() => {
    if (
      !open ||
      !startActivityCreationRequest ||
      handledStartActivityCreationRequest.current ===
        startActivityCreationRequest
    )
      return;
    handledStartActivityCreationRequest.current = startActivityCreationRequest;
    const dateNode = getActivityAssistantConversationNode("activity.date");

    setError("");
    setInput("");
    setGuidedActivity({});
    setConversationNodeId("activity.date");
    setGuidedConversationMode("template");
    setMessages((current) => [
      ...current,
      { role: "user", text: "สร้างกิจกรรม", source: "template" },
      { role: "assistant", text: dateNode.prompt, source: "template" },
    ]);
  }, [open, startActivityCreationRequest]);
  // The left-side Summary button triggers this same conversation flow, so
  // both entry points create identical chat messages and deterministic data.
  useEffect(() => {
    if (
      !open ||
      !startDailySummaryRequest ||
      handledStartDailySummaryRequest.current === startDailySummaryRequest
    )
      return;
    handledStartDailySummaryRequest.current = startDailySummaryRequest;
    runDailySummary();
  }, [open, startDailySummaryRequest, runDailySummary]);
  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
  usePersistAssistantChat({
    messages,
    conversationNodeId,
    guidedActivity,
    guidedConversationMode,
    userId,
  });
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const cooldownLabel =
    cooldownSeconds > 0
      ? `${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, "0")}`
      : "";
  const canUseGemini =
    aiStatus?.isDeveloper === true && aiStatus?.enabled === true;
  const aiRequestCount = messages.filter(
    (message) =>
      ["ai", "free-ai", "calendar"].includes(message.source) && message.role === "user",
  ).length;
  const reset = async () => {
    // One clear action owns every disposable transcript shown in this dialog.
    // Telegram's native app history is intentionally not touched; this clears
    // only the authenticated T.i.M.E.S. mirror and its notification cards.
    conversationEpochRef.current += 1;
    setPending(false);
    setPendingSource("");
    setMessages([INITIAL_ASSISTANT_MESSAGE]);
    setError("");
    setCalendarFailure(null);
    setInput("");
    setGuidedActivity(null);
    setConversationNodeId("home");
    setGuidedConversationMode("template");
    setScheduleResolution(null);
    if (!clearTelegramOnReset || !onClearTelegramMessages) return;
    setPending(true);
    setPendingSource("telegram");
    try {
      await onClearTelegramMessages();
    } catch (requestError) {
      setError(requestError.message || "ล้างประวัติ Telegram ในเว็บไม่สำเร็จ");
    } finally {
      setPending(false);
      setPendingSource("");
    }
  };
  const addMessages = (...newMessages) =>
    setMessages((current) => [...current, ...newMessages]);
  const describeDraftForReview = (draft) =>
    `ร่างกิจกรรม: ${draft.title}\n${draft.startLocal.slice(0, 10)} · ${formatScheduleRange(draft.startLocal, draft.endLocal)}${draft.endLocal.slice(0, 10) !== draft.startLocal.slice(0, 10) ? ` (สิ้นสุด ${draft.endLocal.slice(0, 10)})` : ""}\nตรวจรายละเอียดในฟอร์ม แล้วกดบันทึกเมื่อพร้อมครับ`;
  const openDraftForReview = (draft, values = {}) => {
    if (activityFormOpen) {
      if (!onUpdateActivityForm) throw new Error("ไม่สามารถส่งร่างไปยังฟอร์มกิจกรรมได้");
      onUpdateActivityForm({ values: { ...values, formDraft: draft }, changedField: "activityDraft" });
    } else {
      if (!onOpenActivityForm) throw new Error("ไม่สามารถเปิดฟอร์มตรวจร่างกิจกรรมได้");
      onOpenActivityForm(draft);
    }
    setGuidedActivity(null);
    setConversationNodeId("home");
    setGuidedConversationMode("template");
  };
  const updateGuidedActivityField = (field, value) => {
    if (!guidedActivity || pending || !["title", "date", "time", "durationMinutes"].includes(field)) return;
    const selected = { ...guidedActivity, [field]: value };
    setGuidedActivity(selected);
    setScheduleResolution(null);
    setError("");
    if (activityFormOpen) onUpdateActivityForm?.({ values: selected, changedField: field });
  };
  const finishGuidedActivity = async (selected) => {
    const validationError = validateGuidedActivity(selected);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPending(true);
    setPendingSource("template");
    setError("");
    const requestVersion = activeSessionRef.current.version;
    const requestEpoch = conversationEpochRef.current;
    try {
      const result = await createTemplateDraft({
        title: selected.title,
        date: selected.date,
        time: selected.time,
        durationMinutes: selected.durationMinutes,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        categories: categories.map((category) => category.name),
        assistantPreferences,
        insightContext: toAssistantInsightContext(assistantInsight),
        scheduleContext: buildAssistantScheduleContext(
          activities,
          lockedActivities,
          selected.date,
        ),
      });
      if (!isCurrentConversation(requestVersion, requestEpoch)) {
        if (conversationEpochRef.current === requestEpoch && activeSessionRef.current.open && activeSessionRef.current.userId === userId)
          setError("คำขอสร้างร่างก่อนหน้านี้หมดอายุ เลือกระยะเวลาอีกครั้งเพื่อลองใหม่");
        return;
      }
      const activityDraft = createActivityPopupHandoff(result)?.values.formDraft;
      if (!activityDraft) throw new Error("ระบบสร้างร่างกิจกรรมไม่ครบ กรุณาลองอีกครั้ง");
      // A guided conversation can begin from the compact assistant without
      // an already-open ActivityPopup. Updating a closed form loses the
      // review surface, so open it with the completed draft in that case.
      const localSchedule = assessAssistantDraftOverlap(
        activityDraft,
        activities,
        lockedActivities,
      );
      const schedule = localSchedule;
      if (schedule?.status === "overlap-limit") {
        const resolution = {
          formDraft: activityDraft,
          alternatives: schedule.alternatives || [],
        };
        setScheduleResolution(resolution);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: describeScheduleConflict(schedule),
            source: "template",
            scheduleAlternatives: resolution.alternatives,
            scheduleResolution: resolution,
          },
        ]);
        return;
      }
      openDraftForReview(activityDraft, selected);
      addMessages({
        role: "assistant",
        text: describeDraftForReview(activityDraft),
        source: "template",
        sourceLabel: "ร่างจากข้อความ",
      });
    } catch (requestError) {
      if (isCurrentConversation(requestVersion, requestEpoch))
        setError(requestError.message || "สร้างร่างจากข้อความสำเร็จรูปไม่สำเร็จ");
    } finally {
      if (isCurrentConversation(requestVersion, requestEpoch)) {
        setPending(false);
        setPendingSource("");
      }
    }
  };
  const selectQuickReply = async (option) => {
    if (option.kind === "home") {
      const homeNode = getActivityAssistantConversationNode("home");
      setGuidedActivity(null);
      setConversationNodeId("home");
      setScheduleResolution(null);
      addMessages(
        { role: "user", text: option.label, source: "template" },
        { role: "assistant", text: homeNode.prompt, source: "template" },
      );
      return;
    }
    if (option.kind === "branch") {
      const nextNode = getActivityAssistantConversationNode(option.next);
      setGuidedActivity(null);
      setConversationNodeId(option.next);
      addMessages(
        { role: "user", text: option.label, source: "template" },
        { role: "assistant", text: nextNode.prompt, source: "template" },
      );
      return;
    }
    if (option.kind === "start") {
      const nextNode = getActivityAssistantConversationNode(option.next);
      setError("");
      setGuidedActivity({});
      setConversationNodeId(option.next);
      setScheduleResolution(null);
      setGuidedConversationMode("template");
      addMessages({
        role: "user",
        text: "ฉันต้องการสร้างกิจกรรม",
        source: "template",
      });
      addMessages({
        role: "assistant",
        text: nextNode.prompt,
        source: "template",
      });
      if (openFormOnGuidedStart) openFullActivityForm({});
      return;
    }
    const node = getActivityAssistantConversationNode(conversationNodeId);
    const value =
      option.dateOffset === undefined
        ? option.value
        : (() => {
            const date = new Date();
            date.setDate(date.getDate() + option.dateOffset);
            return toDateInputValue(date);
          })();
    const selected = { ...guidedActivity, [node.field]: value };
    addMessages({ role: "user", text: option.label, source: "template" });
    onUpdateActivityForm?.({ values: selected, changedField: node.field });
    if (option.complete) {
      setGuidedActivity(selected);
      await finishGuidedActivity(selected);
      return;
    }
    const nextNodeId = node.field === "date" && selected.title ? "activity.time" : node.field === "title" && !selected.date ? "activity.date" : option.next;
    const nextNode = getActivityAssistantConversationNode(nextNodeId);
    setGuidedActivity(selected);
    setConversationNodeId(nextNodeId);
    setGuidedConversationMode("template");
    addMessages({
      role: "assistant",
      text: nextNode.prompt,
      source: "template",
    });
  };
  const conversationNode =
    getActivityAssistantConversationNode(conversationNodeId);
  const quickReplies = conversationNode.options.filter(
    (option) => option.available !== false,
  );
  const rootQuestions = getActivityAssistantRootQuestions();
  const sendKnowledge = async (text, commandTone = "knowledge") => {
    if (!text || pending) return;
    const requestVersion = activeSessionRef.current.version;
    const requestEpoch = conversationEpochRef.current;
    setPending(true);
    setPendingSource("knowledge");
    setError("");
    setMessages((current) => [...current, { role: "user", text, source: "knowledge", commandTone }]);
    try {
      const result = await fetchProductKnowledge(text);
      if (!isCurrentConversation(requestVersion, requestEpoch)) return;
      setMessages((current) => [...current, {
        role: "assistant",
        text: result.reply,
        source: "knowledge",
        commandTone,
        followUpQuestions: result.found ? getActivityAssistantKnowledgeFollowUps(text) : [],
      }]);
    } catch (requestError) {
      if (isCurrentConversation(requestVersion, requestEpoch)) setError(requestError.message || "โหลดคำตอบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (isCurrentConversation(requestVersion, requestEpoch)) {
        setPending(false);
        setPendingSource("");
      }
    }
  };
  const send = async (event, suggestedText = "", commandTone = "") => {
    event?.preventDefault();
    const text = (suggestedText || input).trim();
    if (!text || pending || (cooldownSeconds > 0 && !suggestedText && !guidedActivity)) return;
    const requestVersion = activeSessionRef.current.version;
    const requestEpoch = conversationEpochRef.current;
    const isCurrentRequest = () => isCurrentConversation(requestVersion, requestEpoch);
    if (freeConversation && chatStyle === "free" && !suggestedText && !guidedActivity) {
      const history = messages.filter((message) => message.source === "free-ai" && ["user", "assistant"].includes(message.role)).slice(-16).map(({ role, text: turnText }) => ({ role, text: turnText }));
      setMessages((current) => [...current, { role: "user", text, source: "free-ai" }]);
      setInput("");
      setPending(true);
      setPendingSource("ai");
      setError("");
      try {
        const result = await continueFreeChat({ text, history });
        if (!isCurrentRequest()) return;
        if (result.source === "knowledge") setMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, source: "knowledge" } : message));
        setMessages((current) => [...current, { role: "assistant", text: result.reply, source: result.source === "knowledge" ? "knowledge" : "free-ai" }]);
      } catch (requestError) {
        if (!isCurrentRequest()) return;
        setError(requestError.message || "MR.Zettascale ยังตอบไม่ได้ในขณะนี้");
        if (requestError.retryAfterSeconds) setCooldownUntil(Date.now() + requestError.retryAfterSeconds * 1000);
      } finally {
        if (isCurrentRequest()) {
          setPending(false);
          setPendingSource("");
          getActivityAssistantStatus().then((result) => { if (isCurrentRequest()) setAiStatus(result.aiChat); }).catch(() => {});
        }
      }
      return;
    }
    if (guidedActivity && conversationNodeId === "activity.date" && !suggestedText) {
      const date = resolveGuidedDateInput(text);
      if (!date) {
        setError("เลือกวันที่ด้านบนหรือในแผงงาน หรือพิมพ์วันที่แบบ YYYY-MM-DD ครับ");
        return;
      }
      const selected = { ...guidedActivity, date };
      const nextNodeId = selected.title ? "activity.time" : "activity.title";
      setGuidedActivity(selected);
      setConversationNodeId(nextNodeId);
      setInput("");
      setError("");
      setGuidedConversationMode("template");
      onUpdateActivityForm?.({ values: selected, changedField: "date" });
      addMessages(
        { role: "user", text, source: "template" },
        { role: "assistant", text: getActivityAssistantConversationNode(nextNodeId).prompt, source: "template" },
      );
      return;
    }
    if (guidedActivity && conversationNodeId === "activity.title" && !suggestedText) {
      if (text.length > 120) {
        setError("ชื่อกิจกรรมต้องไม่เกิน 120 ตัวอักษรครับ");
        return;
      }
      const selected = { ...guidedActivity, title: text };
      const nextNodeId = selected.date ? "activity.time" : "activity.date";
      setGuidedActivity(selected);
      setConversationNodeId(nextNodeId);
      setInput("");
      setError("");
      setGuidedConversationMode("template");
      onUpdateActivityForm?.({ values: selected, changedField: "title" });
      addMessages(
        { role: "user", text, source: "template" },
        { role: "assistant", text: getActivityAssistantConversationNode(nextNodeId).prompt, source: "template" },
      );
      return;
    }
    const immediateGuidedActivity = guidedActivity;
    const immediateGuidedStep = conversationNodeId;
    const nextMessages = [...messages, { role: "user", text, source: "ai", commandTone }];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setPendingSource(canUseGemini ? "ai" : "template");
    setError("");
    setCalendarFailure(null);
    if (guidedActivity && canUseGemini) setGuidedConversationMode("ai");
    try {
      const history = messages.slice(1);
      // `text` is the current turn. Keep an accidentally duplicated current
      // message out of history so it cannot be interpreted as stale intent.
      if (
        history.at(-1)?.role === "user" &&
        history.at(-1).text.trim() === text
      )
        history.pop();
      const result = await continuePlanningChat({
        text,
        history,
        referenceDate: toDateInputValue(new Date()),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        categories: categories.map((category) => category.name),
        userTags: collectUserTags(activityTagMap),
        assistantPreferences,
        insightContext: toAssistantInsightContext(assistantInsight),
        scheduleContext: buildAssistantScheduleContext(
          activities,
          lockedActivities,
          toDateInputValue(new Date()),
        ),
        guidedStep: immediateGuidedActivity ? immediateGuidedStep : "",
        guidedActivity: immediateGuidedActivity,
      });
      if (!isCurrentRequest()) return;
      // A complete explicit request is parsed by the backend without Gemini.
      // Render it like other quota-free knowledge responses so this turn does
      // not inflate the local AI usage indicator either.
      const responseSource = ["knowledge", "deterministic", "scheduling", "planning"].includes(
        result.source,
      )
        ? "knowledge"
        : result.source === "calendar"
          ? "calendar"
          : "ai";
      const currentNode =
        getActivityAssistantConversationNode(conversationNodeId);
      const collectedFieldValue =
        result.collected?.[currentNode.field] ||
        immediateGuidedActivity?.[currentNode.field];
      const canAdvanceGuidedFlow =
        responseSource === "ai" &&
        immediateGuidedActivity &&
        currentNode.field &&
        collectedFieldValue;
      const nextNodeId = canAdvanceGuidedFlow
        ? currentNode.options.find((option) => option.next)?.next
        : "";
      const completedGuidedActivity = canAdvanceGuidedFlow
        ? { ...immediateGuidedActivity, ...result.collected }
        : null;
      if (canAdvanceGuidedFlow) {
        setGuidedActivity(completedGuidedActivity);
        onUpdateActivityForm?.({
          values: completedGuidedActivity,
          changedField: currentNode.field,
        });
        if (nextNodeId) setConversationNodeId(nextNodeId);
        // Gemini has finished this turn. The next answer is the person's
        // choice again: tap a template option or type to ask Gemini directly.
        setGuidedConversationMode("template");
      } else if (responseSource === "ai") {
        setGuidedActivity(null);
        setConversationNodeId("home");
        setGuidedConversationMode("template");
      }
      setMessages((current) => {
        const withCorrectedUserSource =
          responseSource !== "ai"
            ? current.map((message, index) =>
                index === current.length - 1
                  ? { ...message, source: responseSource }
                  : message,
              )
            : current;
        const nextMessages = [
          ...withCorrectedUserSource,
          {
            role: "assistant",
            text: result.reply,
            source: responseSource,
            sourceLabel: assistantSourceLabel(result),
            toolKind: result.calendarRange?.label ? "calendar" : ["scheduling", "planning"].includes(result.source) ? result.source : "",
            toolResultCount: result.source === "scheduling" ? result.scheduling?.options?.length || 0 : result.source === "planning" ? result.planning?.drafts?.length || 0 : 0,
            calendarRange: result.calendarRange?.label ? { label: result.calendarRange.label } : null,
            commandTone,
            scheduleOptions: result.scheduling?.options || [],
            planDrafts: result.planning?.drafts || [],
            followUpQuestions:
              !result.ready && responseSource === "knowledge"
                ? getActivityAssistantKnowledgeFollowUps(text)
                : [],
          },
        ];
        return nextMessages;
      });
      if (
        canAdvanceGuidedFlow &&
        !nextNodeId &&
        completedGuidedActivity?.title &&
        completedGuidedActivity.date &&
        completedGuidedActivity.time &&
        completedGuidedActivity.durationMinutes
      ) {
        await finishGuidedActivity(completedGuidedActivity);
      }
      if (!isCurrentRequest()) return;
      if (result.ready) {
        const popupHandoff = createActivityPopupHandoff(result);
        if (!popupHandoff)
          throw new Error("ร่างกิจกรรมไม่ครบ จึงยังเปิดฟอร์มบันทึกไม่ได้");
        const localSchedule = assessAssistantDraftOverlap(
          popupHandoff.values.formDraft,
          activities,
          lockedActivities,
        );
        const schedule = localSchedule;
        if (schedule?.status === "overlap-limit") {
          const resolution = {
            formDraft: popupHandoff.values.formDraft,
            alternatives: schedule.alternatives || [],
          };
          setScheduleResolution(resolution);
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              text: describeScheduleConflict(schedule),
              source: "template",
              scheduleAlternatives: resolution.alternatives,
              scheduleResolution: resolution,
            },
          ]);
          return;
        }

        if (activityFormOpen) onUpdateActivityForm?.(popupHandoff);
        else onOpenActivityForm?.(popupHandoff.values.formDraft);
      }
    } catch (requestError) {
      if (!isCurrentRequest()) return;
      if (["CALENDAR_REAUTH_REQUIRED", "CALENDAR_READ_FAILED"].includes(requestError.code)) {
        setCalendarFailure({ kind: requestError.code === "CALENDAR_REAUTH_REQUIRED" ? "reauth" : "unavailable", requestKind: "chat", text, commandTone });
      } else {
        setError(requestError.message || "MR.Zettascale ยังตอบไม่ได้ในขณะนี้");
      }
      if (requestError.retryAfterSeconds)
        setCooldownUntil(Date.now() + requestError.retryAfterSeconds * 1000);
    } finally {
      if (isCurrentRequest()) {
        setPending(false);
        setPendingSource("");
        getActivityAssistantStatus()
          .then((result) => { if (isCurrentRequest()) setAiStatus(result.aiChat); })
          .catch(() => {});
      }
    }
  };
  const sendToTelegram = async () => {
    const text = input.trim();
    if (!text || pending || !onSendTelegramMessage) return;
    setPending(true);
    setPendingSource("telegram");
    setError("");
    try {
      await onSendTelegramMessage(text);
      setInput("");
    } catch (requestError) {
      setError(requestError.message || "ส่งข้อความไป Telegram ไม่สำเร็จ");
    } finally {
      setPending(false);
      setPendingSource("");
    }
  };
  const runWeatherPlan = async ({ location, activity, day, durationHours }) => {
    if (pending || !location?.trim()) return;
    const requestVersion = activeSessionRef.current.version;
    const requestEpoch = conversationEpochRef.current;
    const isCurrent = () => isCurrentConversation(requestVersion, requestEpoch);
    const dayLabel = day === "tomorrow" ? "พรุ่งนี้" : "วันนี้";
    const question = `ดูอากาศ ${location.trim()} ${dayLabel} เพื่อ${activity === "exercise" ? "ออกกำลังกาย" : activity === "travel" ? "เดินทาง" : activity === "laundry" ? "ซักผ้า" : "ทำกิจกรรมกลางแจ้ง"} ${durationHours} ชั่วโมง`;
    setMessages((current) => [...current, { role: "user", text: question, source: "template", commandTone: "calendar" }]);
    setPending(true);
    setPendingSource("weather");
    setError("");
    try {
      const result = await weatherPlanRequest({ location: location.trim(), activity, day, durationHours });
      if (!isCurrent()) return;
      const slots = Array.isArray(result.recommendation?.slots) ? result.recommendation.slots : [];
      const current = result.weather?.current || {};
      const observed = `${current.condition || "ไม่ระบุ"} · ${current.temperatureC == null ? "ไม่ระบุอุณหภูมิ" : `${current.temperatureC}°C`} · โอกาสฝน ${current.rainPercent == null ? "ไม่ระบุ" : `${current.rainPercent}%`}`;
      const reply = `${result.location} · ${dayLabel}\nตอนนี้ ${observed}\n${result.recommendation?.text || "ยังไม่มีช่วงแนะนำ"}${result.aiAdvice ? `\n\n🤖 ${result.aiAdvice}` : ""}\n\nข้อมูล ณ ${result.weather?.asOf || "ไม่ระบุ"} (${result.weather?.timeZone || "Asia/Bangkok"})\n${result.attribution || "Source: Includes weather data from Google"}`;
      setMessages((currentMessages) => [
        ...currentMessages.map((message, index) => index === currentMessages.length - 1 ? { ...message, source: result.aiUsed ? "ai" : "knowledge" } : message),
        { role: "assistant", text: reply, source: result.aiUsed ? "ai" : "knowledge", sourceLabel: result.aiUsed ? "AI · Google Weather" : "Google Weather · เกณฑ์ T.i.M.E.S.", toolKind: "weather", toolResultCount: slots.length, commandTone: "calendar", weatherSlots: slots, weatherContext: { location: result.location, locationQuery: location.trim(), activity: result.activity, activityId: activity, day, durationHours, asOf: result.weather?.asOf, timeZone: result.weather?.timeZone } }
      ]);
    } catch (requestError) {
      if (isCurrent()) setError(requestError.message || "ดึงข้อมูลอากาศไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (isCurrent()) {
        setPending(false);
        setPendingSource("");
        getActivityAssistantStatus().then((result) => { if (isCurrent()) setAiStatus(result.aiChat); }).catch(() => {});
      }
    }
  };
  const selectWeatherSlot = async (slot, context) => {
    if (pending) return;
    const start = new Date(slot?.start);
    const end = new Date(slot?.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError("ช่วงเวลาอากาศนี้ไม่ถูกต้อง กรุณาคำนวณใหม่");
      return;
    }
    if (start.getTime() <= Date.now()) {
      setError("ช่วงเวลานี้ผ่านไปแล้ว กรุณาดูอากาศและคำนวณช่วงใหม่");
      return;
    }
    if (!context?.location || !context?.activityId || !context?.day || !context?.durationHours) {
      setError("ข้อมูลพยากรณ์เดิมไม่ครบ กรุณาดูอากาศอีกครั้ง");
      return;
    }
    const requestVersion = activeSessionRef.current.version;
    const requestEpoch = conversationEpochRef.current;
    const isCurrent = () => isCurrentConversation(requestVersion, requestEpoch);
    setPending(true);
    setPendingSource("weather");
    setError("");
    let latest;
    try {
      latest = await weatherPlanRequest({ location: context.locationQuery || context.location, activity: context.activityId, day: context.day, durationHours: context.durationHours, includeAdvice: false });
    } catch (requestError) {
      if (isCurrent()) setError(requestError.message || "ตรวจพยากรณ์ล่าสุดไม่สำเร็จ กรุณาลองอีกครั้ง");
      return;
    } finally {
      if (isCurrent()) { setPending(false); setPendingSource(""); }
    }
    if (!isCurrent()) return;
    if (start.getTime() <= Date.now() || latest.location !== context.location || !isWeatherSlotStillRecommended(slot, latest)) {
      setError("พยากรณ์อากาศเปลี่ยนแล้ว ช่วงนี้ไม่ผ่านเกณฑ์เดิม กรุณาดูอากาศและเลือกช่วงใหม่");
      return;
    }
    const localValue = (date) => `${toDateInputValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const draft = {
      title: context?.activity || "กิจกรรมกลางแจ้ง",
      startLocal: localValue(start),
      endLocal: localValue(end),
      allDay: false,
      categoryName: "",
      tags: [],
      notes: `ช่วงเวลาแนะนำจาก Google Weather สำหรับ ${latest.location || context.location} · ข้อมูล ณ ${latest.weather?.asOf || "ไม่ระบุ"} (${latest.weather?.timeZone || context.timeZone || "Asia/Bangkok"})\nตรวจสภาพอากาศอีกครั้งก่อนกิจกรรม`,
      weatherValidation: {
        request: { location: context.locationQuery || context.location, activity: context.activityId, day: context.day, durationHours: context.durationHours },
        slot
      }
    };
    const handoff = createActivityPopupHandoff({ ready: true, draft });
    if (!handoff) { setError("ยังสร้างร่างจากช่วงเวลานี้ไม่ได้"); return; }
    if (assessAssistantDraftOverlap(draft, activities, lockedActivities)?.status === "overlap-limit") {
      setError("ช่วงเวลานี้ชนกับกิจกรรมในปฏิทินเกินจำนวนที่รองรับ เลือกช่วงอื่นหรือแก้ตารางก่อน");
      return;
    }
    try {
      openDraftForReview(draft);
      addMessages(
        { role: "user", text: `เลือกช่วงอากาศ ${slot.at || formatScheduleRange(draft.startLocal, draft.endLocal)}`, source: "template", commandTone: "calendar" },
        { role: "assistant", text: describeDraftForReview(draft), source: "template", sourceLabel: "ร่างจากข้อความ", commandTone: "calendar" }
      );
      setError("");
    } catch (requestError) { setError(requestError.message || "เปิดร่างกิจกรรมไม่สำเร็จ"); }
  };
  const retryCalendarFailure = () => {
    if (!calendarFailure || pending) return;
    const failed = calendarFailure;
    setCalendarFailure(null);
    if (failed.requestKind === "daily-summary") runDailySummary();
    else send(null, failed.text, failed.commandTone);
  };
  const selectScheduleAlternative = (
    alternative,
    resolution = scheduleResolution,
  ) => {
    if (
      !resolution?.formDraft ||
      !alternative?.startLocal ||
      !alternative?.endLocal
    )
      return;
    const formDraft = {
      ...resolution.formDraft,
      startLocal: alternative.startLocal,
      endLocal: alternative.endLocal,
      assumptions: [
        ...(resolution.formDraft.assumptions || []),
        `เลือกช่วงเวลาที่ไม่ชนเกินขีดจำกัด ${formatScheduleRange(alternative.startLocal, alternative.endLocal)}`,
      ],
    };
    const schedule = assessAssistantDraftOverlap(
      formDraft,
      activities,
      lockedActivities,
    );
    if (schedule.status === "overlap-limit") {
      setError(
        "ตารางเปลี่ยนแล้ว ช่วงเวลานี้ชนเกิน 3 กิจกรรม กรุณาร่างใหม่หรือเลือกเวลาอื่น",
      );
      return;
    }
    try {
      openDraftForReview(formDraft);
      // Each message keeps its resolution, so another offered slot remains
      // selectable if the person returns after reviewing the form.
      setScheduleResolution({ ...resolution, selected: alternative });
      addMessages(
        { role: "user", text: `เลือกเวลา ${formatScheduleOption(alternative.startLocal, alternative.endLocal)}`, source: "template" },
        { role: "assistant", text: describeDraftForReview(formDraft), source: "template", sourceLabel: "ร่างจากข้อความ" },
      );
      setError("");
    } catch (requestError) {
      setError(requestError.message || "เปิดร่างกิจกรรมไม่สำเร็จ");
    }
  };
  const selectScheduleOption = (option) => {
    const formDraft = option?.draft;
    if (!formDraft?.startLocal || !formDraft?.endLocal) return;
    const schedule = assessAssistantDraftOverlap(formDraft, activities, lockedActivities);
    if (schedule.status === "overlap-limit") {
      setError("ตารางเปลี่ยนแล้ว ช่วงเวลานี้ชนเกิน 3 กิจกรรม กรุณาหาช่วงเวลาใหม่อีกครั้ง");
      return;
    }
    try {
      openDraftForReview(formDraft);
      addMessages(
        { role: "user", text: `เลือกเวลา ${formatScheduleRange(formDraft.startLocal, formDraft.endLocal)}`, source: "template" },
        { role: "assistant", text: describeDraftForReview(formDraft), source: "template", sourceLabel: "ร่างจากข้อความ" },
      );
      setError("");
    } catch (requestError) {
      setError(requestError.message || "เปิดร่างกิจกรรมไม่สำเร็จ");
    }
  };
  const confirmActivityPlan = async (drafts) => {
    if (!onConfirmActivityPlan || pending || !Array.isArray(drafts) || drafts.length === 0) return false;
    setPending(true);
    setPendingSource("template");
    setError("");
    try {
      const result = await onConfirmActivityPlan(drafts);
      const created = result?.created || [];
      const failed = result?.failed || [];
      const warnings = result?.warnings || [];
      setMessages((current) => [
        ...current,
        { role: "user", text: `ยืนยันสร้าง ${drafts.length} กิจกรรม`, source: "template" },
        {
          role: "assistant",
          text: created.length + failed.length === 0
            ? "ยังยืนยันผลการบันทึกไม่ได้ กรุณาตรวจ Google Calendar ก่อนเริ่มสร้างแผนใหม่ เพื่อป้องกันรายการซ้ำ"
            : `${failed.length
              ? `สร้างสำเร็จ ${created.length} รายการ และไม่สำเร็จ ${failed.length} รายการ: ${failed.map((item) => `“${item.title}”`).join(", ")}`
              : `สร้างกิจกรรม ${created.length} รายการเรียบร้อยแล้วครับ`}${warnings.length ? `\nมี ${warnings.length} ขั้นตอนหลังบันทึกที่ไม่สำเร็จ กรุณาตรวจข้อมูลประกอบหรือลองโหลดตารางใหม่` : ""}${failed.length ? "\nกรุณาตรวจ Google Calendar ก่อนเริ่มสร้างแผนใหม่ เพื่อป้องกันรายการซ้ำ" : ""}`,
          source: "template"
        }
      ]);
      return { created, failed, warnings };
    } catch (requestError) {
      setError(requestError.message || "สร้างแผนกิจกรรมไม่สำเร็จ");
      return false;
    } finally {
      setPending(false);
      setPendingSource("");
    }
  };
  const openFullActivityForm = (activityValues = guidedActivity) => {
    const seed = (() => {
      const now = new Date();
      const date = activityValues?.date || toDateInputValue(now);
      const time =
        activityValues?.time ||
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const start = `${date}T${time}`;
      const end = new Date(start);
      end.setMinutes(
        end.getMinutes() + (activityValues?.durationMinutes || 60),
      );
      return {
        title: activityValues?.title || "",
        startLocal: start,
        endLocal: `${toDateInputValue(end)}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
        allDay: false,
        categoryName: "",
        tags: [],
        notes: "",
      };
    })();
    onOpenActivityForm?.(seed);
  };
  return {
    messages,
    pending,
    pendingSource,
    error,
    calendarFailure,
    aiStatus,
    cooldownSeconds,
    cooldownLabel,
    canUseGemini,
    aiRequestCount,
    guidedActivity,
    scheduleResolution,
    conversationNodeId,
    guidedConversationMode,
    input,
    setInput,
    bottomRef,
    rootQuestions,
    quickReplies,
    reset,
    send,
    sendKnowledge,
    selectQuickReply,
    updateGuidedActivityField,
    retryGuidedActivityDraft: () => finishGuidedActivity(guidedActivity),
    runDailySummary,
    runWeatherPlan,
    selectWeatherSlot,
    retryCalendarFailure,
    selectScheduleAlternative,
    selectScheduleOption,
    confirmActivityPlan,
    sendToTelegram,
    chatStyle,
    setChatStyle,
  };
}

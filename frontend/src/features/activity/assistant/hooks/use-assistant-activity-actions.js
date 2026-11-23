import { useCallback, useEffect, useState } from "react";
import { toDateInputValue } from "../../../../shared/lib/date-utils.js";
import { normalizeActivityId } from "../../../../shared/lib/id-utils.js";
import { fetchActivities } from "../../../../shared/api/google-calendar.js";
import { fetchDailySummary } from "../../api/summary.js";
import { fetchWeatherPlan } from "../api/activity-assistant-api.js";
import { collectPreferenceCorrections } from "../lib/preference-corrections.js";
import { assertWeatherDraftCurrent } from "../lib/weather-slot-validation.js";

/**
 * Owns the bridge between Activity Mode, Google Calendar saves, and the
 * MR.Zettascale AI Assistant (daily summary fetch, preference correction
 * learning, rail quick-edit save, multi-activity plan save, and modal handoff).
 */
export function useAssistantActivityActions({
  mode,
  setMode,
  closeAiMode,
  calendarAccessToken,
  archivedActivityIds,
  categories,
  activityCategoryMap,
  activityTagMap,
  assistantPreferences,
  telegramChat,
  openAddActivity,
  closeModal,
  handleSaveActivity,
  handleSaveActivityPlan
}) {
  const activityAssistantOpen = mode === "ai";
  const setActivityAssistantOpen = useCallback((open) => {
    if (open) setMode("ai");
    else closeAiMode();
  }, [setMode, closeAiMode]);

  const [assistantInsight, setAssistantInsight] = useState(null);
  const [activityAssistantFormUpdate, setActivityAssistantFormUpdate] = useState(null);
  const [activityAssistantStartRequest, setActivityAssistantStartRequest] = useState(0);
  const [activityAssistantDailySummaryRequest, setActivityAssistantDailySummaryRequest] = useState(0);
  const [assistantDailySummary, setAssistantDailySummary] = useState({
    open: false,
    loading: false,
    error: "",
    data: null
  });

  const { closeChat } = telegramChat;

  useEffect(() => {
    if (mode === "ai") return;
    closeChat();
    setAssistantDailySummary((current) => (
      current.open ? { open: false, loading: false, error: "", data: null } : current
    ));
  }, [mode, closeChat]);

  const handleCloseActivityModal = useCallback(() => {
    // An assistant hand-off belongs only to the current form. Clearing it on
    // close prevents an old chat reply from refilling the next blank form.
    setActivityAssistantFormUpdate(null);
    closeModal();
  }, [closeModal]);

  const openAssistantDailySummary = useCallback(async () => {
    if (!calendarAccessToken) throw new Error("กรุณาเชื่อม Google Calendar ก่อนดูสรุปกิจกรรม");
    const now = new Date();
    const date = toDateInputValue(now);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    setAssistantDailySummary({ open: true, loading: true, error: "", data: null });
    handleCloseActivityModal();
    try {
      const dayActivities = await fetchActivities(calendarAccessToken, dayStart, dayEnd);
      const payload = dayActivities
        .filter((activity) => !archivedActivityIds.has(activity.id))
        .map((activity) => {
          const allDay = Boolean(activity.start?.date && !activity.start?.dateTime);
          return {
            id: activity.id,
            summary: activity.summary,
            start: allDay ? `${activity.start.date}T00:00:00` : activity.start?.dateTime,
            end: allDay ? `${activity.end?.date || activity.start.date}T00:00:00` : activity.end?.dateTime,
            allDay
          };
        })
        .filter((activity) => activity.start && activity.end);
      const data = await fetchDailySummary(date, payload);
      setAssistantDailySummary({ open: true, loading: false, error: "", data });
      return data;
    } catch (error) {
      setAssistantDailySummary({ open: true, loading: false, error: error.message, data: null });
      throw error;
    }
  }, [calendarAccessToken, archivedActivityIds, handleCloseActivityModal]);

  const requestAssistantDailySummary = useCallback(() => {
    setActivityAssistantOpen(true);
    setActivityAssistantDailySummaryRequest((current) => current + 1);
  }, [setActivityAssistantOpen]);

  const saveActivityWithAssistantLearning = useCallback(async (payload) => {
    await assertWeatherDraftCurrent({
      validation: payload.weatherValidation,
      activityBody: payload.activityBody,
      fetchPlan: fetchWeatherPlan
    });
    const saved = await handleSaveActivity(payload);
    const corrections = collectPreferenceCorrections(payload);
    // Preference learning is never allowed to make a Calendar save look as if
    // it failed. It is an optional follow-up and has its own visible UI.
    if (corrections.length) assistantPreferences.recordCorrections(corrections).catch(() => {});
    return saved;
  }, [assistantPreferences, handleSaveActivity]);

  const saveAssistantRailEdit = useCallback(async ({ id, updated, draft }) => {
    const start = new Date(draft?.startLocal || "");
    const end = new Date(draft?.endLocal || "");
    if (!id || !draft?.title?.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw new Error("ข้อมูลกิจกรรมที่แก้ไขไม่ถูกต้อง");
    }
    const normalizedId = normalizeActivityId(id);
    return handleSaveActivity({
      existingId: id,
      knownUpdated: updated,
      categoryId: activityCategoryMap[normalizedId] || null,
      tags: activityTagMap[normalizedId] || [],
      activityBody: {
        summary: draft.title.trim(),
        start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      }
    });
  }, [activityCategoryMap, activityTagMap, handleSaveActivity]);

  const saveAssistantPlan = useCallback(async (drafts) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const items = drafts.map((draft) => {
      const start = new Date(draft.startLocal || "");
      const end = new Date(draft.endLocal || "");
      if (!draft.title?.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        throw new Error("แผนมีชื่อหรือวันเวลาที่ไม่ถูกต้อง");
      }
      const categoryId = categories.find((category) => category.name === draft.categoryName)?.id || null;
      return {
        activityBody: {
          summary: draft.title.trim(),
          description: draft.notes?.trim() || null,
          start: { dateTime: start.toISOString(), timeZone },
          end: { dateTime: end.toISOString(), timeZone }
        },
        categoryId,
        tags: Array.isArray(draft.tags) ? draft.tags : []
      };
    });
    return handleSaveActivityPlan(items);
  }, [categories, handleSaveActivityPlan]);

  const handleCloseAssistant = useCallback(() => {
    setActivityAssistantOpen(false);
    closeChat();
    setAssistantDailySummary({ open: false, loading: false, error: "", data: null });
  }, [setActivityAssistantOpen, closeChat]);

  const handleOpenActivityFormFromAssistant = useCallback((draft) => {
    setActivityAssistantFormUpdate(null);
    const start = new Date(draft.startLocal || new Date());
    const end = new Date(draft.endLocal || start.getTime() + 60 * 60000);
    openAddActivity(start, {
      preserveTime: true,
      end,
      title: draft.title || "",
      initialDraft: { ...draft, assistantOrigin: "mr-zettascale" }
    });
  }, [openAddActivity]);

  const handleUpdateActivityFormFromAssistant = useCallback(({ values, changedField }) => {
    setActivityAssistantFormUpdate({ values, changedField, revision: Date.now() });
  }, []);

  const handleOpenAssistantFromModal = useCallback(() => {
    handleCloseActivityModal();
    setActivityAssistantOpen(true);
    setActivityAssistantStartRequest((current) => current + 1);
  }, [handleCloseActivityModal, setActivityAssistantOpen]);

  return {
    activityAssistantOpen,
    setActivityAssistantOpen,
    assistantInsight,
    setAssistantInsight,
    activityAssistantFormUpdate,
    activityAssistantStartRequest,
    activityAssistantDailySummaryRequest,
    assistantDailySummary,
    handleCloseActivityModal,
    openAssistantDailySummary,
    requestAssistantDailySummary,
    saveActivityWithAssistantLearning,
    saveAssistantRailEdit,
    saveAssistantPlan,
    handleCloseAssistant,
    handleOpenActivityFormFromAssistant,
    handleUpdateActivityFormFromAssistant,
    handleOpenAssistantFromModal
  };
}

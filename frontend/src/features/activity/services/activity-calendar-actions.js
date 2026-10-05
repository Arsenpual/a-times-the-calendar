import { normalizeActivityId } from "../../../shared/lib/id-utils.js";
import { introducesOverlapLimitViolation } from "../lib/timeline-layout.js";
import {
  activitySaveCandidateEntries,
  buildActivityDuplicateBody,
  buildActivityMoveBody,
  nextActivityCopySummary,
  overlapEntriesFromActivities
} from "../lib/activity-mutation-logic.js";

export function createActivityCalendarActions({
  calendarAccessToken,
  activities,
  setActivities,
  activityCategoryMap,
  setActivityCategoryMap,
  activityTagMap,
  setActivityTagMap,
  lockedActivities,
  setLockedActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  fetchRecurringInstances,
  assignActivityCategory,
  setActivityTags,
  setActivityLocked,
  deleteActivityNotification,
  syncActivityNotification,
  clearTokenIfExpired,
  checkConflict,
  isCalendarAuthExpiredError,
  setCalendarAccessToken,
  setError,
  loadActivities,
  refreshTagSearchIfActive
}) {
  const persistCreatedActivityMetadata = async (savedActivity, categoryId, tags) => {
    if (!savedActivity?.id) return;
    try {
      await syncActivityNotification(savedActivity);
    } catch (error) {
      setError(`บันทึกกิจกรรมสำเร็จ แต่ตั้งการแจ้งเตือนไม่สำเร็จ: ${error.message}`);
    }
    const normalizedId = normalizeActivityId(savedActivity.id);
    setActivityCategoryMap((previous) => {
      const next = { ...previous };
      if (categoryId) next[normalizedId] = categoryId;
      else delete next[normalizedId];
      return next;
    });
    try {
      await assignActivityCategory(normalizedId, categoryId);
    } catch (error) {
      setError(`บันทึกหมวดหมู่ไม่สำเร็จ: ${error.message}`);
    }
    const cleanTags = Array.isArray(tags) ? tags : [];
    setActivityTagMap((previous) => {
      const next = { ...previous };
      if (cleanTags.length > 0) next[normalizedId] = cleanTags;
      else delete next[normalizedId];
      return next;
    });
    try {
      await setActivityTags(normalizedId, cleanTags);
    } catch (error) {
      setError(`บันทึก tag ไม่สำเร็จ: ${error.message}`);
    }
  };

  const handleSaveActivity = async ({ activityBody, categoryId, tags, existingId, knownUpdated }) => {
    if (!calendarAccessToken) return false;

    const candidateEntries = activitySaveCandidateEntries({ activities, existingId, activityBody });
    if (introducesOverlapLimitViolation(overlapEntriesFromActivities(activities), candidateEntries)) {
      throw new Error("บันทึกไม่ได้: ช่วงเวลานี้มีกิจกรรมซ้อนกันเกิน 3 รายการ");
    }

    let conflictDetected = false;
    if (existingId && knownUpdated) {
      try {
        const latest = await getActivity(calendarAccessToken, existingId);
        if (latest?.updated && latest.updated !== knownUpdated) conflictDetected = true;
      } catch {
        // The update call below remains the source of truth for save errors.
      }
    }

    let savedActivity;
    try {
      savedActivity = existingId
        ? await updateActivity(calendarAccessToken, existingId, activityBody)
        : await createActivity(calendarAccessToken, activityBody);
    } catch (error) {
      clearTokenIfExpired(error);
      throw error;
    }

    await persistCreatedActivityMetadata(savedActivity, categoryId, tags);

    if (conflictDetected) {
      setError(`กิจกรรม "${activityBody.summary}" ถูกแก้ไขที่อื่นหลังจากเปิดฟอร์มนี้ — บันทึกทับข้อมูลล่าสุดแล้ว`);
    }
    await loadActivities();
    refreshTagSearchIfActive();
    return savedActivity;
  };

  const handleSaveActivityPlan = async (items) => {
    if (!calendarAccessToken) throw new Error("กรุณาเชื่อม Google Calendar ก่อนสร้างแผน");
    if (!Array.isArray(items) || items.length < 1 || items.length > 5) throw new Error("แผนต้องมีกิจกรรมระหว่าง 1 ถึง 5 รายการ");
    const plannedEntries = items.map((item, index) => ({
      id: `plan-${index}`,
      start: new Date(item?.activityBody?.start?.dateTime || ""),
      end: new Date(item?.activityBody?.end?.dateTime || "")
    }));
    if (plannedEntries.some((entry) => !Number.isFinite(entry.start.getTime()) || !Number.isFinite(entry.end.getTime()) || entry.end <= entry.start)) {
      throw new Error("แผนมีวันเวลาที่ไม่ถูกต้อง");
    }
    const existingEntries = overlapEntriesFromActivities(activities);
    if (introducesOverlapLimitViolation(existingEntries, [...existingEntries, ...plannedEntries])) {
      throw new Error("สร้างแผนไม่ได้: ช่วงเวลานี้มีกิจกรรมซ้อนกันเกิน 3 รายการ");
    }

    const created = [];
    const failed = [];
    for (const item of items) {
      const title = item.activityBody?.summary || "(ไม่มีชื่อ)";
      try {
        const saved = await createActivity(calendarAccessToken, item.activityBody);
        await persistCreatedActivityMetadata(saved, item.categoryId, item.tags);
        created.push({ id: saved?.id || "", title });
      } catch (error) {
        failed.push({ title, error: error.message || "ไม่สามารถสร้างกิจกรรมได้" });
        clearTokenIfExpired(error);
        if (isCalendarAuthExpiredError(error)) break;
      }
    }
    await loadActivities();
    refreshTagSearchIfActive();
    return { created, failed };
  };

  const handleSaveTimes = async (changes) => {
    if (!calendarAccessToken) return false;
    if (changes.length === 0) return true;
    const changesById = new Map(changes.map((change) => [change.id, change]));
    const candidateEntries = overlapEntriesFromActivities(activities).map((entry) => {
      const change = changesById.get(entry.id);
      return change ? { ...entry, start: change.start, end: change.end } : entry;
    });
    if (introducesOverlapLimitViolation(overlapEntriesFromActivities(activities), candidateEntries)) {
      setError("บันทึกไม่ได้: ช่วงเวลานี้มีกิจกรรมซ้อนกันเกิน 3 รายการ");
      return false;
    }
    const failures = [];
    let anySkippedLocked = false;
    let anyConflicts = false;
    let tokenExpired = false;
    for (const { id, start, end } of changes) {
      const normalizedId = normalizeActivityId(id);
      if (lockedActivities[normalizedId]) {
        anySkippedLocked = true;
        continue;
      }
      const conflict = await checkConflict(id);
      if (conflict) anyConflicts = true;
      try {
        const savedActivity = await updateActivity(calendarAccessToken, id, {
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() }
        });
        syncActivityNotification(savedActivity).catch((error) => setError(`อัปเดตเวลาแล้ว แต่ตั้งการแจ้งเตือนไม่สำเร็จ: ${error.message}`));
      } catch (error) {
        failures.push(`${id}: ${error.message}`);
        if (isCalendarAuthExpiredError(error)) {
          tokenExpired = true;
          break;
        }
      }
    }
    if (tokenExpired) {
      setCalendarAccessToken(null);
      setError("สิทธิ์เข้าถึง Google Calendar หมดอายุระหว่างบันทึก — กรุณายืนยันตัวตนอีกครั้งแล้วลองอีกครั้ง");
      return false;
    }
    if (failures.length > 0) {
      setError(`ปรับเวลาบางกิจกรรมไม่สำเร็จ — ${failures.join(", ")}`);
    } else if (anySkippedLocked && anyConflicts) {
      setError("บางกิจกรรมถูกล็อกไว้จึงข้ามไป และบางกิจกรรมถูกแก้ไขที่อื่น — บันทึกทับข้อมูลนั้นแล้ว");
    } else if (anySkippedLocked) {
      setError("บางกิจกรรมถูกล็อกไว้จึงไม่ถูกบันทึก");
    } else if (anyConflicts) {
      setError("บางกิจกรรมถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
    }
    await loadActivities();
    refreshTagSearchIfActive();
    return failures.length === 0 && !anySkippedLocked;
  };

  const handleFetchSeriesCount = async (recurringEventId) => {
    if (!calendarAccessToken || !recurringEventId) return null;
    try {
      const instances = await fetchRecurringInstances(calendarAccessToken, recurringEventId);
      return instances.length;
    } catch {
      return null;
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!calendarAccessToken) return;
    const deletedActivity = activities.find((activity) => activity.id === activityId);
    const isRecurringOccurrence = Boolean(
      deletedActivity?.recurringEventId && deletedActivity.id !== deletedActivity.recurringEventId
    );
    const normalizedId = normalizeActivityId(activityId);
    if (lockedActivities[normalizedId]) throw new Error("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนลบ");
    try {
      await deleteActivity(calendarAccessToken, activityId);
    } catch (error) {
      clearTokenIfExpired(error);
      throw error;
    }
    setActivities((previous) => previous.filter((activity) => activity.id !== activityId));
    deleteActivityNotification(activityId).catch(() => {});
    if (!isRecurringOccurrence) {
      setActivityCategoryMap((previous) => {
        const next = { ...previous };
        delete next[normalizedId];
        return next;
      });
      await assignActivityCategory(normalizedId, null).catch(() => {});
      setActivityTagMap((previous) => {
        const next = { ...previous };
        delete next[normalizedId];
        return next;
      });
      await setActivityTags(normalizedId, []).catch(() => {});
      setLockedActivities((previous) => {
        if (!previous[normalizedId]) return previous;
        const next = { ...previous };
        delete next[normalizedId];
        return next;
      });
      await setActivityLocked(normalizedId, false).catch(() => {});
    }
    await loadActivities();
    refreshTagSearchIfActive();
    return true;
  };

  const handleDeleteSeries = async (recurringEventId) => {
    if (!calendarAccessToken) return;
    const seriesActivityIds = activities
      .filter((activity) => activity.recurringEventId === recurringEventId || activity.id === recurringEventId)
      .map((activity) => activity.id);
    const normalizedSeriesIds = seriesActivityIds.map(normalizeActivityId);
    if (normalizedSeriesIds.some((id) => lockedActivities[id])) {
      throw new Error("บางกิจกรรมในชุดนี้ถูกล็อกไว้ — ปลดล็อกทั้งหมดก่อนลบทั้งชุด");
    }
    try {
      await deleteActivity(calendarAccessToken, recurringEventId);
    } catch (error) {
      clearTokenIfExpired(error);
      throw error;
    }
    setActivities((previous) => previous.filter((activity) => activity.recurringEventId !== recurringEventId && activity.id !== recurringEventId));
    await Promise.all(seriesActivityIds.map((id) => deleteActivityNotification(id).catch(() => {})));
    setActivityCategoryMap((previous) => {
      const next = { ...previous };
      for (const id of normalizedSeriesIds) delete next[id];
      return next;
    });
    await Promise.all([...new Set(normalizedSeriesIds)].map((id) => assignActivityCategory(id, null).catch(() => {})));
    setActivityTagMap((previous) => {
      const next = { ...previous };
      for (const id of normalizedSeriesIds) delete next[id];
      return next;
    });
    await Promise.all([...new Set(normalizedSeriesIds)].map((id) => setActivityTags(id, []).catch(() => {})));
    setLockedActivities((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const id of normalizedSeriesIds) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : previous;
    });
    await Promise.all([...new Set(normalizedSeriesIds)].map((id) => setActivityLocked(id, false).catch(() => {})));
    await loadActivities();
    refreshTagSearchIfActive();
  };

  const handleDuplicateActivity = async (activity, timeOverride = null) => {
    if (!calendarAccessToken) return;
    const body = buildActivityDuplicateBody({
      activity,
      summary: nextActivityCopySummary(activities, activity.summary),
      timeOverride
    });
    let created;
    try {
      created = await createActivity(calendarAccessToken, body);
    } catch (error) {
      clearTokenIfExpired(error);
      throw error;
    }
    const normalizedCreatedId = created?.id ? normalizeActivityId(created.id) : null;
    if (created?.id) {
      syncActivityNotification(created).catch((error) => setError(`ทำสำเนาสำเร็จ แต่ตั้งการแจ้งเตือนไม่สำเร็จ: ${error.message}`));
    }
    const existingCategoryId = activityCategoryMap[normalizeActivityId(activity.id)] || null;
    if (normalizedCreatedId && existingCategoryId) {
      setActivityCategoryMap((previous) => ({ ...previous, [normalizedCreatedId]: existingCategoryId }));
      try {
        await assignActivityCategory(normalizedCreatedId, existingCategoryId);
      } catch (error) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึกหมวดหมู่ของสำเนาไม่สำเร็จ: ${error.message}`);
      }
    }
    const existingTags = activityTagMap[normalizeActivityId(activity.id)] || [];
    if (normalizedCreatedId && existingTags.length > 0) {
      setActivityTagMap((previous) => ({ ...previous, [normalizedCreatedId]: existingTags }));
      try {
        await setActivityTags(normalizedCreatedId, existingTags);
      } catch (error) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึก tag ของสำเนาไม่สำเร็จ: ${error.message}`);
      }
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  const handleMoveActivityToDay = async (activityId, dateStr, savedTimeChanges = []) => {
    if (!calendarAccessToken) return false;
    const normalizedId = normalizeActivityId(activityId);
    if (lockedActivities[normalizedId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนย้ายวัน");
      return false;
    }
    const activity = activities.find((item) => item.id === activityId)
      || activities.find((item) => normalizeActivityId(item.id) === normalizedId);
    if (!activity) return false;
    const body = buildActivityMoveBody({ activity, dateStr, savedTimeChanges });
    const conflict = await checkConflict(activity.id);
    try {
      const savedActivity = await updateActivity(calendarAccessToken, activity.id, body);
      syncActivityNotification(savedActivity).catch((error) => setError(`ย้ายกิจกรรมสำเร็จ แต่ตั้งการแจ้งเตือนไม่สำเร็จ: ${error.message}`));
    } catch (error) {
      clearTokenIfExpired(error);
      throw error;
    }
    if (conflict) setError("กิจกรรมนี้ถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
    await loadActivities();
    refreshTagSearchIfActive();
    return true;
  };

  return {
    handleSaveActivity,
    handleSaveActivityPlan,
    handleSaveTimes,
    handleFetchSeriesCount,
    handleDeleteActivity,
    handleDeleteSeries,
    handleDuplicateActivity,
    handleMoveActivityToDay
  };
}

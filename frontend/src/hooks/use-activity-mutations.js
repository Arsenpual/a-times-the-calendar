import {
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  fetchRecurringInstances
} from "../google-calendar.js";
import {
  createCategory,
  deleteCategory,
  assignActivityCategory,
  setActivityTags,
  fetchActivityCategoryMap,
  fetchLockedActivities,
  setActivityLocked
} from "../api.js";
import { activityDate } from "../date-utils.js";
import { normalizeActivityId } from "../id-utils.js";

/**
 * Every handler that writes an activity or its metadata — the biggest,
 * most tightly-coupled slice of what used to live in app.jsx. These
 * handlers necessarily reach across what useAuth/useCalendarData/
 * useTagSearch own (calendarAccessToken, activities, the category/tag/
 * lock maps and their setters, loadActivities, refreshTagSearchIfActive)
 * because that's the actual shape of the work: every write needs the
 * token to call Google Calendar, needs to patch local state optimistically,
 * and needs to trigger a reload + tag-search refresh afterward. Splitting
 * these further by ID normalization concerns would just relocate the
 * coupling into extra parameters without reducing it.
 *
 * @param {object} deps
 * @param {string|null} deps.calendarAccessToken
 * @param {(token: string|null) => void} deps.setCalendarAccessToken
 * @param {Array} deps.activities
 * @param {Record<string, string>} deps.activityCategoryMap
 * @param {(fn: Function) => void} deps.setActivityCategoryMap
 * @param {Record<string, string[]>} deps.activityTagMap
 * @param {(fn: Function) => void} deps.setActivityTagMap
 * @param {Record<string, boolean>} deps.lockedActivities
 * @param {(fn: Function) => void} deps.setLockedActivities
 * @param {(fn: Function) => void} deps.setCategories
 * @param {() => Promise<void>} deps.loadActivities
 * @param {() => void} deps.refreshTagSearchIfActive
 * @param {(message: string|null) => void} deps.setError
 */
export function useActivityMutations({
  calendarAccessToken,
  setCalendarAccessToken,
  activities,
  activityCategoryMap,
  setActivityCategoryMap,
  activityTagMap,
  setActivityTagMap,
  lockedActivities,
  setLockedActivities,
  setCategories,
  loadActivities,
  refreshTagSearchIfActive,
  setError
}) {
  /**
   * ห้ามกิจกรรมเวลาทับซ้อนกันในโหมด calendar — logic เดียวกันกับที่ใช้ใน
   * ActivityModal.jsx's validate() (ที่นั่นเช็คตอนสร้าง/แก้ไขผ่านฟอร์ม
   * ปกติ) แต่จุดนี้ครอบคลุมสองทางเข้าที่ไม่ผ่านฟอร์มเลย: ลากปรับเวลาใน
   * TimelineEditor (handleSaveTimes) และย้ายกิจกรรมไปวันอื่น
   * (handleMoveActivityToDay) — ทั้งสองจุดคำนวณเวลาใหม่แล้วยิง
   * updateActivity ตรงๆ โดยไม่ผ่าน ActivityModal ดังนั้นต้องเช็คซ้ำที่นี่
   * อีกชั้น ไม่งั้นกฎ "ห้ามทับซ้อน" จะถูกข้ามได้ง่ายๆ แค่ลากบล็อกในไทม์ไลน์
   *
   * @param {string} excludeId normalized id ของกิจกรรมที่กำลังแก้ไขเอง — ไม่นับว่าทับกับตัวเอง
   * @param {Date} newStart
   * @param {Date} newEnd
   * @returns {object|null} กิจกรรมที่ทับซ้อนกัน (ตัวแรกที่เจอ) หรือ null ถ้าไม่มี
   */
  const findOverlappingActivity = (excludeId, newStart, newEnd) => {
    return activities.find((activity) => {
      if (normalizeActivityId(activity.id) === excludeId) return false;
      const otherStart = activityDate(activity.start);
      const otherEnd = activityDate(activity.end) || otherStart;
      if (!otherStart || !otherEnd) return false;
      return newStart < otherEnd && newEnd > otherStart;
    });
  };

  /**
   * Shared two-way sync conflict check: compares the activity's Google
   * Calendar "updated" timestamp against what we last loaded into
   * `activities` state. If it changed — meaning the activity was edited
   * elsewhere since we loaded this week — this does NOT block the save.
   * It always proceeds (overwrites), and just reports back whether a
   * conflict was detected so the caller can show a warning after the fact.
   * @returns {Promise<boolean>} true if a conflicting edit elsewhere was detected
   */
  const checkConflict = async (activityId) => {
    if (!calendarAccessToken) return false;
    const match = activities.find(
      (activity) => normalizeActivityId(activity.id) === normalizeActivityId(activityId)
    );
    if (!match?.updated) return false; // nothing to compare against
    try {
      const latest = await getActivity(calendarAccessToken, match.id);
      return !!(latest?.updated && latest.updated !== match.updated);
    } catch (e) {
      // If we can't check (e.g. the activity was deleted elsewhere), let the
      // actual update call surface that error instead of blocking here.
      return false;
    }
  };

  /** Toggles an activity's lock state via the backend, optimistically updating local state. */
  const handleToggleLock = async (activityId, locked) => {
    setLockedActivities((prev) => {
      const next = { ...prev };
      if (locked) next[activityId] = true;
      else delete next[activityId];
      return next;
    });
    try {
      await setActivityLocked(activityId, locked);
    } catch (e) {
      setError(`${locked ? "ล็อก" : "ปลดล็อก"}กิจกรรมไม่สำเร็จ: ${e.message}`);
      fetchLockedActivities().then(setLockedActivities).catch(() => {});
    }
  };

  const handleAssignCategory = async (activityId, categoryId) => {
    if (lockedActivities[activityId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเปลี่ยนหมวดหมู่");
      return;
    }
    const conflict = await checkConflict(activityId);
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      if (categoryId) {
        next[activityId] = categoryId;
      } else {
        delete next[activityId];
      }
      return next;
    });
    try {
      await assignActivityCategory(activityId, categoryId);
      if (conflict) {
        setError("กิจกรรมนี้ถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
      }
    } catch (e) {
      setError(`บันทึกหมวดหมู่ไม่สำเร็จ: ${e.message}`);
      fetchActivityCategoryMap().then(setActivityCategoryMap).catch(() => {});
    }
  };

  const handleCreateCategory = async (name, color) => {
    const newCategory = await createCategory(name, color);
    setCategories((prev) => [...prev, newCategory]);
    return newCategory;
  };

  /**
   * ลบหมวดหมู่ชีวิต — backend ลบ mapping ของกิจกรรมที่เคยผูกกับหมวดหมู่นี้
   * ให้ด้วย จึงต้องเคลียร์ local state ทั้งสองก้อนให้ตรงกัน
   */
  const handleDeleteCategory = async (categoryId) => {
    await deleteCategory(categoryId);
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      for (const activityId of Object.keys(next)) {
        if (next[activityId] === categoryId) delete next[activityId];
      }
      return next;
    });
  };

  /**
   * Saves an activity to Google Calendar (create or update), then assigns
   * its life-area category + tags via our own backend, then reloads the
   * week. Two-way sync conflict handling: if editing, compares the
   * activity's "updated" timestamp against what the form was opened with
   * — still saves (overwrites) regardless, per the "overwrite but warn"
   * policy.
   */
  const handleSaveActivity = async ({ activityBody, categoryId, tags, existingId, knownUpdated }) => {
    if (!calendarAccessToken) return;

    let conflictDetected = false;
    let savedActivity;
    if (existingId) {
      if (knownUpdated) {
        try {
          const latest = await getActivity(calendarAccessToken, existingId);
          if (latest?.updated && latest.updated !== knownUpdated) {
            conflictDetected = true;
          }
        } catch (e) {
          // Can't verify — proceed with the save and let any real error
          // surface from the update call itself.
        }
      }
      savedActivity = await updateActivity(calendarAccessToken, existingId, activityBody);
    } else {
      savedActivity = await createActivity(calendarAccessToken, activityBody);
    }

    if (savedActivity?.id) {
      const normalizedId = normalizeActivityId(savedActivity.id);
      setActivityCategoryMap((prev) => {
        const next = { ...prev };
        if (categoryId) next[normalizedId] = categoryId;
        else delete next[normalizedId];
        return next;
      });
      try {
        await assignActivityCategory(normalizedId, categoryId);
      } catch (e) {
        setError(`บันทึกหมวดหมู่ไม่สำเร็จ: ${e.message}`);
      }

      const cleanTags = Array.isArray(tags) ? tags : [];
      setActivityTagMap((prev) => {
        const next = { ...prev };
        if (cleanTags.length > 0) next[normalizedId] = cleanTags;
        else delete next[normalizedId];
        return next;
      });
      try {
        await setActivityTags(normalizedId, cleanTags);
      } catch (e) {
        setError(`บันทึก tag ไม่สำเร็จ: ${e.message}`);
      }
    }

    if (conflictDetected) {
      setError(
        `กิจกรรม "${activityBody.summary}" ถูกแก้ไขที่อื่นหลังจากเปิดฟอร์มนี้ — บันทึกทับข้อมูลล่าสุดแล้ว`
      );
    }

    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Batched save for ActivityMode's inline timeline-editor: applies every
   * dragged start/end change to Google Calendar at once, only when the
   * person presses "บันทึก". Locked activities are skipped outright.
   */
  const handleSaveTimes = async (changes) => {
    if (!calendarAccessToken || changes.length === 0) return;
    const failures = [];
    let anySkippedLocked = false;
    let anySkippedOverlap = false;
    let anyConflicts = false;
    let tokenExpired = false;
    for (const { id, start, end } of changes) {
      const normalizedId = normalizeActivityId(id);
      if (lockedActivities[normalizedId]) {
        anySkippedLocked = true;
        continue;
      }
      // เช็คทับซ้อนก่อนบันทึกเวลาใหม่ — เทียบกับ `activities` ที่โหลดไว้
      // (รวมกิจกรรมอื่นที่ยังไม่ถูกลากในรอบนี้ด้วย) ไม่รวมเวลาที่กำลังลาก
      // ของกิจกรรมอื่นใน `changes` ชุดเดียวกันที่ยังไม่ถูก save จริง — เคส
      // ลากสองกิจกรรมพร้อมกันให้มาชนกันในรอบเดียวยังหลุดผ่านได้ (เกิดยาก
      // ในทางปฏิบัติเพราะ UI ลากได้ทีละกิจกรรม) แต่ยอมรับความเสี่ยงนี้ไว้
      // ก่อนแทนที่จะเพิ่มความซับซ้อนของการจำลอง state ระหว่าง batch
      if (findOverlappingActivity(normalizedId, start, end)) {
        anySkippedOverlap = true;
        continue;
      }
      const conflict = await checkConflict(id);
      if (conflict) anyConflicts = true;
      try {
        await updateActivity(calendarAccessToken, id, {
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() }
        });
      } catch (e) {
        failures.push(`${id}: ${e.message}`);
        if (e.message.includes("หมดอายุ")) {
          tokenExpired = true;
          break;
        }
      }
    }
    if (tokenExpired) {
      setCalendarAccessToken(null);
      setError("สิทธิ์เข้าถึง Google Calendar หมดอายุระหว่างบันทึก — กรุณายืนยันตัวตนอีกครั้งแล้วลองอีกครั้ง");
      return;
    }
    if (failures.length > 0) {
      setError(`ปรับเวลาบางกิจกรรมไม่สำเร็จ — ${failures.join(", ")}`);
    } else if (anySkippedOverlap) {
      setError(
        "บางกิจกรรมเวลาทับซ้อนกับกิจกรรมอื่นจึงไม่ถูกบันทึก — ปรับเวลาไม่ให้ชนกัน หรือใช้โหมด reminder สำหรับกิจกรรมย่อย"
      );
    } else if (anySkippedLocked && anyConflicts) {
      setError("บางกิจกรรมถูกล็อกไว้จึงข้ามไป และบางกิจกรรมถูกแก้ไขที่อื่น — บันทึกทับข้อมูลนั้นแล้ว");
    } else if (anySkippedLocked) {
      setError("บางกิจกรรมถูกล็อกไว้จึงไม่ถูกบันทึก");
    } else if (anyConflicts) {
      setError("บางกิจกรรมถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /** นับจำนวน instances ของ recurring series สำหรับ ActivityPopup */
  const handleFetchSeriesCount = async (recurringEventId) => {
    if (!calendarAccessToken || !recurringEventId) return null;
    try {
      const instances = await fetchRecurringInstances(calendarAccessToken, recurringEventId);
      return instances.length;
    } catch (e) {
      return null;
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!calendarAccessToken) return;
    const normalizedId = normalizeActivityId(activityId);
    if (lockedActivities[normalizedId]) {
      throw new Error("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนลบ");
    }
    await deleteActivity(calendarAccessToken, activityId);
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
    try {
      await assignActivityCategory(normalizedId, null);
    } catch (e) {
      // Non-fatal — the activity itself is already gone from Google Calendar.
    }
    setActivityTagMap((prev) => {
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
    try {
      await setActivityTags(normalizedId, []);
    } catch (e) {
      // Non-fatal — the activity itself is already gone from Google Calendar.
    }
    // Clean up any leftover lock doc too — see handleDeleteSeries below for
    // the same reasoning in the series case.
    setLockedActivities((prev) => {
      if (!prev[normalizedId]) return prev;
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
    try {
      await setActivityLocked(normalizedId, false);
    } catch (e) {
      // Non-fatal — the activity itself is already gone from Google Calendar.
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Deletes every occurrence of a recurring event in one call, by
   * targeting the series' recurringEventId. Refuses if any currently
   * loaded occurrence of the series is locked.
   */
  const handleDeleteSeries = async (recurringEventId) => {
    if (!calendarAccessToken) return;
    const seriesActivityIds = activities
      .filter((a) => a.recurringEventId === recurringEventId || a.id === recurringEventId)
      .map((a) => a.id);
    const normalizedSeriesIds = seriesActivityIds.map(normalizeActivityId);
    const lockedInSeries = normalizedSeriesIds.filter((id) => lockedActivities[id]);
    if (lockedInSeries.length > 0) {
      throw new Error("บางกิจกรรมในชุดนี้ถูกล็อกไว้ — ปลดล็อกทั้งหมดก่อนลบทั้งชุด");
    }
    await deleteActivity(calendarAccessToken, recurringEventId);
    setActivityCategoryMap((prev) => {
      const next = { ...prev };
      for (const id of normalizedSeriesIds) delete next[id];
      return next;
    });
    await Promise.all(
      [...new Set(normalizedSeriesIds)].map((id) =>
        assignActivityCategory(id, null).catch(() => {
          // Non-fatal — the activities themselves are already gone from Google Calendar.
        })
      )
    );
    setActivityTagMap((prev) => {
      const next = { ...prev };
      for (const id of normalizedSeriesIds) delete next[id];
      return next;
    });
    await Promise.all(
      [...new Set(normalizedSeriesIds)].map((id) =>
        setActivityTags(id, []).catch(() => {
          // Non-fatal — the activities themselves are already gone from Google Calendar.
        })
      )
    );
    setLockedActivities((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of normalizedSeriesIds) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    await Promise.all(
      [...new Set(normalizedSeriesIds)].map((id) =>
        setActivityLocked(id, false).catch(() => {
          // Non-fatal — the activities themselves are already gone from Google Calendar.
        })
      )
    );
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Builds the summary text for a duplicate: appends "(copy)" the first
   * time, then "(copy 2)", etc. Counts existing copies only from
   * `activities` (the currently loaded week) — best-effort, not
   * guaranteed-unique across the whole calendar.
   */
  const nextCopySummary = (originalSummary) => {
    const base = (originalSummary || "(ไม่มีชื่อ)").replace(/\s*\(copy(?:\s+\d+)?\)\s*$/, "");
    const copyPattern = new RegExp(
      `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(copy(?:\\s+(\\d+))?\\)$`
    );
    let highestExisting = 0;
    for (const existing of activities) {
      const match = (existing.summary || "").match(copyPattern);
      if (!match) continue;
      const n = match[1] ? parseInt(match[1], 10) : 1;
      if (n > highestExisting) highestExisting = n;
    }
    const nextN = highestExisting + 1;
    return nextN === 1 ? `${base} (copy)` : `${base} (copy ${nextN})`;
  };

  /**
   * Clones an activity onto the same day: same title (with a "(copy)"
   * suffix), time range, and colorId, plus the same life-area category
   * assignment. Locked state is deliberately NOT copied.
   */
  const handleDuplicateActivity = async (activity) => {
    if (!calendarAccessToken) return;
    const body = {
      summary: nextCopySummary(activity.summary),
      start: activity.start,
      end: activity.end
    };
    if (activity.colorId) body.colorId = activity.colorId;

    const created = await createActivity(calendarAccessToken, body);
    const normalizedCreatedId = created?.id ? normalizeActivityId(created.id) : null;

    const existingCategoryId = activityCategoryMap[normalizeActivityId(activity.id)] || null;
    if (normalizedCreatedId && existingCategoryId) {
      setActivityCategoryMap((prev) => ({ ...prev, [normalizedCreatedId]: existingCategoryId }));
      try {
        await assignActivityCategory(normalizedCreatedId, existingCategoryId);
      } catch (e) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึกหมวดหมู่ของสำเนาไม่สำเร็จ: ${e.message}`);
      }
    }

    const existingTags = activityTagMap[normalizeActivityId(activity.id)] || [];
    if (normalizedCreatedId && existingTags.length > 0) {
      setActivityTagMap((prev) => ({ ...prev, [normalizedCreatedId]: existingTags }));
      try {
        await setActivityTags(normalizedCreatedId, existingTags);
      } catch (e) {
        setError(`ทำสำเนากิจกรรมสำเร็จ แต่บันทึก tag ของสำเนาไม่สำเร็จ: ${e.message}`);
      }
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Moves an activity to a different calendar date, keeping its
   * time-of-day and duration unchanged.
   * @param {string} activityId
   * @param {string} dateStr "YYYY-MM-DD"
   */
  const handleMoveActivityToDay = async (activityId, dateStr) => {
    if (!calendarAccessToken) return;
    const normalizedId = normalizeActivityId(activityId);
    if (lockedActivities[normalizedId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนย้ายวัน");
      return;
    }
    const activity = activities.find((a) => normalizeActivityId(a.id) === normalizedId);
    if (!activity) return;
    const rawId = activity.id;

    const [y, m, d] = dateStr.split("-").map(Number);

    const oldStart = activityDate(activity.start);
    const oldEnd = activityDate(activity.end);
    const durationMs = oldEnd - oldStart;
    const newStart = new Date(y, m - 1, d, oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
    const newEnd = new Date(newStart.getTime() + durationMs);

    const overlapping = findOverlappingActivity(normalizedId, newStart, newEnd);
    if (overlapping) {
      setError(
        `ย้ายไม่สำเร็จ — เวลาจะทับซ้อนกับกิจกรรม "${overlapping.summary || "(ไม่มีชื่อ)"}" ในวันนั้น`
      );
      return;
    }

    const body = { start: { dateTime: newStart.toISOString() }, end: { dateTime: newEnd.toISOString() } };

    const conflict = await checkConflict(rawId);
    await updateActivity(calendarAccessToken, rawId, body);
    if (conflict) {
      setError("กิจกรรมนี้ถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
    }
    await loadActivities();
    refreshTagSearchIfActive();
  };

  /**
   * Sets or clears a custom color override on an activity, using Google
   * Calendar's own native `colorId` field.
   * @param {string} activityId
   * @param {string|null} colorId null resets to default
   */
  const handleSetActivityColor = async (activityId, colorId) => {
    if (!calendarAccessToken) return;
    const normalizedId = normalizeActivityId(activityId);
    if (lockedActivities[normalizedId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเปลี่ยนสี");
      return;
    }
    const activity = activities.find((a) => normalizeActivityId(a.id) === normalizedId);
    if (!activity) return;
    await updateActivity(calendarAccessToken, activity.id, { colorId: colorId || "" });
    await loadActivities();
    refreshTagSearchIfActive();
  };

  return {
    checkConflict,
    handleToggleLock,
    handleAssignCategory,
    handleCreateCategory,
    handleDeleteCategory,
    handleSaveActivity,
    handleSaveTimes,
    handleFetchSeriesCount,
    handleDeleteActivity,
    handleDeleteSeries,
    handleDuplicateActivity,
    handleMoveActivityToDay,
    handleSetActivityColor
  };
}

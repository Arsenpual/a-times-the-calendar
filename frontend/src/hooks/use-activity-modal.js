import { useCallback, useState } from "react";
import { getActivity } from "../google-calendar.js";
import { normalizeActivityId } from "../id-utils.js";

/**
 * Owns ActivityModal's open/closed state and the three ways it gets
 * opened: creating a new activity, editing an existing one, and editing
 * an entire recurring series (which needs an extra network round-trip to
 * fetch the series' master event first).
 *
 * Takes calendarAccessToken and lockedActivities as inputs (from useAuth
 * and useCalendarData respectively) since opening for edit/series needs
 * to check the lock state and, for series editing, make a Calendar API
 * call. setError is shared with the rest of the app's single error
 * banner, same as every other hook here.
 */
export function useActivityModal({ calendarAccessToken, lockedActivities, setError }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState(null);
  const [modalDefaultEnd, setModalDefaultEnd] = useState(null);
  const [modalDefaultTitle, setModalDefaultTitle] = useState("");
  const [modalInitialWarning, setModalInitialWarning] = useState("");
  const [modalMissingFields, setModalMissingFields] = useState([]);
  const [modalEditingActivity, setModalEditingActivity] = useState(null);
  const [modalEditingAsSeries, setModalEditingAsSeries] = useState(false);

  /**
   * Opens the "add activity" modal prefilled with the actual current
   * date/time — the given `day` supplies the calendar date, but the clock
   * time always comes from `new Date()` at the moment the button is
   * pressed, so a new activity defaults to "now" instead of midnight.
   */
  const openAddActivity = useCallback((day, { preserveTime = false, end = null, title = "", warning = "", missingFields = [] } = {}) => {
    const now = new Date();
    const base = day || now;
    const combined = preserveTime
      ? new Date(base)
      : new Date(base.getFullYear(), base.getMonth(), base.getDate(), now.getHours(), now.getMinutes());
    setModalDefaultDate(combined);
    setModalDefaultEnd(end ? new Date(end) : null);
    setModalDefaultTitle(title);
    setModalInitialWarning(warning);
    setModalMissingFields(missingFields);
    setModalEditingActivity(null);
    setModalEditingAsSeries(false);
    setModalOpen(true);
  }, []);

  const openEditActivity = useCallback(
    (activity) => {
      if (lockedActivities[normalizeActivityId(activity.id)]) {
        setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไขหรือลบ");
        return;
      }
      setModalDefaultDate(null);
      setModalDefaultEnd(null);
      setModalDefaultTitle("");
      setModalInitialWarning("");
      setModalMissingFields([]);
      setModalEditingActivity(activity);
      setModalEditingAsSeries(false);
      setModalOpen(true);
    },
    [lockedActivities, setError]
  );

  const openEditActivityById = useCallback(async (activityId) => {
    if (!calendarAccessToken || !activityId) return;
    try {
      const activity = await getActivity(calendarAccessToken, activityId);
      if (lockedActivities[normalizeActivityId(activity.id)]) {
        setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไขหรือลบ");
        return;
      }
      setModalDefaultDate(null);
      setModalDefaultEnd(null);
      setModalDefaultTitle("");
      setModalInitialWarning("");
      setModalMissingFields([]);
      setModalEditingActivity(activity);
      setModalEditingAsSeries(false);
      setModalOpen(true);
    } catch (error) {
      setError("ไม่สามารถโหลดกิจกรรมสำหรับแก้ไขได้: " + error.message);
    }
  }, [calendarAccessToken, lockedActivities, setError]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalEditingActivity(null);
    setModalDefaultDate(null);
    setModalDefaultEnd(null);
    setModalDefaultTitle("");
    setModalInitialWarning("");
    setModalMissingFields([]);
    setModalEditingAsSeries(false);
  }, []);

  /**
   * เปิด ActivityModal แก้ไขทั้งชุด recurring โดยโหลด master event
   * (recurringEventId) แล้วส่งเป็น initialActivity — Google Calendar
   * จะ apply การแก้ไขไปยังทุก occurrence ที่ยังไม่ได้ถูก override แยก
   */
  const handleEditSeries = useCallback(
    async (activity) => {
      if (!calendarAccessToken) return;
      if (lockedActivities[normalizeActivityId(activity.id)]) {
        setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนแก้ไข");
        return;
      }
      try {
        const masterEvent = await getActivity(calendarAccessToken, activity.recurringEventId);
        setModalDefaultDate(null);
        setModalDefaultEnd(null);
        setModalDefaultTitle("");
        setModalInitialWarning("");
        setModalMissingFields([]);
        setModalEditingActivity(masterEvent);
        setModalEditingAsSeries(true);
        setModalOpen(true);
      } catch (e) {
        setError("โหลดข้อมูลชุดกิจกรรมไม่สำเร็จ: " + e.message);
      }
    },
    [calendarAccessToken, lockedActivities, setError]
  );

  return {
    modalOpen,
    modalDefaultDate,
    modalDefaultEnd,
    modalDefaultTitle,
    modalInitialWarning,
    modalMissingFields,
    modalEditingActivity,
    modalEditingAsSeries,
    openAddActivity,
    openEditActivity,
    openEditActivityById,
    closeModal,
    handleEditSeries
  };
}

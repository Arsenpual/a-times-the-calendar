import { deleteActivityArchiveItem, saveActivityArchiveItem } from "../api/archive.js";
import { normalizeActivityId } from "../../../shared/lib/id-utils.js";

/** Calendar-facing archive commands with safe write/delete ordering. */
export function useActivityArchiveCalendarActions({ archiveState, activityCategoryMap, activityTagMap, onDeleteActivity, onRestoreArchivedActivity, onFocusArchiveTimeline, onOpenArchiveDraft, showInteractionWarning }) {
  const { setActivityArchive, setRestoringCalendarIds, archiveSnapshotRef, pendingArchiveWritesRef, pendingArchiveDeletesRef, archiveSessionRef } = archiveState;
  const archiveActivity = async (segment) => {
    const session = archiveSessionRef.current;
    if (!session?.active) return;
    if (segment.isLocked) return showInteractionWarning("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเก็บเข้าคลัง");
    const archived = { archiveId: `${segment.calendarId}:${segment.start.getTime()}:${Date.now()}`, calendarId: segment.calendarId, title: segment.title, start: segment.start.toISOString(), end: segment.end.toISOString(), categoryId: activityCategoryMap[segment.id] || activityCategoryMap[normalizeActivityId(segment.calendarId)] || null, tags: activityTagMap[segment.id] || activityTagMap[normalizeActivityId(segment.calendarId)] || [], color: segment.color.border, archivedAt: new Date().toISOString() };
    try {
      pendingArchiveWritesRef.current.add(archived.archiveId);
      await saveActivityArchiveItem(archived);
      if (!session.active) return;
      if (!onDeleteActivity || await onDeleteActivity(segment.calendarId) === false) throw new Error("ลบกิจกรรมจากปฏิทินไม่สำเร็จ");
      if (!session.active) return;
      archiveSnapshotRef.current.set(archived.archiveId, JSON.stringify(archived));
      setActivityArchive((current) => [archived, ...current.filter((item) => item.archiveId !== archived.archiveId)]);
    } catch (error) {
      if (!session.active) return;
      await deleteActivityArchiveItem(archived.archiveId).catch(() => {});
      pendingArchiveWritesRef.current.delete(archived.archiveId);
      showInteractionWarning(error?.message || "เก็บกิจกรรมเข้าคลังไม่สำเร็จ");
    }
  };
  const restoreArchivedActivity = async (item) => {
    const session = archiveSessionRef.current;
    if (!session?.active) return;
    if (!item.start || !item.end) {
      const missing = [!item.start && "วันที่/เวลาเริ่ม", !item.end && "วันที่/เวลาสิ้นสุด"].filter(Boolean).join(" และ ");
      onOpenArchiveDraft?.(item, `กิจกรรมนี้ยังขาด ${missing} — กรุณากำหนดให้ครบก่อนบันทึก`); return;
    }
    const start = new Date(item.start); const end = new Date(item.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return showInteractionWarning("ส่งไป Timeline ไม่ได้: เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม");
    try {
      const saved = await onRestoreArchivedActivity?.({ calendarId: null, title: item.title, start, end, categoryId: item.categoryId || null, tags: item.tags || [] });
      if (!session.active) return;
      if (!saved) throw new Error("ส่งกิจกรรมไป Timeline ไม่สำเร็จ");
      const restoredId = saved?.id || item.calendarId;
      if (restoredId) setRestoringCalendarIds((current) => new Set(current).add(restoredId));
      pendingArchiveDeletesRef.current.add(item.archiveId);
      pendingArchiveWritesRef.current.delete(item.archiveId);
      setActivityArchive((current) => current.filter((archived) => archived.archiveId !== item.archiveId));
      onFocusArchiveTimeline?.(start);
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(".week-spine-timeline-surface")?.scrollIntoView({ behavior: "smooth", block: "center" })));
    } catch (error) { showInteractionWarning(error?.message || "ส่งกิจกรรมไป Timeline ไม่สำเร็จ"); }
  };
  return { archiveActivity, restoreArchivedActivity };
}

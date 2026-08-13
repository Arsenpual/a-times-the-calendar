import { useEffect, useState } from "react";
import { fetchActivities } from "../google-calendar.js";

/**
 * Owns tag-search state: the entered search terms, the ±3-month wide
 * fetch of matching candidate activities (separate from the current
 * week's `activities` in useCalendarData), and a refresh counter that
 * lets write handlers in useActivityMutations force a refetch after an
 * edit/delete/move without needing to duplicate this hook's fetch logic
 * themselves.
 *
 * Takes calendarAccessToken as an input (from useAuth) rather than owning
 * it, since the fetch is simply gated on it being present.
 */
export function useTagSearch({ calendarAccessToken }) {
  // ค้นหากิจกรรมด้วย tag (หลายอันพร้อมกัน แบบ OR) — เก็บเป็น array ของ
  // คำค้นหา ไม่ใช่ string เดียว เพื่อรองรับหลาย tag พร้อมกัน
  const [tagSearchTerms, setTagSearchTerms] = useState([]);
  const [tagSearchDraft, setTagSearchDraft] = useState("");
  const [tagSearchResults, setTagSearchResults] = useState([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [tagSearchError, setTagSearchError] = useState(null);

  // Bumped by every handler that writes an activity (save/delete/move/
  // duplicate/set-color/save-times/delete-series) so the effect below
  // knows to refetch even though tagSearchTerms itself didn't change —
  // without this, editing/deleting/moving an activity from inside
  // TagSearchResults left tagSearchResults showing stale data until the
  // person cleared and retyped their search.
  const [tagSearchRefreshKey, setTagSearchRefreshKey] = useState(0);
  const refreshTagSearchIfActive = () => {
    if (tagSearchTerms.length > 0) setTagSearchRefreshKey((k) => k + 1);
  };

  // ค้นหาด้วย tag ต้องเห็นกิจกรรมข้ามสัปดาห์/เดือนได้ — ดึงช่วงกว้าง ±3
  // เดือนจากวันนี้แยกต่างหากจาก `activities` ปกติ เกิดขึ้นแค่ตอนมี
  // tagSearchTerms อย่างน้อย 1 คำ
  useEffect(() => {
    if (tagSearchTerms.length === 0 || !calendarAccessToken) return;

    let cancelled = false;
    setTagSearchLoading(true);
    setTagSearchError(null);
    const today = new Date();
    const rangeStart = new Date(today);
    rangeStart.setMonth(rangeStart.getMonth() - 3);
    const rangeEnd = new Date(today);
    rangeEnd.setMonth(rangeEnd.getMonth() + 3);

    fetchActivities(calendarAccessToken, rangeStart, rangeEnd)
      .then((items) => {
        if (!cancelled) setTagSearchResults(items);
      })
      .catch((e) => {
        if (!cancelled) setTagSearchError(e.message);
      })
      .finally(() => {
        if (!cancelled) setTagSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // tagSearchRefreshKey deliberately triggers a refetch on every bump
    // even though it carries no data of its own.
  }, [tagSearchTerms, calendarAccessToken, tagSearchRefreshKey]);

  // เคลียร์ผลค้นหาทิ้งเมื่อไม่มีคำค้นหาเหลืออยู่แล้ว
  useEffect(() => {
    if (tagSearchTerms.length === 0) {
      setTagSearchResults([]);
      setTagSearchError(null);
    }
  }, [tagSearchTerms]);

  const isSearchingTags = tagSearchTerms.length > 0;

  return {
    tagSearchTerms,
    setTagSearchTerms,
    tagSearchDraft,
    setTagSearchDraft,
    tagSearchResults,
    tagSearchLoading,
    tagSearchError,
    refreshTagSearchIfActive,
    isSearchingTags
  };
}

/** Local edit commands for archive rows. Remote persistence is owned by sync. */
export function useActivityArchiveEditor({ archiveState }) {
  const {
    setActivityArchive,
    pendingArchiveWritesRef,
    pendingArchiveDeletesRef,
    setArchiveTitleToFocus
  } = archiveState;

  const addArchiveDraft = () => {
    const archiveId = `draft:${Date.now()}`;
    pendingArchiveWritesRef.current.add(archiveId);
    setActivityArchive((current) => [{
      archiveId, calendarId: null, title: "กิจกรรมใหม่", start: null, end: null,
      categoryId: null, color: "#5f6368", isDraft: true, archivedAt: new Date().toISOString()
    }, ...current]);
    setArchiveTitleToFocus(archiveId);
  };

  const updateArchivedActivity = (archiveId, field, value) => {
    pendingArchiveWritesRef.current.add(archiveId);
    if (field === "title" || field === "categoryId" || field === "tags") {
      setActivityArchive((current) => current.map((item) => item.archiveId === archiveId ? { ...item, [field]: value } : item));
      return;
    }
    if (!value) {
      setActivityArchive((current) => current.map((item) => item.archiveId === archiveId ? { ...item, [field]: null } : item));
      return;
    }
    const nextDate = new Date(value);
    if (Number.isNaN(nextDate.getTime())) return;
    setActivityArchive((current) => current.map((item) => {
      if (item.archiveId !== archiveId) return item;
      const updated = { ...item, [field]: nextDate.toISOString() };
      if (field === "start" && !item.end) updated.end = new Date(nextDate.getTime() + 3600000).toISOString();
      return updated;
    }));
  };

  const updateArchiveCategory = (item, categoryId) => updateArchivedActivity(item.archiveId, "categoryId", categoryId || null);
  const updateArchivedDate = (item, value) => {
    if (!value) return;
    const oldStart = new Date(item.start); const oldEnd = new Date(item.end);
    const [year, month, day] = value.split("-").map(Number);
    const nextStart = new Date(year, month - 1, day, oldStart.getHours(), oldStart.getMinutes());
    const nextEnd = new Date(nextStart.getTime() + (oldEnd - oldStart));
    if (!Number.isFinite(+nextStart) || !Number.isFinite(+nextEnd)) return;
    pendingArchiveWritesRef.current.add(item.archiveId);
    setActivityArchive((current) => current.map((archived) => archived.archiveId === item.archiveId ? { ...archived, start: nextStart.toISOString(), end: nextEnd.toISOString() } : archived));
  };
  const updateArchivedDuration = (item, rawValue, unit) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const start = new Date(item.start);
    const end = new Date(start.getTime() + value * (unit === "day" ? 86400000 : 3600000));
    if (!item.start || !Number.isFinite(+end)) return;
    pendingArchiveWritesRef.current.add(item.archiveId);
    setActivityArchive((current) => current.map((archived) => archived.archiveId === item.archiveId ? { ...archived, end: end.toISOString(), durationUnit: unit } : archived));
  };
  const deleteArchivedActivity = (archiveId) => {
    pendingArchiveWritesRef.current.delete(archiveId);
    pendingArchiveDeletesRef.current.add(archiveId);
    setActivityArchive((current) => current.filter((item) => item.archiveId !== archiveId));
  };

  return { addArchiveDraft, updateArchivedActivity, updateArchiveCategory, updateArchivedDate, updateArchivedDuration, deleteArchivedActivity };
}

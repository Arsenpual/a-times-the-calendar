import { useActivityArchiveState } from "./use-activity-archive-state.js";
import { useActivityArchiveSync } from "./use-activity-archive-sync.js";
import { useActivityArchiveEditor } from "./use-activity-archive-editor.js";
import { useActivityArchiveCalendarActions } from "./use-activity-archive-calendar-actions.js";

/** Composes persistence and commands; private setters stay within the archive. */
export function useActivityArchive(options) {
  const state = useActivityArchiveState();
  useActivityArchiveSync({ archiveState: state, archiveStorageKey: `times-activity-archive:${options.userId || "guest"}`, userId: options.userId });
  const editor = useActivityArchiveEditor({ archiveState: state });
  const calendar = useActivityArchiveCalendarActions({ ...options, archiveState: state });
  return {
    activityArchive: state.activityArchive,
    restoringCalendarIds: state.restoringCalendarIds,
    archiveTagDrafts: state.archiveTagDrafts,
    setArchiveTagDrafts: state.setArchiveTagDrafts,
    archiveTitleToFocus: state.archiveTitleToFocus,
    setArchiveTitleToFocus: state.setArchiveTitleToFocus,
    ...editor, ...calendar
  };
}

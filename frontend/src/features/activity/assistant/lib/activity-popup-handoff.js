// This is the narrow boundary between an assistant draft and ActivityPopup.
// It deliberately has no save operation: Calendar writes remain owned by the
// modal's explicit user-confirmed Save action.
export function createActivityPopupHandoff(result) {
  const draft = result?.ready ? result.draft : null;
  if (!draft || typeof draft.title !== "string" || !draft.title.trim() || typeof draft.startLocal !== "string" || !draft.startLocal.trim() || typeof draft.endLocal !== "string" || !draft.endLocal.trim()) return null;
  return { values: { formDraft: draft }, changedField: "activityDraft" };
}

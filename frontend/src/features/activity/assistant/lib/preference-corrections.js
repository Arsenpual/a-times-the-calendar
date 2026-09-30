// Only called after ActivityPopup's save succeeds. Keep Calendar writes out
// of preference learning; observations contain no title or conversation text.
export function collectPreferenceCorrections(payload) {
  const proposal = payload.assistantProposal;
  const body = payload.activityBody;
  if (
    !proposal?.title ||
    !proposal.startLocal ||
    !proposal.endLocal ||
    !body?.start?.dateTime ||
    !body?.end?.dateTime
  )
    return [];
  const isHomework = /ทำการบ้าน|\bhomework\b/i.test(proposal.title);
  const isExercise = /ออกกำลังกาย|\bexercise\b|\bworkout\b/i.test(
    proposal.title,
  );
  if (!isHomework && !isExercise) return [];
  const start = new Date(body.start.dateTime);
  const actualStart = Number.isNaN(start.getTime())
    ? ""
    : `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  const proposedDuration =
    (new Date(proposal.endLocal) - new Date(proposal.startLocal)) / 60000;
  const actualDuration = (new Date(body.end.dateTime) - start) / 60000;
  const corrections = [];
  if (
    isHomework &&
    actualStart &&
    actualStart !== proposal.startLocal.slice(11, 16)
  ) {
    corrections.push({ key: "homeworkDefaultStart", value: actualStart });
  }
  if (
    Number.isInteger(actualDuration) &&
    actualDuration >= 15 &&
    actualDuration <= 720 &&
    actualDuration !== proposedDuration
  ) {
    corrections.push({
      key: isHomework
        ? "homeworkDefaultDurationMinutes"
        : "exerciseDefaultDurationMinutes",
      value: actualDuration,
    });
  }
  return corrections;
}

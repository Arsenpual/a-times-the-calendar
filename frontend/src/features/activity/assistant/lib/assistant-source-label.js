/** Display the work that actually produced a reply, not the selected button color. */
export function assistantSourceLabel(result) {
  if (result?.source === "calendar") return "AI · ปฏิทิน";
  if (result?.source === "scheduling") return "ปฏิทิน · ช่วงว่าง";
  if (result?.source === "planning") return "วางแผนจากตาราง";
  if (result?.source === "deterministic" && result.calendarRange) return "ปฏิทิน";
  if (result?.source === "deterministic") return "ร่างจากข้อความ";
  if (result?.source === "knowledge") return "ข้อมูล T.i.M.E.S.";
  return "AI";
}

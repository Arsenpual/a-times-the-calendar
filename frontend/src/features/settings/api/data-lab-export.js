import { apiRequest, handleResponse } from "../../../shared/api/client.js";
import { dataLabExportPath } from "../lib/data-lab-export-window.js";

export async function requestDataLabExport(windowStart, windowEnd) {
  const response = await apiRequest(dataLabExportPath(windowStart, windowEnd), { cache: "no-store" });
  return handleResponse(response, "GET /api/data-lab/activity-export");
}

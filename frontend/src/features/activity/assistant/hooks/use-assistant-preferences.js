import { useCallback, useEffect, useState } from "react";
import { deleteAssistantPreference, getAssistantPreferences, saveAssistantPreference } from "../api/assistant-preferences-api.js";

export const ASSISTANT_PREFERENCE_FIELDS = [
  { key: "homeworkDefaultStart", label: "เวลาเริ่มทำการบ้าน", type: "time" },
  { key: "homeworkDefaultDurationMinutes", label: "ระยะเวลาทำการบ้าน", type: "duration" },
  { key: "exerciseDefaultDurationMinutes", label: "ระยะเวลาออกกำลังกาย", type: "duration" },
  { key: "preferredEveningStart", label: "เวลาเริ่มช่วงเย็น", type: "time" }
];

export function useAssistantPreferences(userId) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!userId) { setValues({}); return; }
    setLoading(true); setError("");
    try { setValues((await getAssistantPreferences()).values || {}); }
    catch (requestError) { setError(requestError.message || "โหลดค่าเริ่มต้นของ MR.Zettascale ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (key, value, enabled = true) => {
    const result = await saveAssistantPreference(key, value, enabled);
    setValues(result.values || {});
    return result;
  }, []);
  const remove = useCallback(async (key) => {
    const result = await deleteAssistantPreference(key);
    setValues(result.values || {});
    return result;
  }, []);

  return { values, loading, error, reload, save, remove };
}

import { useCallback, useEffect, useState } from "react";
import { deleteAssistantPreference, dismissAssistantPreferenceCandidate, getAssistantPreferences, recordAssistantPreferenceCorrections, saveAssistantPreference } from "../api/assistant-preferences-api.js";

export const ASSISTANT_PREFERENCE_FIELDS = [
  { key: "homeworkDefaultStart", label: "เวลาเริ่มทำการบ้าน", type: "time" },
  { key: "homeworkDefaultDurationMinutes", label: "ระยะเวลาทำการบ้าน", type: "duration" },
  { key: "exerciseDefaultDurationMinutes", label: "ระยะเวลาออกกำลังกาย", type: "duration" },
  { key: "preferredEveningStart", label: "เวลาเริ่มช่วงเย็น", type: "time" }
];

export function useAssistantPreferences(userId) {
  const [values, setValues] = useState({});
  const [candidates, setCandidates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!userId) { setValues({}); setCandidates({}); return; }
    setLoading(true); setError("");
    try { const result = await getAssistantPreferences(); setValues(result.values || {}); setCandidates(result.candidates || {}); }
    catch (requestError) { setError(requestError.message || "โหลดค่าเริ่มต้นของ MR.Zettascale ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (key, value, enabled = true) => {
    const result = await saveAssistantPreference(key, value, enabled);
    setValues(result.values || {}); setCandidates(result.candidates || {});
    return result;
  }, []);
  const remove = useCallback(async (key) => {
    const result = await deleteAssistantPreference(key);
    setValues(result.values || {}); setCandidates(result.candidates || {});
    return result;
  }, []);

  const recordCorrections = useCallback(async (corrections) => {
    if (!corrections?.length) return;
    const result = await recordAssistantPreferenceCorrections(corrections);
    setValues(result.values || {}); setCandidates(result.candidates || {});
  }, []);
  const dismissCandidate = useCallback(async (key) => {
    const result = await dismissAssistantPreferenceCandidate(key);
    setValues(result.values || {}); setCandidates(result.candidates || {});
  }, []);

  return { values, candidates, loading, error, reload, save, remove, recordCorrections, dismissCandidate };
}

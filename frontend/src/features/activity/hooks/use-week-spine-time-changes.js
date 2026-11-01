import { useRef, useState } from "react";
import { createTimeChangeState, timeChangeReducer } from "../lib/week-spine-time-changes.js";

// Draft history belongs to the planner where a gesture began, including cross-day moves.
export function useWeekSpineTimeChanges({ onSaveTimes, onError }) {
  const [states, setStates] = useState({});
  const statesRef = useRef(states);
  const [dragPreview, setDragPreview] = useState(null);
  const [saving, setSaving] = useState({});
  const savingRef = useRef(new Set());
  const dispatch = (day, action) => {
    const current = statesRef.current[day] || createTimeChangeState();
    const next = timeChangeReducer(current, action);
    statesRef.current = { ...statesRef.current, [day]: next };
    setStates(statesRef.current);
  };
  const pendingTimeChanges = new Map();
  Object.values(states).forEach(state => state.pending.forEach((value, id) => pendingTimeChanges.set(id, value)));
  const forDay = day => {
    const state = states[day] || createTimeChangeState();
    return {
      dragPreview, setDragPreview,
      pendingTimeChanges: state.pending,
      undoTimeChangeHistory: state.past, redoTimeChangeHistory: state.future,
      isSavingTimeChanges: Boolean(saving[day]),
      queueTimeChanges: changes => {
        // A single activity can have one owner: move its draft to this planner.
        for (const change of changes) for (const [otherDay, other] of Object.entries(statesRef.current)) {
          if (otherDay !== day && other.pending.has(change.id)) {
            const pending = new Map(other.pending); pending.delete(change.id);
            statesRef.current = { ...statesRef.current, [otherDay]: { pending, past: [], future: [] } };
          }
        }
        dispatch(day, { type: "queue", changes });
      },
      undoTimeChange: () => { if (!savingRef.current.has(day)) dispatch(day, { type: "undo" }); },
      redoTimeChange: () => { if (!savingRef.current.has(day)) dispatch(day, { type: "redo" }); },
      savePendingTimeChanges: async () => {
        if (savingRef.current.has(day)) return false;
        const submitted = new Map(statesRef.current[day]?.pending || []);
        if (!submitted.size) return true;
        savingRef.current.add(day); setSaving(current => ({ ...current, [day]: true }));
        try {
          if (!onSaveTimes) throw new Error("ไม่พบคำสั่งบันทึกกิจกรรม");
          const saved = await onSaveTimes([...submitted].map(([id, value]) => ({ id, ...value })), { allowLockedDrafts: true });
          if (saved === false) throw new Error("บันทึกการปรับเวลาไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง");
          dispatch(day, { type: "saved", submitted }); return true;
        } catch (error) { onError?.(error?.message || "บันทึกการปรับเวลาไม่สำเร็จ"); return false; }
        finally { savingRef.current.delete(day); setSaving(current => ({ ...current, [day]: false })); }
      }
    };
  };
  return { pendingTimeChanges, dragPreview, setDragPreview, forDay };
}

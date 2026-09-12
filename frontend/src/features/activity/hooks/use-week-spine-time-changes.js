import { useRef, useState } from "react";
import { createTimeChangeState, timeChangeReducer } from "../lib/week-spine-time-changes.js";

/** Atomic local history; successful writes acknowledge only submitted edits. */
export function useWeekSpineTimeChanges({ onSaveTimes, onMoveActivityToDay, onError }) {
  const [state, setState] = useState(createTimeChangeState);
  const stateRef = useRef(state);
  const savingRef = useRef(false);
  const [isSavingTimeChanges, setIsSavingTimeChanges] = useState(false);
  const dispatch = (action) => {
    stateRef.current = timeChangeReducer(stateRef.current, action);
    setState(stateRef.current);
  };
  const queueTimeChanges = (changes) => dispatch({ type: "queue", changes });
  const undoTimeChange = () => { if (!savingRef.current) dispatch({ type: "undo" }); };
  const redoTimeChange = () => { if (!savingRef.current) dispatch({ type: "redo" }); };
  const discardPendingTimeChanges = () => { if (!savingRef.current) dispatch({ type: "discard" }); };
  const savePendingTimeChanges = async () => {
    if (savingRef.current) return false;
    const submitted = new Map(stateRef.current.pending);
    if (!submitted.size) return true;
    savingRef.current = true;
    setIsSavingTimeChanges(true);
    try {
      if (!onSaveTimes) throw new Error("ไม่พบคำสั่งบันทึกกิจกรรม");
      const saved = await onSaveTimes([...submitted].map(([id, value]) => ({ id, ...value })));
      if (saved === false) throw new Error("บันทึกการปรับเวลาไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง");
      dispatch({ type: "saved", submitted });
      return true;
    } catch (error) {
      onError?.(error?.message || "บันทึกการปรับเวลาไม่สำเร็จ");
      return false;
    } finally {
      savingRef.current = false;
      setIsSavingTimeChanges(false);
    }
  };
  const moveActivityToDay = async (activityId, date) => {
    const changesBeforeMove = [...stateRef.current.pending].map(([id, value]) => ({ id, ...value }));
    if (!(await savePendingTimeChanges())) return false;
    if (stateRef.current.pending.size) {
      onError?.("มีการปรับเวลาเพิ่มระหว่างบันทึก — กรุณาบันทึกอีกครั้งก่อนย้ายวัน");
      return false;
    }
    return onMoveActivityToDay?.(activityId, date, changesBeforeMove);
  };
  return {
    pendingTimeChanges: state.pending,
    undoTimeChangeHistory: state.past,
    redoTimeChangeHistory: state.future,
    isSavingTimeChanges, queueTimeChanges, undoTimeChange, redoTimeChange,
    discardPendingTimeChanges, savePendingTimeChanges, moveActivityToDay
  };
}

import { useEffect, useRef } from "react";

/** Prevent follow-up operations from an unmounted account tree. */
export function useSessionTaskGuard() {
  const lifecycle = useRef({ active: true, epoch: 0 });
  useEffect(() => {
    lifecycle.current.active = true;
    return () => { lifecycle.current.active = false; lifecycle.current.epoch++; };
  }, []);
  const guardTask = (task) => async (...args) => {
    const epoch = lifecycle.current.epoch;
    const assertCurrent = () => {
      if (!lifecycle.current.active || lifecycle.current.epoch !== epoch) {
        const error = new Error("Account session ended");
        error.name = "AbortError";
        throw error;
      }
    };
    assertCurrent();
    const result = await task(...args);
    assertCurrent();
    return result;
  };
  const guardCallback = (callback) => (...args) => {
    if (lifecycle.current.active) return callback(...args);
  };
  return { guardTask, guardCallback };
}

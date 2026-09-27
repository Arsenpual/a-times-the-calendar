import { useSyncExternalStore } from "react";

let currentStatus = null;
const listeners = new Set();

export function setFirestoreQuotaStatus(status) {
  const next = status || null;
  if (JSON.stringify(currentStatus) === JSON.stringify(next)) return;
  currentStatus = next;
  listeners.forEach((listener) => listener());
}

export function useFirestoreQuotaStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentStatus,
    () => null
  );
}

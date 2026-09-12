import { useCallback, useRef, useState } from "react";

/** Activity failures are account-scoped and never clear Auth's own error. */
export function useActivityError(userId) {
  const owner = useRef(userId);
  owner.current = userId;
  const [failure, setFailure] = useState({ userId, message: null });
  if (failure.userId !== userId) setFailure({ userId, message: null });
  const setError = useCallback(message => {
    if (owner.current === userId) setFailure({ userId, message });
  }, [userId]);
  return { error: failure.userId === userId ? failure.message : null, setError };
}

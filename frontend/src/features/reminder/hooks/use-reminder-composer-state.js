import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";

export function useReminderComposerState(createBlankDraft) {
  const [draft, setDraft] = useState(createBlankDraft);
  const [editingId, setEditingId] = useState(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const composerCardRef = useRef(null);
  useEffect(() => {
    if (!isComposerOpen || !composerCardRef.current) return undefined;
    const animation = animate(composerCardRef.current, { opacity: [0, 1], translateY: [-18, 0], scale: [0.98, 1], duration: 500, ease: "out(4)" });
    return () => animation?.pause?.();
  }, [isComposerOpen]);
  return { draft, setDraft, editingId, setEditingId, isComposerOpen, setIsComposerOpen, composerCardRef };
}

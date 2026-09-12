import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";

/** Owns only the fullscreen lifecycle; rendering remains in Week Spine. */
export function useWeekSpineFullscreen({ viewMode, fullscreenRequestId, onTimelineFullscreenChange }) {
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const surfaceRef = useRef(null);
  const handledRequestRef = useRef(fullscreenRequestId);

  useEffect(() => {
    document.body.classList.toggle("week-spine-fullscreen-active", timelineFullscreen);
    return () => document.body.classList.remove("week-spine-fullscreen-active");
  }, [timelineFullscreen]);

  useEffect(() => {
    onTimelineFullscreenChange?.(timelineFullscreen);
    if (!timelineFullscreen || !surfaceRef.current) return undefined;
    const animation = animate(surfaceRef.current, {
      opacity: [0, 1],
      translateY: [-18, 0],
      scale: [0.98, 1],
      duration: 500,
      ease: "out(4)"
    });
    return () => animation.cancel();
  }, [timelineFullscreen, onTimelineFullscreenChange]);

  useEffect(() => {
    if (viewMode === "four-weeks" && timelineFullscreen) setTimelineFullscreen(false);
  }, [viewMode, timelineFullscreen]);

  useEffect(() => {
    if (!fullscreenRequestId || fullscreenRequestId === handledRequestRef.current) return;
    handledRequestRef.current = fullscreenRequestId;
    setTimelineFullscreen(true);
  }, [fullscreenRequestId]);

  useEffect(() => {
    if (!timelineFullscreen) return undefined;
    const exitOnEscape = (event) => {
      if (event.key === "Escape") setTimelineFullscreen(false);
    };
    document.addEventListener("keydown", exitOnEscape);
    return () => document.removeEventListener("keydown", exitOnEscape);
  }, [timelineFullscreen]);

  return {
    timelineFullscreen,
    timelineFullscreenSurfaceRef: surfaceRef,
    toggleTimelineFullscreen: () => setTimelineFullscreen((open) => !open)
  };
}

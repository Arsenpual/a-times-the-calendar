import React, { useLayoutEffect, useRef } from "react";
import { animate, scrambleText } from "animejs";

const REVEAL_DURATION_MS = 1200;
const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  repeatIntervalMinutes: 5,
  holdDurationSeconds: 1.8,
  scrollSpeedPxPerSecond: 60,
  scrambleEnabled: true
});

// React owns the layout; Anime.js owns only the empty display span and transform.
export default function AnnouncementTicker({ message, config }) {
  const containerRef = useRef(null);
  const itemRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    if (!message || !config?.enabled) return undefined;
    const settings = { ...DEFAULT_CONFIG, ...config };
    const container = containerRef.current;
    const item = itemRef.current;
    const text = textRef.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let timer;
    let animation;

    const hide = () => {
      if (cancelled) return;
      container.style.visibility = "hidden";
      timer = window.setTimeout(play, settings.repeatIntervalMinutes * 60 * 1000);
    };
    const scroll = () => {
      if (cancelled) return;
      // Measure after revealing; include the container padding in the exit distance.
      const distance = item.getBoundingClientRect().right - container.getBoundingClientRect().left + 2;
      container.dataset.phase = "scroll";
      animation = animate(item, {
        translateX: -distance,
        duration: Math.max(1000, distance / settings.scrollSpeedPxPerSecond * 1000),
        ease: "linear",
        onComplete: hide
      });
    };
    const hold = () => {
      if (cancelled) return;
      text.textContent = message;
      container.dataset.phase = "hold";
      timer = window.setTimeout(motion.matches ? hide : scroll,
        motion.matches ? Math.max(6000, message.length * 80) : settings.holdDurationSeconds * 1000);
    };
    function play() {
      if (cancelled) return;
      container.style.visibility = "visible";
      container.dataset.phase = "reveal";
      item.style.transform = "translateX(0)";
      text.textContent = message;
      if (motion.matches || !settings.scrambleEnabled) { hold(); return; }
      // Animate a plain object, then copy via textContent: announcement strings
      // (including <, >, &) must never be interpreted as HTML.
      const target = { textContent: message, innerHTML: "" };
      animation = animate(target, {
        innerHTML: scrambleText({ text: message, duration: REVEAL_DURATION_MS, from: "left" }),
        ease: "linear",
        onUpdate: () => { text.textContent = target.innerHTML; },
        onComplete: hold
      });
      text.textContent = target.innerHTML;
    }
    const restart = () => {
      animation?.cancel();
      window.clearTimeout(timer);
      play();
    };
    play();
    motion.addEventListener("change", restart);
    return () => {
      cancelled = true;
      animation?.cancel();
      window.clearTimeout(timer);
      motion.removeEventListener("change", restart);
    };
  }, [message, config]);

  if (!message || !config?.enabled) return null;
  return (
    <div className="announcement-ticker" ref={containerRef} role="status" aria-label={message}>
      <div className="announcement-ticker-track" aria-hidden="true">
        <span className="announcement-ticker-item" ref={itemRef}>
          <span className="announcement-ticker-measure">{message}</span>
          <span className="announcement-ticker-display" ref={textRef} />
        </span>
      </div>
    </div>
  );
}

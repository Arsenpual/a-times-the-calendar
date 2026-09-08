import React, { useLayoutEffect, useRef } from "react";
import { animate, scrambleText } from "animejs";

const HIDDEN_DURATION_MS = 5 * 60 * 1000;
const REVEAL_DURATION_MS = 1200;
const HOLD_DURATION_MS = 1800;
const SCROLL_SPEED_PX_PER_SEC = 60;

// React owns the layout; Anime.js owns only the empty display span and transform.
export default function AnnouncementTicker({ message }) {
  const containerRef = useRef(null);
  const itemRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    if (!message) return undefined;
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
      timer = window.setTimeout(play, HIDDEN_DURATION_MS);
    };
    const scroll = () => {
      if (cancelled) return;
      // Measure after revealing; include the container padding in the exit distance.
      const distance = item.getBoundingClientRect().right - container.getBoundingClientRect().left + 2;
      container.dataset.phase = "scroll";
      animation = animate(item, {
        translateX: -distance,
        duration: Math.max(1000, distance / SCROLL_SPEED_PX_PER_SEC * 1000),
        ease: "linear",
        onComplete: hide
      });
    };
    const hold = () => {
      if (cancelled) return;
      text.textContent = message;
      container.dataset.phase = "hold";
      timer = window.setTimeout(motion.matches ? hide : scroll,
        motion.matches ? Math.max(6000, message.length * 80) : HOLD_DURATION_MS);
    };
    function play() {
      if (cancelled) return;
      container.style.visibility = "visible";
      container.dataset.phase = "reveal";
      item.style.transform = "translateX(0)";
      text.textContent = message;
      if (motion.matches) { hold(); return; }
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
  }, [message]);

  if (!message) return null;
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

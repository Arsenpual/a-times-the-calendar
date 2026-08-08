<<<<<<< HEAD
import React from "react";

export default function AnnouncementTicker({ message }) {
  // ถ้าไม่มีข้อความหรือข้อความว่าง ไม่ต้องแสดงอะไร
  if (!message) return null;

  return (
    <div className="announcement-ticker">
      <div className="ticker-content">
        {message}
=======
import React, { useLayoutEffect, useEffect, useRef, useState } from "react";

const SCROLL_SPEED_PX_PER_SEC = 60; // constant scroll speed regardless of message length
const HIDDEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes between each pass

/**
 * Thin scrolling ticker for one-way announcements to the user (version
 * updates, maintenance notices, etc.) — shown just below the app header in
 * calendar (dashboard) mode. Not dismissible and not fetched from a
 * backend: the message is a hardcoded prop set directly in app.jsx, so
 * changing it means editing that value and redeploying.
 *
 * Cycle: visible immediately on mount (page load/refresh), scrolls through
 * exactly one full pass of the message left, then hides completely for
 * HIDDEN_DURATION_MS before showing (and scrolling) again — repeating for
 * as long as the component stays mounted. This is deliberately a single
 * pass per visible period, not a continuous loop: the earlier version
 * scrolled forever, which meant a person glancing at the header at a
 * random moment might catch the message mid-sentence; showing one full
 * pass then a real gap makes each appearance a complete, readable unit.
 *
 * The single-pass duration is derived from the message's actual rendered
 * width (measured via ref) divided by a constant scroll speed, rather than
 * a fixed animation duration — so a short message and a long message both
 * scroll at the same visual speed instead of a long one racing by to fit
 * the same time budget a short one used.
 *
 * Text is deliberately small (11px, matches the app's other secondary-text
 * sizes like .agenda-weekday) so it reads as a quiet strip, not a banner
 * demanding attention — unlike ReminderModeMockup's .mockup-banner, which
 * is a static warning meant to be noticed immediately.
 *
 * @param {string} message the announcement text
 */
export default function AnnouncementTicker({ message }) {
  const [visible, setVisible] = useState(true);
  const [durationMs, setDurationMs] = useState(null);
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const timerRef = useRef(null);

  // Measure the actual scroll distance — the container's own width (the
  // gap the text crosses while entering from fully off-screen right) plus
  // the message's rendered text width (the distance needed to then fully
  // exit past the left edge) — to derive how long a single pass should
  // take at a constant speed. Both are needed: using only the text width
  // would make the animation cover the true (container + text) distance
  // in too little time, making it visibly faster than
  // SCROLL_SPEED_PX_PER_SEC and inconsistent across different viewport
  // widths (since the container's width, and therefore the true
  // distance, changes with the window). Redone whenever `message`
  // changes (e.g. a future version fetches this from a backend and it
  // changes without a remount) — a stale duration from a previous
  // message would make the animation and the show/hide timers fall out
  // of sync.
  useLayoutEffect(() => {
    if (!message) return;
    const containerEl = containerRef.current;
    const textEl = textRef.current;
    if (!containerEl || !textEl) return;
    const containerWidthPx = containerEl.getBoundingClientRect().width;
    const textWidthPx = textEl.getBoundingClientRect().width;
    const totalDistancePx = containerWidthPx + textWidthPx;
    setDurationMs(Math.max(1000, (totalDistancePx / SCROLL_SPEED_PX_PER_SEC) * 1000));
  }, [message]);

  // Drives the show → scroll-once → hide → wait → show cycle. Starts
  // visible (matches "on page load/refresh, show immediately"). Each time
  // `visible` flips true, schedule hiding it after exactly one scroll
  // pass (durationMs); each time it flips false, schedule showing it
  // again after the cooldown. Cleared and rescheduled whenever durationMs
  // changes (e.g. resolves from null to a real value after the first
  // measurement) so the very first pass uses the correct measured
  // duration rather than a guess.
  useEffect(() => {
    if (!message || durationMs === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => setVisible((prev) => !prev),
      visible ? durationMs : HIDDEN_DURATION_MS
    );
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, durationMs, message]);

  if (!message) return null;

  return (
    <div
      className="announcement-ticker"
      role="status"
      aria-label="ประกาศ"
      style={{ visibility: visible ? "visible" : "hidden" }}
      ref={containerRef}
    >
      <div
        className="announcement-ticker-track"
        style={{ animationDuration: `${durationMs || 1}ms` }}
        // Restarting the CSS animation each time it becomes visible again
        // needs a fresh element instance — otherwise the browser just
        // resumes/no-ops since the animation already technically
        // "finished" and the element never unmounted. Keying on `visible`
        // forces React to remount the track (and therefore restart the
        // animation from 0%) on every new pass. Also keyed on whether
        // durationMs is known yet: rendering the track with the CSS
        // default 0s duration on the very first paint (before
        // useLayoutEffect measures the text) would let that animation
        // "finish" instantly, and simply updating animation-duration
        // afterward on an already-finished animation doesn't restart it
        // in most browsers — remounting via this key sidesteps that.
        key={`${visible}-${durationMs !== null}`}
      >
        <span className="announcement-ticker-item">
          {/* The outer .announcement-ticker-item carries the off-screen
              starting offset (padding-left: 100%, see CSS) — measuring
              *that* element's width would include the padding itself,
              making the duration calculation wildly wrong. This inner
              span has no padding, so its width is exactly the rendered
              text, which is what SCROLL_SPEED_PX_PER_SEC should divide
              into. */}
          <span ref={textRef}>{message}</span>
        </span>
>>>>>>> 3aa757f (เพิ่มไฟล์ใหม่: announcement-ticker.jsx ใช้ประกาศ, สิ่อสารกับผู้ใช้โดยตรง announcement-ticker.jsx, app.jsx index.css เพิ่มไฟล์ใหม่: auto-shrink-text.jsx เพื่อวัด และลดขนาดตัวอักษรของ announcement-ticker.jsx, mini-timeline-panel.jsx, index.css)
      </div>
    </div>
  );
}

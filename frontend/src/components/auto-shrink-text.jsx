import React, { useLayoutEffect, useRef, useState } from "react";

const STEPS = [1, 0.92, 0.85, 0.78, 0.72];

/**
 * Renders `text` on a single line, automatically shrinking font-size (via a
 * CSS custom property, --auto-shrink-scale) until it fits the element's own
 * width — instead of overflowing and getting cut off with an ellipsis like
 * plain `text-overflow: ellipsis` does.
 *
 * Used for activity titles in MiniTimelinePanel and TimelineEditor, where a
 * long title being unreadable behind "..." was worse than a slightly
 * smaller (but fully legible) label — these are short single-line labels
 * where losing text isn't acceptable, unlike e.g. multi-line descriptions
 * elsewhere in the app that can wrap/scroll instead.
 *
 * Uses a small set of discrete scales rather than continuously changing the
 * size, keeping titles visually stable while still making room for long text.
 *
 * Measures the *parent* element's width (via ResizeObserver), not this
 * span's own — observing the span itself would create a feedback loop,
 * since changing its font-size changes its own box size, which would
 * re-trigger the observer.
 *
 * @param {string} text
 * @param {number} [minScale=0.72] smallest allowed scale (as a fraction of the CSS font-size), so text never shrinks past readable
 * @param {string} [className] applied to the wrapping <span>
 * @param {string} [baseFontSize] explicit CSS base size when a caller needs
 * the shrinking style to preserve a class-defined pixel size exactly
 * @param {object} [style] extra inline styles merged onto the wrapping <span>
 * @param {string} [title] native tooltip — defaults to `text` so the full title is still available on hover/long-press even when shrunk
 */
export default function AutoShrinkText({ text, minScale = 0.72, className, style, title, baseFontSize }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const steps = STEPS.filter((step) => step >= minScale);
      if (steps[steps.length - 1] !== minScale) steps.push(minScale);
      let chosen = steps[steps.length - 1];
      for (const step of steps) {
        el.style.setProperty("--auto-shrink-scale", String(step));
        if (el.scrollWidth <= el.clientWidth) {
          chosen = step;
          break;
        }
      }
      setScale(chosen);
    };

    measure();

    // Re-measure when the available width changes — e.g. the timeline
    // column gets narrower/wider from an overlapping activity being
    // added/removed nearby, or a container resize. Observe the parent
    // rather than `el` itself: observing `el` would fire again every time
    // `measure()` changes its own font-size (since that changes its box
    // size), causing an infinite/flickering loop.
    const target = el.parentElement;
    if (!target || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [text, minScale]);

  return (
    <span
      ref={ref}
      className={className}
      title={title ?? text}
      style={{
        ...style,
        "--auto-shrink-scale": scale,
        fontSize: baseFontSize
          ? `calc(${baseFontSize} * var(--auto-shrink-scale))`
          : "calc(1em * var(--auto-shrink-scale))"
      }}
    >
      {text}
    </span>
  );
}

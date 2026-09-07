import React, { useLayoutEffect, useRef, useState } from "react";

/**
 * Renders `text` on a single line, automatically shrinking font-size (via a
 * CSS custom property, --auto-shrink-scale) until it fits the element's own
 * width. A binary search finds the largest fitting continuous scale rather
 * than choosing from a few visibly-jumpy preset sizes.
 *
 * Used for activity titles in MiniTimelinePanel and TimelineEditor, where a
 * long title being unreadable behind "..." was worse than a slightly
 * smaller (but fully legible) label — these are short single-line labels
 * where losing text isn't acceptable, unlike e.g. multi-line descriptions
 * elsewhere in the app that can wrap/scroll instead.
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
      const minimum = Math.max(0.01, Math.min(1, minScale));
      const fits = (candidate) => {
        el.style.setProperty("--auto-shrink-scale", String(candidate));
        return el.scrollWidth <= el.clientWidth;
      };

      let chosen = minimum;
      if (fits(1)) {
        chosen = 1;
      } else if (fits(minimum)) {
        let low = minimum;
        let high = 1;
        // Twelve passes give sub-pixel precision even for a 12px base font.
        for (let pass = 0; pass < 12; pass += 1) {
          const midpoint = (low + high) / 2;
          if (fits(midpoint)) {
            low = midpoint;
          } else {
            high = midpoint;
          }
        }
        chosen = low;
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

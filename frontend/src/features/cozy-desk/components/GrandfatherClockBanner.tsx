import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ClockActivityAnnouncement } from '../hooks/useGrandfatherClockActivities';

const MARQUEE_ROUNDS = 3;
const MARQUEE_SPEED_PX_PER_SEC = 62;
const SHORT_TITLE_DURATION_MS = 10_000;

interface GrandfatherClockBannerProps {
  announcement: ClockActivityAnnouncement | null;
  onComplete: () => void;
}

/**
 * Antique mahogany & brass nameplate shown when the Living Room grandfather clock chimes
 * for an Activity Mode event.
 * - Short titles fit cleanly centered for 10 seconds.
 * - Long titles scroll smoothly right-to-left until the very last character disappears, repeating 3 rounds.
 */
export function GrandfatherClockBanner({
  announcement,
  onComplete,
}: GrandfatherClockBannerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (!announcement) {
      setIsOverflowing(false);
      return;
    }

    let rafId: number | null = null;
    let shortTimerId: number | null = null;
    let cancelled = false;

    const startPlayback = () => {
      if (cancelled) return;
      const viewport = viewportRef.current;
      const textEl = textRef.current;
      if (!viewport || !textEl) return;

      const viewportW = viewport.clientWidth;
      const textW = textEl.scrollWidth;
      const needsScroll = textW > viewportW + 2;
      setIsOverflowing(needsScroll);

      if (!needsScroll) {
        textEl.style.transform = 'translate3d(0px, 0px, 0px)';
        shortTimerId = window.setTimeout(() => {
          if (!cancelled) onCompleteRef.current();
        }, SHORT_TITLE_DURATION_MS);
        return;
      }

      // Scroll from right edge (+viewportW) leftward until the last character completely exits (-textW), 3 full rounds
      const travelDistance = viewportW + textW;
      let offset = viewportW;
      let completedRounds = 0;
      let lastTs: number | null = null;

      textEl.style.transform = `translate3d(${offset.toFixed(1)}px, 0px, 0px)`;

      const step = (ts: number) => {
        if (cancelled) return;
        if (lastTs === null) {
          lastTs = ts;
        }
        const dtSec = Math.min(0.08, Math.max(0, (ts - lastTs) / 1000));
        lastTs = ts;

        offset -= MARQUEE_SPEED_PX_PER_SEC * dtSec;

        if (offset <= -textW) {
          completedRounds += 1;
          if (completedRounds >= MARQUEE_ROUNDS) {
            onCompleteRef.current();
            return;
          }
          // Re-enter smoothly from right edge for the next round
          offset += travelDistance;
        }

        if (textRef.current) {
          textRef.current.style.transform = `translate3d(${offset.toFixed(1)}px, 0px, 0px)`;
        }
        rafId = window.requestAnimationFrame(step);
      };

      rafId = window.requestAnimationFrame(step);
    };

    const initRaf = window.requestAnimationFrame(() => {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        void document.fonts.ready.then(() => {
          if (!cancelled) startPlayback();
        });
      } else {
        startPlayback();
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(initRaf);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (shortTimerId !== null) window.clearTimeout(shortTimerId);
    };
  }, [announcement]);

  if (!announcement) return null;

  return (
    <div
      className="cozy-clock-banner-wrap"
      role="status"
      aria-live="polite"
    >
      <div className="cozy-clock-banner-card">
        {/* Antique brass pendulum clock emblem */}
        <div className="cozy-clock-emblem">
          <svg viewBox="0 0 28 34" className="h-8 w-7" aria-hidden="true">
            <circle cx="14" cy="10" r="7" fill="#FAF6F0" stroke="#D4A03E" strokeWidth="1.8" />
            <line x1="14" y1="10" x2="14" y2="6.2" stroke="#2B1A11" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="10" x2="17.2" y2="10.8" stroke="#2B1A11" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="14" cy="10" r="1.1" fill="#B07D32" />
            <g className="cozy-clock-pendulum">
              <line x1="14" y1="17" x2="14" y2="28" stroke="#D4A03E" strokeWidth="1.6" />
              <circle cx="14" cy="29" r="3" fill="#F5CB69" stroke="#B07D32" strokeWidth="1" />
            </g>
          </svg>
        </div>

        {/* Time header + fixed-size clipped activity marquee */}
        <div className="min-w-0 flex-1">
          <div className="cozy-clock-meta">
            <span>{announcement.statusLabel}</span>
            <span>·</span>
            <span className="cozy-clock-time">{announcement.startTimeLabel}</span>
          </div>

          <div className="cozy-clock-window">
            <div
              ref={viewportRef}
              className={`cozy-clock-viewport ${
                isOverflowing ? 'cozy-clock-viewport--scroll' : 'cozy-clock-viewport--center'
              }`}
            >
              <span ref={textRef} className="cozy-clock-title">
                {announcement.title}
              </span>
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={onComplete}
          aria-label="ปิดการแจ้งเตือนนาฬิกาลูกตุ้มโบราณ"
          className="cozy-clock-close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import type { ClockActivityAnnouncement } from '../hooks/useGrandfatherClockActivities';

const MARQUEE_ROUNDS = 3;
const MARQUEE_SPEED_PX_PER_SEC = 64;
const SHORT_TITLE_DURATION_MS = 10_000;

interface GrandfatherClockBannerProps {
  announcement: ClockActivityAnnouncement | null;
  onComplete: () => void;
  onOpenSchedule: () => void;
}

/**
 * Temporary antique mahogany & brass nameplate shown ONLY when the Living Room
 * grandfather clock chimes for an Activity Mode event's start time.
 * - Short titles sit centered for 10 seconds, then close automatically.
 * - Long titles scroll right-to-left until the very last character disappears, repeating 3 rounds, then close automatically.
 * - Never persists on screen outside of an active chime announcement.
 */
export function GrandfatherClockBanner({
  announcement,
  onComplete,
  onOpenSchedule,
}: GrandfatherClockBannerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [isOverflowing, setIsOverflowing] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);

  const activeTitle = announcement?.title ?? '';
  const activeKey = announcement ? `${announcement.id}:${announcement.title}` : '';

  useEffect(() => {
    if (!announcement || !activeTitle) {
      setIsOverflowing(false);
      setCurrentRound(1);
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

      // Reset transform before measuring so width calculations are exact
      textEl.style.transform = 'translate3d(0px, 0px, 0px)';

      const viewportW = viewport.clientWidth;
      const textW = Math.ceil(textEl.getBoundingClientRect().width || textEl.scrollWidth);
      const needsScroll = textW > viewportW + 2;
      setIsOverflowing(needsScroll);
      setCurrentRound(1);

      if (!needsScroll) {
        const centerOffset = Math.max(0, Math.round((viewportW - textW) / 2));
        textEl.style.transform = `translate3d(${centerOffset}px, 0px, 0px)`;
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
          // Re-enter smoothly from the right edge for the next round
          offset += travelDistance;
          setCurrentRound(Math.min(MARQUEE_ROUNDS, completedRounds + 1));
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
  }, [activeKey, activeTitle, announcement]);

  if (!announcement) return null;

  return (
    <div
      className="cozy-clock-banner-wrap"
      role="status"
      aria-live="polite"
    >
      <div className="cozy-clock-banner-card">
        {/* Antique brass pendulum clock emblem */}
        <div className="cozy-clock-emblem" title="นาฬิกาลูกตุ้มโบราณ ห้องนั่งเล่น">
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
            <span className="font-semibold text-[#F5CB69]">{announcement.statusLabel}</span>
            <span>·</span>
            <span className="cozy-clock-time">{announcement.startTimeLabel}</span>
            {announcement.categoryName && (
              <>
                <span>·</span>
                <span className="truncate text-[#D7B98A]">{announcement.categoryName}</span>
              </>
            )}
            {isOverflowing && (
              <span className="ml-auto rounded bg-[#3B2113] px-1.5 py-0.5 text-[10px] font-semibold text-[#F5CB69]">
                รอบ {currentRound}/{MARQUEE_ROUNDS}
              </span>
            )}
          </div>

          <div className="cozy-clock-window">
            <div
              ref={viewportRef}
              className={`cozy-clock-viewport ${
                isOverflowing ? 'cozy-clock-viewport--scroll' : ''
              }`}
            >
              <span ref={textRef} className="cozy-clock-title">
                {announcement.title}
              </span>
            </div>
          </div>
        </div>

        {/* Open full-day Activity Mode schedule button */}
        <button
          type="button"
          onClick={onOpenSchedule}
          title="ดูกิจกรรมทั้งวันจาก Activity Mode"
          className="cozy-clock-schedule-btn"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>ทั้งวัน</span>
        </button>

        {/* Dismiss chime button */}
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

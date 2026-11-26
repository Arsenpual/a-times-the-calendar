import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ClockDayActivityItem,
  ClockNextActivityCountdown,
} from '../hooks/useGrandfatherClockActivities';

interface GrandfatherClockScheduleModalProps {
  isOpen: boolean;
  nowMs: number;
  todayActivities: ClockDayActivityItem[];
  upcomingWeekActivities: ClockDayActivityItem[];
  ongoingActivity: ClockDayActivityItem | null;
  lastStartedTodayActivity: ClockDayActivityItem | null;
  nextActivityCountdown: ClockNextActivityCountdown | null;
  isSyncingToday?: boolean;
  canSyncToday?: boolean;
  onRefreshToday?: () => void;
  onPreviewActivityChime: (activity: ClockDayActivityItem) => void;
  onSwitchToActivityMode?: () => void;
  onClose: () => void;
}

const THAI_WEEKDAYS = [
  'วันอาทิตย์',
  'วันจันทร์',
  'วันอังคาร',
  'วันพุธ',
  'วันพฤหัสบดี',
  'วันศุกร์',
  'วันเสาร์',
];

const THAI_FULL_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function formatFullThaiDate(ms: number): string {
  const d = new Date(ms);
  const weekday = THAI_WEEKDAYS[d.getDay()] ?? '';
  const day = d.getDate();
  const month = THAI_FULL_MONTHS[d.getMonth()] ?? '';
  const buddhistYear = d.getFullYear() + 543;
  return `${weekday}ที่ ${day} ${month} ${buddhistYear}`;
}

function formatFullDigitalClock(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} น.`;
}

export function GrandfatherClockScheduleModal({
  isOpen,
  nowMs,
  todayActivities,
  upcomingWeekActivities,
  ongoingActivity,
  lastStartedTodayActivity,
  nextActivityCountdown,
  isSyncingToday = false,
  canSyncToday = false,
  onRefreshToday,
  onPreviewActivityChime,
  onSwitchToActivityMode,
  onClose,
}: GrandfatherClockScheduleModalProps) {
  if (!isOpen) return null;

  const fullDateLabel = formatFullThaiDate(nowMs);
  const liveClockLabel = formatFullDigitalClock(nowMs);

  const completedCount = todayActivities.filter((a) => a.status === 'completed').length;
  const remainingCount = todayActivities.filter(
    (a) => a.status === 'next' || a.status === 'upcoming'
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="ตารางกิจกรรมทั้งวันจาก Activity Mode · นาฬิกาลูกตุ้มโบราณ"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-[#C99A49] bg-[#21130C] text-[#FAF6F0] shadow-2xl">
        {/* Antique Mahogany & Brass Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#5B3A21] bg-gradient-to-br from-[#3D2214] via-[#2B170E] to-[#1D0F09] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
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
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display truncate text-base font-bold text-[#FFF3BE]">
                  นาฬิกาลูกตุ้มโบราณ · กิจกรรมทั้งวัน (Activity Mode)
                </h2>
                <span className="rounded-full border border-[#8F6830] bg-[#3A2012] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#F5CB69]">
                  {liveClockLabel}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-[#D7B98A]">
                {fullDateLabel} · เชื่อมต่อตารางเวลาจาก Activity Mode
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างตารางกิจกรรมทั้งวัน"
            className="cozy-clock-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="cozy-scroll flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* Hero Grid: Next Activity Countdown & Current/Latest Activity Status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Next Activity Countdown Card */}
            <div className="rounded-xl border border-[#8F6830] bg-[#2B180F] p-3.5 shadow-inner">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#F5CB69]">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>นับถอยหลังสู่กิจกรรมถัดไป</span>
                </span>
                {nextActivityCountdown && (
                  <span className="rounded bg-[#442515] px-1.5 py-0.5 font-mono text-[11px] text-[#FFF3BE]">
                    {!nextActivityCountdown.isToday
                      ? `${nextActivityCountdown.activity.dateLabel} `
                      : ''}
                    {nextActivityCountdown.activity.startTimeLabel}
                  </span>
                )}
              </div>

              {nextActivityCountdown ? (
                <div className="mt-2">
                  <div className="font-mono text-2xl font-bold tracking-tight tabular-nums text-[#FFF3BE]">
                    อีก {nextActivityCountdown.hmsLabel}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#E5C17B]">
                    ({nextActivityCountdown.thaiLabel})
                  </div>
                  <div className="mt-2 truncate rounded-lg border border-[#5D3A22] bg-[#1A0E08] px-2.5 py-1.5 text-sm font-semibold text-[#FAF3E3]">
                    {nextActivityCountdown.activity.title}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-[#4B2E1B] bg-[#1A0E08] px-3 py-3 text-xs text-[#CFC4B6]">
                  ไม่มีกิจกรรมถัดไปที่รอเริ่มในวันนี้แล้ว
                </div>
              )}
            </div>

            {/* Ongoing / Most Recently Started Activity Status Card */}
            <div className="rounded-xl border border-[#5B3A21] bg-[#26150D] p-3.5">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#D7B98A]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#E5C17B]" />
                  <span>
                    {ongoingActivity
                      ? 'กิจกรรมที่กำลังดำเนินอยู่'
                      : 'สถานะการแจ้งเตือนวันนี้'}
                  </span>
                </span>
                <span className="text-[11px] text-[#B8986E]">
                  รวม {todayActivities.length} กิจกรรม
                </span>
              </div>

              {ongoingActivity ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#34D399]/60 bg-[#064E3B]/50 px-2 py-0.5 text-[11px] font-semibold text-[#A7F3D0]">
                      กำลังดำเนินอยู่
                    </span>
                    <span className="font-mono text-xs text-[#E5C17B]">
                      {ongoingActivity.timeRangeLabel}
                    </span>
                  </div>
                  <div className="mt-2 truncate rounded-lg border border-[#4B2E1B] bg-[#1A0E08] px-2.5 py-1.5 text-sm font-semibold text-[#FAF3E3]">
                    {ongoingActivity.title}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onPreviewActivityChime(ongoingActivity);
                      onClose();
                    }}
                    className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#F5CB69] hover:underline"
                  >
                    <Bell className="h-3 w-3" />
                    <span>ตีระฆังโชว์ชื่อบนนาฬิกาอีกครั้ง</span>
                  </button>
                </div>
              ) : lastStartedTodayActivity ? (
                <div className="mt-2 space-y-1.5">
                  <div className="text-xs text-[#E5C17B]">
                    เลยช่วงถึงเวลาเริ่มกิจกรรมล่าสุดแล้ว ({lastStartedTodayActivity.startTimeLabel})
                  </div>
                  <div className="truncate rounded-lg border border-[#4B2E1B] bg-[#1A0E08] px-2.5 py-1.5 text-xs font-medium text-[#D7B98A]">
                    ล่าสุด: {lastStartedTodayActivity.title}
                  </div>
                  <div className="text-[11px] text-[#B8986E]">
                    เสร็จสิ้นแล้ว {completedCount} · รอเริ่มอีก {remainingCount} กิจกรรม
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-[#4B2E1B] bg-[#1A0E08] px-3 py-3 text-xs text-[#CFC4B6]">
                  {todayActivities.length > 0
                    ? `วันนี้มี ${todayActivities.length} กิจกรรม · รอถึงเวลาเริ่มกิจกรรมแรก`
                    : 'วันนี้ยังไม่มีกิจกรรมที่ตั้งเวลาไว้ใน Activity Mode'}
                </div>
              )}
            </div>
          </div>

          {/* Full-Day Schedule List from Activity Mode */}
          <div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#F5CB69]" />
                <h3 className="text-sm font-semibold text-[#FFF3BE]">
                  รายการกิจกรรมทั้งวัน ({todayActivities.length} รายการ)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {canSyncToday && onRefreshToday && (
                  <button
                    type="button"
                    onClick={onRefreshToday}
                    disabled={isSyncingToday}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#6E492A] bg-[#2D1A10] px-2.5 py-1 text-xs font-medium text-[#E5C17B] transition-colors hover:border-[#C99A49] hover:text-[#FFF3BE] disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isSyncingToday ? 'animate-spin' : ''}`}
                    />
                    <span>{isSyncingToday ? 'กำลังซิงก์...' : 'ซิงก์ล่าสุด'}</span>
                  </button>
                )}

                {onSwitchToActivityMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSwitchToActivityMode();
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#8F6830] bg-[#3B2113] px-2.5 py-1 text-xs font-semibold text-[#FFF3BE] transition-colors hover:border-[#F5CB69] hover:bg-[#4D2B18]"
                  >
                    <span>เปิดหน้า Activity Mode</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {todayActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#5B3A21] bg-[#1A0F0A] px-4 py-8 text-center">
                <p className="text-sm font-medium text-[#E5C17B]">
                  วันนี้ยังไม่มีตารางกิจกรรมใน Activity Mode
                </p>
                <p className="mt-1 text-xs text-[#B8986E]">
                  เมื่อคุณเพิ่มกิจกรรมใน Activity Mode นาฬิกาลูกตุ้มโบราณในห้องนั่งเล่นจะเชื่อมต่อและตีระฆังแจ้งเตือนให้อัตโนมัติ
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayActivities.map((item) => {
                  const isNext = item.status === 'next';
                  const isOngoing = item.status === 'ongoing';
                  const isCompleted = item.status === 'completed';

                  return (
                    <div
                      key={`${item.id}-${item.startMs}`}
                      className={`flex flex-col justify-between gap-2.5 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
                        isNext
                          ? 'border-[#C99A49] bg-[#331C10]'
                          : isOngoing
                            ? 'border-[#34D399]/60 bg-[#172820]'
                            : isCompleted
                              ? 'border-[#3E2718] bg-[#180E09] opacity-75'
                              : 'border-[#4D301D] bg-[#22130C]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[#140B06] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#FFF3BE]">
                            {item.timeRangeLabel}
                          </span>

                          {item.categoryName && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5B3A21] bg-[#2B170E] px-2 py-0.5 text-[11px] font-medium text-[#E5C17B]">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: item.categoryColor || '#D4A03E',
                                }}
                              />
                              <span>{item.categoryName}</span>
                            </span>
                          )}

                          {isOngoing && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#34D399]/60 bg-[#064E3B]/50 px-2 py-0.5 text-[11px] font-semibold text-[#A7F3D0]">
                              {item.isAllDay ? 'กิจกรรมทั้งวัน' : 'กำลังดำเนินอยู่'}
                            </span>
                          )}

                          {isNext && item.countdownLabel && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B]/60 bg-[#442515] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#FDE68A]">
                              <Clock className="h-3 w-3" />
                              <span>กิจกรรมถัดไป · อีก {item.countdownLabel}</span>
                            </span>
                          )}

                          {item.status === 'upcoming' && item.countdownLabel && (
                            <span className="font-mono text-[11px] tabular-nums text-[#C9A87C]">
                              รอเริ่ม · อีก {item.countdownLabel}
                            </span>
                          )}

                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#9C8468]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>ผ่านช่วงเวลาเริ่มแล้ว</span>
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 break-words text-sm font-semibold text-[#FAF6F0]">
                          {item.title}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onPreviewActivityChime(item);
                            onClose();
                          }}
                          title="ตีระฆังนาฬิกาลูกตุ้มและโชว์ชื่อกิจกรรมนี้บนป้ายวิ่ง 3 รอบ"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#6E492A] bg-[#2D1A10] px-2.5 py-1.5 text-xs font-medium text-[#F5CB69] transition-colors hover:border-[#C99A49] hover:bg-[#3D2315] hover:text-[#FFF3BE]"
                        >
                          <Bell className="h-3.5 w-3.5 shrink-0" />
                          <span>โชว์บนนาฬิกา</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming activities on other days in the week (if any) */}
          {upcomingWeekActivities.length > 0 && (
            <div className="pt-2">
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-[#C9A87C]">
                กิจกรรมถัดไปในสัปดาห์นี้
              </h4>
              <div className="space-y-1.5">
                {upcomingWeekActivities.map((item) => (
                  <div
                    key={`future-${item.id}-${item.startMs}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#3E2718] bg-[#1A0F0A] px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded bg-[#2B170E] px-1.5 py-0.5 font-mono text-[11px] text-[#E5C17B]">
                        {item.dateLabel} · {item.startTimeLabel}
                      </span>
                      <span className="truncate font-medium text-[#FAF3E3]">
                        {item.title}
                      </span>
                    </div>
                    {item.countdownLabel && (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#C9A87C]">
                        อีก {item.countdownLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

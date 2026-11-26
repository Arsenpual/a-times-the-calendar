import {
  AlertCircle,
  CheckCircle2,
  Droplets,
  Expand,
  HelpCircle,
  LampDesk,
  Menu,
  Moon,
  Sparkles,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { GameState, RoomZone, TimeOfDay } from '../types/game';

interface TopHudProps {
  zone: RoomZone;
  gameState: GameState;
  timeOfDay: TimeOfDay;
  muted: boolean;
  showHelp: boolean;
  navigationExpanded?: boolean;
  onToggleNavigation?: () => void;
  hasLoggedTodaySleep?: boolean;
  todaySleepLabel?: string | null;
  onOpenSleepQuest?: () => void;
  hasWateredPlantsToday?: boolean;
  todayPlantWaterLabel?: string | null;
  onFocusPlantQuest?: () => void;
  minaReadyReviewCount?: number;
  onOpenMinaReviewTasks?: () => void;
  onChangeTimeOfDay: (time: TimeOfDay) => void;
  onToggleMute: () => void;
  onToggleHelp: () => void;
  onToggleWorkspace: () => void;
  onToggleFullscreenMap?: () => void;
}

const TIME_OPTIONS: Array<{ id: TimeOfDay; label: string; icon: typeof Sun }> = [
  { id: 'morning', label: 'เช้า', icon: Sun },
  { id: 'afternoon', label: 'บ่าย', icon: Sunset },
  { id: 'evening', label: 'ค่ำ', icon: Moon },
];

export function TopHud({
  zone,
  gameState,
  timeOfDay,
  muted,
  showHelp,
  navigationExpanded = false,
  onToggleNavigation,
  hasLoggedTodaySleep = false,
  todaySleepLabel = null,
  onOpenSleepQuest,
  hasWateredPlantsToday = false,
  todayPlantWaterLabel = null,
  onFocusPlantQuest,
  minaReadyReviewCount = 0,
  onOpenMinaReviewTasks,
  onChangeTimeOfDay,
  onToggleMute,
  onToggleHelp,
  onToggleWorkspace,
  onToggleFullscreenMap,
}: TopHudProps) {
  const isWorking = gameState === 'WORKING';

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#2F2823] bg-[#181512] px-4 sm:px-6">
      {/* Left: App navigation toggle, brand & quiet unboxed zone indicator */}
      <div className="flex min-w-0 items-center gap-3">
        {onToggleNavigation && (
          <button
            type="button"
            onClick={onToggleNavigation}
            aria-expanded={navigationExpanded}
            aria-label={navigationExpanded ? 'ซ่อนแถบนำทางหลัก' : 'เปิดแถบนำทางหลัก'}
            title={navigationExpanded ? 'ซ่อนแถบนำทางหลัก' : 'เปิดแถบนำทางหลัก'}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#362E28] bg-[#221D19] text-[#D8CEC2] transition-colors hover:border-[#594B40] hover:text-[#FAF6F0]"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <span className="font-display shrink-0 whitespace-nowrap text-base font-bold tracking-tight text-[#FAF6F0]">
          Cozy Desk
        </span>
        <span aria-hidden="true" className="text-[#594E45]">
          ·
        </span>
        <span className="truncate text-sm font-medium text-[#D8CEC2]">
          {zone === 'office'
            ? 'ห้องทำงาน'
            : zone === 'gym'
              ? 'ห้องออกกำลังกาย'
              : zone === 'kitchen'
                ? 'ห้องครัว'
                : zone === 'bathroom'
                  ? 'ห้องน้ำ'
                  : zone === 'entryway'
                    ? 'โถงทางเข้า · ทางเดินหน้าบ้าน'
                    : zone === 'garage'
                      ? 'โรงจอดรถ (2 คัน)'
                      : zone === 'bedroom'
                        ? 'ห้องนอนใหญ่'
                        : 'ห้องพักผ่อน'}
        </span>
      </div>

      {/* Right: Functional controls only */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* AI scheduled Task review cue (shown when AI assistants have written summaries awaiting manual user check-off) */}
        {minaReadyReviewCount > 0 && onOpenMinaReviewTasks && (
          <button
            type="button"
            onClick={onOpenMinaReviewTasks}
            title={`ผู้ช่วย AI ทำงานตาม Task และเขียนสรุปลงโน้ตแล้ว ${minaReadyReviewCount} รายการ — กดเพื่อเปิดกระดาน Tasks ตรวจงานและติ๊กเสร็จ`}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#34D399]/70 bg-[#152B24] px-3 text-xs font-semibold tabular-nums text-[#A7F3D0] transition-colors duration-150 hover:border-[#34D399] hover:bg-[#1B372E]"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#34D399]" />
            <span>งาน AI รอตรวจ ({minaReadyReviewCount})</span>
          </button>
        )}

        {/* Daily 5-plant watering quest button (resets at local midnight 00:00) */}
        {onFocusPlantQuest && (
          <button
            type="button"
            onClick={onFocusPlantQuest}
            title={
              hasWateredPlantsToday
                ? `รดน้ำต้นไม้ทั้ง 5 ต้นแล้ววันนี้ (${todayPlantWaterLabel ?? 'เรียบร้อย'}) · รีเซ็ตอัตโนมัติตอนเที่ยงคืน 00:00 น.`
                : 'ภารกิจประจำวัน: ยังไม่ได้รดน้ำกระถางต้นไม้ 5 ต้นตรงโถงทางเข้า (อย่างน้อยวันละ 1 ครั้ง · รีเซ็ต 00:00 น.)'
            }
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium tabular-nums transition-colors duration-150 ${
              hasWateredPlantsToday
                ? 'border-[#275A47] bg-[#162720] text-[#A7F3D0] hover:border-[#34D399] hover:bg-[#1B3128]'
                : 'border-[#1E607D] bg-[#13232E] text-[#BAE6FD] hover:border-[#38BDF8] hover:bg-[#193040]'
            }`}
          >
            {hasWateredPlantsToday ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#34D399]" />
            ) : (
              <Droplets className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]" />
            )}
            <span>
              {hasWateredPlantsToday
                ? todayPlantWaterLabel
                  ? `รดน้ำแล้ว · ${todayPlantWaterLabel}`
                  : 'รดน้ำต้นไม้แล้ว'
                : 'ยังไม่ได้รดน้ำต้นไม้'}
            </span>
          </button>
        )}

        {/* Daily sleep upload quest button (resets at local midnight 00:00) */}
        {onOpenSleepQuest && (
          <button
            type="button"
            onClick={onOpenSleepQuest}
            title={
              hasLoggedTodaySleep
                ? `${todaySleepLabel ?? 'บันทึกการนอนวันนี้แล้ว'} · รีเซ็ตภารกิจอัตโนมัติตอนเที่ยงคืน 00:00 น.`
                : 'ยังไม่ได้อัปโหลดภาพการนอนวันนี้ (อย่างน้อยวันละ 1 ครั้ง · รีเซ็ต 00:00 น.)'
            }
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium tabular-nums transition-colors duration-150 ${
              hasLoggedTodaySleep
                ? 'border-[#275A47] bg-[#162720] text-[#A7F3D0] hover:border-[#34D399] hover:bg-[#1B3128]'
                : 'border-[#8C5A1B] bg-[#2B1F14] text-[#FDE68A] hover:border-[#F59E0B] hover:bg-[#382717]'
            }`}
          >
            {hasLoggedTodaySleep ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#34D399]" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#FBBF24]" />
            )}
            <span>
              {hasLoggedTodaySleep
                ? todaySleepLabel || 'บันทึกการนอนแล้ว'
                : 'ยังไม่ได้บันทึกการนอน'}
            </span>
          </button>
        )}

        {/* Time-of-day segmented control */}
        <div
          role="group"
          aria-label="เลือกช่วงเวลาแสงในบ้าน"
          className="hidden items-center gap-0.5 rounded-lg bg-[#241F1B] p-1 sm:flex"
        >
          {TIME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = timeOfDay === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeTimeOfDay(opt.id)}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-[#3A312A] text-[#FAF6F0]'
                    : 'text-[#A89C90] hover:text-[#FAF6F0]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* End conversation button (only visible while actively talking with Mina inside her radius) */}
        {isWorking && (
          <button
            type="button"
            onClick={onToggleWorkspace}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#473D35] bg-[#29231E] px-3.5 text-xs font-semibold text-[#FAF6F0] transition-colors duration-150 hover:bg-[#342C26]"
          >
            <LampDesk className="h-3.5 w-3.5" />
            <span>จบการสนทนา</span>
          </button>
        )}

        {/* Fullscreen full-map view toggle */}
        {onToggleFullscreenMap && (
          <button
            type="button"
            onClick={onToggleFullscreenMap}
            aria-label="แสดงแมพทั้งแมพแบบเต็มจอ"
            title="แสดงแมพทั้งแมพแบบเต็มจอ (F)"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#2F2823] bg-[#211C18] text-[#D8CEC2] transition-colors duration-150 hover:border-[#D97736] hover:text-[#FAF6F0]"
          >
            <Expand className="h-4 w-4" />
          </button>
        )}

        {/* Mute toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'เปิดเสียงเอฟเฟกต์' : 'ปิดเสียงเอฟเฟกต์'}
          title={muted ? 'เปิดเสียงเอฟเฟกต์' : 'ปิดเสียงเอฟเฟกต์'}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#2F2823] bg-[#211C18] text-[#D8CEC2] transition-colors duration-150 hover:border-[#473D35] hover:text-[#FAF6F0]"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        {/* Controls help toggle */}
        <button
          type="button"
          onClick={onToggleHelp}
          aria-label="ดูวิธีควบคุมเกม"
          title="วิธีควบคุมเกม"
          className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition-colors duration-150 ${
            showHelp
              ? 'border-[#D97736] bg-[#33271F] text-[#FAF6F0]'
              : 'border-[#2F2823] bg-[#211C18] text-[#D8CEC2] hover:border-[#473D35] hover:text-[#FAF6F0]'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

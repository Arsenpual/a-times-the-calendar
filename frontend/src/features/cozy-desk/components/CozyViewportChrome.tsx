import {
  Car,
  Coffee,
  Compass,
  Crosshair,
  Expand,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
} from '../game/houseMap';
import type {
  CameraCommand,
  CameraPresetId,
  CameraUiState,
  DrivingHudState,
  InteractableId,
  InteractableObject,
  PlayerSeatId,
  RoomZone,
  WorldToast,
} from '../types/game';
import { ASSETS } from '../types/game';
import { soundEngine } from '../lib/sound';

const CAMERA_PRESETS: Array<{ id: CameraPresetId; label: string; icon?: typeof Crosshair }> = [
  { id: 'follow', label: 'ตามตัว', icon: Crosshair },
  { id: 'overview', label: 'ทั้งบ้าน', icon: Maximize2 },
  { id: 'bedroom', label: 'ห้องนอน' },
  { id: 'living', label: 'พักผ่อน' },
  { id: 'office', label: 'ทำงาน' },
  { id: 'gym', label: 'ออกกำลังกาย' },
  { id: 'bathroom', label: 'ห้องน้ำ' },
  { id: 'kitchen', label: 'ครัว' },
  { id: 'entryway', label: 'ทางเข้า' },
  { id: 'garage', label: 'โรงจอดรถ' },
];

export function CozyCameraToolbar({
  cameraUi,
  onCommand,
  onEnterFullscreen,
}: {
  cameraUi: CameraUiState;
  onCommand: (cmd: CameraCommand) => void;
  onEnterFullscreen: () => void;
}) {
  return (
    <div className="mb-2.5 flex w-full flex-wrap items-center justify-between gap-2 px-1">
      <div
        role="group"
        aria-label="เลือกจุดโฟกัสกล้อง"
        className="flex flex-wrap items-center gap-1 rounded-lg border border-[#2F2823] bg-[#211C18] p-1"
      >
        {CAMERA_PRESETS.map((item) => {
          const Icon = item.icon;
          const active = cameraUi.activePreset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                soundEngine.playInteract();
                onCommand({ id: Date.now(), type: 'preset', preset: item.id });
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                active
                  ? 'bg-[#D97736] text-[#FAF6F0]'
                  : 'text-[#B8ABA0] hover:bg-[#2C251F] hover:text-[#FAF6F0]'
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <div
          role="group"
          aria-label="ปรับระดับการซูมแผนที่"
          className="flex items-center gap-1 rounded-lg border border-[#2F2823] bg-[#211C18] p-1"
        >
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onCommand({ id: Date.now(), type: 'zoom_step', delta: -0.18 });
            }}
            disabled={cameraUi.zoomPercent <= Math.round(CAMERA_MIN_ZOOM * 100)}
            aria-label="ซูมออก"
            title="ซูมออก (-)"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#D8CEC2] transition-colors hover:bg-[#2F2823] hover:text-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onCommand({ id: Date.now(), type: 'reset_zoom' });
            }}
            title="รีเซ็ตซูม 100%"
            className="min-w-[46px] cursor-pointer rounded-md px-1.5 py-0.5 text-center text-xs font-medium tabular-nums text-[#E5DCD0] transition-colors hover:bg-[#2F2823]"
          >
            {cameraUi.zoomPercent}%
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onCommand({ id: Date.now(), type: 'zoom_step', delta: 0.18 });
            }}
            disabled={cameraUi.zoomPercent >= Math.round(CAMERA_MAX_ZOOM * 100)}
            aria-label="ซูมเข้า"
            title="ซูมเข้า (+)"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#D8CEC2] transition-colors hover:bg-[#2F2823] hover:text-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onEnterFullscreen();
          }}
          aria-label="แสดงแมพทั้งแมพแบบเต็มจอ"
          title="แสดงแมพทั้งแมพแบบเต็มจอ (F)"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#2F2823] bg-[#211C18] px-2.5 text-xs font-medium text-[#D8CEC2] transition-colors duration-150 hover:border-[#D97736] hover:bg-[#2C241E] hover:text-[#FAF6F0]"
        >
          <Expand className="h-3.5 w-3.5" />
          <span>เต็มจอ</span>
        </button>
      </div>
    </div>
  );
}

export function CozyBottomActionBar({
  isWorking,
  playerSeat,
  drivingHud,
  workoutReps = 0,
  nearestInteractable,
  effectiveMailboxUnreadCount,
  hasLoggedTodaySleep,
  todaySleepHudLabel,
  hasWateredPlantsToday,
  todayPlantWaterLabel,
  zone,
  onClearSeat,
  onInteract,
}: {
  isWorking: boolean;
  playerSeat: PlayerSeatId | null;
  drivingHud: DrivingHudState | null;
  workoutReps?: number;
  nearestInteractable: InteractableObject | null;
  effectiveMailboxUnreadCount: number;
  hasLoggedTodaySleep: boolean;
  todaySleepHudLabel?: string | null;
  hasWateredPlantsToday: boolean;
  todayPlantWaterLabel: string | null;
  zone: RoomZone;
  onClearSeat: () => void;
  onInteract: (id: InteractableId) => void;
}) {
  return (
    <div className="mt-2.5 flex min-h-10 w-full flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#A89C90]">
      {!isWorking && playerSeat === 'green_car' ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playInteract();
              onClearSeat();
            }}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#D97736] px-3.5 py-2 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A]"
          >
            <span className="font-pixel rounded bg-[#231D19]/40 px-1.5 py-0.5 text-[10px]">E</span>
            <span>จอดและลงจากรถ</span>
          </button>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#3B4E4B] bg-[#1E2726] px-3 py-1.5 text-xs text-[#D6EAE6]">
            <Car className="h-3.5 w-3.5 text-[#7AC4BA]" />
            <span className="font-mono font-bold text-[#FDE68A]">{drivingHud?.gear ?? 'P'}</span>
            <span className="font-mono tabular-nums text-[#FAF6F0]">
              {drivingHud?.speedKmh ?? 0} km/h
            </span>
            <span className="hidden text-[#9BB7B3] md:inline">
              · W/S เดินหน้า–ถอยหลัง · A/D เลี้ยว · Space เบรก · H แตร
            </span>
          </div>
        </div>
      ) : !isWorking && playerSeat ? (
        <button
          type="button"
          onClick={() => {
            if (playerSeat === 'gym_barbell') {
              soundEngine.playBarbellRack();
            } else {
              soundEngine.playInteract();
            }
            onClearSeat();
          }}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#D97736] px-3.5 py-2 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A]"
        >
          <span className="font-pixel rounded bg-[#231D19]/40 px-1.5 py-0.5 text-[10px]">E</span>
          <span>
            {playerSeat === 'workdesk'
              ? 'กำลังนั่งหน้าคอมพิวเตอร์ — ลุกจากโต๊ะ'
              : playerSeat === 'sofa'
                ? 'กำลังนั่งพักบนโซฟา — ลุกจากโซฟา'
                : playerSeat === 'bedroom_bed'
                  ? 'กำลังนอนพักผ่อนบนเตียง (ปิดไฟห้องนอน) — ลุกจากเตียง'
                  : playerSeat === 'gym_barbell'
                    ? `กำลังยกน้ำหนักบาร์เบล${workoutReps > 0 ? ` (${workoutReps} ครั้ง)` : ''} — วางบาร์เบลลง`
                    : 'กำลังนั่งที่โต๊ะอาหารคริสต์มาส — ลุกจากเก้าอี้'}
          </span>
        </button>
      ) : !isWorking && nearestInteractable ? (
        <button
          type="button"
          onClick={() => onInteract(nearestInteractable.id)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#D97736] px-3.5 py-2 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A]"
        >
          <span className="font-pixel rounded bg-[#231D19]/40 px-1.5 py-0.5 text-[10px]">E</span>
          <span>
            {nearestInteractable.id === 'mailbox' && effectiveMailboxUnreadCount > 0
              ? `${nearestInteractable.label} — เปิดอ่าน Gmail (${effectiveMailboxUnreadCount} ข้อความใหม่)`
              : nearestInteractable.id === 'sleep_log'
                ? hasLoggedTodaySleep
                  ? `${nearestInteractable.label} — ${todaySleepHudLabel ?? 'บันทึกแล้ว'} · ดูผล/อัปโหลดเพิ่ม`
                  : `${nearestInteractable.label} — ยังไม่ได้บันทึกการนอนวันนี้ (อัปโหลด .json)`
                : nearestInteractable.id === 'porch_plants'
                  ? hasWateredPlantsToday
                    ? `${nearestInteractable.label} — รดน้ำแล้ววันนี้ (${todayPlantWaterLabel ?? 'สำเร็จ'}) · รดน้ำเพิ่มอีกครั้ง`
                    : `${nearestInteractable.label} — รดน้ำต้นไม้ทั้ง 5 ต้น (ภารกิจประจำวัน)`
                  : `${nearestInteractable.label} — ${nearestInteractable.actionLabel}`}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 text-[#B8ABA0]">
          <Compass className="h-3.5 w-3.5 text-[#D9A066]" />
          <span>
            {isWorking
              ? 'กำลังยืนสนทนากับมีน่า (กด Esc เพื่อจบการสนทนา)'
              : zone === 'living'
                ? 'นั่งพักบนโซฟา ดูทีวี YouTube เดินไปฝั่งซ้ายเข้าห้องนอนใหญ่ หรือเดินลงด้านล่างเข้าห้องครัว'
                : zone === 'office'
                  ? 'ห้องทำงาน — เดินเข้าใกล้ มีน่า, Antigravity หรือ Google AI Studio เพื่อคุยงาน หรือเดินลงด้านล่างเข้าห้องออกกำลังกาย'
                  : zone === 'gym'
                    ? 'ห้องออกกำลังกาย — กด E หรือคลิกที่แร็คบาร์เบลฝั่งซ้ายบนเพื่อยกน้ำหนัก หรือเดินสำรวจอุปกรณ์ออกกำลังกายรอบห้อง'
                    : zone === 'kitchen'
                      ? 'ห้องครัวครอบครัว — นั่งเก้าอี้โต๊ะอาหารทั้ง 4 ตัว เดินไปฝั่งซ้ายเข้าห้องน้ำ หรือเดินลงด้านล่างไปโถงทางเข้า'
                      : zone === 'entryway'
                        ? 'โถงทางเข้าและทางเดินหน้าบ้าน — รดน้ำกระถางต้นไม้ 5 ต้น (ภารกิจประจำวัน รีเซ็ต 00:00 น.) หรือเปิดตู้ไปรษณีย์ Gmail ริมถนน'
                        : zone === 'garage'
                          ? 'โรงจอดรถ 2 คัน — ช่องขวารถคันสีแดงไม่อยู่ (เหลือเส้นสีเหลือง) · ช่องซ้ายกด E หรือคลิกรถคันสีเขียวเพื่อขึ้นขับออกถนนได้'
                          : zone === 'bedroom'
                            ? 'ห้องนอนใหญ่ — นอนพักผ่อนบนเตียงคิงไซส์ (ปิดไฟห้องนอน & วิวกลางคืนหิมะตก) หรือบันทึกการนอน .json ที่โต๊ะข้างเตียงขวา'
                            : 'ห้องน้ำและห้องอาบน้ำ — วางเมาส์ค้างบนสิ่งของประมาณ 2 วินาที เพื่อดูชื่อและรายละเอียด'}
          </span>
        </div>
      )}

      <span className="hidden text-[#7D7065] sm:inline">
        คลิกซ้ายค้างแล้วลากเพื่อดึงดูรอบแมพ (ปล่อยเมาส์เพื่อกลับมาที่ตัวละคร) · สกรอลล์ซูม
      </span>
    </div>
  );
}

export function CozyFullscreenOverlays({
  isWorking,
  playerSeat,
  drivingHud,
  workoutReps = 0,
  nearestInteractable,
  effectiveMailboxUnreadCount,
  hasLoggedTodaySleep,
  todaySleepHudLabel,
  hasWateredPlantsToday,
  todayPlantWaterLabel,
  onExitFullscreen,
  onClearSeat,
  onInteract,
}: {
  isWorking: boolean;
  playerSeat: PlayerSeatId | null;
  drivingHud: DrivingHudState | null;
  workoutReps?: number;
  nearestInteractable: InteractableObject | null;
  effectiveMailboxUnreadCount: number;
  hasLoggedTodaySleep: boolean;
  todaySleepHudLabel?: string | null;
  hasWateredPlantsToday: boolean;
  todayPlantWaterLabel: string | null;
  onExitFullscreen: () => void;
  onClearSeat: () => void;
  onInteract: (id: InteractableId) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.blur();
          onExitFullscreen();
        }}
        aria-label="ออกจากมุมมองเต็มจอ"
        title="ออกจากมุมมองเต็มจอ (Esc / F)"
        className="absolute top-3 right-3 z-20 inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#3B3129] bg-[#181512]/75 px-2.5 text-xs font-medium text-[#FAF6F0] opacity-60 shadow-lg backdrop-blur-xs transition-all duration-150 hover:border-[#D97736] hover:bg-[#2E251F] hover:opacity-100"
      >
        <Minimize2 className="h-3.5 w-3.5" />
        <span>ออกจากเต็มจอ</span>
      </button>

      {!isWorking && (playerSeat || nearestInteractable) && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
          {playerSeat === 'green_car' ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[#3B4E4B] bg-[#1A2120]/90 p-1.5 shadow-xl backdrop-blur-xs">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playInteract();
                  onClearSeat();
                }}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-[#D97736] px-3 py-1.5 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A]"
              >
                <span className="font-pixel rounded bg-[#231D19]/40 px-1.5 py-0.5 text-[10px]">
                  E
                </span>
                <span>จอดและลงจากรถ</span>
              </button>
              <div className="flex items-center gap-2 px-2 text-xs text-[#D6EAE6]">
                <Car className="h-3.5 w-3.5 text-[#7AC4BA]" />
                <span className="font-mono font-bold text-[#FDE68A]">
                  {drivingHud?.gear ?? 'P'}
                </span>
                <span className="font-mono tabular-nums text-[#FAF6F0]">
                  {drivingHud?.speedKmh ?? 0} km/h
                </span>
                <span className="hidden text-[#9BB7B3] sm:inline">
                  · W/S เดินหน้า–ถอยหลัง · A/D เลี้ยว · Space เบรก · H แตร
                </span>
              </div>
            </div>
          ) : playerSeat ? (
            <button
              type="button"
              onClick={() => {
                if (playerSeat === 'gym_barbell') {
                  soundEngine.playBarbellRack();
                } else {
                  soundEngine.playInteract();
                }
                onClearSeat();
              }}
              className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#D97736] px-3.5 py-2 text-xs font-semibold text-[#FAF6F0] shadow-xl transition-colors hover:bg-[#C6682A]"
            >
              <span className="font-pixel rounded bg-[#231D19]/40 px-1.5 py-0.5 text-[10px]">
                E
              </span>
              <span>
                {playerSeat === 'workdesk'
                  ? 'กำลังนั่งหน้าคอมพิวเตอร์ — ลุกจากโต๊ะ'
                  : playerSeat === 'sofa'
                    ? 'กำลังนั่งพักบนโซฟา — ลุกจากโซฟา'
                    : playerSeat === 'bedroom_bed'
                      ? 'กำลังนอนพักผ่อนบนเตียง (ปิดไฟห้องนอน) — ลุกจากเตียง'
                      : playerSeat === 'gym_barbell'
                        ? `กำลังยกน้ำหนักบาร์เบล${workoutReps > 0 ? ` (${workoutReps} ครั้ง)` : ''} — วางบาร์เบลลง`
                        : 'กำลังนั่งที่โต๊ะอาหารคริสต์มาส — ลุกจากเก้าอี้'}
              </span>
            </button>
          ) : (
            nearestInteractable && (
              <button
                type="button"
                onClick={() => onInteract(nearestInteractable.id)}
                className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#D97736] px-3.5 py-2 text-xs font-semibold text-[#FAF6F0] shadow-xl transition-colors hover:bg-[#C6682A]"
              >
                <span className="font-pixel rounded bg-[#231D19]/40 px-1.5 py-0.5 text-[10px]">
                  E
                </span>
                <span>
                  {nearestInteractable.label} —{' '}
                  {nearestInteractable.id === 'mailbox' && effectiveMailboxUnreadCount > 0
                    ? `เปิดอ่าน Gmail (${effectiveMailboxUnreadCount} ข้อความใหม่)`
                    : nearestInteractable.id === 'sleep_log'
                      ? hasLoggedTodaySleep
                        ? `${todaySleepHudLabel ?? 'บันทึกการนอนแล้ว'} · ดูผล/อัปโหลดเพิ่ม`
                        : 'ยังไม่ได้บันทึกการนอนวันนี้ (อัปโหลด .json)'
                      : nearestInteractable.id === 'porch_plants'
                        ? hasWateredPlantsToday
                          ? `รดน้ำแล้ววันนี้ (${todayPlantWaterLabel ?? 'สำเร็จ'}) · รดน้ำเพิ่มอีกครั้ง`
                          : 'รดน้ำต้นไม้ทั้ง 5 ต้น (ภารกิจประจำวัน)'
                        : nearestInteractable.actionLabel}
                </span>
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

export function CozyWorldToastAndHelp({
  toast,
  showHelp,
  onCloseHelp,
}: {
  toast: WorldToast | null;
  showHelp: boolean;
  onCloseHelp: () => void;
}) {
  return (
    <>
      {toast && (
        <div
          role="status"
          className="pointer-events-none absolute top-5 left-1/2 z-20 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-[#4A3E35] bg-[#241E1A]/95 px-4 py-2.5 text-sm text-[#FAF6F0] shadow-xl backdrop-blur-xs"
        >
          {toast.speaker === 'player' ? (
            <img
              src={ASSETS.playerPortrait}
              alt=""
              referrerPolicy="no-referrer"
              className="pixelated h-7 w-7 shrink-0 rounded border border-[#5B4D42] object-cover"
            />
          ) : toast.speaker === 'mina' ? (
            <img
              src={ASSETS.minaPortrait}
              alt=""
              referrerPolicy="no-referrer"
              className="pixelated h-7 w-7 shrink-0 rounded border border-[#5B4D42] object-cover"
            />
          ) : (
            <Coffee className="h-4 w-4 shrink-0 text-[#D9A066]" />
          )}
          <span className="leading-snug">{toast.text}</span>
        </div>
      )}

      {showHelp && (
        <div className="absolute top-4 right-4 z-30 w-80 rounded-xl border border-[#443A32] bg-[#221D19]/96 p-5 text-sm text-[#E5DCD0] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#362E28] pb-3">
            <h3 className="font-display font-semibold text-[#FAF6F0]">คู่มือการเล่น Cozy Desk</h3>
            <button
              type="button"
              onClick={onCloseHelp}
              aria-label="ปิดคู่มือ"
              className="cursor-pointer rounded p-1 text-[#A89C90] hover:text-[#FAF6F0]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#CFC4B6]">
            <li>
              <strong className="text-[#FAF6F0]">WASD / ปุ่มลูกศร:</strong> เดินไปรอบห้องนอนใหญ่ ห้องพักผ่อน ห้องทำงาน ห้องออกกำลังกาย ห้องน้ำ ห้องครัว โถงทางเข้า โรงจอดรถ 2 คัน ทางเดินหน้าบ้าน และถนนหน้าบ้าน
            </li>
            <li>
              <strong className="text-[#FAF6F0]">คลิกบนพื้นหรือเฟอร์นิเจอร์:</strong> เดินไปยังจุดนั้นอัตโนมัติ (ข้ามประตูให้เอง)
            </li>
            <li>
              <strong className="text-[#FAF6F0]">ปุ่ม E หรือคลิกสิ่งของ:</strong> โต้ตอบกาแฟ โซฟา ทีวี (YouTube) กระดานโน้ต (Google Tasks) โต๊ะเอกสารกลางห้อง (Google Drive) ตู้ไปรษณีย์ริมถนน (Gmail) โต๊ะข้างเตียงห้องนอน (ภารกิจการนอน .json + AI) หน้าต่าง หรือชั้นหนังสือ
            </li>
            <li>
              <strong className="text-[#FAF6F0]">ทีม AI ในห้องทำงาน (มีน่า / Antigravity / Google AI Studio):</strong> เดินเข้าใกล้รัศมีตัวละครเพื่อดูป้ายสถานะ Token, งานที่กำลังทำ หรือเหตุผลเมื่อใช้งานไม่ได้ แล้วกด E หรือคลิกที่โต๊ะเพื่อเปิดใช้งาน
            </li>
            <li>
              <strong className="text-[#FAF6F0]">ซูมและเลือกจุดโฟกัสกล้อง:</strong> หมุนลูกกลิ้งเมาส์ (หรือปุ่ม +/-) เพื่อซูม, ลากบนแผนที่หรือคลิกขวาเพื่อเลือกจุดโฟกัสเอง, กด 0 ดูทั้งบ้าน, กด F แสดงแมพทั้งแมพแบบเต็มจอ หรือกด C เพื่อกลับมาตามตัวละคร
            </li>
            <li>
              <strong className="text-[#FAF6F0]">ขับรถคันสีเขียว (โรงจอดรถฝั่งซ้าย):</strong> เดินไปใกล้รถแล้วกด E หรือคลิกที่รถเพื่อขึ้นขับ — ใช้ W/S เดินหน้า–ถอยหลัง, A/D เลี้ยว, Space เบรก, H บีบแตร และขับออกไปจนสุดถนนฝั่งซ้ายหรือขวาเพื่อวนทะลุกลับมาอีกฝั่ง
            </li>
            <li>
              <strong className="text-[#FAF6F0]">สำรวจสิ่งของ (ห้องน้ำ / โรงจอดรถ):</strong> วางเมาส์ทาบค้างไว้บนวัตถุประมาณ 2 วินาที เพื่อแสดงชื่อและรายละเอียดของสิ่งนั้น
            </li>
            <li>
              <strong className="text-[#FAF6F0]">ปุ่ม Esc:</strong> จบการสนทนากลับไปเดินเล่นในบ้าน
            </li>
          </ul>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { ArrowRight, Keyboard, Menu, MousePointerClick, MessageSquare } from 'lucide-react';
import { ASSETS } from '../types/game';

interface TitleScreenProps {
  onStart: () => void;
  navigationExpanded?: boolean;
  onToggleNavigation?: () => void;
}

export function TitleScreen({
  onStart,
  navigationExpanded = false,
  onToggleNavigation,
}: TitleScreenProps) {
  const [bannerFailed, setBannerFailed] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 w-full items-center justify-center overflow-y-auto bg-[#1C1917] p-6">
      {onToggleNavigation && (
        <button
          type="button"
          onClick={onToggleNavigation}
          aria-expanded={navigationExpanded}
          aria-label={navigationExpanded ? 'ซ่อนแถบนำทางหลัก' : 'เปิดแถบนำทางหลัก'}
          title={navigationExpanded ? 'ซ่อนแถบนำทางหลัก' : 'เปิดแถบนำทางหลัก'}
          className="absolute top-4 left-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#473B32] bg-[#211C18]/90 text-[#E5DDD3] shadow-lg backdrop-blur-xs transition-colors hover:border-[#6B5A4D] hover:text-white"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      {/* Full-bleed cozy pixel house diorama background */}
      {!bannerFailed ? (
        <img
          src={ASSETS.homeBanner}
          alt="ฉากบ้านจำลอง 2D สไตล์ Pixel Art แบ่งเป็นห้องพักผ่อนและห้องทำงาน"
          referrerPolicy="no-referrer"
          onError={() => setBannerFailed(true)}
          className="pixelated pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#2B221B] via-[#1C1917] to-[#141210]"
        />
      )}

      {/* Measured contrast scrim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#171412] via-[#171412]/75 to-[#171412]/45"
      />

      <main className="relative z-10 w-full max-w-4xl">
        <div className="grid items-stretch gap-8 rounded-2xl border border-[#3B322B] bg-[#211C18]/92 p-8 shadow-2xl backdrop-blur-sm md:grid-cols-[1.35fr_1fr] md:p-10">
          {/* Left: Brand, Story & Single Primary Action */}
          <div className="flex flex-col justify-between gap-8">
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wide text-[#D9A066]">
                เกมจำลองชีวิตในบ้าน 2D · ห้องพักผ่อน &amp; ห้องทำงาน
              </p>
              <h1 className="font-display text-balance text-4xl font-bold tracking-tight text-[#FAF6F0] sm:text-5xl">
                Cozy Desk
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-[#D8CEC2]">
                พักผ่อนในมุมโซฟาอุ่นๆ ชงกาแฟ และเดินเข้าห้องทำงานไปนั่งโต๊ะคอมคู่กับ
                <span className="font-medium text-[#FAF6F0]"> มีน่า </span>
                ผู้ช่วย AI ที่พร้อมช่วยตอบคำถาม ระดมสมอง และร่างเอกสารจริงแบบเรียลไทม์
              </p>
            </div>

            <div className="space-y-6">
              {/* Control hints as clean scannable list */}
              <div className="grid gap-3 border-t border-[#362E28] pt-5 text-sm text-[#CFC4B6] sm:grid-cols-3">
                <div className="flex items-start gap-2.5">
                  <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-[#D97736]" />
                  <div>
                    <p className="font-medium text-[#FAF6F0]">WASD / ลูกศร</p>
                    <p className="text-xs text-[#A89C90]">เดินสำรวจในบ้าน</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-[#D97736]" />
                  <div>
                    <p className="font-medium text-[#FAF6F0]">คลิกพื้น / กด E</p>
                    <p className="text-xs text-[#A89C90]">เดินและโต้ตอบสิ่งของ</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#D97736]" />
                  <div>
                    <p className="font-medium text-[#FAF6F0]">โต๊ะห้องทำงาน</p>
                    <p className="text-xs text-[#A89C90]">คุยช่วยงานกับมีน่า</p>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={onStart}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#D97736] px-7 py-3 text-base font-semibold text-[#FAF6F0] transition-transform duration-150 hover:bg-[#C6682A] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5B841]"
                >
                  <span>เข้าสู่บ้าน</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Meet Mina Preview Card */}
          <div className="flex flex-col justify-between rounded-xl border border-[#3A312A] bg-[#29231E] p-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#4D4138] bg-[#1C1917]">
                {!portraitFailed ? (
                  <img
                    src={ASSETS.minaPortrait}
                    alt="ภาพพิกเซลของมีน่า ผู้ช่วย AI ประจำห้องทำงาน"
                    referrerPolicy="no-referrer"
                    onError={() => setPortraitFailed(true)}
                    className="pixelated h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-[#D9A066]">
                    มีน่า
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-[#A89C90]">ผู้ช่วยประจำโต๊ะทำงาน</p>
                <h2 className="font-display text-xl font-semibold text-[#FAF6F0]">มีน่า (Mina)</h2>
                <p className="mt-0.5 text-xs text-[#8BB5A7]">ประจำอยู่ที่ห้องทำงานฝั่งขวา</p>
              </div>
            </div>

            <blockquote className="mt-5 border-t border-[#3A312A] pt-4 text-sm leading-relaxed text-[#E3DACD]">
              “สวัสดีครับ วันนี้พักจิบกาแฟให้สบายก่อนได้เลยนะ ถ้าพร้อมลุยงานเมื่อไหร่ เดินมาหามีน่าที่โต๊ะทำงานได้ทันทีเลย”
            </blockquote>

            <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#A89C90]">
              <span>ถาม-ตอบช่วยงาน</span>
              <span aria-hidden="true">·</span>
              <span>ระดมสมองคิดไอเดีย</span>
              <span aria-hidden="true">·</span>
              <span>ร่างเอกสารพร้อมเก็บฉบับร่าง</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

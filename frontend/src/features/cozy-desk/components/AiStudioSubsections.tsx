import {
  Braces,
  Check,
  Copy,
  HardDriveUpload,
  Layers,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import type {
  AiStudioMessage,
  AiStudioMode,
  AiStudioModelId,
  AiStudioThinkingLevel,
  AssistantTaskDelivery,
  CharacterStatusSnapshot,
} from '../types/game';
import { cozyStorageKey } from '../api/cozyApi';
import { soundEngine } from '../lib/sound';

export const STORAGE_AISTUDIO_MESSAGES_KEY = 'cozy_desk_aistudio_messages_v1';
export const STORAGE_AISTUDIO_SYSINST_KEY = 'cozy_desk_aistudio_sysinst_v1';

export const QUOTA_PRESETS: Array<{ label: string; limit: number }> = [
  { label: '50k', limit: 50_000 },
  { label: '250k', limit: 250_000 },
  { label: '1M', limit: 1_000_000 },
];

export interface CharacterTaskActivityUpdate {
  busy: boolean;
  taskLabel: string | null;
  errorReason?: string | null;
  errorCode?: string | null;
}

export interface AiStudioModalProps {
  isOpen: boolean;
  statusSnapshot?: CharacterStatusSnapshot;
  incomingTaskDelivery?: AssistantTaskDelivery | null;
  onClose: () => void;
  onTaskActivityChange?: (activity: CharacterTaskActivityUpdate) => void;
  onBackgroundComplete?: (taskSummary: string) => void;
  onRefreshStatus?: () => void;
  onSaveToDrive?: (payload: { content: string; title?: string; assistantName: string }) => void;
}

export const STUDIO_MODES: Array<{
  id: AiStudioMode;
  label: string;
  icon: typeof Sparkles;
  placeholder: string;
  starters: string[];
}> = [
  {
    id: 'prompt',
    label: 'Prompt Lab',
    icon: Sparkles,
    placeholder: 'พิมพ์ Prompt เพื่อทดลอง รีไรต์ หรือให้ Google AI Studio ช่วยปรับโครงสร้าง...',
    starters: [
      'ช่วยออกแบบ Prompt สำหรับสรุปรายงานประชุมภาษาไทยให้ได้ Action Items ชัดเจน',
      'ช่วยปรับ Prompt นี้ให้ได้คำตอบที่กระชับและมีตัวอย่างประกอบมากขึ้น',
      'แนะนำเทคนิคเขียน System Instruction ให้ AI ตอบสม่ำเสมอไม่หลุดบทบาท',
    ],
  },
  {
    id: 'build',
    label: 'App Builder',
    icon: Layers,
    placeholder: 'บอกไอเดียฟีเจอร์หรือต้นแบบแอพที่อยากให้ AI Studio ช่วยวางโครงสร้าง...',
    starters: [
      'ออกแบบฟีเจอร์ปฏิทินวางแผนงานรายสัปดาห์ในห้องทำงาน Cozy Desk',
      'วางโครงสร้างคอมโพเนนต์ React + TypeScript สำหรับกระดานโน้ตแบบลากวาง',
      'ช่วยคิดระบบ AI Workflow ที่เชื่อม Google Drive และ Google Tasks เข้าด้วยกัน',
    ],
  },
  {
    id: 'schema',
    label: 'JSON & Schema',
    icon: Braces,
    placeholder: 'ระบุข้อมูลที่อยากสกัดหรือจัดโครงสร้างเป็น JSON Schema / TypeScript...',
    starters: [
      'สร้าง JSON Schema สำหรับสกัดข้อมูลใบเสร็จ (ชื่อร้าน วันที่ รายการ ยอดรวม)',
      'ออกแบบ Response Schema สำหรับแผนทริปท่องเที่ยว 3 วันพร้อมงบประมาณ',
      'แปลงโครงสร้างโปรไฟล์ตัวละคร NPC ในบ้าน 2D เป็น TypeScript Interface และ JSON ตัวอย่าง',
    ],
  },
];

export const MODEL_OPTIONS: Array<{
  id: AiStudioModelId;
  label: string;
  note: string;
}> = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Flash',
    note: 'สมดุลความเร็วและความฉลาด',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    note: 'ตอบไวพิเศษ ประหยัดโควต้า',
  },
];

export const THINKING_OPTIONS: Array<{ id: AiStudioThinkingLevel; label: string }> = [
  { id: 'LOW', label: 'Low' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HIGH', label: 'High' },
];

export const SYSTEM_PRESETS: Array<{ label: string; value: string }> = [
  {
    label: 'Prompt Engineer',
    value:
      'ช่วยวิเคราะห์จุดแข็ง-จุดอ่อนของ Prompt แล้วเสนอเวอร์ชันปรับปรุงที่ชัดเจน พร้อมตัวอย่างผลลัพธ์',
  },
  {
    label: 'React Architect',
    value:
      'เน้นโครงสร้าง React + TypeScript + Tailwind CSS ที่สะอาด แบ่งคอมโพเนนต์ชัด และจัดการ Edge Case ครบถ้วน',
  },
  {
    label: 'UX Writer (TH)',
    value:
      'ใช้ภาษาไทยที่เป็นธรรมชาติ อ่านง่าย สุภาพ กระชับ เหมาะกับปุ่ม ข้อความแจ้งเตือน และหน้าจอแอพยุคใหม่',
  },
];

export function loadSavedMessages(): AiStudioMessage[] {
  try {
    const raw = localStorage.getItem(cozyStorageKey(STORAGE_AISTUDIO_MESSAGES_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiStudioMessage[]) : [];
  } catch {
    return [];
  }
}

export function loadSavedSystemInstruction(): string {
  try {
    return localStorage.getItem(cozyStorageKey(STORAGE_AISTUDIO_SYSINST_KEY)) || '';
  } catch {
    return '';
  }
}

export function renderFormattedText(text: string) {
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments.map((segment, idx) => {
    if (segment.startsWith('```') && segment.endsWith('```')) {
      const inner = segment.slice(3, -3);
      const firstNewline = inner.indexOf('\n');
      const lang = firstNewline > -1 ? inner.slice(0, firstNewline).trim() : '';
      const code = firstNewline > -1 ? inner.slice(firstNewline + 1) : inner;
      return (
        <div
          key={idx}
          className="my-2.5 overflow-hidden rounded-lg border border-[#2B3752] bg-[#0B0F1A]"
        >
          {lang && (
            <div className="border-b border-[#1E273D] bg-[#111726] px-3 py-1 font-mono text-[11px] text-[#93C5FD]">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-[#E2E8F0]">
            <code>{code.trimEnd()}</code>
          </pre>
        </div>
      );
    }

    return (
      <div key={idx} className="whitespace-pre-wrap break-words leading-relaxed">
        {segment}
      </div>
    );
  });
}

export function formatCompactTokens(n: number): string {
  const safe = Math.max(0, Math.round(n));
  if (safe >= 1_000_000) {
    const m = safe / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (safe >= 1_000) {
    const k = safe / 1_000;
    return `${k >= 100 || k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(safe);
}

export function formatResetTime(resetAtMs: number): string {
  const d = new Date(resetAtMs);
  if (Number.isNaN(d.getTime())) return '--:-- น.';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
}

export function summarizePrompt(raw: string, fallback: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

export interface AiStudioMessagesViewportProps {
  messages: AiStudioMessage[];
  currentModelConfig: { id: AiStudioModelId; label: string; note: string };
  currentModeConfig: { id: AiStudioMode; label: string; starters: string[] };
  copiedId: string | null;
  error: string | null;
  endRef: React.RefObject<HTMLDivElement | null>;
  onSend: (text?: string) => void;
  onRetry: () => void;
  onCopy: (id: string, text: string) => Promise<void>;
  onSaveToDrive?: (payload: { content: string; title?: string; assistantName: string }) => void;
}

export function AiStudioMessagesViewport({
  messages,
  currentModelConfig,
  currentModeConfig,
  copiedId,
  error,
  endRef,
  onSend,
  onRetry,
  onCopy,
  onSaveToDrive,
}: AiStudioMessagesViewportProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      {messages.length === 0 ? (
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#324A7A] bg-[#19233D]">
            <Sparkles className="h-6 w-6 text-[#60A5FA]" />
          </div>
          <h3 className="font-display mt-4 text-lg font-semibold text-[#F8FAFC]">
            ยินดีต้อนรับสู่สถานี Google AI Studio
          </h3>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-[#94A3B8]">
            ทดลองเขียน Prompt, วางโครงสร้างต้นแบบเว็บแอพ หรือออกแบบ JSON Schema ร่วมกับโมเดล{' '}
            {currentModelConfig.label} ({currentModelConfig.note})
          </p>

          <div className="mt-6 grid w-full grid-cols-1 gap-2.5 text-left">
            {currentModeConfig.starters.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => onSend(starter)}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#24314E] bg-[#171E30] px-4 py-3 text-left text-xs leading-relaxed text-[#E2E8F0] transition-colors hover:border-[#4285F4] hover:bg-[#1D2842]"
              >
                <span>{starter}</span>
                <Send className="h-3.5 w-3.5 shrink-0 text-[#64748B] transition-colors group-hover:text-[#60A5FA]" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const modeLabel =
              STUDIO_MODES.find((m) => m.id === msg.mode)?.label ?? 'Prompt Lab';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-[#94A3B8]">
                  <span>{isUser ? 'คุณ' : 'Google AI Studio'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{modeLabel}</span>
                  {!isUser && msg.model && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[10px] text-[#64748B]">{msg.model}</span>
                    </>
                  )}
                </div>

                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                    isUser
                      ? 'bg-[#2563EB] text-white'
                      : 'border border-[#24314E] bg-[#171E30] text-[#E2E8F0]'
                  }`}
                >
                  {msg.content ? (
                    renderFormattedText(msg.content)
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-[#93C5FD]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Google AI Studio กำลังประมวลผล...</span>
                    </div>
                  )}

                  {!isUser && msg.content && (
                    <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-[#23304D] pt-2">
                      {onSaveToDrive && (
                        <button
                          type="button"
                          onClick={() =>
                            onSaveToDrive({
                              content: msg.content,
                              assistantName: 'Google AI Studio',
                            })
                          }
                          title="แปลงเป็น Google Docs, Google Sheets หรือ Markdown แล้วบันทึกลง Google Drive"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-[#93C5FD] transition-colors hover:bg-[#222D47] hover:text-white"
                        >
                          <HardDriveUpload className="h-3.5 w-3.5" />
                          <span>ลง Docs / Sheets</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onCopy(msg.id, msg.content)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-[#94A3B8] transition-colors hover:bg-[#222D47] hover:text-white"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#34D399]" />
                            <span className="text-[#34D399]">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>คัดลอกคำตอบ</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-[#7F1D1D] bg-[#2A1519] px-4 py-3 text-xs text-[#FCA5A5]"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#991B1B] bg-[#3F1D23] px-3 py-1.5 font-medium text-[#FECACA] hover:bg-[#52232B]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>ส่งใหม่</span>
              </button>
            </div>
          )}

          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

import { Check, Code2, Copy, FileCode2, FolderGit2, HardDriveUpload, Loader2, RotateCcw, Sparkles, Terminal } from 'lucide-react';
import type {
  AntigravityMessage,
  AntigravityMode,
  AssistantTaskDelivery,
  CharacterStatusSnapshot,
} from '../types/game';
import type { CharacterTaskActivityUpdate } from './AiStudioModal';
import { cozyStorageKey } from '../api/cozyApi';

export const STORAGE_AGY_MESSAGES_KEY = 'cozy_desk_antigravity_messages_v1';
export const STORAGE_AGY_ENDPOINT_KEY = 'cozy_desk_antigravity_endpoint_v1';
export const DEFAULT_LOCAL_ENDPOINT = '/api/cozy-desk/antigravity/chat';

export interface AntigravityStatus {
  ok: boolean;
  agent: string;
  host: string;
  endpoint: string;
  workspace: string;
  model: string;
  fileCount: number;
  files: string[];
}

export interface AntigravityModalProps {
  isOpen: boolean;
  statusSnapshot?: CharacterStatusSnapshot;
  incomingTaskDelivery?: AssistantTaskDelivery | null;
  onClose: () => void;
  onTaskActivityChange?: (activity: CharacterTaskActivityUpdate) => void;
  onBackgroundComplete?: (taskSummary: string) => void;
  onRefreshStatus?: () => void;
  onSaveToDrive?: (payload: { content: string; title?: string; assistantName: string }) => void;
}

export const AGY_MODES: Array<{
  id: AntigravityMode;
  label: string;
  icon: typeof Code2;
  placeholder: string;
  starters: string[];
}> = [
  {
    id: 'code',
    label: 'โค้ด & แก้บัค',
    icon: Code2,
    placeholder: 'ถามเรื่องโค้ด ตรวจสอบบัค หรือให้ Antigravity ช่วยเขียนโค้ด...',
    starters: [
      'ช่วยตรวจสอบโครงสร้างโค้ดใน src/App.tsx และแนะนำจุดที่ช่วยให้ทำงานเสถียรขึ้น',
      'ช่วยอธิบายระบบกล้องและการลากแมพใน src/components/GameCanvas.tsx',
      'ขอแนวทางป้องกัน Memory Leak ใน React 19 + Canvas 60fps loop',
    ],
  },
  {
    id: 'workspace',
    label: 'สำรวจไฟล์โปรเจกต์',
    icon: FolderGit2,
    placeholder: 'ระบุชื่อไฟล์หรือส่วนของแอพบน localhost ที่อยากให้สำรวจ...',
    starters: [
      'สรุปโครงสร้างไฟล์ทั้งหมดในโปรเจกต์นี้และหน้าที่ของแต่ละส่วนให้หน่อย',
      'ไฟล์ src/game/houseMap.ts กับ src/game/pixelRenderer.ts เชื่อมกันอย่างไร?',
      'เซิร์ฟเวอร์ใน server.ts มี API endpoints อะไรบ้าง?',
    ],
  },
  {
    id: 'arch',
    label: 'สถาปัตยกรรม & CLI',
    icon: Terminal,
    placeholder: 'ถามเกี่ยวกับการรัน localhost, สถาปัตยกรรมระบบ หรือคำสั่ง CLI...',
    starters: [
      'อธิบายการทำงานของ Express + Vite middleware บน localhost:3000 ใน server.ts',
      'ถ้าต้องการเพิ่ม NPC หรือเฟอร์นิเจอร์ชิ้นใหม่ในบ้าน ต้องแก้ไฟล์ไหนบ้างตามลำดับ?',
      'แนะนำวิธีใช้งาน Antigravity CLI (agy) และ Python SDK ร่วมกับโปรเจกต์นี้',
    ],
  },
];

export function loadSavedMessages(): AntigravityMessage[] {
  try {
    const raw = localStorage.getItem(cozyStorageKey(STORAGE_AGY_MESSAGES_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AntigravityMessage[]) : [];
  } catch {
    return [];
  }
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

export function AntigravityChatTranscript({
  messages,
  currentModeConfig,
  copiedId,
  error,
  endRef,
  handleSend,
  handleRetry,
  handleCopy,
  onSaveToDrive,
}: any) {
  return (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#38BDF8]/40 bg-[#182238] text-[#38BDF8] shadow-lg">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="font-display mt-3 text-base font-bold text-[#F8FAFC]">
                สวัสดีครับ! ผมคือ Antigravity ประจำสถานี Localhost
              </h3>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#94A3B8]">
                คุณสามารถเลือกคลิกไฟล์ของแอพด้านบนเพื่อให้อ่านโค้ดจริงบนเครื่อง หรือเลือกคำสั่งตัวอย่างด้านล่างเพื่อเริ่มคุยได้เลยครับ
              </p>

              <div className="mt-5 flex w-full max-w-xl flex-col gap-2">
                {currentModeConfig.starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => handleSend(starter)}
                    className="cursor-pointer rounded-xl border border-[#26334D] bg-[#172033] px-4 py-2.5 text-left text-xs text-[#CBD5E1] transition-colors hover:border-[#38BDF8] hover:bg-[#1C2840] hover:text-[#F8FAFC]"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed sm:text-sm ${
                      isUser
                        ? 'bg-[#0284C7] text-[#F8FAFC]'
                        : 'border border-[#26334D] bg-[#161F30] text-[#E2E8F0]'
                    }`}
                  >
                    {!isUser && msg.inspectedFiles && msg.inspectedFiles.length > 0 && (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-[#26334D] pb-2 text-[11px] text-[#7DD3FC]">
                        <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                        <span>อ่านไฟล์บน localhost:</span>
                        {msg.inspectedFiles.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-[#0F172A] px-1.5 py-0.5 font-mono text-[10px] text-[#38BDF8]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.content ? (
                      <div className="whitespace-pre-wrap break-words font-sans">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-[#7DD3FC]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Antigravity กำลังประมวลผลผ่าน localhost...</span>
                      </div>
                    )}

                    {!isUser && msg.content && (
                      <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-[#232F46] pt-2">
                        {onSaveToDrive && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveToDrive({
                                content: msg.content,
                                assistantName: 'Antigravity',
                              })
                            }
                            title="แปลงเป็น Google Docs, Google Sheets หรือ Markdown แล้วบันทึกลง Google Drive"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#7DD3FC] transition-colors hover:bg-[#222E47] hover:text-[#BAE6FD]"
                          >
                            <HardDriveUpload className="h-3 w-3" />
                            <span>ลง Docs / Sheets</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleCopy(msg.id, msg.content)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#94A3B8] transition-colors hover:bg-[#222E47] hover:text-[#F8FAFC]"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-[#34D399]" />
                              <span className="text-[#34D399]">คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>คัดลอก</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {error && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#EF4444]/40 bg-[#451A1A]/60 px-4 py-3 text-xs text-[#FCA5A5]">
              <span>{error}</span>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#7F1D1D] px-3 py-1.5 font-semibold text-[#FEF2F2] hover:bg-[#991B1B]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>ลองใหม่</span>
              </button>
            </div>
          )}

          <div ref={endRef} />
        </div>

  );
}

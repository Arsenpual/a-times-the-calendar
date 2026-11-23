import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Braces,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  HardDriveUpload,
  Layers,
  Loader2,
  Minimize2,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AiStudioMessage,
  AiStudioMode,
  AiStudioModelId,
  AiStudioThinkingLevel,
  AssistantTaskDelivery,
  CharacterStatusSnapshot,
} from '../types/game';
import { formatTaskDeliveryChatMessage } from '../utils/minaTaskScheduler';
import { cozyApiFetch, cozyStorageKey } from '../utils/cozyApi';
import { soundEngine } from '../utils/sound';

const STORAGE_AISTUDIO_MESSAGES_KEY = 'cozy_desk_aistudio_messages_v1';
const STORAGE_AISTUDIO_SYSINST_KEY = 'cozy_desk_aistudio_sysinst_v1';

const QUOTA_PRESETS: Array<{ label: string; limit: number }> = [
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

interface AiStudioModalProps {
  isOpen: boolean;
  statusSnapshot?: CharacterStatusSnapshot;
  incomingTaskDelivery?: AssistantTaskDelivery | null;
  onClose: () => void;
  onTaskActivityChange?: (activity: CharacterTaskActivityUpdate) => void;
  onBackgroundComplete?: (taskSummary: string) => void;
  onRefreshStatus?: () => void;
  onSaveToDrive?: (payload: { content: string; title?: string; assistantName: string }) => void;
}

const STUDIO_MODES: Array<{
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

const MODEL_OPTIONS: Array<{
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

const THINKING_OPTIONS: Array<{ id: AiStudioThinkingLevel; label: string }> = [
  { id: 'LOW', label: 'Low' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HIGH', label: 'High' },
];

const SYSTEM_PRESETS: Array<{ label: string; value: string }> = [
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

function loadSavedMessages(): AiStudioMessage[] {
  try {
    const raw = localStorage.getItem(cozyStorageKey(STORAGE_AISTUDIO_MESSAGES_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiStudioMessage[]) : [];
  } catch {
    return [];
  }
}

function loadSavedSystemInstruction(): string {
  try {
    return localStorage.getItem(cozyStorageKey(STORAGE_AISTUDIO_SYSINST_KEY)) || '';
  } catch {
    return '';
  }
}

function renderFormattedText(text: string) {
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

function formatCompactTokens(n: number): string {
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

function formatResetTime(resetAtMs: number): string {
  const d = new Date(resetAtMs);
  if (Number.isNaN(d.getTime())) return '--:-- น.';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
}

function summarizePrompt(raw: string, fallback: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

export function AiStudioModal({
  isOpen,
  statusSnapshot,
  incomingTaskDelivery = null,
  onClose,
  onTaskActivityChange,
  onBackgroundComplete,
  onRefreshStatus,
  onSaveToDrive,
}: AiStudioModalProps) {
  const [mode, setMode] = useState<AiStudioMode>('prompt');
  const [model, setModel] = useState<AiStudioModelId>('gemini-4-hydrogen');
  const [thinkingLevel, setThinkingLevel] = useState<AiStudioThinkingLevel>('MEDIUM');
  const [systemInstruction, setSystemInstruction] = useState<string>(loadSavedSystemInstruction);
  const [showSystemConfig, setShowSystemConfig] = useState(false);
  const [isUpdatingQuota, setIsUpdatingQuota] = useState(false);

  const [messages, setMessages] = useState<AiStudioMessage[]>(loadSavedMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastDeliveredTaskIdRef = useRef<number | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    if (
      !incomingTaskDelivery ||
      incomingTaskDelivery.assistantId !== 'ai_studio' ||
      incomingTaskDelivery.id === lastDeliveredTaskIdRef.current
    ) {
      return;
    }
    lastDeliveredTaskIdRef.current = incomingTaskDelivery.id;
    const formatted = formatTaskDeliveryChatMessage(incomingTaskDelivery);
    setMessages((prev) => [
      ...prev,
      {
        id: `aistudio-task-${incomingTaskDelivery.id}`,
        role: 'assistant',
        content: formatted,
        mode: 'prompt',
        model,
        createdAt: Date.now(),
      },
    ]);
    if (!incomingTaskDelivery.success && incomingTaskDelivery.errorMessage) {
      setError(incomingTaskDelivery.errorMessage);
    }
  }, [incomingTaskDelivery, model]);

  const callbacksRef = useRef({
    onTaskActivityChange,
    onBackgroundComplete,
    onRefreshStatus,
  });
  callbacksRef.current = {
    onTaskActivityChange,
    onBackgroundComplete,
    onRefreshStatus,
  };

  const currentModeConfig = STUDIO_MODES.find((m) => m.id === mode) ?? STUDIO_MODES[0];
  const currentModelConfig = MODEL_OPTIONS.find((m) => m.id === model) ?? MODEL_OPTIONS[0];

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(cozyStorageKey(STORAGE_AISTUDIO_MESSAGES_KEY), JSON.stringify(messages.slice(-30)));
    } catch {
      // Ignore storage quota errors
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(cozyStorageKey(STORAGE_AISTUDIO_SYSINST_KEY), systemInstruction);
    } catch {
      // Ignore storage quota errors
    }
  }, [systemInstruction]);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isStreaming]);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen, mode]);

  const streamResponse = useCallback(
    async (
      historyToSend: AiStudioMessage[],
      activeMode: AiStudioMode,
      activeModel: AiStudioModelId,
      activeThinking: AiStudioThinkingLevel,
      customSysInst: string
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantMsgId = `aistudio-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          mode: activeMode,
          model: activeModel,
          createdAt: Date.now(),
        },
      ]);

      setIsStreaming(true);
      setError(null);

      const latestUserPrompt =
        [...historyToSend].reverse().find((m) => m.role === 'user')?.content ?? '';
      const taskSummary = summarizePrompt(
        latestUserPrompt,
        activeMode === 'build'
          ? 'ออกแบบต้นแบบแอพ'
          : activeMode === 'schema'
            ? 'สร้าง JSON Schema'
            : 'ทดลอง Prompt Lab'
      );
      callbacksRef.current.onTaskActivityChange?.({
        busy: true,
        taskLabel: taskSummary,
        errorReason: null,
        errorCode: null,
      });

      let accumulated = '';
      let succeeded = false;

      try {
        const res = await cozyApiFetch('/api/aistudio/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: historyToSend.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            mode: activeMode,
            model: activeModel,
            thinkingLevel: activeThinking,
            systemInstruction: customSysInst,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errMsg = 'ไม่สามารถเชื่อมต่อกับ Google AI Studio ได้ในขณะนี้';
          try {
            const payload = (await res.json()) as { error?: string };
            if (payload.error) errMsg = payload.error;
          } catch {
            // Keep default message
          }
          throw new Error(errMsg);
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error('ไม่พบสตรีมข้อมูลตอบกลับจาก Google AI Studio');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const rawEvent of events) {
            const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            const parsed = JSON.parse(dataLine.slice(6)) as {
              type: 'chunk' | 'done' | 'error' | 'usage';
              text?: string;
              error?: string;
            };

            if (parsed.type === 'error') {
              throw new Error(parsed.error || 'เกิดข้อผิดพลาดจาก Google AI Studio');
            }

            if (parsed.type === 'usage') {
              callbacksRef.current.onRefreshStatus?.();
            }

            if (parsed.type === 'chunk' && parsed.text) {
              accumulated += parsed.text;
              const nextContent = accumulated;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: nextContent } : m))
              );
            }
          }
        }

        if (!accumulated.trim()) {
          throw new Error('ไม่ได้รับข้อความตอบกลับจาก Google AI Studio กรุณาลองส่งใหม่อีกครั้ง');
        }

        succeeded = true;
        soundEngine.playMessageReceived();
        callbacksRef.current.onTaskActivityChange?.({
          busy: false,
          taskLabel: null,
          errorReason: null,
          errorCode: null,
        });
        if (!isOpenRef.current) {
          callbacksRef.current.onBackgroundComplete?.(taskSummary);
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') {
          callbacksRef.current.onTaskActivityChange?.({
            busy: false,
            taskLabel: null,
            errorReason: null,
            errorCode: null,
          });
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google AI Studio';
        setError(message);
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId || m.content.trim().length > 0));
        callbacksRef.current.onTaskActivityChange?.({
          busy: false,
          taskLabel: null,
          errorReason: message,
          errorCode: null,
        });
      } finally {
        setIsStreaming(false);
        if (succeeded || !controller.signal.aborted) {
          callbacksRef.current.onRefreshStatus?.();
        }
      }
    },
    []
  );

  const handleSend = (rawText?: string) => {
    const trimmed = (rawText ?? input).trim();
    if (!trimmed || isStreaming) return;
    soundEngine.playInteract();

    const userMsg: AiStudioMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      mode,
      model,
      createdAt: Date.now(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    void streamResponse(nextHistory, mode, model, thinkingLevel, systemInstruction);
  };

  const handleRetry = () => {
    if (isStreaming || messages.length === 0) return;
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const trimmedHistory = messages.slice(0, actualIdx + 1);
    setMessages(trimmedHistory);
    void streamResponse(trimmedHistory, mode, model, thinkingLevel, systemInstruction);
  };

  const handleClear = () => {
    abortRef.current?.abort();
    soundEngine.playInteract();
    setIsStreaming(false);
    setMessages([]);
    setError(null);
    callbacksRef.current.onTaskActivityChange?.({
      busy: false,
      taskLabel: null,
      errorReason: null,
      errorCode: null,
    });
  };

  const handleUpdateQuota = async (payload: { dailyLimit?: number; resetUsage?: boolean }) => {
    setIsUpdatingQuota(true);
    soundEngine.playInteract();
    try {
      await cozyApiFetch('/api/characters/quota-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      callbacksRef.current.onRefreshStatus?.();
    } catch {
      // Ignore transient network errors
    } finally {
      setIsUpdatingQuota(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1600);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="เวิร์กเบนช์ตัวละคร Google AI Studio"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-3 backdrop-blur-xs sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2B3B5E] bg-[#121622] text-[#EFF6FF] shadow-2xl">
        {/* Top Header */}
        <header className="flex items-center justify-between gap-4 border-b border-[#232F4A] bg-[#171D2E] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            {/* Pixel-style Google AI Studio Character Avatar */}
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#3B5998] bg-[#1A2542]"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
                  fill="#60A5FA"
                />
                <path
                  d="M12 6L13.3 10.7L18 12L13.3 13.3L12 18L10.7 13.3L6 12L10.7 10.7L12 6Z"
                  fill="#EFF6FF"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-semibold text-[#F8FAFC]">
                Google AI Studio
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#94A3B8]">
                <span>{currentModelConfig.label}</span>
                {model === 'gemini-4-hydrogen' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Thinking {thinkingLevel}</span>
                  </>
                )}
                {statusSnapshot && (
                  <>
                    <span aria-hidden="true">·</span>
                    {statusSnapshot.status === 'unavailable' ? (
                      <span className="font-medium text-[#FCA5A5]">
                        ใช้งานไม่ได้ ({statusSnapshot.unavailableReason || 'ระบบไม่พร้อม'})
                      </span>
                    ) : statusSnapshot.status === 'busy' ? (
                      <span className="font-medium text-[#FDE68A]">
                        กำลังทำงาน: {statusSnapshot.currentTask || 'ประมวลผลคำสั่ง'}
                      </span>
                    ) : (
                      <span className="tabular-nums text-[#BFDBFE]">
                        เหลือ {formatCompactTokens(statusSnapshot.tokensRemaining)}/
                        {formatCompactTokens(statusSnapshot.tokensLimit)} Token · รีเซ็ต{' '}
                        {formatResetTime(statusSnapshot.resetAt)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isStreaming && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playInteract();
                  onClose();
                }}
                title="พับหน้าต่างเพื่อดูตัวละครทำงานบนแผนที่ห้องทำงาน"
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#F59E0B]/50 bg-[#2C2012] px-3 py-1.5 text-xs font-medium text-[#FDE68A] transition-colors hover:border-[#F59E0B] hover:bg-[#3A2A15]"
              >
                <Minimize2 className="h-3.5 w-3.5 shrink-0" />
                <span>พับดูตัวละคร</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.playInteract();
                setShowSystemConfig((v) => !v);
              }}
              aria-expanded={showSystemConfig}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                showSystemConfig || systemInstruction.trim().length > 0
                  ? 'border-[#4285F4] bg-[#1E325C] text-[#DBEAFE]'
                  : 'border-[#2A3754] bg-[#1D2538] text-[#CBD5E1] hover:border-[#3E5380] hover:text-white'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span>ตั้งค่า Lab</span>
              {showSystemConfig ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                title="ล้างประวัติการทดลอง"
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#2A3754] bg-[#1D2538] px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] transition-colors hover:border-[#64748B] hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">ล้างแชท</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง Google AI Studio"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#2A3754] bg-[#1D2538] text-[#CBD5E1] transition-colors hover:border-[#60A5FA] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Workbench Controls Strip: Mode Tabs + Model & Thinking Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202B42] bg-[#141A29] px-5 py-2.5">
          <div
            role="tablist"
            aria-label="โหมดเวิร์กเบนช์ Google AI Studio"
            className="flex items-center gap-1 rounded-lg bg-[#0D111C] p-1"
          >
            {STUDIO_MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    soundEngine.playInteract();
                    setMode(m.id);
                  }}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#94A3B8] hover:bg-[#192236] hover:text-[#E2E8F0]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 text-[#94A3B8]">
              <span className="whitespace-nowrap">โมเดล</span>
              <select
                value={model}
                onChange={(e) => {
                  soundEngine.playInteract();
                  setModel(e.target.value as AiStudioModelId);
                }}
                aria-label="เลือกโมเดล Gemini"
                className="cursor-pointer rounded-md border border-[#2A3754] bg-[#1A2236] px-2.5 py-1 text-xs font-medium text-[#EFF6FF] focus:border-[#60A5FA] focus:outline-none"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {model === 'gemini-4-hydrogen' && (
              <div
                role="group"
                aria-label="ระดับการคิด Thinking Level"
                className="flex items-center gap-1 rounded-md border border-[#24304A] bg-[#0D111C] p-0.5"
              >
                <span className="px-2 text-[11px] text-[#94A3B8]">Thinking</span>
                {THINKING_OPTIONS.map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playInteract();
                      setThinkingLevel(lvl.id);
                    }}
                    className={`cursor-pointer whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      thinkingLevel === lvl.id
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Collapsible System Instruction Drawer */}
        {showSystemConfig && (
          <div className="border-b border-[#232F4A] bg-[#161E31] px-5 py-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#BFDBFE]">
                System Instruction (กำหนดบทบาทหรือเงื่อนไขเพิ่มเติมให้โมเดล)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {SYSTEM_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      soundEngine.playInteract();
                      setSystemInstruction(preset.value);
                    }}
                    className="cursor-pointer whitespace-nowrap rounded-md border border-[#2E4068] bg-[#1C2740] px-2.5 py-1 text-[11px] font-medium text-[#CBD5E1] transition-colors hover:border-[#60A5FA] hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
                {systemInstruction.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSystemInstruction('')}
                    className="cursor-pointer whitespace-nowrap rounded-md px-2 py-1 text-[11px] text-[#94A3B8] hover:text-white"
                  >
                    ล้างค่า
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={2}
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              placeholder="ตัวอย่าง: ตอบเป็นตารางเปรียบเทียบภาษาไทย พร้อมให้คะแนนข้อดี-ข้อเสียแต่ละตัวเลือก..."
              className="w-full resize-none rounded-lg border border-[#2B3B5E] bg-[#0E1320] px-3 py-2 text-xs text-[#EFF6FF] placeholder-[#64748B] focus:border-[#60A5FA] focus:outline-none"
            />

            {statusSnapshot && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#23304D] pt-2.5 text-[11px] text-[#94A3B8]">
                <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                  <span className="text-[#CBD5E1]">โควต้า Token รายวัน (ใช้ร่วมกันทั้งห้องทำงาน):</span>
                  <span>
                    ใช้ไป {statusSnapshot.tokensUsed.toLocaleString()} /{' '}
                    {statusSnapshot.tokensLimit.toLocaleString()}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>รีเซ็ตรอบถัดไป {formatResetTime(statusSnapshot.resetAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {QUOTA_PRESETS.map((preset) => {
                    const active = statusSnapshot.tokensLimit === preset.limit;
                    return (
                      <button
                        key={preset.limit}
                        type="button"
                        disabled={isUpdatingQuota}
                        onClick={() => void handleUpdateQuota({ dailyLimit: preset.limit })}
                        className={`cursor-pointer whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          active
                            ? 'bg-[#2563EB] text-white'
                            : 'border border-[#2E4068] bg-[#1C2740] text-[#CBD5E1] hover:border-[#60A5FA] hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={isUpdatingQuota}
                    onClick={() => void handleUpdateQuota({ resetUsage: true })}
                    className="cursor-pointer whitespace-nowrap rounded border border-[#2E4068] bg-[#1C2740] px-2 py-0.5 text-[11px] text-[#94A3B8] hover:border-[#60A5FA] hover:text-white"
                  >
                    รีเซ็ตตัวนับ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages Area */}
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
                    onClick={() => handleSend(starter)}
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
                            onClick={() => void handleCopy(msg.id, msg.content)}
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
                    onClick={handleRetry}
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

        {/* Composer Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="border-t border-[#232F4A] bg-[#151B2B] px-5 py-3.5"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2.5">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={currentModeConfig.placeholder}
              className="min-h-[46px] max-h-36 flex-1 resize-none rounded-xl border border-[#2B3B5E] bg-[#0D111C] px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#64748B] focus:border-[#60A5FA] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="inline-flex h-[46px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>รันคำสั่ง</span>
            </button>
          </div>
          <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between text-[11px] text-[#64748B]">
            <span>Enter เพื่อส่ง · Shift + Enter ขึ้นบรรทัดใหม่ · Esc ปิดหน้าต่าง</span>
            <span className="font-mono">{model}</span>
          </div>
        </form>
      </div>
    </div>
  );
}

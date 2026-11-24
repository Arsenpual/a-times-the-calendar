import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Cpu,
  FileCode2,
  FolderGit2,
  HardDriveUpload,
  Loader2,
  Minimize2,
  RotateCcw,
  Send,
  Server,
  Settings2,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AntigravityMessage,
  AntigravityMode,
  AssistantTaskDelivery,
  CharacterStatusSnapshot,
} from '../types/game';
import type { CharacterTaskActivityUpdate } from './AiStudioModal';
import { formatTaskDeliveryChatMessage } from '../lib/minaTaskScheduler';
import { cozyApiFetch, cozyStorageKey } from '../api/cozyApi';
import { soundEngine } from '../lib/sound';

import {
  AGY_MODES,
  AntigravityChatTranscript,
  type AntigravityModalProps,
  type AntigravityStatus,
  DEFAULT_LOCAL_ENDPOINT,
  formatCompactTokens,
  formatResetTime,
  loadSavedMessages,
  STORAGE_AGY_ENDPOINT_KEY,
  STORAGE_AGY_MESSAGES_KEY,
  summarizePrompt,
} from './AntigravitySubsections';

export function AntigravityModal({
  isOpen,
  statusSnapshot,
  incomingTaskDelivery = null,
  onClose,
  onTaskActivityChange,
  onBackgroundComplete,
  onRefreshStatus,
  onSaveToDrive,
}: AntigravityModalProps) {
  const [mode, setMode] = useState<AntigravityMode>('code');
  const [messages, setMessages] = useState<AntigravityMessage[]>(loadSavedMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [status, setStatus] = useState<AntigravityStatus | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState<string>(() => {
    try {
      return localStorage.getItem(cozyStorageKey(STORAGE_AGY_ENDPOINT_KEY)) || DEFAULT_LOCAL_ENDPOINT;
    } catch {
      return DEFAULT_LOCAL_ENDPOINT;
    }
  });

  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastDeliveredTaskIdRef = useRef<number | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    if (
      !incomingTaskDelivery ||
      incomingTaskDelivery.assistantId !== 'antigravity' ||
      incomingTaskDelivery.id === lastDeliveredTaskIdRef.current
    ) {
      return;
    }
    lastDeliveredTaskIdRef.current = incomingTaskDelivery.id;
    const formatted = formatTaskDeliveryChatMessage(incomingTaskDelivery);
    setMessages((prev) => [
      ...prev,
      {
        id: `agy-task-${incomingTaskDelivery.id}`,
        role: 'assistant',
        content: formatted,
        mode: 'code',
        createdAt: Date.now(),
      },
    ]);
    if (!incomingTaskDelivery.success && incomingTaskDelivery.errorMessage) {
      setError(incomingTaskDelivery.errorMessage);
    }
  }, [incomingTaskDelivery]);

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

  const currentModeConfig = AGY_MODES.find((m) => m.id === mode) ?? AGY_MODES[0];

  // Fetch live localhost status & workspace file list on mount
  useEffect(() => {
    let active = true;
    cozyApiFetch('/api/antigravity/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AntigravityStatus | null) => {
        if (active && data?.ok) {
          setStatus(data);
        }
      })
      .catch(() => {
        // Keep fallback offline badge if unreachable
      });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(cozyStorageKey(STORAGE_AGY_MESSAGES_KEY), JSON.stringify(messages.slice(-30)));
    } catch {
      // Ignore storage quota errors
    }
  }, [messages]);

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

  const toggleFocusFile = (filePath: string) => {
    soundEngine.playInteract();
    setSelectedFiles((prev) => {
      if (prev.includes(filePath)) {
        return prev.filter((f) => f !== filePath);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), filePath];
      }
      return [...prev, filePath];
    });
  };

  const streamResponse = useCallback(
    async (historyToSend: AntigravityMessage[], activeMode: AntigravityMode, filesToInspect: string[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantMsgId = `agy-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          mode: activeMode,
          createdAt: Date.now(),
        },
      ]);

      setIsStreaming(true);
      setError(null);

      const latestPrompt =
        [...historyToSend].reverse().find((m) => m.role === 'user')?.content ?? '';
      const taskSummary = summarizePrompt(
        latestPrompt,
        activeMode === 'workspace'
          ? 'สำรวจไฟล์โปรเจกต์'
          : activeMode === 'arch'
            ? 'วิเคราะห์สถาปัตยกรรม'
            : 'ตรวจโค้ด & แก้บัค'
      );
      callbacksRef.current.onTaskActivityChange?.({
        busy: true,
        taskLabel: taskSummary,
        errorReason: null,
        errorCode: null,
      });

      let accumulated = '';
      let succeeded = false;
      const targetEndpoint = customEndpoint.trim() || DEFAULT_LOCAL_ENDPOINT;

      try {
        const res = targetEndpoint.startsWith('/api/')
          ? await cozyApiFetch(targetEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: historyToSend.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
                mode: activeMode,
                focusFiles: filesToInspect,
              }),
              signal: controller.signal,
            })
          : await fetch(targetEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: historyToSend.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
                mode: activeMode,
                focusFiles: filesToInspect,
              }),
              signal: controller.signal,
            });

        if (!res.ok) {
          let errMsg = `ไม่สามารถเชื่อมต่อกับ Antigravity บน ${targetEndpoint} ได้`;
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
          throw new Error('ไม่พบสตรีมข้อมูลตอบกลับจาก Localhost Agent');
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
              type: 'chunk' | 'done' | 'error' | 'inspected_files' | 'usage';
              text?: string;
              error?: string;
              files?: string[];
            };

            if (parsed.type === 'error') {
              throw new Error(parsed.error || 'เกิดข้อผิดพลาดจาก Antigravity Localhost Agent');
            }

            if (parsed.type === 'usage') {
              continue;
            }

            if (parsed.type === 'inspected_files' && Array.isArray(parsed.files)) {
              const inspected = parsed.files;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, inspectedFiles: inspected } : m
                )
              );
            }

            if (parsed.type === 'chunk' && parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulated } : m
                )
              );
            }
          }
        }

        if (!accumulated.trim()) {
          throw new Error('ไม่ได้รับข้อความตอบกลับจาก Antigravity กรุณาลองส่งใหม่อีกครั้ง');
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
        const msg =
          err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Antigravity บน localhost';
        setError(msg);
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantMsgId && m.content === ''))
        );
        callbacksRef.current.onTaskActivityChange?.({
          busy: false,
          taskLabel: null,
          errorReason: msg,
          errorCode: null,
        });
      } finally {
        setIsStreaming(false);
        if (succeeded || !controller.signal.aborted) {
          callbacksRef.current.onRefreshStatus?.();
        }
      }
    },
    [customEndpoint]
  );

  const handleSend = (textToSend?: string) => {
    const trimmed = (textToSend ?? input).trim();
    if (!trimmed || isStreaming) return;

    soundEngine.playMessageSent();
    const userMsg: AntigravityMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      mode,
      createdAt: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textToSend) {
      setInput('');
    }
    void streamResponse(nextHistory, mode, selectedFiles);
  };

  const handleRetry = () => {
    if (isStreaming || messages.length === 0) return;
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const trimmedHistory = messages.slice(0, actualIdx + 1);
    setMessages(trimmedHistory);
    void streamResponse(trimmedHistory, mode, selectedFiles);
  };

  const handleClear = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages([]);
    setError(null);
    soundEngine.playInteract();
  };

  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const quickFiles = (status?.files ?? [
    'src/App.tsx',
    'src/components/GameCanvas.tsx',
    'src/game/houseMap.ts',
    'src/game/pixelRenderer.ts',
    'server.ts',
    'package.json',
  ]).slice(0, 14);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="คอนโซลตัวละคร Antigravity Localhost Agent"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2E3B59] bg-[#111622] text-[#E2E8F0] shadow-2xl">
        {/* Top Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#222D45] bg-[#151C2C] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            {/* Pixel-style Antigravity Agent Avatar Badge */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#38BDF8]/50 bg-[#1B253B] shadow-inner">
              <Cpu className="h-5 w-5 text-[#38BDF8]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                  Antigravity · Localhost Agent
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/40 bg-[#064E3B]/50 px-2.5 py-0.5 text-[11px] font-medium text-[#6EE7B7]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
                  <span>{status?.host || window.location.origin}</span>
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                {statusSnapshot ? (
                  statusSnapshot.status === 'unavailable' ? (
                    <span className="font-medium text-[#FCA5A5]">
                      ใช้งานไม่ได้ ({statusSnapshot.unavailableReason || 'ระบบไม่พร้อม'})
                    </span>
                  ) : statusSnapshot.status === 'busy' ? (
                    <span className="font-medium text-[#FDE68A]">
                      กำลังทำงาน: {statusSnapshot.currentTask || 'ประมวลผลคำสั่ง'}
                    </span>
                  ) : (
                    <span className="tabular-nums text-[#7DD3FC]">
                      เหลือ {formatCompactTokens(statusSnapshot.tokensRemaining)}/
                      {formatCompactTokens(statusSnapshot.tokensLimit)} Token · รีเซ็ต{' '}
                      {formatResetTime(statusSnapshot.resetAt)}
                    </span>
                  )
                ) : (
                  'ตัวละครผู้ช่วยสายโค้ดดิ้ง & สำรวจไฟล์โปรเจกต์บนเครื่อง Localhost แบบปลอดภัย (Read-Only Sandbox)'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playInteract();
                  onClose();
                }}
                title="พับหน้าต่างเพื่อดูตัวละครทำงานบนแผนที่ห้องทำงาน"
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#F59E0B]/50 bg-[#2C2012] px-2.5 text-xs font-medium text-[#FDE68A] transition-colors hover:border-[#F59E0B] hover:bg-[#3A2A15]"
              >
                <Minimize2 className="h-3.5 w-3.5 shrink-0" />
                <span>พับดูตัวละคร</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.playInteract();
                setShowSettings((s) => !s);
              }}
              title="ตั้งค่าการเชื่อมต่อ Localhost Endpoint"
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                showSettings
                  ? 'border-[#38BDF8] bg-[#1E2D4A] text-[#F8FAFC]'
                  : 'border-[#2B3752] bg-[#1A2234] text-[#94A3B8] hover:border-[#3B4C70] hover:text-[#F8FAFC]'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Localhost</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                title="ล้างประวัติการสนทนา"
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#2B3752] bg-[#1A2234] px-2.5 text-xs font-medium text-[#94A3B8] transition-colors hover:border-[#EF4444]/50 hover:text-[#FCA5A5]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ล้างแชท</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง Antigravity"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#2B3752] bg-[#1A2234] text-[#94A3B8] transition-colors hover:border-[#38BDF8] hover:text-[#F8FAFC]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Localhost Endpoint Settings Bar */}
        {showSettings && (
          <div className="shrink-0 border-b border-[#222D45] bg-[#131A29] px-4 py-3 text-xs sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#CBD5E1]">
                <Server className="h-3.5 w-3.5 text-[#38BDF8]" />
                <span className="font-semibold">Localhost API Endpoint:</span>
                <span className="text-[#94A3B8]">
                  (ค่าเริ่มต้นใช้เซิร์ฟเวอร์ในตัวแอพ `{DEFAULT_LOCAL_ENDPOINT}` ที่เสถียรที่สุด)
                </span>
              </div>
              {customEndpoint !== DEFAULT_LOCAL_ENDPOINT && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomEndpoint(DEFAULT_LOCAL_ENDPOINT);
                    try {
                      localStorage.setItem(cozyStorageKey(STORAGE_AGY_ENDPOINT_KEY), DEFAULT_LOCAL_ENDPOINT);
                    } catch {
                      // Ignore
                    }
                  }}
                  className="cursor-pointer text-[#38BDF8] underline hover:text-[#7DD3FC]"
                >
                  รีเซ็ตกลับเป็นค่าเริ่มต้น
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomEndpoint(val);
                  try {
                    localStorage.setItem(cozyStorageKey(STORAGE_AGY_ENDPOINT_KEY), val);
                  } catch {
                    // Ignore
                  }
                }}
                placeholder="/api/antigravity/chat หรือ http://localhost:3000/api/antigravity/chat"
                className="flex-1 rounded-lg border border-[#2B3752] bg-[#0D121D] px-3 py-1.5 font-mono text-xs text-[#F8FAFC] outline-none focus:border-[#38BDF8]"
              />
            </div>
          </div>
        )}

        {/* Mode Selector & Quick File Context Chips */}
        <div className="shrink-0 space-y-2.5 border-b border-[#222D45] bg-[#141B2A] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="โหมดการทำงานของ Antigravity" className="flex flex-wrap gap-1.5">
              {AGY_MODES.map((m) => {
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
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#0284C7] text-[#F8FAFC] shadow-xs'
                        : 'bg-[#1C2539] text-[#94A3B8] hover:bg-[#24304A] hover:text-[#E2E8F0]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {status && (
              <span className="text-[11px] text-[#64748B]">
                Workspace: <strong className="text-[#94A3B8]">{status.workspace}</strong> ({status.fileCount} ไฟล์)
              </span>
            )}
          </div>

          {/* Clickable local project file chips to attach real localhost file contents */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
            <span className="shrink-0 text-[#64748B]">แนบไฟล์ในเครื่อง (สูงสุด 3):</span>
            {quickFiles.map((filePath) => {
              const active = selectedFiles.includes(filePath);
              return (
                <button
                  key={filePath}
                  type="button"
                  onClick={() => toggleFocusFile(filePath)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 font-mono transition-colors ${
                    active
                      ? 'border-[#38BDF8] bg-[#0369A1]/40 text-[#E0F2FE]'
                      : 'border-[#26324B] bg-[#182032] text-[#94A3B8] hover:border-[#3B4E73] hover:text-[#CBD5E1]'
                  }`}
                >
                  <FileCode2 className="h-3 w-3 shrink-0" />
                  <span>{filePath}</span>
                </button>
              );
            })}
          </div>
        </div>

        <AntigravityChatTranscript
          messages={messages}
          currentModeConfig={currentModeConfig}
          copiedId={copiedId}
          error={error}
          endRef={endRef}
          handleSend={handleSend}
          handleRetry={handleRetry}
          handleCopy={handleCopy}
          onSaveToDrive={onSaveToDrive}
        />

        {/* Bottom Input Bar */}
        <div className="shrink-0 border-t border-[#222D45] bg-[#151C2C] p-3 sm:px-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
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
              disabled={isStreaming}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-[#2B3752] bg-[#0E1420] px-3.5 py-2.5 text-xs text-[#F8FAFC] placeholder-[#64748B] outline-none transition-colors focus:border-[#38BDF8] sm:text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0284C7] px-4 text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-[#0369A1] disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>ส่งคำสั่ง</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

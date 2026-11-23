import { ChatTaskProposalCard, StructuredResponse } from './WorkspaceSubcomponents';
import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BookmarkPlus,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HardDriveUpload,
  Lightbulb,
  Loader2,
  MessageCircle,
  Pin,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AssistantMood,
  ChatMessage,
  ChatTaskProposal,
  SavedDraft,
  TaskAssistantId,
  WorkMode,
} from '../types/game';
import { ASSETS } from '../types/game';
import { detectMinaMentionInTitle } from '../lib/minaTaskScheduler';

interface WorkspacePanelProps {
  messages: ChatMessage[];
  drafts: SavedDraft[];
  workMode: WorkMode;
  assistantMood: AssistantMood;
  isStreaming: boolean;
  error: string | null;
  googleUser: User | null;
  accessToken: string | null;
  isSigningInGoogle: boolean;
  googleAuthError: string | null;
  tasksSummary?: {
    listCount: number;
    pendingCount: number;
    completedCount: number;
  } | null;
  isSyncingTasks?: boolean;
  tasksSyncError?: string | null;
  onSyncTasks?: () => void;
  onGoogleSignIn: () => void;
  onChangeWorkMode: (mode: WorkMode) => void;
  onSendMessage: (text: string) => void;
  onRetryLast: () => void;
  onClearChat: () => void;
  onSaveDraft: (message: ChatMessage) => void;
  onDeleteDraft: (id: string) => void;
  onConfirmChatTask: (
    messageId: string,
    payload: {
      title: string;
      notes?: string;
      dueDate?: string;
      assignToMina?: boolean;
      assistantId?: TaskAssistantId;
      scheduledTime?: string;
    }
  ) => Promise<void>;
  onCancelChatTask: (messageId: string) => void;
  onSaveToDrive?: (payload: { content: string; title?: string; assistantName: string }) => void;
  onOpenPinboard: () => void;
  onCloseWorkspace: () => void;
}

const WORK_MODES: Array<{
  id: WorkMode;
  label: string;
  icon: typeof MessageCircle;
  placeholder: string;
  starters: string[];
}> = [
  {
    id: 'qa',
    label: 'ถาม-ตอบช่วยงาน',
    icon: MessageCircle,
    placeholder: 'ถามเรื่องงาน เช็ค/สรุป Google Tasks หรือสั่งเพิ่มงานใหม่...',
    starters: [
      'ช่วยสรุปรายการงานทั้งหมดใน Google Tasks ของฉันตอนนี้หน่อย',
      'ช่วยเพิ่มงานลง Google Tasks: ส่งรายงานประจำสัปดาห์ พรุ่งนี้',
      'ช่วยจัดลำดับความสำคัญงานค้างใน Google Tasks ให้หน่อย',
    ],
  },
  {
    id: 'brainstorm',
    label: 'คิดไอเดีย',
    icon: Lightbulb,
    placeholder: 'บอกโจทย์หรือหัวข้อที่อยากให้มีน่าช่วยระดมสมอง...',
    starters: [
      'ช่วยคิดไอเดียฟีเจอร์เสริมสำหรับเกม 2D จำลองบ้านในเวอร์ชันถัดไป 5 อย่าง',
      'ช่วยระดมไอเดียหัวข้อบทความสั้นๆ สำหรับคนทำงานสายสร้างสรรค์',
    ],
  },
  {
    id: 'draft',
    label: 'ร่างเอกสาร',
    icon: FileText,
    placeholder: 'ระบุประเภทเอกสาร เช่น อีเมล โครงร่างงาน หรือสรุปประชุม...',
    starters: [
      'ช่วยร่างอีเมลอัปเดตความคืบหน้าโปรเจกต์ให้ทีมแบบสุภาพ กระชับ ชัดเจน',
      'ช่วยร่างโครงร่างเอกสารสรุปแนวคิด Prototype สำหรับนำเสนอใน 1 หน้า',
    ],
  },
];

export function WorkspacePanel({
  messages,
  drafts,
  workMode,
  assistantMood,
  isStreaming,
  error,
  googleUser,
  accessToken,
  isSigningInGoogle,
  googleAuthError,
  tasksSummary,
  isSyncingTasks,
  tasksSyncError,
  onSyncTasks,
  onGoogleSignIn,
  onChangeWorkMode,
  onSendMessage,
  onRetryLast,
  onClearChat,
  onSaveDraft,
  onDeleteDraft,
  onConfirmChatTask,
  onCancelChatTask,
  onSaveToDrive,
  onOpenPinboard,
  onCloseWorkspace,
}: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'drafts'>('chat');
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [portraitFailed, setPortraitFailed] = useState(false);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentModeConfig =
    WORK_MODES.find((m) => m.id === workMode) ?? WORK_MODES[0];

  useEffect(() => {
    if (activeTab === 'chat') {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, activeTab]);

  useEffect(() => {
    if (activeTab === 'chat') {
      textareaRef.current?.focus();
    }
  }, [activeTab]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      // Clipboard API may be restricted in some contexts
    }
  };

  const handleSave = (msg: ChatMessage) => {
    onSaveDraft(msg);
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.add(msg.id);
      return next;
    });
  };

  const handleDownloadDraft = (draft: SavedDraft) => {
    const blob = new Blob([`# ${draft.title}\n\n${draft.content}\n`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.title.replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().slice(0, 40) || 'cozy-desk-draft'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusText =
    assistantMood === 'pinning'
      ? 'กำลังเดินไปปักหมุดงานที่กระดานโน้ต...'
      : assistantMood === 'thinking'
        ? 'กำลังคิดและพิมพ์คำตอบ...'
        : assistantMood === 'speaking'
          ? 'ตอบกลับเรียบร้อย · พร้อมคุยต่อ'
          : 'พร้อมช่วยงานและจด Google Tasks';

  return (
    <aside
      aria-label="แผงทำงานร่วมกับผู้ช่วย AI มีน่า"
      className="flex h-full min-h-0 w-full flex-col border-l border-[#332B25] bg-[#FAF6F0] text-[#29221D]"
    >
      {/* Panel Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E2D9CC] bg-[#F4EDE3] px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[#D4C7B6] bg-[#29231E]">
            {!portraitFailed ? (
              <img
                src={ASSETS.minaPortrait}
                alt="มีน่า ผู้ช่วยทำงาน AI"
                referrerPolicy="no-referrer"
                onError={() => setPortraitFailed(true)}
                className="pixelated h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#FAF6F0]">
                มีน่า
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-display truncate text-base font-semibold text-[#29221D]">
              มีน่า · ผู้ช่วยห้องทำงาน
            </h2>
            <p className="truncate text-xs text-[#6E6258]">{statusText}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCloseWorkspace}
          title="จบการสนทนา (Esc)"
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D8CCBC] bg-[#FAF6F0] px-3 text-xs font-medium text-[#52473E] transition-colors duration-150 hover:bg-[#EFE7DC] hover:text-[#29221D]"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">จบการสนทนา</span>
        </button>
      </div>

      {/* Top View Switcher: Chat vs Saved Drafts */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E2D9CC] px-5 py-2.5">
        <div className="flex items-center gap-1 rounded-lg bg-[#EDE5D9] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              activeTab === 'chat'
                ? 'bg-[#FAF6F0] text-[#29221D] shadow-xs'
                : 'text-[#6E6258] hover:text-[#29221D]'
            }`}
          >
            แชทช่วยงาน
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors duration-150 ${
              activeTab === 'drafts'
                ? 'bg-[#FAF6F0] text-[#29221D] shadow-xs'
                : 'text-[#6E6258] hover:text-[#29221D]'
            }`}
          >
            คลังฉบับร่าง ({drafts.length})
          </button>
        </div>

        {activeTab === 'chat' && messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            disabled={isStreaming}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#7A6D62] transition-colors hover:text-[#B5472A] disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>ล้างแชท</span>
          </button>
        )}
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Work Mode Selector */}
          <div className="shrink-0 border-b border-[#E8DFD3] bg-[#FAF6F0] px-5 py-3">
            <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#EFE7DC] p-1">
              {WORK_MODES.map((mode) => {
                const Icon = mode.icon;
                const active = workMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeWorkMode(mode.id)}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-2 text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-[#29221D] text-[#FAF6F0]'
                        : 'text-[#63574D] hover:text-[#29221D]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{mode.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Google Tasks Sync & Connection Bar */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2D9CC] bg-[#F4EDE3]/80 px-3 py-2 text-xs">
              {accessToken ? (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        tasksSyncError
                          ? 'bg-[#C4513B]'
                          : isSyncingTasks
                            ? 'animate-pulse bg-[#D97736]'
                            : 'bg-[#3B7A67]'
                      }`}
                    />
                    <span className="truncate font-medium text-[#3D342D]">
                      {isSyncingTasks
                        ? 'กำลังซิงค์ Google Tasks...'
                        : tasksSyncError
                          ? tasksSyncError
                          : tasksSummary
                            ? `Google Tasks: ค้าง ${tasksSummary.pendingCount} · เสร็จ ${tasksSummary.completedCount} (${tasksSummary.listCount} รายการ)`
                            : 'เชื่อมต่อ Google Tasks แล้ว'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {onSyncTasks && (
                      <button
                        type="button"
                        onClick={onSyncTasks}
                        disabled={isSyncingTasks}
                        title="ซิงค์รายการ Google Tasks ล่าสุด"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#D8CCBC] bg-white px-2 py-1 text-[11px] font-medium text-[#52473E] transition-colors hover:border-[#D97736] hover:text-[#29221D] disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${isSyncingTasks ? 'animate-spin' : ''}`}
                        />
                        <span>ซิงค์</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenPinboard}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#D8CCBC] bg-white px-2 py-1 text-[11px] font-medium text-[#52473E] transition-colors hover:border-[#D97736] hover:text-[#29221D]"
                    >
                      <ClipboardList className="h-3 w-3" />
                      <span>กระดาน</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-[#5C5046]">
                      เชื่อมต่อ Google เพื่อดูและรายงาน Google Tasks ทั้งหมด
                    </p>
                    {googleAuthError && (
                      <p className="mt-0.5 text-[11px] text-[#8C2F1B]">{googleAuthError}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={isSigningInGoogle}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#747775] bg-white px-2.5 text-[11px] font-medium text-[#1F1F1F] transition-colors hover:bg-[#F8F9FA] disabled:opacity-60"
                  >
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="h-3.5 w-3.5 shrink-0"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    <span>{isSigningInGoogle ? 'กำลังเชื่อมต่อ...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages Transcript */}
          <div className="cozy-scroll flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <div className="space-y-4 py-4">
                <div className="rounded-xl border border-[#E2D9CC] bg-[#F4EDE3] p-4">
                  <p className="text-sm font-semibold text-[#29221D]">
                    ยินดีต้อนรับเข้าห้องทำงานครับ
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5C5046]">
                    ตอนนี้เราอยู่ในโหมด{' '}
                    <span className="font-semibold text-[#29221D]">
                      {currentModeConfig.label}
                    </span>{' '}
                    พิมพ์โจทย์ที่อยากให้มีน่าช่วยได้เลย หรือลองเริ่มจากตัวอย่างด้านล่างครับ
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#7A6D62]">
                    ตัวอย่างคำสั่งสำหรับโหมดนี้
                  </p>
                  {currentModeConfig.starters.map((promptText) => (
                    <button
                      key={promptText}
                      type="button"
                      onClick={() => onSendMessage(promptText)}
                      disabled={isStreaming}
                      className="block w-full cursor-pointer rounded-xl border border-[#E2D9CC] bg-white px-4 py-3 text-left text-sm leading-snug text-[#3D342D] transition-colors duration-150 hover:border-[#D97736] hover:bg-[#FFFDF9] disabled:opacity-50"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                const modeLabel =
                  WORK_MODES.find((m) => m.id === msg.mode)?.label ?? 'ถาม-ตอบ';
                const isSaved = savedIds.has(msg.id);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-[#7D7065]">
                      <span className="font-medium text-[#4A3F37]">
                        {isUser ? 'คุณ' : 'มีน่า'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{modeLabel}</span>
                    </div>

                    <div
                      className={`max-w-[92%] rounded-xl px-4 py-3 text-[15px] leading-relaxed ${
                        isUser
                          ? 'bg-[#29221D] text-[#FAF6F0]'
                          : 'border border-[#E2D9CC] bg-white text-[#29221D]'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : msg.content ? (
                        <StructuredResponse content={msg.content} />
                      ) : (
                        <span className="text-sm text-[#8A7D72]">
                          กำลังเรียบเรียงคำตอบ...
                        </span>
                      )}
                    </div>

                    {!isUser && msg.taskProposal && (
                      <ChatTaskProposalCard
                        messageId={msg.id}
                        proposal={msg.taskProposal}
                        googleUser={googleUser}
                        accessToken={accessToken}
                        isSigningInGoogle={isSigningInGoogle}
                        googleAuthError={googleAuthError}
                        onGoogleSignIn={onGoogleSignIn}
                        onConfirm={onConfirmChatTask}
                        onCancel={onCancelChatTask}
                        onOpenPinboard={onOpenPinboard}
                      />
                    )}

                    {!isUser && msg.content && !(isStreaming && msg === messages[messages.length - 1]) && (
                      <div className="mt-1.5 flex items-center gap-3 px-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#6E6258] transition-colors hover:text-[#29221D]"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#4D7C6F]" />
                              <span className="text-[#4D7C6F]">คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>คัดลอก</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(msg)}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#6E6258] transition-colors hover:text-[#D97736]"
                        >
                          {isSaved ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#4D7C6F]" />
                              <span className="text-[#4D7C6F]">เก็บลงคลังแล้ว</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="h-3.5 w-3.5" />
                              <span>เก็บเป็นฉบับร่าง</span>
                            </>
                          )}
                        </button>
                        {onSaveToDrive && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveToDrive({
                                content: msg.content,
                                assistantName: 'มีน่า',
                              })
                            }
                            title="แปลงเป็น Google Docs, Google Sheets หรือ Markdown แล้วบันทึกลง Google Drive"
                            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
                          >
                            <HardDriveUpload className="h-3.5 w-3.5" />
                            <span>ลง Docs / Sheets</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-xl border border-[#DFB4A8] bg-[#FDF2EF] px-4 py-3 text-sm text-[#8C2F1B]"
              >
                <p className="leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={onRetryLast}
                  disabled={isStreaming}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[#8C2F1B] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#732515] disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>ส่งใหม่</span>
                </button>
              </div>
            )}

            <div ref={listEndRef} />
          </div>

          {/* Message Composer */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-[#E2D9CC] bg-[#F4EDE3] p-4"
          >
            <div className="flex items-end gap-2 rounded-xl border border-[#D6C9B8] bg-white p-2 focus-within:border-[#D97736]">
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentModeConfig.placeholder}
                disabled={isStreaming}
                className="cozy-scroll max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-[#29221D] placeholder:text-[#96897D] focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                aria-label="ส่งข้อความให้มีน่า"
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#D97736] text-[#FAF6F0] transition-colors duration-150 hover:bg-[#C6682A] disabled:cursor-not-allowed disabled:bg-[#CFC4B6] disabled:text-[#FAF6F0]"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-[#7D7065]">
              กด Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่ · Esc ลุกจากโต๊ะ
            </p>
          </form>
        </>
      ) : (
        /* Saved Drafts Vault Tab */
        <div className="cozy-scroll flex-1 space-y-3 overflow-y-auto p-5">
          {drafts.length === 0 ? (
            <div className="rounded-xl border border-[#E2D9CC] bg-[#F4EDE3] p-6 text-center">
              <p className="text-sm font-semibold text-[#29221D]">
                ยังไม่มีเอกสารร่างที่บันทึกไว้
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#6E6258]">
                เมื่อมีน่าช่วยคิดไอเดียหรือร่างเอกสารในแท็บแชท สามารถกดปุ่ม “เก็บเป็นฉบับร่าง” ใต้คำตอบเพื่อเก็บไว้ใช้งานต่อที่นี่ได้ครับ
              </p>
            </div>
          ) : (
            drafts.map((draft) => {
              const modeLabel =
                WORK_MODES.find((m) => m.id === draft.mode)?.label ?? 'เอกสารร่าง';
              const dateStr = new Date(draft.createdAt).toLocaleString('th-TH', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <article
                  key={draft.id}
                  className="rounded-xl border border-[#E2D9CC] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#29221D]">
                        {draft.title}
                      </h3>
                      <p className="mt-0.5 text-xs tabular-nums text-[#7D7065]">
                        {modeLabel} · {dateStr}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteDraft(draft.id)}
                      aria-label="ลบฉบับร่าง"
                      className="cursor-pointer rounded-md p-1.5 text-[#8A7D72] transition-colors hover:bg-[#FDF2EF] hover:text-[#B5472A]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 max-h-48 overflow-y-auto border-t border-[#F0E8DC] pt-3 text-sm leading-relaxed text-[#3D342D]">
                    <StructuredResponse content={draft.content} />
                  </div>

                  <div className="mt-3 flex items-center gap-3 border-t border-[#F0E8DC] pt-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(draft.id, draft.content)}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#5C5046] hover:text-[#29221D]"
                    >
                      {copiedId === draft.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#4D7C6F]" />
                          <span className="text-[#4D7C6F]">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>คัดลอกเนื้อหา</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadDraft(draft)}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#5C5046] hover:text-[#D97736]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>ดาวน์โหลด .md</span>
                    </button>
                    {onSaveToDrive && (
                      <button
                        type="button"
                        onClick={() =>
                          onSaveToDrive({
                            title: draft.title,
                            content: draft.content,
                            assistantName: 'มีน่า',
                          })
                        }
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                      >
                        <HardDriveUpload className="h-3.5 w-3.5" />
                        <span>ลง Google Drive</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}

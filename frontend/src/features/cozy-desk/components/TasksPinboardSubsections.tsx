import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  Loader2,
  MessageCircle,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ASSETS, type GoogleTask, type TaskAssistantId } from '../types/game';
import { type MinaTaskRecurrence, parseMinaTaskMeta } from '../lib/minaTaskScheduler';
import { getLocalIsoDate } from '../api/sleepLogsApi';

export const MINA_TASK_TEMPLATES: Array<{
  label: string;
  assistantId: TaskAssistantId;
  title: string;
  notes: string;
  recurrence?: MinaTaskRecurrence;
}> = [
  {
    label: 'สรุปอีเมลวันนี้',
    assistantId: 'mina',
    title: 'สรุปอีเมลสำคัญวันนี้ "มีน่า"',
    notes: 'คัดเฉพาะอีเมลที่ยังไม่อ่านหรือเรื่องด่วนที่ต้องตอบ พร้อมสรุปประเด็นสั้นๆ',
    recurrence: 'daily',
  },
  {
    label: 'ร่างอีเมล',
    assistantId: 'mina',
    title: 'ร่างอีเมล์ "มีน่า"',
    notes: 'เรื่อง: [ระบุหัวข้อ] ถึง: [ระบุผู้รับ] โทนสุภาพ กระชับ พร้อมส่ง',
  },
  {
    label: 'จัดลำดับงานค้าง',
    assistantId: 'mina',
    title: 'จัดลำดับความสำคัญงานค้างวันนี้ "มีน่า"',
    notes: 'ช่วยเรียงลำดับงานค้างทั้งหมดตามความเร่งด่วนและแนะนำ 3 งานแรกที่ควรทำก่อน',
  },
  {
    label: 'รีวิวโค้ด (Antigravity)',
    assistantId: 'antigravity',
    title: 'ตรวจโครงสร้างและคุณภาพโค้ด "Antigravity"',
    notes: 'ระบุไฟล์ที่อยากให้ตรวจ: [เช่น server.ts หรือ src/App.tsx] พร้อมจุดเสี่ยงที่ควรระวัง',
  },
  {
    label: 'ออกแบบ Prompt (AI Studio)',
    assistantId: 'ai_studio',
    title: 'ออกแบบ System Prompt คุณภาพสูง "AI Studio"',
    notes: 'เป้าหมายของ AI: [ระบุบทบาทและรูปแบบผลลัพธ์ที่ต้องการ]',
  },
];

export type TaskFilter = 'pending' | 'completed' | 'all';

export interface PendingConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  execute: () => Promise<void>;
}

export function formatDueDate(iso?: string): string | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export function GoogleSignInButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-[#DADCE0] bg-white px-4 text-sm font-medium text-[#1F1F1F] shadow-xs transition-colors duration-150 hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
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
      <span>{disabled ? 'กำลังเข้าสู่ระบบ...' : 'Sign in with Google'}</span>
    </button>
  );
}


export function TasksPinboardCardsArea({
  isLoadingLists,
  isLoadingTasks,
  filteredTasks,
  filter,
  editingTaskId,
  setEditingTaskId,
  runningMinaTaskIds,
  editTitle,
  setEditTitle,
  editNotes,
  setEditNotes,
  editAssignToMina,
  setEditAssignToMina,
  editDueDate,
  setEditDueDate,
  editAssistantId,
  setEditAssistantId,
  editRecurrence,
  setEditRecurrence,
  editScheduledTime,
  setEditScheduledTime,
  editResetMinaRun,
  setEditResetMinaRun,
  requestSaveEdit,
  isMutating,
  requestToggleStatus,
  onOpenAssistantChat,
  onRunMinaTaskNow,
  selectedListId,
  startEditing,
  requestDeleteTask,
}: any) {
  return (
            <div className="cozy-scroll flex-1 overflow-y-auto bg-[#F3E9DC] p-5">
              {isLoadingLists || isLoadingTasks ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#6E6258]">
                  <Loader2 className="h-5 w-5 animate-spin text-[#D97736]" />
                  <span>กำลังซิงก์รายการงานจาก Google Tasks...</span>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="mx-auto max-w-md rounded-xl border border-[#DFD2C0] bg-[#FAF6F0] p-8 text-center">
                  <p className="text-sm font-semibold text-[#29221D]">
                    {filter === 'completed'
                      ? 'ยังไม่มีงานที่ทำเสร็จในรายการนี้'
                      : 'ยังไม่มีรายการงานค้างอยู่'}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#6E6258]">
                    พิมพ์ชื่องานด้านบนเพื่อปักโน้ตงานใหม่ หรือกดปุ่ม &ldquo;สั่งงานมีน่า&rdquo; เพื่อตั้งเวลาให้มีน่าทำงานแทนได้เลยครับ
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  {filteredTasks.map((task) => {
                    const isDone = task.status === 'completed';
                    const isEditing = editingTaskId === task.id;
                    const dueLabel = formatDueDate(task.due);
                    const meta = parseMinaTaskMeta(task);
                    const isMinaRunning =
                      runningMinaTaskIds.includes(task.id) ||
                      (!isDone && meta.status === 'in_progress');
                    const isFailed = !isDone && meta.status === 'failed';
                    const isWaitingReview =
                      !isDone && meta.assignedToMina && meta.status === 'ready_for_review';

                    return (
                      <article
                        key={task.id}
                        className={`flex flex-col justify-between rounded-xl border p-4 shadow-xs transition-colors ${
                          isDone
                            ? 'border-[#DCD2C5] bg-[#F5EFE7]/90'
                            : isFailed
                              ? 'border-[#DFB4A8] bg-[#FFF8F6]'
                              : isWaitingReview
                                ? 'border-[#7EB3A4] bg-[#F8FDFB]'
                                : 'border-[#E5D3B3] bg-[#FFFDF7]'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2.5">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full rounded-lg border border-[#D4C6B4] bg-white px-3 py-1.5 text-sm font-medium text-[#29221D] focus:border-[#D97736] focus:outline-none"
                            />
                            <textarea
                              rows={2}
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder={
                                editAssignToMina
                                  ? 'คำสั่งหรือรายละเอียดสำหรับมีน่า...'
                                  : 'รายละเอียดเพิ่มเติม...'
                              }
                              className="w-full resize-none rounded-lg border border-[#D4C6B4] bg-white px-3 py-1.5 text-xs text-[#3D342D] focus:border-[#D97736] focus:outline-none"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditAssignToMina((prev) => {
                                    const next = !prev;
                                    if (next && !editDueDate) {
                                      setEditDueDate(getLocalIsoDate());
                                    }
                                    return next;
                                  });
                                }}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  editAssignToMina
                                    ? 'border-[#3F6F62] bg-[#E5F2EE] text-[#285247]'
                                    : 'border-[#D4C6B4] bg-white text-[#5C5046] hover:bg-[#F2EAE0]'
                                }`}
                              >
                                <Sparkles className="h-3 w-3" />
                                <span>{editAssignToMina ? 'มอบหมายมีน่า' : 'สั่งงานมีน่า'}</span>
                              </button>
                              <input
                                type="date"
                                value={editDueDate}
                                onChange={(e) => setEditDueDate(e.target.value)}
                                className="rounded-lg border border-[#D4C6B4] bg-white px-2.5 py-1 text-xs tabular-nums text-[#29221D]"
                              />
                              {editAssignToMina && (
                                <>
                                  <select
                                    value={editAssistantId}
                                    onChange={(e) =>
                                      setEditAssistantId(e.target.value as TaskAssistantId)
                                    }
                                    aria-label="เลือกผู้ช่วย AI"
                                    className="rounded-lg border border-[#9DC3B8] bg-white px-2 py-1 text-xs font-medium text-[#1F3F37]"
                                  >
                                    <option value="mina">มีน่า</option>
                                    <option value="antigravity">Antigravity</option>
                                    <option value="ai_studio">AI Studio</option>
                                  </select>
                                  <select
                                    value={editRecurrence}
                                    onChange={(e) =>
                                      setEditRecurrence(e.target.value as MinaTaskRecurrence)
                                    }
                                    aria-label="ความถี่การทำงานซ้ำ"
                                    className="rounded-lg border border-[#9DC3B8] bg-white px-2 py-1 text-xs text-[#1F3F37]"
                                  >
                                    <option value="none">ทำครั้งเดียว</option>
                                    <option value="daily">ซ้ำทุกวัน</option>
                                    <option value="weekly">ซ้ำทุกสัปดาห์</option>
                                  </select>
                                  <input
                                    type="time"
                                    value={editScheduledTime}
                                    onChange={(e) => setEditScheduledTime(e.target.value)}
                                    className="rounded-lg border border-[#9DC3B8] bg-white px-2.5 py-1 text-xs tabular-nums text-[#1F3F37]"
                                  />
                                </>
                              )}
                            </div>

                            {editAssignToMina && meta.status === 'ready_for_review' && (
                              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#4C423A]">
                                <input
                                  type="checkbox"
                                  checked={editResetMinaRun}
                                  onChange={(e) => setEditResetMinaRun(e.target.checked)}
                                  className="rounded border-[#C8B9A6] accent-[#4D7C6F]"
                                />
                                <span>ตั้งเวลารอบใหม่ (ล้างสรุปเดิมเพื่อให้มีน่าทำซ้ำเมื่อถึงเวลา)</span>
                              </label>
                            )}

                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingTaskId(null)}
                                className="cursor-pointer rounded-lg border border-[#D4C6B4] bg-white px-3 py-1.5 text-xs font-medium text-[#5C5046] hover:bg-[#F2EAE0]"
                              >
                                ยกเลิก
                              </button>
                              <button
                                type="button"
                                onClick={() => requestSaveEdit(task)}
                                disabled={!editTitle.trim() || isMutating}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#4D7C6F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F685D] disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>บันทึก</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2.5">
                              {/* Mina scheduled status banner */}
                              {meta.assignedToMina && (
                                <div
                                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                                    isMinaRunning
                                      ? 'border border-[#D8B480] bg-[#FEF6E8] text-[#8A5416]'
                                      : isDone
                                        ? 'border border-[#D8CFC3] bg-[#EFE9E0] text-[#6E6258]'
                                        : isFailed
                                          ? 'border border-[#DFB4A8] bg-[#FDF2EF] text-[#8C2F1B]'
                                          : isWaitingReview
                                            ? 'border border-[#9DC3B8] bg-[#E3F3EE] text-[#1F5347]'
                                            : 'border border-[#C9DBD5] bg-[#EEF6F4] text-[#2D5A4F]'
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    {isMinaRunning ? (
                                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#C87A2B]" />
                                    ) : isFailed ? (
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#B5472A]" />
                                    ) : (
                                      <img
                                        src={ASSETS.minaPortrait}
                                        alt=""
                                        referrerPolicy="no-referrer"
                                        className="pixelated h-4 w-4 shrink-0 rounded-xs border border-[#9DC3B8] object-cover"
                                      />
                                    )}
                                    <span className="truncate">
                                      {isMinaRunning
                                        ? `${meta.assistantName} กำลังทำงานและเตรียมส่งในแชท...`
                                        : isDone
                                          ? `มอบหมาย ${meta.assistantName} · ตรวจงานและติ๊กเสร็จแล้ว`
                                          : isFailed
                                            ? `${meta.assistantName} แจ้งข้อผิดพลาดในแชทแล้ว${meta.errorMessage ? ` · ${meta.errorMessage}` : ''}`
                                            : isWaitingReview
                                              ? `${meta.assistantName} ส่งงานในแชทแล้ว · กดดูในแชทหรือติ๊กเสร็จ`
                                              : `มอบหมาย ${meta.assistantName} · รอเวลา ${meta.scheduledTime ? `${meta.scheduledTime} น.` : 'ตามกำหนด'}`}
                                    </span>
                                  </div>
                                  {isWaitingReview && meta.completedAtLabel && (
                                    <span className="shrink-0 text-[10px] font-normal tabular-nums text-[#356B5E]">
                                      {meta.completedAtLabel}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => requestToggleStatus(task)}
                                  disabled={isMutating || isMinaRunning}
                                  aria-label={
                                    isDone
                                      ? `เปิดงาน ${task.title} กลับมาทำ`
                                      : `ติ๊กงาน ${task.title} ว่าเสร็จแล้ว`
                                  }
                                  title={
                                    isWaitingReview
                                      ? 'ตรวจสรุปจากมีน่าเสร็จแล้ว? กดเพื่อติ๊กงานนี้ว่าเสร็จสิ้น'
                                      : isDone
                                        ? 'เปิดงานกลับมาทำ'
                                        : 'ติ๊กงานนี้ว่าเสร็จสิ้น'
                                  }
                                  className={`mt-0.5 shrink-0 cursor-pointer transition-colors disabled:opacity-50 ${
                                    isWaitingReview
                                      ? 'text-[#2E7D6B] hover:text-[#1E5C4E]'
                                      : 'text-[#6E6258] hover:text-[#4D7C6F]'
                                  }`}
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="h-5 w-5 text-[#4D7C6F]" />
                                  ) : (
                                    <Circle className="h-5 w-5" />
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <h3
                                    className={`text-sm font-semibold leading-snug ${
                                      isDone
                                        ? 'text-[#8C8075] line-through'
                                        : 'text-[#29221D]'
                                    }`}
                                  >
                                    {task.title}
                                  </h3>
                                  {meta.userPromptNotes && (
                                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#63574D]">
                                      {meta.userPromptNotes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Chat delivery status strip (full work & error details live in the AI assistant chat) */}
                              {!isDone && meta.assignedToMina && (isWaitingReview || isFailed) && (
                                <div
                                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                                    isFailed
                                      ? 'border-[#E6BFB5] bg-[#FDF5F3] text-[#7D2B1A]'
                                      : 'border-[#C6DFD7] bg-[#F1F9F6] text-[#225045]'
                                  }`}
                                >
                                  <span className="min-w-0 flex-1 text-[11px] leading-snug">
                                    {isFailed
                                      ? 'ดูรายละเอียดข้อผิดพลาดและแก้ไขปัญหาต่อได้ในหน้าต่างแชท'
                                      : 'ส่งผลงานฉบับเต็มในหน้าต่างแชทแล้ว — เปิดแชทเพื่ออ่านหรือคุยปรับแก้ต่อได้เลย'}
                                  </span>
                                  {onOpenAssistantChat && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenAssistantChat(meta.assistantId)}
                                      className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                        isFailed
                                          ? 'bg-[#8C2F1B] text-white hover:bg-[#732515]'
                                          : 'bg-[#3F6F62] text-white hover:bg-[#2F574C]'
                                      }`}
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                      <span>เปิดแชท{isFailed ? 'ดูสาเหตุ' : 'ดูงาน'}</span>
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Legacy note summary fallback if an older task still has inline summary text */}
                              {meta.minaSummary && (
                                <div className="rounded-lg border border-[#C6DFD7] bg-[#F1F9F6] p-3">
                                  <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#225045]">
                                      <Sparkles className="h-3 w-3 text-[#3A8472]" />
                                      <span>สรุปผลงานจาก {meta.assistantName}</span>
                                    </span>
                                    {meta.minaSummaryHeader && (
                                      <span className="text-[10px] tabular-nums text-[#53786E]">
                                        {meta.minaSummaryHeader}
                                      </span>
                                    )}
                                  </div>
                                  <div className="cozy-scroll max-h-36 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[#2C3A36]">
                                    {meta.minaSummary}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE5D7] pt-2.5 text-xs text-[#7D7065]">
                              <div className="flex items-center gap-1.5 tabular-nums">
                                {dueLabel ? (
                                  <>
                                    <Calendar className="h-3.5 w-3.5 text-[#D97736]" />
                                    <span>
                                      {meta.assignedToMina && meta.scheduledTime
                                        ? `${dueLabel} · ${meta.scheduledTime} น.`
                                        : `ครบกำหนด ${dueLabel}`}
                                    </span>
                                    {meta.assignedToMina && meta.recurrence !== 'none' && (
                                      <span className="rounded bg-[#EDE5D9] px-1.5 py-0.5 text-[10px] font-semibold text-[#5E4D3E]">
                                        {meta.recurrence === 'daily' ? 'ซ้ำทุกวัน' : 'ซ้ำทุกสัปดาห์'}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span>{isDone ? 'เสร็จสิ้นแล้ว' : 'กำลังดำเนินการ'}</span>
                                    {meta.assignedToMina && meta.recurrence !== 'none' && (
                                      <span className="rounded bg-[#EDE5D9] px-1.5 py-0.5 text-[10px] font-semibold text-[#5E4D3E]">
                                        {meta.recurrence === 'daily' ? 'ซ้ำทุกวัน' : 'ซ้ำทุกสัปดาห์'}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {!isDone && meta.assignedToMina && onRunMinaTaskNow && (
                                  <button
                                    type="button"
                                    onClick={() => void onRunMinaTaskNow(selectedListId, task)}
                                    disabled={isMutating || isMinaRunning}
                                    title={
                                      isFailed
                                        ? `ลองให้ ${meta.assistantName} ทำงานนี้อีกครั้งแล้วส่งในแชท`
                                        : isWaitingReview
                                          ? `ให้ ${meta.assistantName} ทำใหม่แล้วเดินมาส่งในแชทอีกครั้ง`
                                          : `ไม่ต้องรอถึงเวลา — สั่งให้ ${meta.assistantName} ทำทันทีแล้วมาส่งในแชท`
                                    }
                                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                      isFailed
                                        ? 'border-[#DFB4A8] bg-[#FDF2EF] text-[#8C2F1B] hover:bg-[#F9E3DD]'
                                        : 'border-[#B8D5CC] bg-[#EDF6F3] text-[#255549] hover:bg-[#DFEFEA]'
                                    }`}
                                  >
                                    {isMinaRunning ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : isFailed || isWaitingReview ? (
                                      <RotateCcw className="h-3 w-3" />
                                    ) : (
                                      <Play className="h-3 w-3" />
                                    )}
                                    <span>
                                      {isMinaRunning
                                        ? 'กำลังทำ'
                                        : isFailed
                                          ? 'ลองใหม่'
                                          : isWaitingReview
                                            ? 'ทำใหม่'
                                            : 'ทำตอนนี้'}
                                    </span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => startEditing(task)}
                                  disabled={isMutating || isMinaRunning}
                                  aria-label={`แก้ไขงาน ${task.title}`}
                                  className="cursor-pointer rounded-md p-1.5 text-[#6E6258] transition-colors hover:bg-[#EFE5D7] hover:text-[#29221D] disabled:opacity-40"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteTask(task)}
                                  disabled={isMutating || isMinaRunning}
                                  aria-label={`ลบงาน ${task.title}`}
                                  className="cursor-pointer rounded-md p-1.5 text-[#7A6D62] transition-colors hover:bg-[#FDF2EF] hover:text-[#B5472A] disabled:opacity-40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
  );
}

export function TasksPinboardNewTaskOptions({
  showNewOptions,
  isNewTaskAssignedToMina,
  newNotes,
  setNewNotes,
  effectiveNewAssistantName,
  newDueDate,
  setNewDueDate,
  effectiveNewAssistantId,
  setNewAssistantId,
  setNewAssignToMina,
  effectiveNewRecurrence,
  setNewRecurrence,
  newAssignToMina,
  newScheduledTime,
  setNewScheduledTime,
  newTitleMention,
  setNewTitle,
  setShowNewOptions,
}: any) {
  if (!showNewOptions && !isNewTaskAssignedToMina) return null;
  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
          placeholder={
            isNewTaskAssignedToMina
              ? `คำสั่งหรือรายละเอียดให้ ${effectiveNewAssistantName} ทำ (เช่น เนื้อหาอีเมล / ไฟล์ที่ให้ตรวจ)...`
              : 'รายละเอียดเพิ่มเติม (ไม่บังคับ)'
          }
          className="h-9 min-w-0 flex-1 rounded-lg border border-[#DDD1C2] bg-white px-3 text-xs text-[#29221D] placeholder:text-[#96897D] focus:border-[#D97736] focus:outline-none"
        />
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          aria-label="วันครบกำหนด"
          className="h-9 rounded-lg border border-[#DDD1C2] bg-white px-3 text-xs tabular-nums text-[#29221D] focus:border-[#D97736] focus:outline-none"
        />
        {isNewTaskAssignedToMina && (
          <>
            <select
              value={effectiveNewAssistantId}
              onChange={(e) => {
                setNewAssistantId(e.target.value as TaskAssistantId);
                setNewAssignToMina(true);
              }}
              aria-label="เลือกผู้ช่วย AI"
              className="h-9 rounded-lg border border-[#9DC3B8] bg-white px-2.5 text-xs font-semibold text-[#1F3F37] focus:border-[#3F6F62] focus:outline-none"
            >
              <option value="mina">มีน่า (งานทั่วไป/อีเมล)</option>
              <option value="antigravity">Antigravity (โค้ด/โปรเจกต์)</option>
              <option value="ai_studio">AI Studio (ออกแบบ Prompt)</option>
            </select>
            <select
              value={effectiveNewRecurrence}
              onChange={(e) => setNewRecurrence(e.target.value as MinaTaskRecurrence)}
              aria-label="ความถี่การทำงานซ้ำ"
              className="h-9 rounded-lg border border-[#9DC3B8] bg-white px-2.5 text-xs font-medium text-[#1F3F37] focus:border-[#3F6F62] focus:outline-none"
            >
              <option value="none">ทำครั้งเดียว</option>
              <option value="daily">ซ้ำทุกวัน</option>
              <option value="weekly">ซ้ำทุกสัปดาห์</option>
            </select>
          </>
        )}
        {newAssignToMina && (
          <input
            type="time"
            value={newScheduledTime}
            onChange={(e) => setNewScheduledTime(e.target.value)}
            aria-label="เวลาที่ให้ผู้ช่วย AI เริ่มทำงาน"
            className="h-9 rounded-lg border border-[#9DC3B8] bg-white px-3 text-xs font-medium tabular-nums text-[#1F3F37] focus:border-[#3F6F62] focus:outline-none"
          />
        )}
      </div>

      {isNewTaskAssignedToMina && (
        <div className="flex items-center gap-2 rounded-lg border border-[#C6DFD7] bg-[#EDF6F3] px-3 py-2 text-[11px] leading-relaxed text-[#2D554B]">
          <img
            src={ASSETS.minaPortrait}
            alt=""
            referrerPolicy="no-referrer"
            className="pixelated h-5 w-5 shrink-0 rounded border border-[#9DC3B8] object-cover"
          />
          <span>
            {newTitleMention.matched && !newAssignToMina ? (
              <>
                ตรวจพบชื่อผู้ช่วยในชื่องาน (<strong>{newTitleMention.cleanTitle}</strong>) —{' '}
                <strong>{effectiveNewAssistantName}</strong> จะทำ
                {newTitleMention.inlineTime
                  ? `ตอนเวลา ${newTitleMention.inlineTime} น.`
                  : newDueDate
                    ? `ตามวันที่ ${formatDueDate(newDueDate) ?? newDueDate}`
                    : 'ทันที'}
                {effectiveNewRecurrence === 'daily'
                  ? ' (ซ้ำทุกวัน)'
                  : effectiveNewRecurrence === 'weekly'
                    ? ' (ซ้ำทุกสัปดาห์)'
                    : ''}{' '}
                เมื่อทำงานเสร็จจะเดินมาหา แล้วเปิดแชทส่งงานให้คุณตรวจทันทีครับ
              </>
            ) : (
              <>
                เมื่อถึงวันและเวลาที่ตั้งไว้ <strong>{effectiveNewAssistantName}</strong> จะลงมือทำงาน
                {effectiveNewRecurrence === 'daily'
                  ? ' (และสร้างรอบวันถัดไปเมื่อคุณติ๊กเสร็จ)'
                  : effectiveNewRecurrence === 'weekly'
                    ? ' (และสร้างรอบสัปดาห์ถัดไปเมื่อคุณติ๊กเสร็จ)'
                    : ''}{' '}
                พอเสร็จแล้วจะเดินมาหา เปิดแชท และเริ่มบทสนทนาเพื่อส่งงานทันที (หรือแจ้งข้อผิดพลาดผ่านแชทถ้ามีปัญหา) ครับ
              </>
            )}
          </span>
        </div>
      )}

      {/* Quick AI Task Templates */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] font-medium text-[#7D7065]">คำสั่งด่วน:</span>
        {MINA_TASK_TEMPLATES.map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            onClick={() => {
              setNewTitle(tpl.title);
              setNewNotes(tpl.notes);
              setNewAssistantId(tpl.assistantId);
              setNewRecurrence(tpl.recurrence ?? 'none');
              setNewAssignToMina(false);
              setShowNewOptions(true);
            }}
            className="cursor-pointer rounded-md border border-[#DFD2C0] bg-white px-2 py-0.5 text-[11px] font-medium text-[#4F443B] transition-colors hover:border-[#9DC3B8] hover:bg-[#EDF6F3] hover:text-[#234C42]"
          >
            + {tpl.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TasksPinboardConfirmDialog({
  pendingConfirm,
  setPendingConfirm,
  runConfirmedMutation,
}: any) {
  return (
    <>
        {/* Mandatory Explicit Confirmation Dialog for All Google Tasks Mutations */}
        {pendingConfirm && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tasks-confirm-title"
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#1A1512]/60 p-4 backdrop-blur-[1px]"
          >
            <div className="w-full max-w-md rounded-xl border border-[#DFD2C0] bg-[#FAF6F0] p-6 shadow-2xl">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    pendingConfirm.tone === 'danger'
                      ? 'bg-[#FDF2EF] text-[#B5472A]'
                      : 'bg-[#EDF4F1] text-[#4D7C6F]'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3
                    id="tasks-confirm-title"
                    className="font-display text-base font-bold text-[#29221D]"
                  >
                    {pendingConfirm.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5C5046]">
                    {pendingConfirm.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="cursor-pointer rounded-lg border border-[#D4C6B4] bg-white px-4 py-2 text-xs font-semibold text-[#52473E] transition-colors hover:bg-[#F2EAE0]"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void runConfirmedMutation()}
                  className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors ${
                    pendingConfirm.tone === 'danger'
                      ? 'bg-[#B5472A] hover:bg-[#993A21]'
                      : 'bg-[#D97736] hover:bg-[#C6682A]'
                  }`}
                >
                  {pendingConfirm.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

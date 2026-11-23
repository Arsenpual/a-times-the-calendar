import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  Edit3,
  Loader2,
  LogOut,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ASSETS,
  type GoogleTask,
  type GoogleTaskList,
  type TaskAssistantId,
} from '../types/game';
import {
  ASSISTANT_DISPLAY_NAMES,
  buildMinaTaskNotes,
  computeNextRecurringDueDate,
  detectMinaMentionInTitle,
  getDefaultScheduleTime,
  type MinaTaskRecurrence,
  parseMinaTaskMeta,
} from '../utils/minaTaskScheduler';
import { getLocalIsoDate } from '../utils/sleepLogsApi';
import {
  createTask,
  deleteTask,
  fetchTaskLists,
  fetchTasks,
  GoogleTasksApiError,
  updateTask,
} from '../utils/tasksApi';

interface TasksPinboardModalProps {
  googleUser: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  authError: string | null;
  runningMinaTaskIds?: string[];
  boardRefreshNonce?: number;
  onRunMinaTaskNow?: (
    taskListId: string,
    task: GoogleTask,
    options?: { refineInstruction?: string }
  ) => Promise<void>;
  onOpenAssistantChat?: (assistantId: TaskAssistantId) => void;
  onTasksChanged?: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onTokenExpired: () => void;
  onClose: () => void;
}

const MINA_TASK_TEMPLATES: Array<{
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

type TaskFilter = 'pending' | 'completed' | 'all';

interface PendingConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  execute: () => Promise<void>;
}

function formatDueDate(iso?: string): string | null {
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

function GoogleSignInButton({
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

export function TasksPinboardModal({
  googleUser,
  accessToken,
  isSigningIn,
  authError,
  runningMinaTaskIds = [],
  boardRefreshNonce = 0,
  onRunMinaTaskNow,
  onOpenAssistantChat,
  onTasksChanged,
  onGoogleSignIn,
  onGoogleSignOut,
  onTokenExpired,
  onClose,
}: TasksPinboardModalProps) {
  const isAuthenticated = Boolean(googleUser && accessToken);

  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('pending');

  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssignToMina, setNewAssignToMina] = useState(false);
  const [newAssistantId, setNewAssistantId] = useState<TaskAssistantId>('mina');
  const [newRecurrence, setNewRecurrence] = useState<MinaTaskRecurrence>('none');
  const [newScheduledTime, setNewScheduledTime] = useState(() => getDefaultScheduleTime(2));
  const [showNewOptions, setShowNewOptions] = useState(false);

  // Inline edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssignToMina, setEditAssignToMina] = useState(false);
  const [editAssistantId, setEditAssistantId] = useState<TaskAssistantId>('mina');
  const [editRecurrence, setEditRecurrence] = useState<MinaTaskRecurrence>('none');
  const [editScheduledTime, setEditScheduledTime] = useState('09:00');
  const [editResetMinaRun, setEditResetMinaRun] = useState(false);

  // Mandatory explicit user confirmation dialog for all Google Tasks mutations
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof GoogleTasksApiError) {
        if (err.status === 401 || err.status === 403) {
          onTokenExpired();
        }
        setApiError(err.message);
      } else {
        setApiError('ไม่สามารถเชื่อมต่อกับ Google Tasks ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    },
    [onTokenExpired]
  );

  const loadListsAndTasks = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingLists(true);
    setApiError(null);
    try {
      const lists = await fetchTaskLists(accessToken);
      setTaskLists(lists);
      const targetId =
        lists.find((l) => l.id === selectedListId)?.id ?? lists[0]?.id ?? '';
      setSelectedListId(targetId);

      if (targetId) {
        setIsLoadingTasks(true);
        const listTasks = await fetchTasks(accessToken, targetId);
        setTasks(listTasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingLists(false);
      setIsLoadingTasks(false);
    }
  }, [accessToken, handleApiError, selectedListId]);

  const loadTasksForList = useCallback(
    async (listId: string) => {
      if (!accessToken || !listId) return;
      setIsLoadingTasks(true);
      setApiError(null);
      try {
        const listTasks = await fetchTasks(accessToken, listId);
        setTasks(listTasks);
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingTasks(false);
      }
    },
    [accessToken, handleApiError]
  );

  useEffect(() => {
    if (isAuthenticated) {
      void loadListsAndTasks();
    } else {
      setTaskLists([]);
      setSelectedListId('');
      setTasks([]);
      setApiError(null);
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh active task list whenever Mina finishes writing a scheduled summary in the background
  useEffect(() => {
    if (boardRefreshNonce > 0 && isAuthenticated && selectedListId) {
      void loadTasksForList(selectedListId);
    }
  }, [boardRefreshNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    setEditingTaskId(null);
    void loadTasksForList(listId);
  };

  const toggleNewAssignToMina = () => {
    setNewAssignToMina((prev) => {
      const next = !prev;
      if (next) {
        setShowNewOptions(true);
        setNewDueDate((curr) => curr || getLocalIsoDate());
        setNewScheduledTime((curr) => curr || getDefaultScheduleTime(2));
      }
      return next;
    });
  };

  const runConfirmedMutation = async () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm.execute;
    setPendingConfirm(null);
    setIsMutating(true);
    setApiError(null);
    try {
      await action();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const newTitleMention = useMemo(() => detectMinaMentionInTitle(newTitle), [newTitle]);
  const isNewTaskAssignedToMina = newAssignToMina || newTitleMention.matched;
  const effectiveNewAssistantId: TaskAssistantId = newAssignToMina
    ? newAssistantId
    : newTitleMention.matched
      ? newTitleMention.assistantId
      : newAssistantId;
  const effectiveNewAssistantName = ASSISTANT_DISPLAY_NAMES[effectiveNewAssistantId];
  const effectiveNewRecurrence: MinaTaskRecurrence =
    newRecurrence !== 'none' ? newRecurrence : newTitleMention.inlineRecurrence;

  const requestCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || !accessToken || !selectedListId) return;

    const currentListTitle =
      taskLists.find((l) => l.id === selectedListId)?.title ?? 'Google Tasks';
    const assignedToMina = newAssignToMina || newTitleMention.matched;
    const effectiveTime = newAssignToMina
      ? newScheduledTime || getDefaultScheduleTime(2)
      : newTitleMention.inlineTime;
    const effectiveDueDate = newDueDate
      ? newDueDate
      : newAssignToMina || Boolean(effectiveTime) || effectiveNewRecurrence !== 'none'
        ? getLocalIsoDate()
        : '';

    const needsStructuredHeader =
      newAssignToMina ||
      Boolean(effectiveTime) ||
      effectiveNewRecurrence !== 'none' ||
      effectiveNewAssistantId !== 'mina';

    const formattedNotes = needsStructuredHeader
      ? buildMinaTaskNotes({
          assignedToMina: true,
          assistantId: effectiveNewAssistantId,
          scheduledTime: effectiveTime,
          recurrence: effectiveNewRecurrence,
          status: 'pending',
          userPromptNotes: newNotes,
        })
      : newNotes.trim();

    const recurrenceText =
      effectiveNewRecurrence === 'daily'
        ? ' (ทำซ้ำทุกวัน)'
        : effectiveNewRecurrence === 'weekly'
          ? ' (ทำซ้ำทุกสัปดาห์)'
          : '';

    const scheduleHint = assignedToMina
      ? effectiveDueDate || effectiveTime
        ? ` โดยมอบหมายให้ ${effectiveNewAssistantName} ทำอัตโนมัติ${effectiveDueDate ? `วันที่ ${formatDueDate(effectiveDueDate) ?? effectiveDueDate}` : ''}${effectiveTime ? ` เวลา ${effectiveTime} น.` : ''}${recurrenceText} เมื่อเสร็จแล้วจะเดินมาเปิดแชทส่งงานให้ทันที`
        : ` โดยมอบหมายให้ ${effectiveNewAssistantName} เริ่มทำทันที${recurrenceText} เมื่อเสร็จแล้วจะเดินมาเปิดแชทส่งงานให้ทันที`
      : '';

    setPendingConfirm({
      title: assignedToMina
        ? `ยืนยันการสั่งงาน ${effectiveNewAssistantName} ลง Google Tasks`
        : 'ยืนยันการเพิ่มงานลง Google Tasks',
      description: `ต้องการสร้างงาน "${trimmed}" ในรายการ "${currentListTitle}"${scheduleHint} หรือไม่?`,
      confirmLabel: assignedToMina ? `สั่งงาน ${effectiveNewAssistantName}` : 'เพิ่มงาน',
      tone: 'primary',
      execute: async () => {
        const created = await createTask(accessToken, selectedListId, {
          title: trimmed,
          notes: formattedNotes,
          dueDate: effectiveDueDate || undefined,
        });
        setTasks((prev) => [created, ...prev]);
        setNewTitle('');
        setNewNotes('');
        setNewDueDate('');
        setNewAssignToMina(false);
        setNewAssistantId('mina');
        setNewRecurrence('none');
        setNewScheduledTime(getDefaultScheduleTime(2));
        setShowNewOptions(false);
        onTasksChanged?.();
      },
    });
  };

  const requestToggleStatus = (task: GoogleTask) => {
    if (!accessToken || !selectedListId) return;
    const nextStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    const meta = parseMinaTaskMeta(task);
    const nextDueIso =
      nextStatus === 'completed' && meta.assignedToMina && meta.recurrence !== 'none'
        ? computeNextRecurringDueDate(meta.scheduledDateIso, meta.recurrence)
        : null;
    const recurrenceDesc = nextDueIso
      ? ` (ระบบจะสร้างงานรอบถัดไปสำหรับวันที่ ${formatDueDate(nextDueIso) ?? nextDueIso} ให้อัตโนมัติ)`
      : '';

    setPendingConfirm({
      title:
        nextStatus === 'completed'
          ? 'ยืนยันการทำเครื่องหมายว่าเสร็จแล้ว'
          : 'ยืนยันการย้ายกลับเป็นงานที่ต้องทำ',
      description:
        nextStatus === 'completed'
          ? `ต้องการอัปเดตสถานะงาน "${task.title}" เป็นเสร็จสิ้นใน Google Tasks หรือไม่?${recurrenceDesc}`
          : `ต้องการเปิดงาน "${task.title}" กลับมาเป็นยังไม่เสร็จใน Google Tasks หรือไม่?`,
      confirmLabel: nextStatus === 'completed' ? 'ติ๊กเสร็จสิ้น' : 'เปิดงานอีกครั้ง',
      tone: 'primary',
      execute: async () => {
        const updated = await updateTask(accessToken, selectedListId, task.id, {
          status: nextStatus,
        });
        let nextCreated: GoogleTask | null = null;
        if (nextDueIso) {
          const nextNotes = buildMinaTaskNotes({
            assignedToMina: true,
            assistantId: meta.assistantId,
            scheduledTime: meta.scheduledTime,
            recurrence: meta.recurrence,
            status: 'pending',
            userPromptNotes: meta.userPromptNotes,
          });
          nextCreated = await createTask(accessToken, selectedListId, {
            title: task.title,
            notes: nextNotes,
            dueDate: nextDueIso,
          });
        }
        setTasks((prev) => {
          const mapped = prev.map((t) => (t.id === task.id ? updated : t));
          return nextCreated ? [nextCreated, ...mapped] : mapped;
        });
        onTasksChanged?.();
      },
    });
  };

  const startEditing = (task: GoogleTask) => {
    const meta = parseMinaTaskMeta(task);
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditNotes(meta.userPromptNotes);
    setEditDueDate(task.due ? task.due.slice(0, 10) : '');
    setEditAssignToMina(meta.assignedToMina);
    setEditAssistantId(meta.assistantId);
    setEditRecurrence(meta.recurrence);
    setEditScheduledTime(meta.scheduledTime ?? getDefaultScheduleTime(2));
    setEditResetMinaRun(false);
  };

  const requestSaveEdit = (task: GoogleTask) => {
    const trimmed = editTitle.trim();
    if (!trimmed || !accessToken || !selectedListId) return;

    const existingMeta = parseMinaTaskMeta(task);
    const effectiveDueDate = editAssignToMina
      ? editDueDate || getLocalIsoDate()
      : editDueDate;
    const effectiveTime = editAssignToMina ? editScheduledTime || '09:00' : null;
    const keepSummary =
      editAssignToMina && !editResetMinaRun && existingMeta.status === 'ready_for_review';

    const nextNotes = buildMinaTaskNotes({
      assignedToMina: editAssignToMina,
      assistantId: editAssistantId,
      scheduledTime: effectiveTime,
      recurrence: editAssignToMina ? editRecurrence : 'none',
      status: keepSummary ? 'ready_for_review' : 'pending',
      completedAtLabel: keepSummary ? existingMeta.completedAtLabel : null,
      userPromptNotes: editNotes,
      minaSummary: keepSummary ? existingMeta.minaSummary : null,
      minaSummaryHeader: keepSummary ? existingMeta.minaSummaryHeader : null,
    });

    setPendingConfirm({
      title: 'ยืนยันการบันทึกการแก้ไขงาน',
      description: `ต้องการอัปเดตรายละเอียดงาน "${trimmed}" ในบัญชี Google Tasks หรือไม่?`,
      confirmLabel: 'บันทึกการแก้ไข',
      tone: 'primary',
      execute: async () => {
        const updated = await updateTask(accessToken, selectedListId, task.id, {
          title: trimmed,
          notes: nextNotes,
          dueDate: effectiveDueDate || null,
        });
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        setEditingTaskId(null);
        onTasksChanged?.();
      },
    });
  };

  const requestDeleteTask = (task: GoogleTask) => {
    if (!accessToken || !selectedListId) return;

    setPendingConfirm({
      title: 'ยืนยันการลบงานออกจาก Google Tasks',
      description: `ต้องการลบงาน "${task.title}" ออกจาก Google Tasks อย่างถาวรหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      confirmLabel: 'ลบงานถาวร',
      tone: 'danger',
      execute: async () => {
        await deleteTask(accessToken, selectedListId, task.id);
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        if (editingTaskId === task.id) {
          setEditingTaskId(null);
        }
        onTasksChanged?.();
      },
    });
  };

  const counts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let minaScheduled = 0;
    let minaReview = 0;
    for (const t of tasks) {
      if (t.status === 'completed') {
        completed += 1;
      } else {
        pending += 1;
        const meta = parseMinaTaskMeta(t);
        if (meta.assignedToMina) {
          if (meta.status === 'ready_for_review') minaReview += 1;
          else minaScheduled += 1;
        }
      }
    }
    return { pending, completed, all: tasks.length, minaScheduled, minaReview };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filter === 'pending') return tasks.filter((t) => t.status !== 'completed');
    if (filter === 'completed') return tasks.filter((t) => t.status === 'completed');
    return tasks;
  }, [filter, tasks]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="กระดานโน้ตห้องทำงาน Google Tasks"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0C0A09]/80 p-3 backdrop-blur-xs sm:p-6"
    >
      {/* Corkboard Wood-Framed Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-4 border-[#69462D] bg-[#FAF6F0] text-[#29221D] shadow-2xl"
      >
        {/* Top Corkboard Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#D8C5AE] bg-[#EFE5D7] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4D7C6F] text-[#FAF6F0]">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-bold text-[#29221D]">
                กระดานงานห้องทำงาน · Google Tasks
              </h2>
              <p className="truncate text-xs text-[#6E6258]">
                ซิงก์รายการงานจริงกับบัญชี Google Tasks ของคุณ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && googleUser && (
              <>
                <button
                  type="button"
                  onClick={() => void loadListsAndTasks()}
                  disabled={isLoadingLists || isLoadingTasks}
                  title="รีเฟรชรายการงาน"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] text-[#52473E] transition-colors hover:bg-[#E7DCCE] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoadingLists || isLoadingTasks ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  title="ออกจากระบบบัญชี Google"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-2.5 text-xs font-medium text-[#52473E] transition-colors hover:bg-[#E7DCCE]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ออกจากระบบ</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-3 text-xs font-semibold text-[#3D342D] transition-colors hover:bg-[#E7DCCE]"
            >
              <X className="h-3.5 w-3.5" />
              <span>ปิดกระดาน</span>
            </button>
          </div>
        </header>

        {/* Auth or API Error Strip */}
        {(authError || apiError) && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFB4A8] bg-[#FDF2EF] px-5 py-2.5 text-xs text-[#8C2F1B]"
          >
            <span>{authError || apiError}</span>
            <button
              type="button"
              onClick={isAuthenticated ? () => void loadListsAndTasks() : onGoogleSignIn}
              className="cursor-pointer rounded-md bg-[#8C2F1B] px-3 py-1 font-semibold text-white hover:bg-[#732515]"
            >
              {isAuthenticated ? 'ลองโหลดใหม่' : 'Sign in with Google'}
            </button>
          </div>
        )}

        {/* Unauthenticated Sign-In Screen */}
        {!isAuthenticated ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-5 rounded-2xl border border-[#DFD2C0] bg-white p-8 shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EDF4F1] text-[#4D7C6F]">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-[#29221D]">
                  เชื่อมต่อกระดานโน้ตกับ Google Tasks
                </h3>
                <p className="text-sm leading-relaxed text-[#6E6258]">
                  เข้าสู่ระบบด้วยบัญชี Google เพื่อดึงรายการงานจาก Google Tasks มาปักบนกระดานห้องทำงาน เพิ่มงานใหม่ ติ๊กเสร็จ และแก้ไขซิงก์กับมือถือของคุณได้ทันที
                </p>
              </div>
              <div className="pt-1">
                <GoogleSignInButton onClick={onGoogleSignIn} disabled={isSigningIn} />
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Google Tasks Board */
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Task List Selector & Status Filter Toolbar */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E2D9CC] bg-[#F6EFE5] px-5 py-3">
              {/* TaskList switcher */}
              <div className="cozy-scroll flex max-w-full items-center gap-1.5 overflow-x-auto">
                {taskLists.map((list) => {
                  const active = list.id === selectedListId;
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => handleSelectList(list.id)}
                      className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#29221D] text-[#FAF6F0]'
                          : 'bg-[#E9DFD2] text-[#5C5046] hover:bg-[#DFD2C1] hover:text-[#29221D]'
                      }`}
                    >
                      {list.title}
                    </button>
                  );
                })}
              </div>

              {/* Status segmented filter */}
              <div className="flex items-center gap-1 rounded-lg bg-[#EAE0D3] p-1">
                {(
                  [
                    { id: 'pending', label: `ต้องทำ (${counts.pending})` },
                    { id: 'completed', label: `เสร็จแล้ว (${counts.completed})` },
                    { id: 'all', label: `ทั้งหมด (${counts.all})` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                      filter === item.id
                        ? 'bg-[#FAF6F0] text-[#29221D] shadow-xs'
                        : 'text-[#6E6258] hover:text-[#29221D]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add New Task Composer (supports typing activity + "มีน่า"/"นีน่า" or explicit schedule toggle) */}
            <form
              onSubmit={requestCreateTask}
              className="shrink-0 border-b border-[#E2D9CC] bg-[#FAF6F0] px-5 py-3.5"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onFocus={() => setShowNewOptions(true)}
                  placeholder={
                    isNewTaskAssignedToMina
                      ? 'เช่น ร่างอีเมล์ "มีน่า" 14:30 หรือพิมพ์คำสั่งเพิ่มเติมด้านล่าง...'
                      : 'ปักโน้ตงานใหม่ หรือฝังชื่อผู้ช่วย เช่น ร่างอีเมล์ "มีน่า"...'
                  }
                  disabled={isMutating || !selectedListId}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[#D4C6B4] bg-white px-3.5 text-sm text-[#29221D] placeholder:text-[#96897D] focus:border-[#D97736] focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={toggleNewAssignToMina}
                  disabled={isMutating || !selectedListId}
                  className={`inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    isNewTaskAssignedToMina
                      ? 'border-[#3F6F62] bg-[#E5F2EE] text-[#285247]'
                      : 'border-[#D4C6B4] bg-white text-[#5C5046] hover:bg-[#F3ECE2]'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#3F6F62]" />
                  <span>
                    {newAssignToMina
                      ? `ตั้งเวลา ${effectiveNewAssistantName} แล้ว`
                      : newTitleMention.matched
                        ? `พบชื่อ ${effectiveNewAssistantName} · ตั้งเวลาเพิ่ม`
                        : 'สั่งงาน AI'}
                  </span>
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || isMutating || !selectedListId}
                  className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#D97736] px-4 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A] disabled:cursor-not-allowed disabled:bg-[#CFC4B6]"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {newAssignToMina
                      ? `ตั้งเวลาสั่ง ${effectiveNewAssistantName}`
                      : newTitleMention.matched
                        ? `สั่งงาน ${effectiveNewAssistantName}`
                        : 'เพิ่มงาน'}
                  </span>
                </button>
              </div>

              {(showNewOptions || isNewTaskAssignedToMina) && (
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
                          onChange={(e) =>
                            setNewRecurrence(e.target.value as MinaTaskRecurrence)
                          }
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
                            ตรวจพบชื่อผู้ช่วยในชื่องาน (<strong>{newTitleMention.cleanTitle}</strong>) — <strong>{effectiveNewAssistantName}</strong> จะทำ
                            {newTitleMention.inlineTime
                              ? `ตอนเวลา ${newTitleMention.inlineTime} น.`
                              : newDueDate
                                ? `ตามวันที่ ${formatDueDate(newDueDate) ?? newDueDate}`
                                : 'ทันที'}
                            {effectiveNewRecurrence === 'daily'
                              ? ' (ซ้ำทุกวัน)'
                              : effectiveNewRecurrence === 'weekly'
                                ? ' (ซ้ำทุกสัปดาห์)'
                                : ''}
                            {' '}เมื่อทำงานเสร็จจะเดินมาหา แล้วเปิดแชทส่งงานให้คุณตรวจทันทีครับ
                          </>
                        ) : (
                          <>
                            เมื่อถึงวันและเวลาที่ตั้งไว้ <strong>{effectiveNewAssistantName}</strong> จะลงมือทำงาน
                            {effectiveNewRecurrence === 'daily'
                              ? ' (และสร้างรอบวันถัดไปเมื่อคุณติ๊กเสร็จ)'
                              : effectiveNewRecurrence === 'weekly'
                                ? ' (และสร้างรอบสัปดาห์ถัดไปเมื่อคุณติ๊กเสร็จ)'
                                : ''}
                            {' '}พอเสร็จแล้วจะเดินมาหา เปิดแชท และเริ่มบทสนทนาเพื่อส่งงานทันที (หรือแจ้งข้อผิดพลาดผ่านแชทถ้ามีปัญหา) ครับ
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
              )}

              {(counts.minaScheduled > 0 || counts.minaReview > 0) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                  {counts.minaReview > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#9DC3B8] bg-[#E5F2EE] px-2.5 py-1 font-semibold text-[#234C42]">
                      <Sparkles className="h-3 w-3 text-[#2E7D6B]" />
                      <span>มีน่าส่งงานรอตรวจ {counts.minaReview} รายการ</span>
                    </span>
                  )}
                  {counts.minaScheduled > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E2D2B8] bg-[#FBF4E7] px-2.5 py-1 font-medium text-[#7B5224]">
                      <Clock className="h-3 w-3 text-[#C87A2B]" />
                      <span>ตั้งเวลาให้มีน่าไว้ {counts.minaScheduled} รายการ</span>
                    </span>
                  )}
                </div>
              )}
            </form>

            {/* Corkboard Task Cards Area */}
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
          </div>
        )}

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
      </div>
    </div>
  );
}

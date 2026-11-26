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
} from '../lib/minaTaskScheduler';
import { getLocalIsoDate } from '../api/sleepLogsApi';
import {
  createTask,
  deleteTask,
  fetchTaskLists,
  fetchTasks,
  GoogleTasksApiError,
  updateTask,
} from '../api/tasksApi';

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

import {
  formatDueDate,
  GoogleSignInButton,
  type PendingConfirmation,
  type TaskFilter,
  TasksPinboardCardsArea,
  TasksPinboardConfirmDialog,
  TasksPinboardNewTaskOptions,
} from './TasksPinboardSubsections';

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
      } else {
        setNewRecurrence('none');
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

  const requestDeleteTask = async (task: GoogleTask) => {
    if (!accessToken || !selectedListId || isMutating) return;
    setIsMutating(true);
    setApiError(null);
    try {
      await deleteTask(accessToken, selectedListId, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (editingTaskId === task.id) {
        setEditingTaskId(null);
      }
      onTasksChanged?.();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsMutating(false);
    }
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

              <TasksPinboardNewTaskOptions
                showNewOptions={showNewOptions}
                isNewTaskAssignedToMina={isNewTaskAssignedToMina}
                newNotes={newNotes}
                setNewNotes={setNewNotes}
                effectiveNewAssistantName={effectiveNewAssistantName}
                newDueDate={newDueDate}
                setNewDueDate={setNewDueDate}
                effectiveNewAssistantId={effectiveNewAssistantId}
                setNewAssistantId={setNewAssistantId}
                setNewAssignToMina={setNewAssignToMina}
                effectiveNewRecurrence={effectiveNewRecurrence}
                setNewRecurrence={setNewRecurrence}
                newAssignToMina={newAssignToMina}
                newScheduledTime={newScheduledTime}
                setNewScheduledTime={setNewScheduledTime}
                newTitleMention={newTitleMention}
                setNewTitle={setNewTitle}
                setShowNewOptions={setShowNewOptions}
              />

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

            <TasksPinboardCardsArea
              isLoadingLists={isLoadingLists}
              isLoadingTasks={isLoadingTasks}
              filteredTasks={filteredTasks}
              filter={filter}
              editingTaskId={editingTaskId}
              setEditingTaskId={setEditingTaskId}
              runningMinaTaskIds={runningMinaTaskIds}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              editNotes={editNotes}
              setEditNotes={setEditNotes}
              editAssignToMina={editAssignToMina}
              editDueDate={editDueDate}
              setEditDueDate={setEditDueDate}
              editAssistantId={editAssistantId}
              setEditAssistantId={setEditAssistantId}
              editRecurrence={editRecurrence}
              setEditRecurrence={setEditRecurrence}
              editScheduledTime={editScheduledTime}
              setEditScheduledTime={setEditScheduledTime}
              editResetMinaRun={editResetMinaRun}
              setEditResetMinaRun={setEditResetMinaRun}
              requestSaveEdit={requestSaveEdit}
              isMutating={isMutating}
              requestToggleStatus={requestToggleStatus}
              onOpenAssistantChat={onOpenAssistantChat}
              onRunMinaTaskNow={onRunMinaTaskNow}
              selectedListId={selectedListId}
              startEditing={startEditing}
              requestDeleteTask={requestDeleteTask}
            />
          </div>
        )}

        <TasksPinboardConfirmDialog
          pendingConfirm={pendingConfirm}
          setPendingConfirm={setPendingConfirm}
          runConfirmedMutation={runConfirmedMutation}
        />
      </div>
    </div>
  );
}

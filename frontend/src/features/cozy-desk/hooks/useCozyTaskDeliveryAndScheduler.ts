import { useCallback, useEffect, useRef } from 'react';
import type {
  AssistantTaskDelivery,
  ChatMessage,
  GoogleTask,
  TaskAssistantId,
} from '../types/game';
import { fetchGmailMessages } from '../api/gmailApi';
import {
  formatTaskDeliveryChatMessage,
  formatThaiShortDateTime,
  markMinaTaskStatusInNotes,
  markTaskDeliveredInChat,
  parseMinaTaskMeta,
} from '../lib/minaTaskScheduler';
import { formatSleepTimeSummary } from '../api/sleepLogsApi';
import { soundEngine } from '../lib/sound';
import {
  fetchAllTaskListsWithTasks,
  GoogleTasksApiError,
  updateTask,
  type GoogleTaskListWithTasks,
} from '../api/tasksApi';
import { cozyApiFetch } from '../api/cozyApi';


export function useCozyTaskDeliveryAndScheduler(ctx: any) {
  const {
    setPlayerSeat,
    setMinaActionMenu,
    setMessages,
    workMode,
    setGameState,
    setAssistantMood,
    showMinaBubble,
    setDeliveredChatTaskAgy,
    setIsAntigravityOpen,
    setDeliveredChatTaskAiStudio,
    setIsAiStudioOpen,
    inFlightDeliveryRef,
    pendingDeliveriesRef,
    uiBlockersRef,
    setIsPinboardOpen,
    showToast,
    setDeliveryWalkCommand,
    isTvOpen,
    isDriveOpen,
    isMailboxOpen,
    isSleepLogOpen,
    isAntigravityOpen,
    isAiStudioOpen,
    gameState,
    setMinaSummonCommand,
    youtubeToken,
    runningMinaTaskIdsRef,
    setRunningMinaTaskIds,
    syncedTaskLists,
    todayIsoDate,
    timeOfDay,
    sleepLogs,
    setSyncedTaskLists,
    setMinaReadyReviewCount,
    setTasksBoardRefreshNonce,
    fetchCharacterStatuses,
    handleYouTubeTokenExpired,
    setIsSleepLogOpen,
    handleUpdateCharacterActivity,
    googleUser,
    isScanningMinaTasksRef,
    setTasksSyncError,
  } = ctx;

  const deliverTaskToAssistantChat = useCallback(
    (delivery: AssistantTaskDelivery) => {
      const shortTitle =
        delivery.cleanTitle.length > 32
          ? `${delivery.cleanTitle.slice(0, 32)}…`
          : delivery.cleanTitle;

      setPlayerSeat(null);
      setMinaActionMenu(null);
      soundEngine.playEnterOffice();
      soundEngine.playMessageReceived();

      if (delivery.assistantId === 'mina') {
        const content = formatTaskDeliveryChatMessage(delivery);
        setMessages((prev) => [
          ...prev,
          {
            id: `mina-task-${delivery.id}`,
            role: 'assistant',
            content,
            mode: workMode,
            createdAt: Date.now(),
          },
        ]);
        setGameState('WORKING');
        setAssistantMood(delivery.success ? 'greeting' : 'idle');
        showMinaBubble(
          delivery.success
            ? `มาถึงแล้วครับ! ส่งงาน "${shortTitle}" ในแชทเรียบร้อยแล้ว`
            : `ขออภัยครับ มีข้อผิดพลาดในงาน "${shortTitle}" แจ้งในแชทแล้ว`,
          4500
        );
        window.setTimeout(() => {
          setAssistantMood((curr) => (curr === 'greeting' ? 'idle' : curr));
        }, 2000);
      } else if (delivery.assistantId === 'antigravity') {
        setDeliveredChatTaskAgy(delivery);
        setIsAntigravityOpen(true);
      } else {
        setDeliveredChatTaskAiStudio(delivery);
        setIsAiStudioOpen(true);
      }
    },
    [showMinaBubble, workMode]
  );

  const dispatchNextDelivery = useCallback(() => {
    if (inFlightDeliveryRef.current || pendingDeliveriesRef.current.length === 0) {
      return;
    }
    const ui = uiBlockersRef.current;
    if (ui.isTvOpen || ui.isDriveOpen || ui.isMailboxOpen || ui.isSleepLogOpen) {
      return;
    }

    const next = pendingDeliveriesRef.current[0];
    const isTargetChatAlreadyOpen =
      (next.assistantId === 'mina' && ui.gameState === 'WORKING') ||
      (next.assistantId === 'antigravity' && ui.isAntigravityOpen) ||
      (next.assistantId === 'ai_studio' && ui.isAiStudioOpen);

    // If a DIFFERENT assistant's chat is currently open, wait until user finishes and closes it
    const isAnotherChatOpen =
      !isTargetChatAlreadyOpen &&
      (ui.gameState === 'WORKING' || ui.isAntigravityOpen || ui.isAiStudioOpen);
    if (isAnotherChatOpen) {
      return;
    }

    pendingDeliveriesRef.current.shift();

    if (ui.isPinboardOpen) {
      setIsPinboardOpen(false);
    }

    if (isTargetChatAlreadyOpen) {
      deliverTaskToAssistantChat(next);
      return;
    }

    inFlightDeliveryRef.current = next;
    const shortTitle =
      next.cleanTitle.length > 28 ? `${next.cleanTitle.slice(0, 28)}…` : next.cleanTitle;
    const bubbleText = next.success
      ? `ทำงาน "${shortTitle}" เสร็จแล้ว กำลังเดินไปส่งในแชทครับ!`
      : `งาน "${shortTitle}" พบข้อผิดพลาด กำลังเดินไปแจ้งในแชทครับ`;

    if (next.assistantId === 'mina') {
      showMinaBubble(bubbleText, 5500);
    }
    showToast(
      next.success
        ? `${next.assistantName} ทำงาน "${shortTitle}" เสร็จแล้ว — กำลังเดินมาเปิดแชทส่งงาน`
        : `${next.assistantName} พบข้อผิดพลาดระหว่างทำงาน "${shortTitle}" — กำลังเดินมาแจ้งในแชท`,
      next.assistantId === 'mina' ? 'mina' : 'house'
    );

    setDeliveryWalkCommand({
      id: next.id,
      assistantId: next.assistantId,
      bubbleText,
    });
  }, [deliverTaskToAssistantChat, showMinaBubble, showToast]);

  const enqueueTaskDelivery = useCallback(
    (delivery: AssistantTaskDelivery) => {
      pendingDeliveriesRef.current.push(delivery);
      dispatchNextDelivery();
    },
    [dispatchNextDelivery]
  );

  const handleAssistantDeliveryArrived = useCallback(
    (commandId: number, assistantId: TaskAssistantId) => {
      const pending = inFlightDeliveryRef.current;
      if (!pending || (pending.id !== commandId && pending.assistantId !== assistantId)) {
        return;
      }
      inFlightDeliveryRef.current = null;
      deliverTaskToAssistantChat(pending);
    },
    [deliverTaskToAssistantChat]
  );

  // Resume queued chat deliveries as soon as blocking modals or another assistant chat closes
  useEffect(() => {
    if (
      !isTvOpen &&
      !isDriveOpen &&
      !isMailboxOpen &&
      !isSleepLogOpen &&
      !isAntigravityOpen &&
      !isAiStudioOpen &&
      gameState === 'PLAYING'
    ) {
      dispatchNextDelivery();
    }
  }, [
    dispatchNextDelivery,
    gameState,
    isAiStudioOpen,
    isAntigravityOpen,
    isDriveOpen,
    isMailboxOpen,
    isSleepLogOpen,
    isTvOpen,
  ]);

  const handleOpenAssistantChatFromPinboard = useCallback(
    (assistantId: TaskAssistantId) => {
      soundEngine.playInteract();
      setIsPinboardOpen(false);
      setPlayerSeat(null);
      if (assistantId === 'mina') {
        setGameState('WORKING');
        setMinaSummonCommand({ id: Date.now(), mode: 'chat_then_walk' });
      } else if (assistantId === 'antigravity') {
        setIsAntigravityOpen(true);
      } else {
        setIsAiStudioOpen(true);
      }
    },
    []
  );

  const countMinaReadyReviewTasks = useCallback((lists: GoogleTaskListWithTasks[]): number => {
    let total = 0;
    for (const list of lists) {
      for (const task of list.tasks) {
        if (task.status === 'completed') continue;
        const meta = parseMinaTaskMeta(task);
        if (meta.assignedToMina && meta.status === 'ready_for_review') {
          total += 1;
        }
      }
    }
    return total;
  }, []);

  const executeMinaScheduledTask = useCallback(
    async (
      taskListId: string,
      task: GoogleTask,
      options?: { triggerSource?: 'schedule' | 'manual'; refineInstruction?: string }
    ) => {
      if (!youtubeToken || runningMinaTaskIdsRef.current.has(task.id)) {
        return;
      }

      runningMinaTaskIdsRef.current.add(task.id);
      setRunningMinaTaskIds(Array.from(runningMinaTaskIdsRef.current));

      const shortTitle = task.title.length > 36 ? `${task.title.slice(0, 36)}…` : task.title;
      const meta = parseMinaTaskMeta(task);
      const assistantLabel = meta.assistantName;
      const refineInstruction = options?.refineInstruction?.trim() || '';

      setAssistantMood('thinking');
      showMinaBubble(
        refineInstruction
          ? `รับทราบครับ! ${assistantLabel} กำลังปรับปรุงผลงาน "${shortTitle}" ตามคำสั่งใหม่อยู่ครับ`
          : options?.triggerSource === 'manual'
            ? `รับทราบครับ! ${assistantLabel} เริ่มทำงาน "${shortTitle}" แล้ว เสร็จแล้วจะเขียนสรุปลงโน้ต Task ให้นะครับ`
            : `ถึงเวลานัดแล้วครับ! ${assistantLabel} เริ่มทำงานตาม Task "${shortTitle}" แล้วนะครับ`,
        5500
      );

      try {
        // Best-effort live Gmail & pending Google Tasks context so Mina works with real user data
        let gmailContext: Array<{
          subject: string;
          from: string;
          snippet: string;
          isUnread: boolean;
          date: string;
        }> = [];
        if (meta.assistantId === 'mina') {
          try {
            const recentEmails = await Promise.race([
              fetchGmailMessages(youtubeToken, { filter: 'inbox', maxResults: 8 }),
              new Promise<never>((_, reject) => {
                window.setTimeout(() => reject(new Error('GMAIL_TIMEOUT')), 3500);
              }),
            ]);
            gmailContext = recentEmails.map((m) => ({
              subject: m.subject,
              from: m.fromEmail ? `${m.fromName} <${m.fromEmail}>` : m.fromName,
              snippet: m.snippet,
              isUnread: m.isUnread,
              date: new Date(m.internalDate).toISOString().slice(0, 10),
            }));
          } catch {
            // Ignore Gmail scope/timeout errors so scheduled tasks still run smoothly
          }
        }

        const pendingTasksContext: Array<{
          listTitle: string;
          title: string;
          dueDate?: string;
        }> = [];
        for (const list of syncedTaskLists ?? []) {
          for (const item of list.tasks) {
            if (item.id === task.id || item.status === 'completed') continue;
            pendingTasksContext.push({
              listTitle: list.title,
              title: item.title,
              dueDate: item.due ? item.due.slice(0, 10) : undefined,
            });
            if (pendingTasksContext.length >= 25) break;
          }
          if (pendingTasksContext.length >= 25) break;
        }

        const res = await cozyApiFetch('/api/assistant/execute-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistantId: meta.assistantId,
            title: meta.cleanTaskTitle || task.title,
            notes: meta.userPromptNotes,
            dueDate: meta.scheduledDateIso ?? undefined,
            scheduledTime: meta.scheduledTime ?? undefined,
            localDate: todayIsoDate,
            timeOfDay,
            sleepLogsContext: sleepLogs.slice(0, 14),
            gmailContext,
            pendingTasksContext,
            ...(refineInstruction ? { refineInstruction } : {}),
            ...(refineInstruction && meta.minaSummary
              ? { previousSummary: meta.minaSummary }
              : {}),
          }),
        });

        if (!res.ok) {
          let errMsg = `${assistantLabel} ไม่สามารถรันงานตาม Task ได้ในขณะนี้`;
          try {
            const payload = (await res.json()) as { error?: string };
            if (payload.error) errMsg = payload.error;
          } catch {
            // Keep default message
          }
          throw new Error(errMsg);
        }

        const data = (await res.json()) as { summary?: string };
        const summaryText = (data.summary ?? '').trim();
        if (!summaryText) {
          throw new Error(`ไม่ได้รับข้อความสรุปผลงานจาก ${assistantLabel}`);
        }

        const completedDate = new Date();
        const updatedNotes = markTaskDeliveredInChat(task, completedDate);

        // Keep Task notes clean with chat-delivery status while keeping status='needsAction' so user reviews in chat & checks off manually
        const updatedTask = await updateTask(youtubeToken, taskListId, task.id, {
          notes: updatedNotes,
        });

        setSyncedTaskLists((prev) => {
          if (!prev) return prev;
          const nextLists = prev.map((list) =>
            list.id !== taskListId
              ? list
              : {
                  ...list,
                  tasks: list.tasks.map((t) => (t.id === task.id ? updatedTask : t)),
                }
          );
          setMinaReadyReviewCount(countMinaReadyReviewTasks(nextLists));
          return nextLists;
        });

        setTasksBoardRefreshNonce((n) => n + 1);
        void fetchCharacterStatuses();

        enqueueTaskDelivery({
          id: Date.now(),
          assistantId: meta.assistantId,
          assistantName: assistantLabel,
          taskListId,
          taskId: task.id,
          taskTitle: task.title,
          cleanTitle: meta.cleanTaskTitle || task.title,
          scheduledTime: meta.scheduledTime,
          completedAtLabel: formatThaiShortDateTime(completedDate),
          success: true,
          summary: summaryText,
        });
      } catch (err) {
        if (err instanceof GoogleTasksApiError && (err.status === 401 || err.status === 403)) {
          handleYouTubeTokenExpired();
        }
        const msg =
          err instanceof Error
            ? err.message
            : `เกิดข้อผิดพลาดระหว่างให้ ${assistantLabel} ทำงานตาม Task`;
        // Persist failed status in Google Tasks notes so scheduled polling does not infinitely retry every 20s
        if (!(err instanceof GoogleTasksApiError && (err.status === 401 || err.status === 403))) {
          try {
            const failedNotes = markMinaTaskStatusInNotes(task, 'failed', msg);
            const failedTask = await updateTask(youtubeToken, taskListId, task.id, {
              notes: failedNotes,
            });
            setSyncedTaskLists((prev) =>
              prev
                ? prev.map((list) =>
                    list.id !== taskListId
                      ? list
                      : {
                          ...list,
                          tasks: list.tasks.map((t) => (t.id === task.id ? failedTask : t)),
                        }
                  )
                : prev
            );
            setTasksBoardRefreshNonce((n) => n + 1);
          } catch {
            // Ignore secondary update failure
          }
        }
        enqueueTaskDelivery({
          id: Date.now(),
          assistantId: meta.assistantId,
          assistantName: assistantLabel,
          taskListId,
          taskId: task.id,
          taskTitle: task.title,
          cleanTitle: meta.cleanTaskTitle || task.title,
          scheduledTime: meta.scheduledTime,
          completedAtLabel: formatThaiShortDateTime(new Date()),
          success: false,
          errorMessage: msg,
        });
      } finally {
        runningMinaTaskIdsRef.current.delete(task.id);
        setRunningMinaTaskIds(Array.from(runningMinaTaskIdsRef.current));
        setAssistantMood('idle');
      }
    },
    [
      countMinaReadyReviewTasks,
      enqueueTaskDelivery,
      fetchCharacterStatuses,
      handleYouTubeTokenExpired,
      showMinaBubble,
      sleepLogs,
      syncedTaskLists,
      timeOfDay,
      todayIsoDate,
      youtubeToken,
    ]
  );

  const runningSleepAnalysisRef = useRef(false);

  const handleAskMinaAnalyzeSleep = useCallback(async () => {
    if (runningSleepAnalysisRef.current || sleepLogs.length === 0) return;
    runningSleepAnalysisRef.current = true;

    const totalDays = sleepLogs.length;
    const taskTitle = `สรุปภาพรวมการนอนทั้งหมด (${totalDays} วัน)`;
    soundEngine.playInteract();
    setIsSleepLogOpen(false);
    setGameState('PLAYING');
    setAssistantMood('thinking');
    handleUpdateCharacterActivity('mina', {
      busy: true,
      taskLabel: `สรุปภาพรวมการนอน ${totalDays} วัน`,
    });
    showMinaBubble(`รับทราบครับ! กำลังรวบรวมสรุปภาพรวมการนอน ${totalDays} วันให้สักครู่นะครับ`, 5000);
    showToast(`มีน่ากำลังสรุปภาพรวมข้อมูลการนอน ${totalDays} วัน — เสร็จแล้วจะเดินมาส่งในแชท`, 'mina');

    try {
      const notesPrompt = [
        `ช่วยสรุปภาพรวมข้อมูลการนอนทั้งหมดที่เก็บสะสมไว้จำนวน ${totalDays} วัน (จากไฟล์ .json) ตามเทมเพลตมาตรฐาน:`,
        '1) ### 📊 ภาพรวมสถิติการนอนทั้งหมด (จำนวนวัน, ช่วงวันที่, คะแนนการนอน เฉลี่ย/ต่ำสุด/สูงสุด, ระยะเวลานอนรวม เฉลี่ย/ต่ำสุด/สูงสุด, ช่วงเวลาเข้านอน–ตื่นนอนโดยรวม, สัดส่วนและเวลาเฉลี่ย หลับลึก/หลับตื้น/REM, และตัวชี้วัดเสริม: ความต่อเนื่องในการหลับลึก, คะแนนการหายใจ, จำนวนครั้งที่ตื่น)',
        '2) ### 📅 รายการสรุปรายวัน (สรุปทุกวันที่เก็บข้อมูลได้)',
        'ข้อห้ามสำคัญ: ห้ามใส่ข้อมูลที่ไม่เกี่ยวข้องกับการนอนเด็ดขาด (ห้ามพูดถึงความเครียด ห้ามใส่ชื่อแอป และไม่ต้องวิเคราะห์เชิงลึก)',
      ].join('\n');

      const res = await cozyApiFetch('/api/assistant/execute-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: 'mina',
          taskType: 'sleep_summary',
          title: taskTitle,
          notes: notesPrompt,
          localDate: todayIsoDate,
          timeOfDay,
          sleepLogsContext: sleepLogs,
        }),
      });

      if (!res.ok) {
        let errMsg = 'มีน่าไม่สามารถสรุปภาพรวมข้อมูลการนอนได้ในขณะนี้';
        try {
          const payload = (await res.json()) as { error?: string; detail?: string };
          if (payload.error) {
            errMsg = payload.detail ? `${payload.error} [${payload.detail}]` : payload.error;
          }
        } catch {
          // Keep default error message
        }
        throw new Error(errMsg);
      }

      const data = (await res.json()) as { summary?: string };
      const summaryText = (data.summary ?? '').trim();
      if (!summaryText) {
        throw new Error('ไม่ได้รับสรุปภาพรวมการนอนจากมีน่า');
      }

      enqueueTaskDelivery({
        id: Date.now(),
        assistantId: 'mina',
        assistantName: 'มีน่า (Mina)',
        taskListId: 'sleep-analysis',
        taskId: `sleep-summary-${Date.now()}`,
        taskTitle,
        cleanTitle: taskTitle,
        scheduledTime: null,
        completedAtLabel: formatThaiShortDateTime(new Date()),
        success: true,
        summary: summaryText,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดระหว่างให้มีน่าสรุปภาพรวมข้อมูลการนอน';
      enqueueTaskDelivery({
        id: Date.now(),
        assistantId: 'mina',
        assistantName: 'มีน่า (Mina)',
        taskListId: 'sleep-analysis',
        taskId: `sleep-summary-${Date.now()}`,
        taskTitle,
        cleanTitle: taskTitle,
        scheduledTime: null,
        completedAtLabel: formatThaiShortDateTime(new Date()),
        success: false,
        errorMessage: msg,
      });
    } finally {
      runningSleepAnalysisRef.current = false;
      handleUpdateCharacterActivity('mina', { busy: false, taskLabel: null });
      setAssistantMood('idle');
      void fetchCharacterStatuses();
    }
  }, [
    enqueueTaskDelivery,
    fetchCharacterStatuses,
    handleUpdateCharacterActivity,
    showMinaBubble,
    showToast,
    sleepLogs,
    timeOfDay,
    todayIsoDate,
  ]);

  const scanAndRunDueMinaTasks = useCallback(async () => {
    if (
      !googleUser ||
      !youtubeToken ||
      gameState === 'TITLE_MENU' ||
      isScanningMinaTasksRef.current
    ) {
      return;
    }
    isScanningMinaTasksRef.current = true;
    try {
      const lists = await fetchAllTaskListsWithTasks(youtubeToken);
      setSyncedTaskLists(lists);
      setTasksSyncError(null);
      setMinaReadyReviewCount(countMinaReadyReviewTasks(lists));

      const dueItems: Array<{ listId: string; task: GoogleTask; scheduledAtMs: number }> = [];
      const nowMs = Date.now();
      for (const list of lists) {
        for (const task of list.tasks) {
          if (task.status === 'completed') continue;
          if (runningMinaTaskIdsRef.current.has(task.id)) continue;
          const meta = parseMinaTaskMeta(task, nowMs);
          if (meta.isDueNow) {
            dueItems.push({
              listId: list.id,
              task,
              scheduledAtMs: meta.scheduledAtMs ?? nowMs,
            });
          }
        }
      }

      dueItems.sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);

      for (const item of dueItems.slice(0, 2)) {
        await executeMinaScheduledTask(item.listId, item.task, { triggerSource: 'schedule' });
      }
    } catch (err) {
      if (err instanceof GoogleTasksApiError && (err.status === 401 || err.status === 403)) {
        handleYouTubeTokenExpired();
      }
    } finally {
      isScanningMinaTasksRef.current = false;
    }
  }, [
    countMinaReadyReviewTasks,
    executeMinaScheduledTask,
    gameState,
    googleUser,
    handleYouTubeTokenExpired,
    youtubeToken,
  ]);

  useEffect(() => {
    if (!googleUser || !youtubeToken || gameState === 'TITLE_MENU') {
      setMinaReadyReviewCount(0);
      return;
    }

    void scanAndRunDueMinaTasks();
    const timer = window.setInterval(() => {
      void scanAndRunDueMinaTasks();
    }, 20_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void scanAndRunDueMinaTasks();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [gameState, googleUser, scanAndRunDueMinaTasks, youtubeToken]);

  return {
    deliverTaskToAssistantChat,
    dispatchNextDelivery,
    enqueueTaskDelivery,
    handleAssistantDeliveryArrived,
    handleOpenAssistantChatFromPinboard,
    countMinaReadyReviewTasks,
    executeMinaScheduledTask,
    handleAskMinaAnalyzeSleep,
    scanAndRunDueMinaTasks,
  };
}

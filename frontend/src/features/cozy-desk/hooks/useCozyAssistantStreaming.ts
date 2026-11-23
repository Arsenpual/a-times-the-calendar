import { useCallback, useEffect, useMemo } from 'react';
import type { ChatMessage, SavedDraft, WorkMode } from '../types/game';
import {
  fetchGmailMessages,
  fetchGmailUnreadStatus,
  GmailApiError,
} from '../api/gmailApi';
import {
  buildMinaTaskNotes,
  formatThaiShortDateTime,
} from '../lib/minaTaskScheduler';
import { formatSleepTimeSummary } from '../api/sleepLogsApi';
import { soundEngine } from '../lib/sound';
import {
  createTask,
  fetchAllTaskListsWithTasks,
  GoogleTasksApiError,
} from '../api/tasksApi';
import { cozyApiFetch } from '../api/cozyApi';
import { summarizeMinaTask } from '../lib/cozyDeskDefaults';


export function useCozyAssistantStreaming(ctx: any) {
  const {
    youtubeToken,
    setGmailUnreadTotal,
    setGmailFreshArrival,
    setGmailScopeMissing,
    knownGmailUnreadIdsRef,
    hasPolledGmailOnceRef,
    freshArrivalTimerRef,
    showToast,
    handleYouTubeTokenExpired,
    gmailScopeMissing,
    setLocallyReadMailIds,
    setLocallyReadUnreadIds,
    gmailUnreadTotal,
    locallyReadUnreadIds,
    setSyncedTaskLists,
    setTasksSyncError,
    setIsSyncingTasks,
    gameState,
    syncedTaskLists,
    setGameState,
    showMinaBubble,
    muted,
    setMuted,
    abortControllerRef,
    setMessages,
    setIsStreaming,
    setApiError,
    setAssistantMood,
    handleUpdateCharacterActivity,
    timeOfDay,
    sleepLogs,
    fetchCharacterStatuses,
    todayIsoDate,
    setMinaMission,
    scanAndRunDueMinaTasks,
    setExtraPinCount,
    messages,
    workMode,
    isStreaming,
    setDrafts,
  } = ctx;

  const syncGmailUnreadStatus = useCallback(
    async (tokenOverride?: string | null) => {
      const token = tokenOverride ?? youtubeToken;
      if (!token) {
        setGmailUnreadTotal(0);
        setGmailFreshArrival(false);
        return;
      }
      try {
        const status = await fetchGmailUnreadStatus(token);
        setGmailScopeMissing(false);
        setGmailUnreadTotal(status.unreadCount);

        const prevKnown = knownGmailUnreadIdsRef.current;
        const incomingNewIds = status.latestUnreadIds.filter((id) => !prevKnown.has(id));

        if (hasPolledGmailOnceRef.current && incomingNewIds.length > 0) {
          soundEngine.playMessageReceived();
          setGmailFreshArrival(true);
          if (freshArrivalTimerRef.current) {
            window.clearTimeout(freshArrivalTimerRef.current);
          }
          freshArrivalTimerRef.current = window.setTimeout(() => {
            setGmailFreshArrival(false);
          }, 8000);
          showToast(
            `มีอีเมลใหม่เข้าที่ตู้ไปรษณีย์ริมถนน (${incomingNewIds.length} ฉบับ)! เดินไปกด E หรือคลิกที่ตู้ไปรษณีย์เพื่อเปิดอ่านได้เลย`,
            'house'
          );
        }

        hasPolledGmailOnceRef.current = true;
        knownGmailUnreadIdsRef.current = new Set(status.latestUnreadIds);
      } catch (err) {
        if (err instanceof GmailApiError) {
          if (err.status === 401) {
            handleYouTubeTokenExpired();
          } else if (err.status === 403 && err.isScopeError) {
            setGmailScopeMissing(true);
          }
        }
      }
    },
    [handleYouTubeTokenExpired, showToast, youtubeToken]
  );

  // Poll Gmail unread inbox status every 30s while signed in so incoming messages alert right at the roadside mailbox
  useEffect(() => {
    if (!youtubeToken || gmailScopeMissing) {
      if (!youtubeToken) {
        setGmailUnreadTotal(0);
        setGmailFreshArrival(false);
        knownGmailUnreadIdsRef.current = new Set();
        hasPolledGmailOnceRef.current = false;
      }
      return;
    }

    void syncGmailUnreadStatus(youtubeToken);
    const interval = window.setInterval(() => {
      void syncGmailUnreadStatus(youtubeToken);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [gmailScopeMissing, syncGmailUnreadStatus, youtubeToken]);

  const handleMarkMailRead = useCallback((messageId: string, wasUnread: boolean) => {
    setLocallyReadMailIds((prev) => {
      if (prev.has(messageId)) return prev;
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
    if (wasUnread) {
      setLocallyReadUnreadIds((prev) => {
        if (prev.has(messageId)) return prev;
        const next = new Set(prev);
        next.add(messageId);
        return next;
      });
    }
  }, []);

  const effectiveMailboxUnreadCount = Math.max(0, gmailUnreadTotal - locallyReadUnreadIds.size);

  const syncGoogleTasksForMina = useCallback(
    async (tokenOverride?: string | null): Promise<GoogleTaskListWithTasks[] | null> => {
      const token = tokenOverride ?? youtubeToken;
      if (!token) {
        setSyncedTaskLists(null);
        setTasksSyncError(null);
        return null;
      }
      setIsSyncingTasks(true);
      setTasksSyncError(null);
      try {
        const lists = await fetchAllTaskListsWithTasks(token);
        setSyncedTaskLists(lists);
        return lists;
      } catch (err) {
        if (err instanceof GoogleTasksApiError && (err.status === 401 || err.status === 403)) {
          handleYouTubeTokenExpired();
          setTasksSyncError('สิทธิ์ Google Tasks หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        } else {
          setTasksSyncError(
            err instanceof Error ? err.message : 'ดึงข้อมูล Google Tasks ไม่สำเร็จชั่วคราว'
          );
        }
        return null;
      } finally {
        setIsSyncingTasks(false);
      }
    },
    [handleYouTubeTokenExpired, youtubeToken]
  );

  // Auto-sync Google Tasks whenever signed in or opening Mina's Workspace
  useEffect(() => {
    if (!youtubeToken) {
      setSyncedTaskLists(null);
      setTasksSyncError(null);
      return;
    }
    if (gameState === 'WORKING' || !syncedTaskLists) {
      void syncGoogleTasksForMina(youtubeToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeToken, gameState]);

  const minaTasksSummary = useMemo(() => {
    if (!syncedTaskLists) return null;
    let pendingCount = 0;
    let completedCount = 0;
    for (const list of syncedTaskLists) {
      for (const task of list.tasks) {
        if (task.status === 'completed') completedCount += 1;
        else pendingCount += 1;
      }
    }
    return {
      listCount: syncedTaskLists.length,
      pendingCount,
      completedCount,
    };
  }, [syncedTaskLists]);

  const handleToggleWorkspace = () => {
    if (gameState !== 'WORKING') return;
    soundEngine.playInteract();
    setGameState('PLAYING');
    showMinaBubble('ถ้ามีอะไรให้ช่วย เดินมาเรียกได้เสมอนะครับ', 3200);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const streamAssistantResponse = useCallback(
    async (historyToSend: ChatMessage[], mode: WorkMode) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          mode,
          createdAt: Date.now(),
        },
      ]);

      const latestUserMessage = [...historyToSend].reverse().find((m) => m.role === 'user');
      const taskSummary = summarizeMinaTask(latestUserMessage?.content ?? '', mode);

      setIsStreaming(true);
      setApiError(null);
      setAssistantMood('thinking');
      handleUpdateCharacterActivity('mina', {
        busy: true,
        taskLabel: taskSummary,
        errorReason: null,
        errorCode: null,
      });

      let accumulated = '';
      let receivedProposal = false;

      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      type TasksContextPayload =
        | { status: 'not_signed_in' | 'auth_expired' | 'unavailable'; errorDetail?: string }
        | {
            status: 'connected';
            lists: Array<{
              id: string;
              title: string;
              tasks: Array<{
                id: string;
                title: string;
                status: 'needsAction' | 'completed';
                due?: string;
                notes?: string;
                updated?: string;
                parent?: string;
              }>;
            }>;
          };

      const serializeLists = (
        lists: GoogleTaskListWithTasks[]
      ): Extract<TasksContextPayload, { status: 'connected' }> => ({
        status: 'connected',
        lists: lists.map((list) => ({
          id: list.id,
          title: list.title,
          tasks: list.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            ...(t.due ? { due: t.due } : {}),
            ...(t.notes ? { notes: t.notes } : {}),
            ...(t.updated ? { updated: t.updated } : {}),
            ...(t.parent ? { parent: t.parent } : {}),
          })),
        })),
      });

      try {
        let tasksContext: TasksContextPayload = { status: 'not_signed_in' };
        if (youtubeToken) {
          let timeoutId: number | undefined;
          try {
            const listsWithTasks = await Promise.race([
              fetchAllTaskListsWithTasks(youtubeToken),
              new Promise<never>((_, reject) => {
                timeoutId = window.setTimeout(() => reject(new Error('TASKS_TIMEOUT')), 10_000);
              }),
            ]);
            setSyncedTaskLists(listsWithTasks);
            setTasksSyncError(null);
            tasksContext = serializeLists(listsWithTasks);
          } catch (err) {
            if (err instanceof GoogleTasksApiError && (err.status === 401 || err.status === 403)) {
              handleYouTubeTokenExpired();
              tasksContext = { status: 'auth_expired' };
            } else if (syncedTaskLists) {
              // Fall back to fresh in-session snapshot if live refresh transiently timed out
              tasksContext = serializeLists(syncedTaskLists);
            } else {
              tasksContext = {
                status: 'unavailable',
                errorDetail: err instanceof Error ? err.message : undefined,
              };
            }
          } finally {
            if (timeoutId !== undefined) {
              window.clearTimeout(timeoutId);
            }
          }
        }

        if (controller.signal.aborted) {
          return;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (youtubeToken) {
          headers['X-Google-Access-Token'] = youtubeToken;
        }

        const res = await cozyApiFetch('/api/assistant/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: historyToSend.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            mode,
            timeOfDay,
            localDate,
            tasksContext,
            sleepLogsContext: sleepLogs.slice(0, 30),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errMsg = 'ไม่สามารถเชื่อมต่อกับผู้ช่วย AI ได้ในขณะนี้';
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
          throw new Error('ไม่พบสตรีมข้อมูลตอบกลับจากเซิร์ฟเวอร์');
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
            const dataLine = rawEvent
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            const parsed = JSON.parse(dataLine.slice(6)) as {
              type: 'chunk' | 'done' | 'error' | 'task_proposal' | 'usage';
              text?: string;
              error?: string;
              task?: {
                title: string;
                notes?: string;
                dueDate?: string;
                assignToMina?: boolean;
                assistantId?: TaskAssistantId;
                scheduledTime?: string;
              };
            };

            if (parsed.type === 'error') {
              throw new Error(parsed.error || 'เกิดข้อผิดพลาดระหว่างรับคำตอบจาก Gemini API');
            }

            if (parsed.type === 'usage') {
              void fetchCharacterStatuses();
              continue;
            }

            if (parsed.type === 'task_proposal' && parsed.task?.title) {
              receivedProposal = true;
              const taskPayload = parsed.task;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        taskProposal: {
                          title: taskPayload.title,
                          notes: taskPayload.notes,
                          dueDate: taskPayload.dueDate,
                          assignToMina: taskPayload.assignToMina,
                          assistantId: taskPayload.assistantId,
                          scheduledTime: taskPayload.scheduledTime,
                          status: 'pending',
                        },
                      }
                    : m
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

        if (!accumulated.trim() && !receivedProposal) {
          throw new Error('ไม่ได้รับข้อความตอบกลับจากผู้ช่วย AI กรุณาลองส่งใหม่อีกครั้ง');
        }

        soundEngine.playMessageReceived();
        setAssistantMood('speaking');
        handleUpdateCharacterActivity('mina', {
          busy: false,
          taskLabel: null,
          errorReason: null,
          errorCode: null,
        });
        if (receivedProposal) {
          showMinaBubble('เตรียมงานแล้ว กดยืนยันได้เลยครับ!', 5000);
        } else {
          const shortPreview = accumulated
            .replace(/[#*`>\n]+/g, ' ')
            .trim()
            .slice(0, 24);
          showMinaBubble(shortPreview ? `${shortPreview}…` : 'เรียบร้อยแล้วครับ!', 5000);
        }
        window.setTimeout(() => {
          setAssistantMood((curr) => (curr === 'speaking' ? 'idle' : curr));
        }, 3500);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          handleUpdateCharacterActivity('mina', {
            busy: false,
            taskLabel: null,
          });
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini API';
        setApiError(message);
        setAssistantMood('idle');
        handleUpdateCharacterActivity('mina', {
          busy: false,
          taskLabel: null,
          errorReason: message,
        });
        // Remove empty placeholder assistant message on error
        setMessages((prev) =>
          prev.filter(
            (m) => !(m.id === assistantMsgId && m.content === '' && !m.taskProposal)
          )
        );
      } finally {
        setIsStreaming(false);
        void fetchCharacterStatuses();
      }
    },
    [
      fetchCharacterStatuses,
      handleUpdateCharacterActivity,
      handleYouTubeTokenExpired,
      showMinaBubble,
      sleepLogs,
      syncedTaskLists,
      timeOfDay,
      youtubeToken,
    ]
  );

  const handleConfirmChatTask = useCallback(
    async (
      messageId: string,
      payload: {
        title: string;
        notes?: string;
        dueDate?: string;
        assignToMina?: boolean;
        assistantId?: TaskAssistantId;
        scheduledTime?: string;
      }
    ) => {
      if (!youtubeToken) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.taskProposal
              ? {
                  ...m,
                  taskProposal: {
                    ...m.taskProposal,
                    title: payload.title,
                    notes: payload.notes,
                    dueDate: payload.dueDate,
                    assignToMina: payload.assignToMina,
                    assistantId: payload.assistantId,
                    scheduledTime: payload.scheduledTime,
                    status: 'error',
                    errorMessage: 'กรุณากด Sign in with Google เพื่อเชื่อมต่อสิทธิ์ Google Tasks ก่อนครับ',
                  },
                }
              : m
          )
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.taskProposal
            ? {
                ...m,
                taskProposal: {
                  ...m.taskProposal,
                  title: payload.title,
                  notes: payload.notes,
                  dueDate: payload.dueDate,
                  assignToMina: payload.assignToMina,
                  assistantId: payload.assistantId,
                  scheduledTime: payload.scheduledTime,
                  status: 'saving',
                  errorMessage: undefined,
                },
              }
            : m
        )
      );

      try {
        const effectiveDueDate =
          payload.dueDate || (payload.assignToMina && payload.scheduledTime ? todayIsoDate : undefined);
        const formattedNotes = payload.assignToMina
          ? buildMinaTaskNotes({
              assignedToMina: true,
              assistantId: payload.assistantId ?? 'mina',
              scheduledTime: payload.scheduledTime,
              status: 'pending',
              userPromptNotes: payload.notes,
            })
          : payload.notes;

        const created = await createTask(youtubeToken, '@default', {
          title: payload.title,
          notes: formattedNotes,
          dueDate: effectiveDueDate,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.taskProposal
              ? {
                  ...m,
                  taskProposal: {
                    ...m.taskProposal,
                    title: created.title,
                    notes: payload.notes,
                    dueDate: effectiveDueDate,
                    assignToMina: payload.assignToMina,
                    assistantId: payload.assistantId,
                    scheduledTime: payload.scheduledTime,
                    status: 'added',
                    createdTaskId: created.id,
                    errorMessage: undefined,
                  },
                }
              : m
          )
        );

        soundEngine.playMessageReceived();
        setAssistantMood('pinning');
        setMinaMission({ id: Date.now(), taskTitle: created.title });
        void scanAndRunDueMinaTasks();
        showToast(
          payload.assignToMina
            ? `มอบหมายงาน “${created.title}” ให้มีน่าลง Google Tasks แล้ว`
            : `เพิ่มงาน “${created.title}” ลง Google Tasks แล้ว — มีน่ากำลังเดินไปปักหมุดที่กระดานโน้ต`,
          'mina'
        );
      } catch (err) {
        if (err instanceof GoogleTasksApiError && (err.status === 401 || err.status === 403)) {
          handleYouTubeTokenExpired();
        }
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเพิ่มงานลง Google Tasks ได้ในขณะนี้';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.taskProposal
              ? {
                  ...m,
                  taskProposal: {
                    ...m.taskProposal,
                    status: 'error',
                    errorMessage,
                  },
                }
              : m
          )
        );
      }
    },
    [handleYouTubeTokenExpired, scanAndRunDueMinaTasks, showToast, todayIsoDate, youtubeToken]
  );

  const handleCancelChatTask = useCallback((messageId: string) => {
    soundEngine.playInteract();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.taskProposal
          ? {
              ...m,
              taskProposal: {
                ...m.taskProposal,
                status: 'cancelled',
                errorMessage: undefined,
              },
            }
          : m
      )
    );
  }, []);

  const handleMinaMissionEvent = useCallback(
    (event: 'started' | 'pinned' | 'returned', _taskTitle: string) => {
      if (event === 'started') {
        setAssistantMood('pinning');
        showMinaBubble('กำลังเดินไปติดโน้ตที่กระดานครับ!', 3500);
      } else if (event === 'pinned') {
        setExtraPinCount((c) => c + 1);
        showMinaBubble('ปักหมุดงานบนกระดานเรียบร้อย!', 2800);
      } else if (event === 'returned') {
        setAssistantMood((curr) => (curr === 'pinning' ? 'idle' : curr));
        showMinaBubble('ติดโน้ตเสร็จแล้วครับ มีอะไรให้ช่วยต่อไหม?', 3600);
      }
    },
    [showMinaBubble]
  );

  const handleSendMessage = (text: string) => {
    soundEngine.playMessageSent();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      mode: workMode,
      createdAt: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    void streamAssistantResponse(nextHistory, workMode);
  };

  const handleRetryLast = () => {
    if (isStreaming || messages.length === 0) return;
    // Retry from last user message
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const trimmedHistory = messages.slice(0, actualIdx + 1);
    setMessages(trimmedHistory);
    void streamAssistantResponse(trimmedHistory, workMode);
  };

  const handleClearChat = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setMessages([]);
    setApiError(null);
    setAssistantMood('idle');
    showMinaBubble('เริ่มหัวข้อใหม่กันได้เลยครับ!');
  };

  const handleSaveDraft = (msg: ChatMessage) => {
    const firstLine = msg.content
      .split('\n')
      .map((l) => l.replace(/^#+\s*/, '').replace(/[*`]/g, '').trim())
      .find((l) => l.length > 0);
    const title = firstLine ? firstLine.slice(0, 48) : 'เอกสารร่างจากมีน่า';

    const newDraft: SavedDraft = {
      id: `draft-${Date.now()}`,
      title,
      content: msg.content,
      mode: msg.mode,
      createdAt: Date.now(),
    };
    setDrafts((prev) => [newDraft, ...prev]);
    soundEngine.playInteract();
    showToast('บันทึกคำตอบลงในคลังฉบับร่างเรียบร้อยครับ', 'mina');
  };

  const handleDeleteDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  return {
    syncGmailUnreadStatus,
    handleMarkMailRead,
    effectiveMailboxUnreadCount,
    syncGoogleTasksForMina,
    minaTasksSummary,
    handleToggleWorkspace,
    handleToggleMute,
    streamAssistantResponse,
    handleConfirmChatTask,
    handleCancelChatTask,
    handleMinaMissionEvent,
    handleSendMessage,
    handleRetryLast,
    handleClearChat,
    handleSaveDraft,
    handleDeleteDraft,
  };
}

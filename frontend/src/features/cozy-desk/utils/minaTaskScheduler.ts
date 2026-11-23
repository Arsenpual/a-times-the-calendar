import type {
  AssistantTaskDelivery,
  GoogleTask,
  TaskAssistantId,
} from '../types/game';
import { getLocalIsoDate } from './sleepLogsApi';

export type MinaTaskScheduleStatus =
  | 'pending'
  | 'in_progress'
  | 'ready_for_review'
  | 'failed';

export type MinaTaskRecurrence = 'none' | 'daily' | 'weekly';

export const ASSISTANT_DISPLAY_NAMES: Record<TaskAssistantId, string> = {
  mina: 'มีน่า',
  antigravity: 'Antigravity',
  ai_studio: 'AI Studio',
};

const ASSISTANT_HEADER_TAGS: Record<TaskAssistantId, string> = {
  mina: 'Mina',
  antigravity: 'Antigravity',
  ai_studio: 'AIStudio',
};

export interface ParsedMinaTaskMeta {
  assignedToMina: boolean;
  assistantId: TaskAssistantId;
  assistantName: string;
  assignedViaTitle: boolean;
  matchedAlias: string | null;
  cleanTaskTitle: string;
  scheduledTime: string | null; // "HH:mm" in 24h local time
  recurrence: MinaTaskRecurrence;
  status: MinaTaskScheduleStatus;
  errorMessage: string | null;
  completedAtLabel: string | null;
  userPromptNotes: string;
  minaSummary: string | null;
  minaSummaryHeader: string | null;
  scheduledDateIso: string | null; // "YYYY-MM-DD"
  scheduledAtMs: number | null;
  isImmediateRun: boolean;
  isDueNow: boolean;
}

const AI_HEADER_REGEX = /^\[AI:(Mina|Antigravity|AIStudio|AI_Studio)(?:\s*\|\s*([^\]]+))?\]\s*/i;

const AI_SUMMARY_REGEX =
  /\n*--- สรุปผลงานจาก(?:มีน่า|Antigravity|AI Studio)(?:\s*\(([^)]+)\))?\s*---\n([\s\S]*?)\n--- จบสรุป(?:มีน่า|Antigravity|AI Studio) ---\s*$/;

const ASSISTANT_ALIAS_PATTERNS: Array<{
  assistantId: TaskAssistantId;
  patterns: RegExp[];
}> = [
  {
    assistantId: 'antigravity',
    patterns: [
      /["'“”‘’]\s*(antigravity|แอนตี้|แอนติกราวิตี้)\s*["'“”‘’]/i,
      /[(\[{]\s*(antigravity|แอนตี้|แอนติกราวิตี้)\s*[)\]}]/i,
      /(?:^|\s)[@#](antigravity|แอนตี้)(?=$|\s|[,.:;!?])/i,
      /^\s*(?:ให้)?(antigravity|แอนตี้)\s*[:：\-–—]\s*/i,
      /^\s*(?:ให้)?(antigravity|แอนตี้)\s+(?=ช่วย|ตรวจ|แก้|เช็ค|รีวิว|เขียน|ออกแบบ|รัน)/i,
      /(?:^|\s)(?:ให้)?(antigravity|แอนตี้)\s*$/i,
    ],
  },
  {
    assistantId: 'ai_studio',
    patterns: [
      /["'“”‘’]\s*(ai\s*studio|aistudio|สตูดิโอ)\s*["'“”‘’]/i,
      /[(\[{]\s*(ai\s*studio|aistudio|สตูดิโอ)\s*[)\]}]/i,
      /(?:^|\s)[@#](aistudio|ai_studio|สตูดิโอ)(?=$|\s|[,.:;!?])/i,
      /^\s*(?:ให้)?(ai\s*studio|aistudio|สตูดิโอ)\s*[:：\-–—]\s*/i,
      /^\s*(?:ให้)?(ai\s*studio|aistudio)\s+(?=ช่วย|ออกแบบ|ร่าง|ปรับ|คิด|สร้าง)/i,
      /(?:^|\s)(?:ให้)?(ai\s*studio|aistudio)\s*$/i,
    ],
  },
  {
    assistantId: 'mina',
    patterns: [
      /["'“”‘’]\s*(มีน่า|นีน่า|mina|nina)\s*["'“”‘’]/i,
      /[(\[{]\s*(มีน่า|นีน่า|mina|nina)\s*[)\]}]/i,
      /(?:^|\s)[@#](มีน่า|นีน่า|mina|nina)(?=$|\s|[,.:;!?])/i,
      /^\s*(?:ให้)?(มีน่า|นีน่า|mina|nina)\s*[:：\-–—]\s*/i,
      /^\s*(?:ให้)?(มีน่า|นีน่า)\s+(?=ช่วย|ร่าง|สรุป|วางแผน|จัด|เขียน|คิด|เช็ค|ตรวจ|วิเคราะห์)/i,
      /(?:^|\s)(?:ให้)?(มีน่า|นีน่า)\s*$/i,
    ],
  },
];

// Optional inline time in title, e.g. "09:30", "14:00 น.", "09.30 น."
const INLINE_TIME_REGEX = /(?:เวลา\s*)?(\d{1,2})[:.](\d{2})(?:\s*น\.?)?(?=$|\s|[)\]}])/i;
const INLINE_DAILY_REGEX = /(?:^|\s)(ทุกวัน|ประจำวัน|daily)(?=$|\s|[)\]}])/i;
const INLINE_WEEKLY_REGEX = /(?:^|\s)(ทุกสัปดาห์|ทุกอาทิตย์|weekly)(?=$|\s|[)\]}])/i;

function normalizeHeaderTagToAssistantId(tag?: string): TaskAssistantId {
  const lower = (tag ?? '').toLowerCase();
  if (lower === 'antigravity') return 'antigravity';
  if (lower === 'aistudio' || lower === 'ai_studio') return 'ai_studio';
  return 'mina';
}

export function detectMinaMentionInTitle(title: string): {
  matched: boolean;
  assistantId: TaskAssistantId;
  alias: string | null;
  cleanTitle: string;
  inlineTime: string | null;
  inlineRecurrence: MinaTaskRecurrence;
} {
  const raw = title.trim();
  if (!raw) {
    return {
      matched: false,
      assistantId: 'mina',
      alias: null,
      cleanTitle: '',
      inlineTime: null,
      inlineRecurrence: 'none',
    };
  }

  let matchedAssistantId: TaskAssistantId = 'mina';
  let matchedAlias: string | null = null;
  let cleaned = raw;

  for (const group of ASSISTANT_ALIAS_PATTERNS) {
    for (const pattern of group.patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        matchedAssistantId = group.assistantId;
        matchedAlias = match[1]?.trim() || ASSISTANT_DISPLAY_NAMES[group.assistantId];
        cleaned = cleaned.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
        break;
      }
    }
    if (matchedAlias) break;
  }

  let inlineTime: string | null = null;
  let inlineRecurrence: MinaTaskRecurrence = 'none';
  if (matchedAlias) {
    const timeMatch = cleaned.match(INLINE_TIME_REGEX);
    if (timeMatch) {
      const hh = Number(timeMatch[1]);
      const mm = Number(timeMatch[2]);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        inlineTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        cleaned = cleaned.replace(INLINE_TIME_REGEX, ' ').replace(/\s+/g, ' ').trim();
      }
    }
    if (INLINE_DAILY_REGEX.test(cleaned)) {
      inlineRecurrence = 'daily';
    } else if (INLINE_WEEKLY_REGEX.test(cleaned)) {
      inlineRecurrence = 'weekly';
    }
  }

  return {
    matched: Boolean(matchedAlias),
    assistantId: matchedAssistantId,
    alias: matchedAlias,
    cleanTitle: cleaned || raw,
    inlineTime,
    inlineRecurrence,
  };
}

export function formatThaiShortDateTime(date = new Date()): string {
  const dateLabel = date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
  });
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${dateLabel} ${hh}:${mm} น.`;
}

export function getDefaultScheduleTime(offsetMinutes = 5): string {
  const target = new Date(Date.now() + offsetMinutes * 60_000);
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function computeNextRecurringDueDate(
  currentDueIso: string | null | undefined,
  recurrence: MinaTaskRecurrence,
  todayIso = getLocalIsoDate()
): string | null {
  if (recurrence === 'none') return null;
  const baseIso =
    currentDueIso && /^\d{4}-\d{2}-\d{2}$/.test(currentDueIso) ? currentDueIso : todayIso;
  const [y, m, d] = baseIso.split('-').map(Number);
  const baseDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(baseDate.getTime())) return null;

  const deltaDays = recurrence === 'weekly' ? 7 : 1;
  baseDate.setDate(baseDate.getDate() + deltaDays);
  const nextIso = getLocalIsoDate(baseDate);
  // If base date was far in the past, jump to tomorrow / next week from today
  if (nextIso <= todayIso) {
    const [ty, tm, td] = todayIso.split('-').map(Number);
    const todayDate = new Date(ty, tm - 1, td, 0, 0, 0, 0);
    todayDate.setDate(todayDate.getDate() + deltaDays);
    return getLocalIsoDate(todayDate);
  }
  return nextIso;
}

function parseLocalDateTimeMs(dateIso: string | null, timeHm: string | null): number | null {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = dateIso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  let hours = 0;
  let minutes = 0;
  if (timeHm && /^\d{2}:\d{2}$/.test(timeHm)) {
    const [hStr, mStr] = timeHm.split(':');
    hours = Math.min(23, Math.max(0, Number(hStr)));
    minutes = Math.min(59, Math.max(0, Number(mStr)));
  }

  const dt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function parseMinaTaskMeta(task: GoogleTask, nowMs = Date.now()): ParsedMinaTaskMeta {
  const rawNotes = task.notes ?? '';
  const headerMatch = rawNotes.match(AI_HEADER_REGEX);
  const titleDetection = detectMinaMentionInTitle(task.title ?? '');
  const assignedToMina = Boolean(headerMatch) || titleDetection.matched;

  if (!assignedToMina) {
    return {
      assignedToMina: false,
      assistantId: 'mina',
      assistantName: ASSISTANT_DISPLAY_NAMES.mina,
      assignedViaTitle: false,
      matchedAlias: null,
      cleanTaskTitle: task.title,
      scheduledTime: null,
      recurrence: 'none',
      status: 'pending',
      errorMessage: null,
      completedAtLabel: null,
      userPromptNotes: rawNotes.trim(),
      minaSummary: null,
      minaSummaryHeader: null,
      scheduledDateIso: task.due ? task.due.slice(0, 10) : null,
      scheduledAtMs: null,
      isImmediateRun: false,
      isDueNow: false,
    };
  }

  const assistantId: TaskAssistantId = headerMatch
    ? normalizeHeaderTagToAssistantId(headerMatch[1])
    : titleDetection.assistantId;
  const assistantName = ASSISTANT_DISPLAY_NAMES[assistantId];

  const segments = (headerMatch?.[2] ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  let headerTime: string | null = null;
  let headerRecurrence: MinaTaskRecurrence = 'none';
  let rawStatus = '';

  for (const seg of segments) {
    const timeM = seg.match(/^เวลา\s*(\d{2}:\d{2})$/i);
    if (timeM) {
      headerTime = timeM[1];
      continue;
    }
    const recM = seg.match(/^ซ้ำ:\s*(.+)$/i);
    if (recM) {
      const val = recM[1].trim();
      if (val.includes('สัปดาห์')) headerRecurrence = 'weekly';
      else if (val.includes('วัน')) headerRecurrence = 'daily';
      continue;
    }
    const stM = seg.match(/^สถานะ:\s*(.+)$/i);
    if (stM) {
      rawStatus = stM[1].trim();
    }
  }

  const scheduledTime = headerTime || titleDetection.inlineTime || null;
  const recurrence: MinaTaskRecurrence =
    headerRecurrence !== 'none' ? headerRecurrence : titleDetection.inlineRecurrence;

  let status: MinaTaskScheduleStatus = 'pending';
  let errorMessage: string | null = null;
  let completedAtLabel: string | null = null;

  if (rawStatus.includes('ส่งงานในแชทแล้ว') || rawStatus.includes('รอตรวจงาน')) {
    status = 'ready_for_review';
    const parts = rawStatus.split('·');
    if (parts.length > 1) {
      completedAtLabel = parts.slice(1).join('·').trim() || null;
    }
  } else if (rawStatus.includes('กำลังทำ')) {
    status = 'in_progress';
  } else if (rawStatus.includes('ผิดพลาด')) {
    status = 'failed';
    const parts = rawStatus.split('·');
    if (parts.length > 1) {
      errorMessage = parts.slice(1).join('·').trim() || null;
    }
  }

  const bodyAfterHeader = headerMatch ? rawNotes.slice(headerMatch[0].length) : rawNotes;
  const summaryMatch = bodyAfterHeader.match(AI_SUMMARY_REGEX);

  let userPromptNotes = bodyAfterHeader.trim();
  let minaSummary: string | null = null;
  let minaSummaryHeader: string | null = null;

  if (summaryMatch) {
    minaSummaryHeader = summaryMatch[1]?.trim() || completedAtLabel || null;
    minaSummary = summaryMatch[2]?.trim() || null;
    userPromptNotes = bodyAfterHeader.slice(0, summaryMatch.index).trim();
    if (status === 'pending' && minaSummary) {
      status = 'ready_for_review';
    }
  }

  const explicitDueIso = task.due ? task.due.slice(0, 10) : null;
  const scheduledDateIso =
    explicitDueIso ?? (scheduledTime ? getLocalIsoDate(new Date(nowMs)) : null);

  const scheduledAtMs = parseLocalDateTimeMs(scheduledDateIso, scheduledTime);
  const isImmediateRun = !explicitDueIso && !scheduledTime;

  const isDueNow =
    task.status !== 'completed' &&
    status === 'pending' &&
    (isImmediateRun || (scheduledAtMs !== null && nowMs >= scheduledAtMs));

  return {
    assignedToMina: true,
    assistantId,
    assistantName,
    assignedViaTitle: titleDetection.matched,
    matchedAlias: titleDetection.alias,
    cleanTaskTitle: titleDetection.cleanTitle,
    scheduledTime,
    recurrence,
    status,
    errorMessage,
    completedAtLabel: completedAtLabel || minaSummaryHeader,
    userPromptNotes,
    minaSummary,
    minaSummaryHeader,
    scheduledDateIso,
    scheduledAtMs,
    isImmediateRun,
    isDueNow,
  };
}

export function buildMinaTaskNotes(options: {
  assignedToMina: boolean;
  assistantId?: TaskAssistantId;
  scheduledTime?: string | null;
  recurrence?: MinaTaskRecurrence;
  status?: MinaTaskScheduleStatus;
  errorMessage?: string | null;
  completedAtLabel?: string | null;
  userPromptNotes?: string;
  minaSummary?: string | null;
  minaSummaryHeader?: string | null;
}): string {
  const cleanPrompt = (options.userPromptNotes ?? '').trim();

  if (!options.assignedToMina) {
    return cleanPrompt;
  }

  const assistantId: TaskAssistantId = options.assistantId ?? 'mina';
  const assistantTag = ASSISTANT_HEADER_TAGS[assistantId];
  const assistantDisplay = ASSISTANT_DISPLAY_NAMES[assistantId];

  const timePart =
    options.scheduledTime && /^\d{2}:\d{2}$/.test(options.scheduledTime.trim())
      ? ` | เวลา ${options.scheduledTime.trim()}`
      : '';
  const recurrencePart =
    options.recurrence === 'daily'
      ? ' | ซ้ำ: ทุกวัน'
      : options.recurrence === 'weekly'
        ? ' | ซ้ำ: ทุกสัปดาห์'
        : '';

  const effectiveStatus: MinaTaskScheduleStatus = options.status ?? 'pending';
  let statusPart = ' | สถานะ: รอเวลา';
  if (effectiveStatus === 'ready_for_review') {
    statusPart = ` | สถานะ: ส่งงานในแชทแล้ว${options.completedAtLabel ? ` · ${options.completedAtLabel}` : ''}`;
  } else if (effectiveStatus === 'in_progress') {
    statusPart = ' | สถานะ: กำลังทำ';
  } else if (effectiveStatus === 'failed') {
    const cleanErr = (options.errorMessage ?? '')
      .replace(/[\[\]|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
    statusPart = ` | สถานะ: ผิดพลาด${cleanErr ? ` · ${cleanErr}` : ''}`;
  }

  const header = `[AI:${assistantTag}${timePart}${recurrencePart}${statusPart}]`;
  const sections: string[] = [header];

  if (cleanPrompt) {
    sections.push(cleanPrompt);
  }

  const cleanSummary = (options.minaSummary ?? '').trim();
  if (cleanSummary) {
    const label = options.minaSummaryHeader || options.completedAtLabel || formatThaiShortDateTime();
    sections.push(
      `\n--- สรุปผลงานจาก${assistantDisplay} (${label}) ---\n${cleanSummary}\n--- จบสรุป${assistantDisplay} ---`
    );
  }

  return sections.join('\n').trim();
}

export function markMinaTaskStatusInNotes(
  task: GoogleTask,
  status: MinaTaskScheduleStatus,
  errorMessage?: string | null
): string {
  const parsed = parseMinaTaskMeta(task);
  return buildMinaTaskNotes({
    assignedToMina: true,
    assistantId: parsed.assistantId,
    scheduledTime: parsed.scheduledTime,
    recurrence: parsed.recurrence,
    status,
    errorMessage: status === 'failed' ? errorMessage : null,
    completedAtLabel: parsed.completedAtLabel,
    userPromptNotes: parsed.userPromptNotes,
    minaSummary: parsed.minaSummary,
    minaSummaryHeader: parsed.minaSummaryHeader,
  });
}

export function markTaskDeliveredInChat(
  task: GoogleTask,
  completedDate = new Date()
): string {
  const parsed = parseMinaTaskMeta(task, completedDate.getTime());
  const stamp = formatThaiShortDateTime(completedDate);
  return buildMinaTaskNotes({
    assignedToMina: true,
    assistantId: parsed.assistantId,
    scheduledTime: parsed.scheduledTime,
    recurrence: parsed.recurrence,
    status: 'ready_for_review',
    completedAtLabel: stamp,
    userPromptNotes: parsed.userPromptNotes,
  });
}

export function formatTaskDeliveryChatMessage(
  delivery: AssistantTaskDelivery
): string {
  const isSleepAnalysis = delivery.taskListId === 'sleep-analysis';
  const scheduleMeta = delivery.scheduledTime
    ? `⏰ รอบเวลา ${delivery.scheduledTime} น. · `
    : '';

  if (!delivery.success) {
    return [
      isSleepAnalysis
        ? `⚠️ **แจ้งข้อผิดพลาดระหว่างสรุปภาพรวมการนอน: ${delivery.cleanTitle}**`
        : `⚠️ **แจ้งข้อผิดพลาดระหว่างทำงาน Google Tasks: ${delivery.cleanTitle}**`,
      `${scheduleMeta}🕒 เวลาที่ตรวจพบ: ${delivery.completedAtLabel}`,
      '',
      `**สาเหตุ:** ${delivery.errorMessage || 'ไม่สามารถดำเนินงานได้ในขณะนี้'}`,
      '',
      isSleepAnalysis
        ? 'สามารถพิมพ์ถามมีน่าในแชทนี้ หรือกดส่งสรุปภาพรวมใหม่อีกครั้งจากสมุดบันทึกการนอนได้เลยครับ'
        : 'สามารถพิมพ์สอบถามหรือแก้ปัญหาต่อในแชทนี้ หรือกด **ลองใหม่** ในกระดาน Google Tasks ได้เลยครับ',
    ].join('\n');
  }

  return [
    isSleepAnalysis
      ? `🌙 **ส่งสรุปภาพรวมการนอน: ${delivery.cleanTitle}**`
      : `📋 **ส่งงานจาก Google Tasks: ${delivery.cleanTitle}**`,
    `${scheduleMeta}✅ เสร็จเมื่อ ${delivery.completedAtLabel}`,
    '',
    (delivery.summary ?? '').trim(),
    '',
    '---',
    isSleepAnalysis
      ? 'หากต้องการดูรายละเอียดวันไหนเพิ่มเติม หรือให้มีน่าช่วยจัดรูปแบบสรุปใหม่ พิมพ์บอกต่อในแชทนี้ได้เลยครับ'
      : 'หากต้องการให้ปรับแก้หรือลงรายละเอียดเพิ่ม พิมพ์บอกต่อในแชทนี้ได้เลยครับ (และเมื่อพอใจแล้วสามารถกดติ๊กเสร็จในกระดาน Google Tasks ได้เลย)',
  ].join('\n');
}

export function appendMinaSummaryToTaskNotes(
  task: GoogleTask,
  summaryText: string,
  completedDate = new Date()
): string {
  const parsed = parseMinaTaskMeta(task, completedDate.getTime());
  const stamp = formatThaiShortDateTime(completedDate);
  return buildMinaTaskNotes({
    assignedToMina: true,
    assistantId: parsed.assistantId,
    scheduledTime: parsed.scheduledTime,
    recurrence: parsed.recurrence,
    status: 'ready_for_review',
    completedAtLabel: stamp,
    userPromptNotes: parsed.userPromptNotes,
    minaSummary: summaryText.trim(),
    minaSummaryHeader: stamp,
  });
}

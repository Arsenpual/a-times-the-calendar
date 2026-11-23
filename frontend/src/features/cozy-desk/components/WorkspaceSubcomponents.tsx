import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Pin,
  Sparkles,
} from 'lucide-react';
import type { ChatTaskProposal, TaskAssistantId } from '../types/game';
import { detectMinaMentionInTitle } from '../lib/minaTaskScheduler';

interface ChatTaskProposalCardProps {
  messageId: string;
  proposal: ChatTaskProposal;
  googleUser: User | null;
  accessToken: string | null;
  isSigningInGoogle: boolean;
  googleAuthError: string | null;
  onGoogleSignIn: () => void;
  onConfirm: (
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
  onCancel: (messageId: string) => void;
  onOpenPinboard: () => void;
}

export function ChatTaskProposalCard({
  messageId,
  proposal,
  googleUser,
  accessToken,
  isSigningInGoogle,
  googleAuthError,
  onGoogleSignIn,
  onConfirm,
  onCancel,
  onOpenPinboard,
}: ChatTaskProposalCardProps) {
  const initialMention = detectMinaMentionInTitle(proposal.title);
  const [title, setTitle] = useState(proposal.title);
  const [notes, setNotes] = useState(proposal.notes ?? '');
  const [dueDate, setDueDate] = useState(proposal.dueDate ?? '');
  const [assignToMina, setAssignToMina] = useState(
    Boolean(proposal.assignToMina || initialMention.matched)
  );
  const [assistantId, setAssistantId] = useState<TaskAssistantId>(
    proposal.assistantId ?? (initialMention.matched ? initialMention.assistantId : 'mina')
  );
  const [scheduledTime, setScheduledTime] = useState(
    proposal.scheduledTime ?? initialMention.inlineTime ?? ''
  );

  useEffect(() => {
    const mention = detectMinaMentionInTitle(proposal.title);
    setTitle(proposal.title);
    setNotes(proposal.notes ?? '');
    setDueDate(proposal.dueDate ?? '');
    setAssignToMina(Boolean(proposal.assignToMina || mention.matched));
    setAssistantId(
      proposal.assistantId ?? (mention.matched ? mention.assistantId : 'mina')
    );
    setScheduledTime(proposal.scheduledTime ?? mention.inlineTime ?? '');
  }, [
    proposal.title,
    proposal.notes,
    proposal.dueDate,
    proposal.assignToMina,
    proposal.assistantId,
    proposal.scheduledTime,
  ]);

  if (proposal.status === 'cancelled') {
    return (
      <div className="mt-2 w-full max-w-[92%] rounded-xl border border-[#E2D9CC] bg-[#F4EDE3]/70 px-3.5 py-2.5 text-xs text-[#7A6D62]">
        ยกเลิกการเพิ่มงาน “{proposal.title}” ลง Google Tasks แล้ว
      </div>
    );
  }

  if (proposal.status === 'added') {
    return (
      <div className="mt-2 w-full max-w-[92%] rounded-xl border border-[#B8D5C9] bg-[#EDF5F1] p-3.5 text-[#23473C]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3B7A67]" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#23473C]">
                เพิ่มลง Google Tasks แล้ว · มีน่าไปปักหมุดที่กระดานโน้ตให้แล้วครับ
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1B372E]">
                {proposal.title}
              </p>
              {proposal.notes && (
                <p className="mt-0.5 text-xs text-[#3C6457]">{proposal.notes}</p>
              )}
              {proposal.dueDate && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs tabular-nums text-[#3C6457]">
                  <Calendar className="h-3 w-3" />
                  <span>ครบกำหนด {proposal.dueDate}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-end border-t border-[#CDE3DA] pt-2">
          <button
            type="button"
            onClick={onOpenPinboard}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#2E594D] transition-colors hover:text-[#1A3B31]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>เปิดดูกระดานโน้ต</span>
          </button>
        </div>
      </div>
    );
  }

  const isSaving = proposal.status === 'saving';

  return (
    <div className="mt-2 w-full max-w-[92%] rounded-xl border border-[#DECDB8] bg-[#FBF7F0] p-3.5 text-[#29221D] shadow-xs">
      <div className="flex items-center gap-2 border-b border-[#EAE0D2] pb-2">
        <Pin className="h-3.5 w-3.5 text-[#D97736]" />
        <span className="text-xs font-semibold text-[#5C4633]">
          ยืนยันเพิ่มงานลง Google Tasks
        </span>
      </div>

      <div className="mt-2.5 space-y-2">
        <div>
          <label
            htmlFor={`task-title-${messageId}`}
            className="block text-[11px] font-medium text-[#7A6D62]"
          >
            ชื่องาน
          </label>
          <input
            id={`task-title-${messageId}`}
            type="text"
            value={title}
            disabled={isSaving}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-[#DCD0C0] bg-white px-2.5 py-1.5 text-sm font-medium text-[#29221D] focus:border-[#D97736] focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`task-due-${messageId}`}
              className="block text-[11px] font-medium text-[#7A6D62]"
            >
              วันครบกำหนด (ไม่บังคับ)
            </label>
            <input
              id={`task-due-${messageId}`}
              type="date"
              value={dueDate}
              disabled={isSaving}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-[#DCD0C0] bg-white px-2.5 py-1.5 text-xs text-[#29221D] focus:border-[#D97736] focus:outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label
              htmlFor={`task-notes-${messageId}`}
              className="block text-[11px] font-medium text-[#7A6D62]"
            >
              รายละเอียดเพิ่มเติม
            </label>
            <input
              id={`task-notes-${messageId}`}
              type="text"
              value={notes}
              disabled={isSaving}
              placeholder="โน้ตสั้นๆ..."
              onChange={(e) => setNotes(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-[#DCD0C0] bg-white px-2.5 py-1.5 text-xs text-[#29221D] placeholder:text-[#A39689] focus:border-[#D97736] focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setAssignToMina((prev) => !prev)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
              assignToMina
                ? 'border-[#3F6F62] bg-[#E5F2EE] text-[#285247]'
                : 'border-[#DCD0C0] bg-white text-[#5C5046] hover:bg-[#F3ECE2]'
            }`}
          >
            <Sparkles className="h-3 w-3 text-[#3F6F62]" />
            <span>{assignToMina ? 'มอบหมายมีน่าทำอัตโนมัติ' : 'สั่งให้มีน่าทำอัตโนมัติ'}</span>
          </button>

          {assignToMina && (
            <>
              <select
                value={assistantId}
                disabled={isSaving}
                onChange={(e) => setAssistantId(e.target.value as TaskAssistantId)}
                aria-label="เลือกผู้ช่วย AI"
                className="rounded-lg border border-[#9DC3B8] bg-white px-2 py-1 text-xs font-medium text-[#1F3F37] focus:border-[#3F6F62] focus:outline-none disabled:opacity-60"
              >
                <option value="mina">มีน่า</option>
                <option value="antigravity">Antigravity</option>
                <option value="ai_studio">AI Studio</option>
              </select>
              <div className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#3F6F62]" />
                <input
                  type="time"
                  value={scheduledTime}
                  disabled={isSaving}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  aria-label="เวลาที่ให้ผู้ช่วย AI เริ่มทำ"
                  className="rounded-lg border border-[#9DC3B8] bg-white px-2 py-1 text-xs tabular-nums text-[#1F3F37] focus:border-[#3F6F62] focus:outline-none disabled:opacity-60"
                />
                {!scheduledTime && (
                  <span className="text-[11px] text-[#3C6457]">
                    (ไม่ระบุเวลา = ทำทันที)
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {proposal.errorMessage && (
        <p className="mt-2 rounded-lg border border-[#DFB4A8] bg-[#FDF2EF] px-2.5 py-1.5 text-xs text-[#8C2F1B]">
          {proposal.errorMessage}
        </p>
      )}

      {!accessToken ? (
        <div className="mt-3 space-y-2 border-t border-[#EAE0D2] pt-2.5">
          <p className="text-xs text-[#6E6258]">
            เชื่อมต่อบัญชี Google เพื่ออนุญาตให้มีน่าบันทึกงานนี้ลง Google Tasks ของคุณ
          </p>
          {googleAuthError && (
            <p className="text-xs text-[#8C2F1B]">{googleAuthError}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={isSigningInGoogle}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#747775] bg-white px-3 text-xs font-medium text-[#1F1F1F] transition-colors hover:bg-[#F8F9FA] disabled:opacity-60"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-4 w-4 shrink-0"
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
            <button
              type="button"
              onClick={() => onCancel(messageId)}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#7A6D62] transition-colors hover:text-[#29221D]"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-[#EAE0D2] pt-2.5">
          <p className="mb-2 text-[11px] text-[#7A6D62]">
            จะเพิ่มรายการนี้ลง Google Tasks ({googleUser?.email || 'บัญชี Google ของคุณ'})
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSaving || !title.trim()}
              onClick={() =>
                void onConfirm(messageId, {
                  title: title.trim(),
                  notes: notes.trim() || undefined,
                  dueDate: dueDate || undefined,
                  assignToMina,
                  assistantId: assignToMina ? assistantId : undefined,
                  scheduledTime: assignToMina && scheduledTime ? scheduledTime : undefined,
                })
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#D97736] px-3 py-1.5 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>กำลังเพิ่มงาน...</span>
                </>
              ) : (
                <>
                  <Pin className="h-3.5 w-3.5" />
                  <span>ยืนยันเพิ่มลง Google Tasks</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onCancel(messageId)}
              className="cursor-pointer rounded-lg border border-[#D8CCBC] bg-white px-3 py-1.5 text-xs font-medium text-[#5C5046] transition-colors hover:bg-[#F4EDE3] disabled:opacity-50"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight, safe Markdown-to-React renderer for clean headings, lists,
 * bold text, and code blocks without raw HTML injection.
 */
export function StructuredResponse({ content }: { content: string }) {
  const blocks = content.split(/```/);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, blockIdx) => {
        if (blockIdx % 2 === 1) {
          // Fenced code block
          const firstNewline = block.indexOf('\n');
          const codeBody =
            firstNewline >= 0 ? block.slice(firstNewline + 1) : block;
          return (
            <pre
              key={blockIdx}
              className="cozy-scroll overflow-x-auto rounded-lg bg-[#231D19] p-3 font-mono text-xs leading-relaxed text-[#FAF6F0]"
            >
              <code>{codeBody.trimEnd()}</code>
            </pre>
          );
        }

        const lines = block.split('\n');
        return (
          <div key={blockIdx} className="space-y-1.5">
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lineIdx} className="h-1" />;
              }

              if (trimmed.startsWith('### ')) {
                return (
                  <h4
                    key={lineIdx}
                    className="pt-1 font-display text-sm font-semibold text-[#29221D]"
                  >
                    {renderInline(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                const headingText = trimmed.replace(/^#{1,2}\s+/, '');
                return (
                  <h3
                    key={lineIdx}
                    className="pt-1 font-display text-[15px] font-bold text-[#29221D]"
                  >
                    {renderInline(headingText)}
                  </h3>
                );
              }
              if (/^[-*•]\s+/.test(trimmed)) {
                return (
                  <div key={lineIdx} className="flex items-start gap-2 pl-1">
                    <span aria-hidden="true" className="mt-1 text-xs text-[#D97736]">
                      •
                    </span>
                    <p className="flex-1">{renderInline(trimmed.replace(/^[-*•]\s+/, ''))}</p>
                  </div>
                );
              }
              const orderedMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
              if (orderedMatch) {
                return (
                  <div key={lineIdx} className="flex items-start gap-2 pl-1">
                    <span className="shrink-0 font-semibold tabular-nums text-[#8F5328]">
                      {orderedMatch[1]}
                    </span>
                    <p className="flex-1">{renderInline(orderedMatch[2])}</p>
                  </div>
                );
              }

              return <p key={lineIdx}>{renderInline(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Split by **bold** or `code`
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#1F1915]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[#EFE7DC] px-1.5 py-0.5 font-mono text-[13px] text-[#7A3F1D]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}

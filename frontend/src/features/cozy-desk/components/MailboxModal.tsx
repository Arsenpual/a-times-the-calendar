import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ExternalLink,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  MailOpen,
  Paperclip,
  RefreshCw,
  Search,
  Star,
  X,
} from 'lucide-react';
import type { GmailMessageDetail, GmailMessageSummary } from '../types/game';
import {
  fetchGmailMessageDetail,
  fetchGmailMessages,
  GmailApiError,
  type GmailFilterCategory,
} from '../api/gmailApi';

interface MailboxModalProps {
  googleUser: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  authError: string | null;
  gmailScopeMissing: boolean;
  unreadCount: number;
  locallyReadIds: ReadonlySet<string>;
  onMarkMessageRead: (messageId: string, wasUnread: boolean) => void;
  onSyncUnreadStatus: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onTokenExpired: () => void;
  onGmailScopeError: () => void;
  onClose: () => void;
}

const FILTERS: ReadonlyArray<{ id: GmailFilterCategory; label: string }> = [
  { id: 'inbox', label: 'กล่องจดหมาย' },
  { id: 'unread', label: 'ยังไม่อ่าน' },
  { id: 'starred', label: 'ติดดาว' },
];

function formatThaiMailTime(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const isSameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    ...(isSameYear ? {} : { year: '2-digit' }),
  });
}

function formatThaiFullDateTime(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GoogleSignInButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
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
      <span>{disabled ? 'กำลังเข้าสู่ระบบ...' : (label || 'Sign in with Google')}</span>
    </button>
  );
}

export function MailboxModal({
  googleUser,
  accessToken,
  isSigningIn,
  authError,
  gmailScopeMissing,
  unreadCount,
  locallyReadIds,
  onMarkMessageRead,
  onSyncUnreadStatus,
  onGoogleSignIn,
  onGoogleSignOut,
  onTokenExpired,
  onGmailScopeError,
  onClose,
}: MailboxModalProps) {
  const isAuthenticated = Boolean(googleUser && accessToken);
  const needsSignInOrConsent = !isAuthenticated || gmailScopeMissing;

  const [filter, setFilter] = useState<GmailFilterCategory>('inbox');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<GmailMessageDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof GmailApiError) {
        if (err.status === 401) {
          onTokenExpired();
        } else if (err.status === 403 && err.isScopeError) {
          onGmailScopeError();
        }
        setApiError(err.message);
      } else {
        setApiError('ไม่สามารถเชื่อมต่อ Gmail ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    },
    [onGmailScopeError, onTokenExpired]
  );

  const loadMessages = useCallback(async () => {
    if (!accessToken || gmailScopeMissing) return;
    setIsLoadingList(true);
    setApiError(null);
    try {
      const list = await fetchGmailMessages(accessToken, {
        filter,
        searchQuery: activeSearch,
        maxResults: 20,
      });
      setMessages(list);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingList(false);
    }
  }, [accessToken, activeSearch, filter, gmailScopeMissing, handleApiError]);

  useEffect(() => {
    if (!needsSignInOrConsent) {
      void loadMessages();
      onSyncUnreadStatus();
    } else {
      setMessages([]);
      setSelectedId(null);
      setSelectedDetail(null);
      setApiError(null);
    }
  }, [needsSignInOrConsent, loadMessages, onSyncUnreadStatus]);

  const handleSelectMessage = useCallback(
    async (msg: GmailMessageSummary) => {
      if (!accessToken) return;
      setSelectedId(msg.id);
      setDetailError(null);
      onMarkMessageRead(msg.id, msg.isUnread);

      if (selectedDetail?.id === msg.id) {
        return;
      }

      setSelectedDetail(null);
      setIsLoadingDetail(true);
      try {
        const detail = await fetchGmailMessageDetail(accessToken, msg.id);
        setSelectedDetail(detail);
      } catch (err) {
        if (err instanceof GmailApiError) {
          if (err.status === 401) onTokenExpired();
          else if (err.status === 403 && err.isScopeError) onGmailScopeError();
          setDetailError(err.message);
        } else {
          setDetailError('ไม่สามารถโหลดเนื้อหาอีเมลฉบับนี้ได้ กรุณาลองใหม่');
        }
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [accessToken, onGmailScopeError, onMarkMessageRead, onTokenExpired, selectedDetail?.id]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
  };

  const selectedSummary = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ตู้ไปรษณีย์ริมถนน Gmail"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0C0A09]/80 p-3 backdrop-blur-xs sm:p-6"
    >
      {/* Warm Oak & Enamel Framed Roadside Mailbox Reader */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-4 border-[#2B4B5F] bg-[#FAF6F0] text-[#29221D] shadow-2xl"
      >
        {/* Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#D8C5AE] bg-[#EFE5D7] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2D4F63] text-[#FAF6F0]">
              <Mail className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-bold text-[#29221D]">
                ตู้ไปรษณีย์ริมถนน · Gmail
              </h2>
              <div className="flex items-center gap-2 truncate text-xs text-[#6E6258]">
                {isAuthenticated && googleUser?.email ? (
                  <>
                    <span className="truncate">{googleUser.email}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-medium text-[#9E2A2B]">
                      {unreadCount > 0 ? `ยังไม่อ่าน ${unreadCount} ฉบับ` : 'อ่านครบแล้ว'}
                    </span>
                  </>
                ) : (
                  <span>เชื่อมต่อบัญชี Gmail เพื่อรับการแจ้งเตือนและเปิดอ่านอีเมลที่ตู้ไปรษณีย์</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && !gmailScopeMissing && (
              <button
                type="button"
                onClick={() => {
                  void loadMessages();
                  onSyncUnreadStatus();
                }}
                disabled={isLoadingList}
                title="ตรวจเช็กอีเมลใหม่"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] text-[#52473E] transition-colors hover:bg-[#E7DCCE] disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingList ? 'animate-spin' : ''}`} />
              </button>
            )}

            {isAuthenticated && (
              <button
                type="button"
                onClick={onGoogleSignOut}
                title="ออกจากระบบบัญชี Google"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-2.5 text-xs font-medium text-[#52473E] transition-colors hover:bg-[#E7DCCE]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-3 text-xs font-semibold text-[#3D342D] transition-colors hover:bg-[#E7DCCE]"
            >
              <X className="h-3.5 w-3.5" />
              <span>ปิดตู้ไปรษณีย์</span>
            </button>
          </div>
        </header>

        {/* Auth / API Error Strip */}
        {(authError || apiError) && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFB4A8] bg-[#FDF2EF] px-5 py-2.5 text-xs text-[#8C2F1B]"
          >
            <span>{authError || apiError}</span>
            <button
              type="button"
              onClick={needsSignInOrConsent ? onGoogleSignIn : () => void loadMessages()}
              className="cursor-pointer whitespace-nowrap rounded-md bg-[#8C2F1B] px-3 py-1 font-semibold text-white transition-colors hover:bg-[#732515]"
            >
              {needsSignInOrConsent ? 'Sign in with Google' : 'ลองโหลดใหม่'}
            </button>
          </div>
        )}

        {/* Unauthenticated or Missing Gmail Scope View */}
        {needsSignInOrConsent ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-5 rounded-2xl border border-[#DFD2C0] bg-white p-8 shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF1F5] text-[#2D4F63]">
                <Mail className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-[#29221D]">
                  {gmailScopeMissing
                    ? 'อนุญาตสิทธิ์อ่านอีเมลจาก Gmail'
                    : 'เชื่อมต่อตู้ไปรษณีย์ริมถนนกับ Gmail'}
                </h3>
                <p className="text-sm leading-relaxed text-[#6E6258]">
                  {gmailScopeMissing
                    ? 'บัญชี Google ของคุณเชื่อมต่ออยู่แล้ว กรุณาเข้าสู่ระบบอีกครั้งเพื่ออนุญาตสิทธิ์อ่านข้อความจาก Gmail สำหรับตู้ไปรษณีย์ริมถนน'
                    : 'เข้าสู่ระบบด้วยบัญชี Google เพื่อให้ตู้ไปรษณีย์ริมถนนยกธงแดงแจ้งเตือนเมื่อมีข้อความเข้า และเปิดอ่านอีเมลได้ทันทีจากในบ้าน'}
                </p>
              </div>
              <div className="pt-1">
                <GoogleSignInButton
                  onClick={onGoogleSignIn}
                  disabled={isSigningIn}
                  label={gmailScopeMissing ? 'Sign in with Google (เพิ่มสิทธิ์ Gmail)' : 'Sign in with Google'}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Search & Filter Toolbar */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-[#E2D9CC] bg-[#F6EFE5] px-5 py-3">
              {/* Segmented Filter Tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-[#EAE0D2] p-1">
                {FILTERS.map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-white text-[#29221D] shadow-xs'
                          : 'text-[#62564C] hover:text-[#29221D]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Input + Open Gmail */}
              <div className="flex min-w-[240px] flex-1 items-center justify-end gap-2">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex w-full max-w-sm items-center gap-1.5"
                >
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8E8074]" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="ค้นหาอีเมล ผู้ส่ง หรือหัวข้อ..."
                      className="h-9 w-full rounded-lg border border-[#D4C6B4] bg-white pr-8 pl-8.5 text-xs text-[#29221D] placeholder:text-[#96897D] focus:border-[#2D4F63] focus:outline-none"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput('');
                          setActiveSearch('');
                        }}
                        aria-label="ล้างคำค้นหา"
                        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-[#8E8074] hover:text-[#29221D]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="h-9 cursor-pointer whitespace-nowrap rounded-lg border border-[#D4C6B4] bg-[#FAF6F0] px-3 text-xs font-semibold text-[#3D342D] transition-colors hover:bg-[#E7DCCE]"
                  >
                    ค้นหา
                  </button>
                </form>

                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4C6B4] bg-[#FAF6F0] px-3 text-xs font-semibold text-[#3D342D] transition-colors hover:bg-[#E7DCCE]"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#2D4F63]" />
                  <span className="hidden md:inline">เปิด Gmail</span>
                </a>
              </div>
            </div>

            {/* 2-Column Master-Detail Body */}
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_1fr]">
              {/* Left Column: Inbox Message List */}
              <div className="flex min-h-0 flex-col border-b border-[#E2D9CC] bg-[#FAF6F0] md:border-r md:border-b-0">
                <div className="flex shrink-0 items-center justify-between border-b border-[#EAE2D6] px-4 py-2 text-[11px] text-[#7D7065]">
                  <span>
                    {activeSearch
                      ? `ผลการค้นหา “${activeSearch}”`
                      : FILTERS.find((f) => f.id === filter)?.label}
                  </span>
                  <span className="tabular-nums">{messages.length} ฉบับ</span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[#EDE5D9]">
                  {isLoadingList && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2.5 py-14 text-xs text-[#7D7065]">
                      <Loader2 className="h-5 w-5 animate-spin text-[#2D4F63]" />
                      <span>กำลังเปิดตู้ไปรษณีย์และโหลดอีเมล...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                      <Inbox className="h-8 w-8 text-[#BDB1A3]" />
                      <p className="text-sm font-medium text-[#52473E]">ไม่พบข้อความในหมวดนี้</p>
                      <p className="text-xs text-[#8A7D72]">
                        {filter === 'unread'
                          ? 'คุณอ่านอีเมลใหม่ครบทุกฉบับแล้ว'
                          : 'ลองเปลี่ยนหมวดหมู่หรือล้างคำค้นหา'}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSelected = msg.id === selectedId;
                      const isStillUnread = msg.isUnread && !locallyReadIds.has(msg.id);
                      return (
                        <button
                          key={msg.id}
                          type="button"
                          onClick={() => void handleSelectMessage(msg)}
                          className={`flex w-full cursor-pointer flex-col gap-1 px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? 'bg-[#EAE1D4]'
                              : isStillUnread
                                ? 'bg-white hover:bg-[#F5EFE6]'
                                : 'bg-[#FAF6F0] hover:bg-[#F3ECE2]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {isStillUnread && (
                                <span
                                  aria-label="ยังไม่อ่าน"
                                  className="h-2 w-2 shrink-0 rounded-full bg-[#C83E37]"
                                />
                              )}
                              <span
                                className={`truncate text-xs ${
                                  isStillUnread
                                    ? 'font-bold text-[#29221D]'
                                    : 'font-medium text-[#52473E]'
                                }`}
                              >
                                {msg.fromName}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-[#8A7D72]">
                              {msg.isStarred && (
                                <Star className="h-3 w-3 fill-[#D99B26] text-[#D99B26]" />
                              )}
                              <span>{formatThaiMailTime(msg.internalDate)}</span>
                            </div>
                          </div>

                          <div
                            className={`truncate text-xs ${
                              isStillUnread
                                ? 'font-semibold text-[#1E1916]'
                                : 'font-normal text-[#3D342D]'
                            }`}
                          >
                            {msg.subject}
                          </div>

                          {msg.snippet && (
                            <p className="line-clamp-1 text-[11px] leading-snug text-[#7D7065]">
                              {msg.snippet}
                            </p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Editorial Letter Reading Pane */}
              <div className="flex min-h-0 flex-col bg-white">
                {!selectedId ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4EFE7] text-[#7A6B5D]">
                      <MailOpen className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-display text-sm font-semibold text-[#3D342D]">
                        เลือกจดหมายจากรายการด้านซ้ายเพื่อเปิดอ่าน
                      </p>
                      <p className="text-xs text-[#8A7D72]">
                        เนื้อหาจะถูกแสดงแบบอ่านสบายตา พร้อมลิงก์เปิดต่อใน Gmail
                      </p>
                    </div>
                  </div>
                ) : isLoadingDetail ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-xs text-[#7D7065]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#2D4F63]" />
                    <span>กำลังคลี่จดหมาย...</span>
                  </div>
                ) : detailError ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <p className="text-sm font-medium text-[#8C2F1B]">{detailError}</p>
                    {selectedSummary && (
                      <button
                        type="button"
                        onClick={() => void handleSelectMessage(selectedSummary)}
                        className="cursor-pointer rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-3.5 py-1.5 text-xs font-semibold text-[#3D342D] hover:bg-[#EAE0D2]"
                      >
                        ลองโหลดอีกครั้ง
                      </button>
                    )}
                  </div>
                ) : selectedDetail ? (
                  <article className="flex min-h-0 flex-1 flex-col">
                    {/* Letter Header */}
                    <div className="shrink-0 space-y-2.5 border-b border-[#EDE5D9] px-6 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-display text-lg font-bold leading-snug text-[#1F1A17]">
                          {selectedDetail.subject}
                        </h3>
                        <a
                          href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(selectedDetail.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8CBB8] bg-[#FAF6F0] px-3 text-xs font-medium text-[#3D342D] transition-colors hover:bg-[#EFE5D7]"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-[#2D4F63]" />
                          <span>เปิดใน Gmail</span>
                        </a>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6E6258]">
                        <span className="font-semibold text-[#29221D]">
                          {selectedDetail.fromName}
                        </span>
                        {selectedDetail.fromEmail &&
                          selectedDetail.fromEmail !== selectedDetail.fromName && (
                            <span className="text-[#8A7D72]">&lt;{selectedDetail.fromEmail}&gt;</span>
                          )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatThaiFullDateTime(selectedDetail.internalDate)}
                        </span>
                      </div>

                      {selectedDetail.to && (
                        <div className="truncate text-[11px] text-[#8A7D72]">
                          ถึง: {selectedDetail.to}
                        </div>
                      )}
                    </div>

                    {/* Attachments Bar (if any) */}
                    {selectedDetail.attachments.length > 0 && (
                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[#F0EAE0] bg-[#FAF7F2] px-6 py-2.5 text-xs text-[#52473E]">
                        <span className="inline-flex items-center gap-1 font-medium text-[#6E6258]">
                          <Paperclip className="h-3.5 w-3.5" />
                          ไฟล์แนบ ({selectedDetail.attachments.length})
                        </span>
                        {selectedDetail.attachments.map((att, idx) => (
                          <span
                            key={`${att.filename}-${idx}`}
                            className="inline-flex items-center gap-1 text-[#29221D]"
                          >
                            <span className="max-w-[200px] truncate font-medium">
                              {att.filename}
                            </span>
                            {att.size > 0 && (
                              <span className="tabular-nums text-[11px] text-[#8A7D72]">
                                ({formatAttachmentSize(att.size)})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Letter Body (safe plain-text rendering, no raw HTML injection) */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                      <div className="max-w-[68ch] whitespace-pre-wrap break-words text-sm leading-relaxed text-[#2D2621]">
                        {selectedDetail.bodyText}
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

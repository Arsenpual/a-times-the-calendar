import { useCallback, useEffect, useRef, useState } from "react";
import { clearTelegramChat, getTelegramChat, getTelegramChatSummary, markTelegramChatRead, sendTelegramChatMessage } from "../telegram-chat-api.js";

// The web chat is deliberately backend-polled rather than a second direct
// Firestore client: private Telegram data stays behind requireAuth. A short
// interval while the dialog is visible makes a Telegram reply feel live;
// the closed state only refreshes its tiny unread counter.
const CLOSED_CHAT_SUMMARY_INTERVAL_MS = 60_000;
const OPEN_CHAT_REFRESH_INTERVAL_MS = 8_000;

export function useTelegramWebChat(firebaseUser, connected) {
  const uid = firebaseUser?.uid;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const state = useRef(null);
  if (!state.current || state.current.uid !== uid || state.current.connected !== connected) {
    state.current = { uid, connected, revision: "", inFlight: false, retryAt: 0, messagesAt: 0, summaryAt: 0 };
  }
  const [chat, setChat] = useState({ uid, isOpen: false, messages: [], unreadCount: 0, error: "" });
  const refresh = useCallback(async (messages, force = false) => {
    const request = state.current;
    const key = messages ? "messagesAt" : "summaryAt";
    const interval = messages ? OPEN_CHAT_REFRESH_INTERVAL_MS : CLOSED_CHAT_SUMMARY_INTERVAL_MS;
    if (!uid || !connected || request.inFlight || Date.now() < request.retryAt) return;
    if (!force && (document.visibilityState === "hidden" || Date.now() - request[key] < interval)) return;
    request.inFlight = true;
    request[key] = Date.now();
    try {
      const data = messages ? await getTelegramChat(30, request.revision) : await getTelegramChatSummary();
      if (!mounted.current || state.current !== request) return;
      if (data.notModified) {
        setChat(previous => previous.error ? { ...previous, error: "" } : previous);
        return;
      }
      if (messages) request.revision = data.revision || "";
      setChat(previous => ({ ...previous, ...(messages ? { messages: data.messages || [] } : {}), unreadCount: data.unreadCount || 0, error: "" }));
    } catch (error) {
      request.retryAt = Date.now() + (error.retryAfterSeconds || 30) * 1000;
      if (mounted.current && state.current === request) setChat(previous => ({ ...previous, error: error.message }));
    } finally { request.inFlight = false; }
  }, [uid, connected]);
  const refreshMessages = useCallback(() => refresh(true), [refresh]);
  const refreshSummary = useCallback(() => refresh(false), [refresh]);
  useEffect(() => {
    setChat({ uid, isOpen: false, messages: [], unreadCount: 0, error: "" });
  }, [uid, connected]);
  useEffect(() => {
    if (chat.uid !== uid || chat.isOpen) return undefined;
    refreshSummary();
    const timer = window.setInterval(refreshSummary, CLOSED_CHAT_SUMMARY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [uid, chat.uid, chat.isOpen, refreshSummary]);
  useEffect(() => {
    if (chat.uid !== uid || !chat.isOpen) return undefined;
    refreshMessages();
    const timer = window.setInterval(refreshMessages, OPEN_CHAT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [uid, chat.uid, chat.isOpen, refreshMessages]);
  useEffect(() => {
    const refreshWhenReturning = () => {
      if (document.visibilityState !== "visible") return;
      if (chat.isOpen) refreshMessages();
      else refreshSummary();
    };
    document.addEventListener("visibilitychange", refreshWhenReturning);
    window.addEventListener("focus", refreshWhenReturning);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenReturning);
      window.removeEventListener("focus", refreshWhenReturning);
    };
  }, [chat.isOpen, refreshMessages, refreshSummary]);
  const openChat = useCallback(() => {
    if (state.current) state.current.messagesAt = 0;
    setChat((previous) => ({ ...previous, isOpen: true }));
  }, []);
  const closeChat = useCallback(() => setChat((previous) => ({ ...previous, isOpen: false })), []);
  const markRead = useCallback(async () => {
    await markTelegramChatRead().catch(() => {});
    setChat((previous) => ({
      ...previous,
      unreadCount: 0,
      messages: previous.messages.map((message) => (
        message.direction === "outgoing" && !message.readAt ? { ...message, readAt: Date.now() } : message
      ))
    }));
  }, []);
  const send = useCallback(async (text) => {
    await sendTelegramChatMessage(text);
    await refresh(true, true);
    await markRead();
  }, [markRead, refresh]);
  const clear = useCallback(async () => {
    await clearTelegramChat();
    if (state.current) state.current.revision = "";
    setChat((previous) => ({ ...previous, messages: [], unreadCount: 0, error: "" }));
  }, []);
  return { ...chat, openChat, closeChat, markTelegramChatRead: markRead, sendChatMessage: send, clearChatMessages: clear };
}

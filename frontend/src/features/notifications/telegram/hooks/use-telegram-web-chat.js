import { useCallback, useEffect, useState } from "react";
import { clearTelegramChat, getTelegramChat, getTelegramChatSummary, markTelegramChatRead, sendTelegramChatMessage } from "../telegram-chat-api.js";

// The web chat is deliberately backend-polled rather than a second direct
// Firestore client: private Telegram data stays behind requireAuth. A short
// interval while the dialog is visible makes a Telegram reply feel live;
// the closed state only refreshes its tiny unread counter.
const CLOSED_CHAT_SUMMARY_INTERVAL_MS = 30_000;
const OPEN_CHAT_REFRESH_INTERVAL_MS = 8_000;

export function useTelegramWebChat(firebaseUser, connected) {
  const [chat, setChat] = useState({ isOpen: false, messages: [], unreadCount: 0, error: "" });
  const refreshMessages = useCallback(async () => {
    if (!firebaseUser || !connected) return;
    try {
      const data = await getTelegramChat();
      setChat((previous) => ({ ...previous, messages: data.messages || [], unreadCount: data.unreadCount || 0, error: "" }));
    } catch (error) { setChat((previous) => ({ ...previous, error: error.message })); }
  }, [firebaseUser, connected]);
  const refreshSummary = useCallback(async () => {
    if (!firebaseUser || !connected) return;
    try {
      const data = await getTelegramChatSummary();
      setChat((previous) => ({ ...previous, unreadCount: data.unreadCount || 0, error: "" }));
    } catch (error) { setChat((previous) => ({ ...previous, error: error.message })); }
  }, [firebaseUser, connected]);
  useEffect(() => {
    if (chat.isOpen) return undefined;
    refreshSummary();
    const timer = window.setInterval(refreshSummary, CLOSED_CHAT_SUMMARY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [chat.isOpen, refreshSummary]);
  useEffect(() => {
    if (!chat.isOpen) return undefined;
    refreshMessages();
    const timer = window.setInterval(refreshMessages, OPEN_CHAT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [chat.isOpen, refreshMessages]);
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
  const openChat = useCallback(async () => {
    setChat((previous) => ({ ...previous, isOpen: true }));
    await refreshMessages();
  }, [refreshMessages]);
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
    await refreshMessages();
    await markRead();
  }, [markRead, refreshMessages]);
  const clear = useCallback(async () => {
    await clearTelegramChat();
    setChat((previous) => ({ ...previous, messages: [], unreadCount: 0, error: "" }));
  }, []);
  return { ...chat, openChat, closeChat, markTelegramChatRead: markRead, sendChatMessage: send, clearChatMessages: clear };
}

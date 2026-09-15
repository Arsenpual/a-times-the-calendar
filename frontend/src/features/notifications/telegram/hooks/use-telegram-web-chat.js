import { useCallback, useEffect, useState } from "react";
import { getTelegramChat, getTelegramChatSummary, markTelegramChatRead, sendTelegramChatMessage } from "../telegram-chat-api.js";

const CLOSED_CHAT_SUMMARY_INTERVAL_MS = 60_000;
const OPEN_CHAT_REFRESH_INTERVAL_MS = 30_000;

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
  return { ...chat, openChat, closeChat, markTelegramChatRead: markRead, sendChatMessage: send };
}

import { useCallback, useEffect, useState } from "react";
import { getTelegramChat, markTelegramChatRead, sendTelegramChatMessage, setTelegramAiChatEnabled } from "../telegram-chat-api.js";

export function useTelegramWebChat(firebaseUser, connected) {
  const [chat, setChat] = useState({ isOpen: false, messages: [], unreadCount: 0, aiChat: null, error: "" });
  const refresh = useCallback(async () => {
    if (!firebaseUser || !connected) return;
    try {
      const data = await getTelegramChat();
      setChat((previous) => ({ ...previous, messages: data.messages || [], unreadCount: data.unreadCount || 0, aiChat: data.aiChat || null, error: "" }));
    } catch (error) { setChat((previous) => ({ ...previous, error: error.message })); }
  }, [firebaseUser, connected]);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const openChat = useCallback(async () => {
    setChat((previous) => ({ ...previous, isOpen: true }));
    await refresh();
  }, [refresh]);
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
    await refresh();
    await markRead();
  }, [markRead, refresh]);
  const setAiChatEnabled = useCallback(async (enabled) => {
    const data = await setTelegramAiChatEnabled(enabled);
    setChat((previous) => ({ ...previous, aiChat: data.aiChat || previous.aiChat }));
  }, []);
  return { ...chat, openChat, closeChat, markTelegramChatRead: markRead, sendChatMessage: send, setAiChatEnabled };
}

import { useCallback, useEffect, useState } from "react";
import { getTelegramChat, markTelegramChatRead, sendTelegramChatMessage } from "../telegram-chat-api.js";

export function useTelegramWebChat(firebaseUser, connected) {
  const [chat, setChat] = useState({ isOpen: false, messages: [], unreadCount: 0, error: "" });
  const refresh = useCallback(async () => {
    if (!firebaseUser || !connected) return;
    try {
      const data = await getTelegramChat();
      setChat((previous) => ({ ...previous, messages: data.messages || [], unreadCount: data.unreadCount || 0, error: "" }));
    } catch (error) { setChat((previous) => ({ ...previous, error: error.message })); }
  }, [firebaseUser, connected]);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const openChat = useCallback(async () => {
    setChat((previous) => ({ ...previous, isOpen: true }));
    await markTelegramChatRead().catch(() => {});
    await refresh();
  }, [refresh]);
  const closeChat = useCallback(() => setChat((previous) => ({ ...previous, isOpen: false })), []);
  const send = useCallback(async (text) => { await sendTelegramChatMessage(text); await refresh(); }, [refresh]);
  return { ...chat, openChat, closeChat, sendChatMessage: send };
}

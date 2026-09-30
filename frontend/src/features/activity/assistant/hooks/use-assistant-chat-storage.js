import { useEffect, useState } from "react";

export const INITIAL_ASSISTANT_MESSAGE = {
  role: "assistant",
  text: "สวัสดีครับ ผม MR.Zettascale ✦ เลือกสร้างกิจกรรมจากตัวเลือกด้านล่าง หรือระบุให้ครบ เช่น “ทำงาน 08.30 พรุ่งนี้ 3 ชม.” และถามตาราง เช่น “วันนี้มีอะไรบ้าง?” ได้ครับ",
  source: "template"
};

export function assistantChatStorageKey(userId) {
  return userId ? `times.activity-ai-assistant.chat.v2:${userId}` : null;
}

function emptyChat() {
  return { messages: [INITIAL_ASSISTANT_MESSAGE], conversationNodeId: "home", guidedActivity: null, guidedConversationMode: "template" };
}

export function loadSavedChat(userId) {
  const key = assistantChatStorageKey(userId);
  if (!key || typeof window === "undefined") return emptyChat();
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || "null");
    const messages = Array.isArray(saved?.messages)
      ? saved.messages.slice(-120).filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.text === "string").map((message) => ({ role: message.role, text: message.text.slice(0, 1_200), source: ["ai", "calendar", "knowledge", "system"].includes(message.source) ? message.source : "template" }))
      : [];
    return {
      // A new chat always begins with MR.Zettascale's greeting, including
      // after a previous transcript was cleared or a tab was reopened.
      messages: messages.length ? messages : [INITIAL_ASSISTANT_MESSAGE],
      conversationNodeId: typeof saved?.conversationNodeId === "string" ? saved.conversationNodeId : "home",
      guidedActivity: saved?.guidedActivity && typeof saved.guidedActivity === "object" ? saved.guidedActivity : null,
      guidedConversationMode: saved?.guidedConversationMode === "ai" ? "ai" : "template"
    };
  } catch { return emptyChat(); }
}

export function useInitialAssistantChat(userId) {
  const [initialChat] = useState(() => loadSavedChat(userId));
  return initialChat;
}

export function usePersistAssistantChat({ userId, messages, conversationNodeId, guidedActivity, guidedConversationMode }) {
  useEffect(() => {
    const key = assistantChatStorageKey(userId);
    if (!key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({
        messages: messages.slice(-120), conversationNodeId, guidedActivity, guidedConversationMode
      }));
    } catch { /* Storage may be disabled or full; chat still works in memory. */ }
  }, [userId, messages, conversationNodeId, guidedActivity, guidedConversationMode]);
}

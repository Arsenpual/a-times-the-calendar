import { useEffect, useState } from "react";

export const INITIAL_ASSISTANT_MESSAGE = {
  role: "assistant",
  text: "สวัสดีครับ ผม MR.Zettascale ✦ บอกสิ่งที่อยากทำคร่าว ๆ ได้เลย เช่น “พรุ่งนี้ประชุมทีมช่วงเช้า” หรือถาม Google Calendar เช่น “พรุ่งนี้ว่างช่วงไหน?” ได้ครับ",
  source: "template"
};

const CHAT_STORAGE_KEY = "times.activity-ai-assistant.chat.v1";

function emptyChat() {
  return { messages: [INITIAL_ASSISTANT_MESSAGE], conversationNodeId: "home", guidedActivity: null, guidedConversationMode: "template", draft: null };
}

function loadSavedChat() {
  if (typeof window === "undefined") return emptyChat();
  try {
    const saved = JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY) || "null");
    const messages = Array.isArray(saved?.messages)
      ? saved.messages.slice(-120).filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.text === "string").map((message) => ({ role: message.role, text: message.text.slice(0, 1_200), source: ["ai", "calendar", "knowledge", "system"].includes(message.source) ? message.source : "template" }))
      : [];
    return {
      // A new chat always begins with MR.Zettascale's greeting, including
      // after a previous transcript was cleared or a tab was reopened.
      messages: messages.length ? messages : [INITIAL_ASSISTANT_MESSAGE],
      conversationNodeId: typeof saved?.conversationNodeId === "string" ? saved.conversationNodeId : "home",
      guidedActivity: saved?.guidedActivity && typeof saved.guidedActivity === "object" ? saved.guidedActivity : null,
      guidedConversationMode: saved?.guidedConversationMode === "ai" ? "ai" : "template",
      draft: saved?.draft && typeof saved.draft === "object" ? saved.draft : null
    };
  } catch { return emptyChat(); }
}

export function useInitialAssistantChat() {
  const [initialChat] = useState(loadSavedChat);
  return initialChat;
}

export function usePersistAssistantChat({ messages, conversationNodeId, guidedActivity, guidedConversationMode, draft }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        messages: messages.slice(-120), conversationNodeId, guidedActivity, guidedConversationMode, draft
      }));
    } catch { /* Storage may be disabled or full; chat still works in memory. */ }
  }, [messages, conversationNodeId, guidedActivity, guidedConversationMode, draft]);
}

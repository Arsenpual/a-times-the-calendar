import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import React from "react";
import Renderer from "react-test-renderer";
const { act } = Renderer;
const reactUrl = import.meta.resolve("react");
const url = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
let now = 1_000_000;
const realNow = Date.now;
Date.now = () => now;
const timers = new Map(), events = new Map();
const addEventListener = (name, fn) => { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); };
const removeEventListener = (name, fn) => events.get(name)?.delete(fn);
globalThis.document = { visibilityState: "visible", addEventListener, removeEventListener };
globalThis.window = { setInterval: (fn, delay) => { timers.set(fn, delay); return fn; }, clearInterval: id => timers.delete(id), addEventListener, removeEventListener };
const fire = name => Promise.all([...events.get(name) || []].map(fn => fn()));
const tick = async ms => { now += ms; await act(async () => { await Promise.all([...timers.keys()].map(fn => fn())); }); };
let messageCalls = [], summaryCalls = 0, syncCalls = 0, fail = false, hold, finish;
globalThis.pollingApi = {
  getTelegramChat: async (limit, revision) => {
    messageCalls.push({ limit, revision });
    if (hold) return new Promise(resolve => { finish = resolve; });
    if (fail) throw Object.assign(new Error("quota"), { retryAfterSeconds: 300 });
    return revision === "v1" ? { notModified: true } : { revision: "v1", messages: [{ id: "first" }], unreadCount: 1 };
  },
  getTelegramChatSummary: async () => { summaryCalls++; return { unreadCount: 1 }; },
  clearTelegramChat: async () => {}, markTelegramChatRead: async () => {}, sendTelegramChatMessage: async () => {},
  fetchReminderSync: async () => { syncCalls++; return { revision: "v1", reminders: {} }; },
  fetchReminders: async () => ({}), saveReminder: async () => {}, deleteReminderRemote: async () => {}
};
const chatSource = readFileSync(new URL("../src/features/notifications/telegram/hooks/use-telegram-web-chat.js", import.meta.url), "utf8")
  .replace('from "react"', `from "${reactUrl}"`)
  .replace(/import \{ clearTelegramChat[^\n]+/, "const { clearTelegramChat, getTelegramChat, getTelegramChatSummary, markTelegramChatRead, sendTelegramChatMessage } = globalThis.pollingApi;");
const syncSource = readFileSync(new URL("../src/features/reminder/hooks/use-reminders-sync.js", import.meta.url), "utf8")
  .replace('from "react"', `from "${reactUrl}"`)
  .replace(/import \{ fetchReminders[^\n]+/, "const { fetchReminders, fetchReminderSync, saveReminder, deleteReminderRemote } = globalThis.pollingApi;");
const { useTelegramWebChat } = await import(url(chatSource));
const { useRemindersSync } = await import(url(syncSource));
let chat;
function Chat({ uid = "a" }) { chat = useTelegramWebChat({ uid }, true); return null; }
function Reminder() { useRemindersSync({ firebaseUser: { uid: "a" } }); return null; }
let view;
await act(async () => { view = Renderer.create(React.createElement(Chat)); });
assert.equal(summaryCalls, 1);
await act(async () => chat.openChat());
assert.equal(messageCalls.length, 1, "opening chat loads only once");
await tick(8000);
assert.equal(messageCalls.at(-1).revision, "v1");
assert.equal(chat.messages[0].id, "first", "304 preserves the existing messages");
document.visibilityState = "hidden";
const before = messageCalls.length;
await tick(60_000);
assert.equal(messageCalls.length, before, "hidden chat performs no polling");
document.visibilityState = "visible";
await act(async () => { await fire("visibilitychange"); await fire("focus"); });
assert.equal(messageCalls.length, before + 1, "visibility and focus do not duplicate the read");
fail = true;
await tick(8000);
const failureCalls = messageCalls.length;
await tick(60_000);
assert.equal(messageCalls.length, failureCalls, "Retry-After is honored");
fail = false;
await tick(300_000);
assert.equal(chat.error, "", "304 recovery clears the error");
hold = true;
now += 8000;
await act(async () => { for (const fn of timers.keys()) void fn(); });
const finishOldAccount = finish;
await act(async () => view.update(React.createElement(Chat, { uid: "b" })));
await act(async () => finishOldAccount({ revision: "old", messages: [{ id: "private-a" }] }));
assert.equal(chat.messages.length, 0, "late response cannot cross accounts");
await act(async () => view.unmount());
assert.equal(timers.size, 0);
assert.ok([...events.values()].every(set => set.size === 0));
await act(async () => { view = Renderer.create(React.createElement(Reminder)); });
assert.equal(syncCalls, 1);
document.visibilityState = "hidden";
await tick(60_000);
assert.equal(syncCalls, 1);
await tick(240_000);
assert.equal(syncCalls, 2, "background reminder sync remains alive every five minutes");
document.visibilityState = "visible";
await act(async () => fire("visibilitychange"));
assert.equal(syncCalls, 3, "returning to the app refreshes immediately");
await act(async () => view.unmount());
Date.now = realNow;
assert.equal(timers.size, 0);
console.log("PASS: revision polling, single-flight, hidden-tab budget, retry backoff, account isolation, and reminder resume");

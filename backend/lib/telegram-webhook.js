function createTelegramWebhookHandlers(deps) {
  const {
    announcementDoc,
    normalizeAnnouncementConfig,
    formatAnnouncementPanel,
    announcementInlineKeyboard,
    isAnnouncementAdmin,
    answerTelegramCallback,
    editTelegramMessage,
    sendTelegram,
    pendingAnnouncementMessageEdits,
    ANNOUNCEMENT_EDIT_TTL_MS,
    MAX_ANNOUNCEMENT_LENGTH,
    PRODUCT_QUESTION_NODES,
    productQuestionResponse,
    productQuestionKeyboard,
    productNodeForText,
    answerTimesQuestion,
    telegramChatOwnerDoc,
    telegramAuthDoc,
    telegramLinkDoc,
    saveChatMessage,
    sendChatReply,
    clearRememberedNewsPanel,
    telegramNewsConfig,
    telegramNewsTopics,
    saveTelegramNewsConfig,
    saveTelegramNewsTopics,
    closePreviousNewsPanel,
    rememberNewsPanel,
    telegramNewsTopicList,
    telegramNewsControllerText,
    telegramNewsControllerKeyboard,
    telegramNewsPriorityText,
    telegramNewsPriorityKeyboard,
    telegramNewsTopicsText,
    telegramNewsTopicsKeyboard,
    telegramNewsRemoveTopicsKeyboard,
    syncPriorityNewsSubscription,
    checkPriorityNewsSubscription,
    pendingTelegramNewsInputs,
    TELEGRAM_NEWS_INPUT_TTL_MS,
    TELEGRAM_NEWS_PERIODS,
    TELEGRAM_NEWS_MAX_REPORT_ITEMS,
    TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC,
    TELEGRAM_NEWS_TOPIC_LIMIT,
    normalizeTelegramNewsTopics,
    getGoogleNewsTopStories,
    searchGoogleNews,
    telegramNewsResultLimit,
    summarizeTelegramNewsTopic,
    formatGoogleNewsBrief,
    googleNewsArticleKeyboard,
    sendTelegramNewsDigest,
    weatherController,
    handleAiCommandCallback,
    COMMAND_HELP_TEXT,
    CUSTOM_COMMAND_KEYBOARD,
    AI_COMMAND_COLLECTION_KEYBOARD,
    runTelegramFreeAiCommand,
    isTelegramFreeAiAllowed,
    answerTelegramFreeAi,
    sendTelegramFreeAiReply,
  } = deps;

  const chatRateWindows = new Map();
  const CHAT_RATE_WINDOW_MS = 60_000;
  const CHAT_RATE_MAX_ACTIONS = 24;

  function isChatRateLimited(chatId) {
    if (!chatId) return false;
    const key = String(chatId);
    const now = Date.now();
    const entry = chatRateWindows.get(key);
    if (!entry || now >= entry.resetAt) {
      if (chatRateWindows.size > 1000) {
        for (const [k, v] of chatRateWindows) {
          if (now >= v.resetAt) chatRateWindows.delete(k);
        }
      }
      chatRateWindows.set(key, { count: 1, resetAt: now + CHAT_RATE_WINDOW_MS });
      return false;
    }
    entry.count += 1;
    return entry.count > CHAT_RATE_MAX_ACTIONS;
  }

async function sendAnnouncementPanel(reply) {
  const data = (await announcementDoc().get()).data() || {};
  const config = normalizeAnnouncementConfig(data);
  await reply(formatAnnouncementPanel(data), { reply_markup: announcementInlineKeyboard(config) });
}

async function handleAnnouncementCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  if (!chatId || !messageId || !callbackQuery.id) return;
  if (!isAnnouncementAdmin(chatId)) {
    await answerTelegramCallback(callbackQuery.id, "คุณไม่มีสิทธิ์เปลี่ยนประกาศ");
    return;
  }

  const action = String(callbackQuery.data || "");
  if (!action.startsWith("announce:")) return;
  if (action === "announce:close") {
    await answerTelegramCallback(callbackQuery.id, "ปิดแผงแล้ว");
    await editTelegramMessage(chatId, messageId, "📣 ปิดแผงตั้งค่า announcement-ticker แล้ว");
    return;
  }
  if (action === "announce:message") {
    pendingAnnouncementMessageEdits.set(String(chatId), Date.now() + ANNOUNCEMENT_EDIT_TTL_MS);
    await answerTelegramCallback(callbackQuery.id, "ส่งข้อความใหม่ภายใน 10 นาที");
    await sendTelegram(chatId, "✏️ ส่งข้อความประกาศใหม่ในข้อความถัดไป\n(หมดเวลาใน 10 นาที)", {
      reply_markup: { force_reply: true, input_field_placeholder: "พิมพ์ข้อความ announcement…" }
    });
    return;
  }

  const data = (await announcementDoc().get()).data() || {};
  const config = normalizeAnnouncementConfig(data);
  const updates = {};
  if (action === "announce:toggle") updates.enabled = !config.enabled;
  if (action === "announce:scramble") updates.scrambleEnabled = !config.scrambleEnabled;
  if (action === "announce:interval:-") updates.repeatIntervalMinutes = Math.max(1, config.repeatIntervalMinutes - 1);
  if (action === "announce:interval:+") updates.repeatIntervalMinutes = Math.min(1_440, config.repeatIntervalMinutes + 1);
  if (action === "announce:hold:-") updates.holdDurationSeconds = Math.max(0.5, Number((config.holdDurationSeconds - 0.5).toFixed(1)));
  if (action === "announce:hold:+") updates.holdDurationSeconds = Math.min(60, Number((config.holdDurationSeconds + 0.5).toFixed(1)));
  if (action === "announce:speed:-") updates.scrollSpeedPxPerSecond = Math.max(20, config.scrollSpeedPxPerSecond - 10);
  if (action === "announce:speed:+") updates.scrollSpeedPxPerSecond = Math.min(240, config.scrollSpeedPxPerSecond + 10);

  const next = normalizeAnnouncementConfig({ ...config, ...updates });
  if (Object.keys(updates).length) {
    await announcementDoc().set({ ...next, updatedAt: new Date().toISOString(), updatedByTelegramChatId: String(chatId) }, { merge: true });
  }
  await answerTelegramCallback(callbackQuery.id, action === "announce:status" ? "ดูสถานะล่าสุด" : "บันทึกแล้ว");
  await editTelegramMessage(chatId, messageId, formatAnnouncementPanel({ ...data, ...next }), { reply_markup: announcementInlineKeyboard(next) });
}

async function handleProductQuestionCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const nodeId = String(callbackQuery.data || "").replace(/^product:/, "");
  if (!chatId || !messageId || !callbackQuery.id || !PRODUCT_QUESTION_NODES[nodeId]) return;

  const { node, text } = productQuestionResponse(nodeId);
  await answerTelegramCallback(callbackQuery.id);
  await editTelegramMessage(chatId, messageId, text, { reply_markup: productQuestionKeyboard(node) });

  // The answer is edited in Telegram rather than sent as a stack of new
  // messages. Route the final visible text through the same persistence
  // function as every other bot reply: this keeps ordering, unread state and
  // the web-chat mirror consistent instead of creating a partial message.
  const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId;
  if (chatOwner) await saveChatMessage(chatOwner, { direction: "outgoing", text, telegramMessageId: messageId });
}

async function handleNewsCommandCallback(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const action = String(callbackQuery.data || "").replace(/^news:/, "");
  if (!chatId || !messageId || !callbackQuery.id) return;
  const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId || null;
  const reply = chatOwner
    ? (text, options) => sendChatReply(chatOwner, chatId, text, options)
    : (text, options) => sendTelegram(chatId, text, options);
  if (!chatOwner) {
    await answerTelegramCallback(callbackQuery.id);
    await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
    return;
  }
  if (action === "close") {
    await answerTelegramCallback(callbackQuery.id, "ปิดแผงแล้ว");
    await editTelegramMessage(chatId, messageId, "📰 ปิด News Controller แล้ว");
    await clearRememberedNewsPanel(chatOwner, messageId);
    return;
  }
  const config = await telegramNewsConfig(chatOwner);
  if (action === "panel") {
    await answerTelegramCallback(callbackQuery.id, "อัปเดตแล้ว");
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(config), { reply_markup: telegramNewsControllerKeyboard(config) });
    return;
  }
  if (action === "noop") {
    await answerTelegramCallback(callbackQuery.id);
    return;
  }
  const priorityPageMatch = action.match(/^priority:(\d+)$/);
  if (action === "priority" || priorityPageMatch) {
    const page = priorityPageMatch ? Number(priorityPageMatch[1]) : 0;
    await answerTelegramCallback(callbackQuery.id);
    await editTelegramMessage(chatId, messageId, telegramNewsPriorityText(config, page), { reply_markup: telegramNewsPriorityKeyboard(config, page) });
    return;
  }
  const prioritySetMatch = action.match(/^priority_set:(\d+)$/);
  if (prioritySetMatch) {
    const topic = config.topics[Number(prioritySetMatch[1])];
    if (!topic) {
      await answerTelegramCallback(callbackQuery.id, "ไม่พบหัวข้อนี้");
      return;
    }
    const next = await saveTelegramNewsConfig(chatOwner, { priorityTopic: topic });
    const subscription = await syncPriorityNewsSubscription(chatOwner, next.priorityTopic);
    await answerTelegramCallback(callbackQuery.id, `ติดตาม ${topic} แล้ว`);
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(next), { reply_markup: telegramNewsControllerKeyboard(next) });
    if (subscription) checkPriorityNewsSubscription(subscription).catch(error => console.error("[telegram] initial priority news check failed:", error.message));
    return;
  }
  if (action === "priority_off") {
    const next = await saveTelegramNewsConfig(chatOwner, { priorityTopic: null });
    await syncPriorityNewsSubscription(chatOwner, null);
    await answerTelegramCallback(callbackQuery.id, "ปิดหัวข้อเร่งด่วนแล้ว");
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(next), { reply_markup: telegramNewsControllerKeyboard(next) });
    return;
  }
  const topicsMatch = action.match(/^topics:(\d+)$/);
  if (topicsMatch) {
    const page = Number(topicsMatch[1]);
    await answerTelegramCallback(callbackQuery.id);
    await editTelegramMessage(chatId, messageId, telegramNewsTopicsText(config, page), { reply_markup: telegramNewsTopicsKeyboard(config, page) });
    return;
  }
  if (action === "add" || action === "search") {
    pendingTelegramNewsInputs.set(String(chatId), { action, expiresAt: Date.now() + TELEGRAM_NEWS_INPUT_TTL_MS });
    await answerTelegramCallback(callbackQuery.id, action === "add" ? "รอรับหัวข้อใหม่" : "รอรับคำค้นหา");
    await reply(action === "add"
      ? "＋ ส่งหัวข้อที่ต้องการติดตามในข้อความถัดไป\nเพิ่มหลายหัวข้อได้โดยคั่นด้วยเครื่องหมายจุลภาค"
      : "🔎 ส่งหัวข้อหรือคำค้นหาข่าวในข้อความถัดไป", {
      reply_markup: { force_reply: true, input_field_placeholder: action === "add" ? "AI, เทคโนโลยี, เศรษฐกิจไทย" : "ค้นหาข่าวเรื่อง…" }
    });
    return;
  }
  const removePageMatch = action.match(/^remove:(\d+)$/);
  if (action === "remove" || removePageMatch) {
    const page = removePageMatch ? Number(removePageMatch[1]) : 0;
    await answerTelegramCallback(callbackQuery.id);
    await editTelegramMessage(chatId, messageId, config.topics.length ? "เลือกหัวข้อที่ต้องการลบ" : "ยังไม่มีหัวข้อให้ลบ", {
      reply_markup: telegramNewsRemoveTopicsKeyboard(config, page)
    });
    return;
  }
  const removeMatch = action.match(/^remove_item:(\d+)$/);
  if (removeMatch) {
    const index = Number(removeMatch[1]);
    const removed = config.topics[index];
    if (!removed) {
      await answerTelegramCallback(callbackQuery.id, "ไม่พบหัวข้อนี้");
      return;
    }
    const next = await saveTelegramNewsConfig(chatOwner, { topics: config.topics.filter((_, topicIndex) => topicIndex !== index) });
    await syncPriorityNewsSubscription(chatOwner, next.priorityTopic);
    await answerTelegramCallback(callbackQuery.id, `ลบ ${removed} แล้ว`);
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(next), { reply_markup: telegramNewsControllerKeyboard(next) });
    return;
  }
  const periodMatch = action.match(/^period:(1h|6h|1d|7d)$/);
  if (periodMatch) {
    const next = await saveTelegramNewsConfig(chatOwner, { period: periodMatch[1] });
    await answerTelegramCallback(callbackQuery.id, `เลือกข่าวย้อนหลัง ${TELEGRAM_NEWS_PERIODS[next.period]}`);
    await editTelegramMessage(chatId, messageId, telegramNewsControllerText(next), { reply_markup: telegramNewsControllerKeyboard(next) });
    return;
  }
  if (action === "top") {
    await answerTelegramCallback(callbackQuery.id, "กำลังโหลดข่าวเด่น");
    try {
      const items = await getGoogleNewsTopStories({ limit: TELEGRAM_NEWS_MAX_REPORT_ITEMS });
      const brief = await summarizeTelegramNewsTopic(chatOwner, "ข่าวเด่น Google News", items);
      const result = formatGoogleNewsBrief("ข่าวเด่น Google News", items, "top", brief);
      await editTelegramMessage(chatId, messageId, result.text, {
        reply_markup: googleNewsArticleKeyboard(result.items, [[
          { text: "← กลับ News Controller", callback_data: "news:panel" },
          { text: "↻ โหลดใหม่", callback_data: "news:top" }
        ]])
      });
    } catch (error) {
      console.error("[telegram] Google News top stories failed:", error.message);
      await editTelegramMessage(chatId, messageId, "ตอนนี้ดึงข่าวเด่นจาก Google News ไม่สำเร็จ", {
        reply_markup: { inline_keyboard: [[{ text: "← กลับ News Controller", callback_data: "news:panel" }, { text: "ลองใหม่", callback_data: "news:top" }]] }
      });
    }
    return;
  }
  const topicMatch = action.match(/^topic:(\d+)$/);
  if (topicMatch) {
    const topic = config.topics[Number(topicMatch[1])];
    if (!topic) {
      await answerTelegramCallback(callbackQuery.id, "ไม่พบหัวข้อนี้");
      return;
    }
    await answerTelegramCallback(callbackQuery.id, `กำลังโหลด ${topic}`);
    try {
      const items = await searchGoogleNews(topic, {
        limit: telegramNewsResultLimit(config.period),
        period: config.period
      });
      const brief = await summarizeTelegramNewsTopic(chatOwner, topic, items);
      const result = formatGoogleNewsBrief(topic, items, config.period, brief);
      await editTelegramMessage(chatId, messageId, result.text, {
        reply_markup: googleNewsArticleKeyboard(result.items, [[
          { text: "← กลับ News Controller", callback_data: "news:panel" },
          { text: "↻ โหลดใหม่", callback_data: `news:topic:${topicMatch[1]}` }
        ]])
      });
    } catch (error) {
      console.error(`[telegram] Google News topic "${topic}" failed:`, error.message);
      await editTelegramMessage(chatId, messageId, `ตอนนี้ดึงข่าวหัวข้อ “${topic}” ไม่สำเร็จ`, {
        reply_markup: { inline_keyboard: [[{ text: "← กลับ News Controller", callback_data: "news:panel" }, { text: "ลองใหม่", callback_data: `news:topic:${topicMatch[1]}` }]] }
      });
    }
    return;
  }
  if (action === "now") {
    await answerTelegramCallback(callbackQuery.id, "กำลังโหลดข่าวล่าสุด");
    if (!config.topics.length) {
      await reply("ยังไม่มีหัวข้อข่าว กด ＋ เพิ่มหัวข้อ ใน News Controller ก่อนครับ");
      return;
    }
    await sendTelegramNewsDigest(chatOwner, config.topics, reply, config.period, { maxItemsPerTopic: TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC });
  }
}

async function telegramWebhook(req, res, next) {
  if (req.get("X-Telegram-Bot-Api-Secret-Token") !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(401);
  try {
    const callbackQuery = req.body?.callback_query;
    const incomingChatId = callbackQuery?.message?.chat?.id || req.body?.message?.chat?.id;
    if (isChatRateLimited(incomingChatId)) {
      if (callbackQuery?.id) {
        await answerTelegramCallback(callbackQuery.id, "ส่งคำสั่งถี่เกินไป กรุณารอสักครู่ครับ").catch(() => {});
      }
      return res.sendStatus(200);
    }
    if (callbackQuery?.data?.startsWith("weather:")) {
      const chatId = callbackQuery.message?.chat?.id;
      await answerTelegramCallback(callbackQuery.id);
      if (!chatId) return res.sendStatus(200);
      const userId = (await telegramChatOwnerDoc(chatId).get()).data()?.userId || null;
      pendingTelegramNewsInputs.delete(String(chatId));
      pendingAnnouncementMessageEdits.delete(String(chatId));
      await weatherController.handle({
        chatId, userId, privateChat: callbackQuery.message.chat.type === "private",
        action: callbackQuery.data.slice("weather:".length),
        reply: (text, options) => userId ? sendChatReply(userId, chatId, text, options) : sendTelegram(chatId, text, options)
      });
      return res.sendStatus(200);
    }
    if (callbackQuery?.data?.startsWith("announce:")) {
      await handleAnnouncementCallback(callbackQuery);
      return res.sendStatus(200);
    }
    if (callbackQuery?.data?.startsWith("product:")) {
      await handleProductQuestionCallback(callbackQuery);
      return res.sendStatus(200);
    }
    if (callbackQuery?.data?.startsWith("ai:")) {
      await handleAiCommandCallback(callbackQuery);
      return res.sendStatus(200);
    }
    if (callbackQuery?.data?.startsWith("news:")) {
      await handleNewsCommandCallback(callbackQuery);
      return res.sendStatus(200);
    }
    const message = req.body?.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();
    if (!chatId) return res.sendStatus(200);
    const chatOwner = (await telegramChatOwnerDoc(chatId).get()).data()?.userId || null;
    if (chatOwner && text) await saveChatMessage(chatOwner, { direction: "incoming", text, telegramMessageId: message.message_id, readAt: Date.now() });
    const reply = (replyText, options) => chatOwner
      ? sendChatReply(chatOwner, chatId, replyText, options)
      : sendTelegram(chatId, replyText, options);

    if (/^\/weather(?:_ask|_cancel)?(?:@\w+)?(?:\s|$)/i.test(text)) {
      pendingTelegramNewsInputs.delete(String(chatId));
      pendingAnnouncementMessageEdits.delete(String(chatId));
    }
    if (await weatherController.handle({
      chatId, userId: chatOwner, privateChat: message.chat.type === "private",
      text, location: message.location, replyTo: message.reply_to_message?.message_id, reply
    })) {
      return res.sendStatus(200);
    }

    const pendingNewsInput = pendingTelegramNewsInputs.get(String(chatId));
    if (pendingNewsInput?.expiresAt < Date.now()) pendingTelegramNewsInputs.delete(String(chatId));
    if (pendingTelegramNewsInputs.has(String(chatId)) && text && !text.startsWith("/")) {
      pendingTelegramNewsInputs.delete(String(chatId));
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะใช้ News Controller ได้ครับ");
        return res.sendStatus(200);
      }
      if (pendingNewsInput.action === "search") {
        const topic = normalizeTelegramNewsTopics([text])[0];
        const config = await telegramNewsConfig(chatOwner);
        await sendTelegramNewsDigest(chatOwner, topic ? [topic] : [], reply, config.period, { includeSummary: true });
        return res.sendStatus(200);
      }
      if (pendingNewsInput.action === "add") {
        const additions = normalizeTelegramNewsTopics(text.split(","));
        const current = await telegramNewsTopics(chatOwner);
        const next = await saveTelegramNewsConfig(chatOwner, { topics: [...current, ...additions] });
        const added = next.topics.filter((topic) => !current.some((old) => old.toLocaleLowerCase("th") === topic.toLocaleLowerCase("th")));
        await reply(added.length
          ? `✅ เพิ่มหัวข้อ: ${added.join(", ")}\nเปิด /news เพื่อเลือกอ่านข่าวได้เลย`
          : `ไม่ได้เพิ่มหัวข้อใหม่ อาจมีหัวข้อนี้อยู่แล้วหรือครบ ${TELEGRAM_NEWS_TOPIC_LIMIT} หัวข้อแล้ว`);
        return res.sendStatus(200);
      }
    }

    if (/^\/cmd(?:@\w+)?$/i.test(text)) {
      await reply(COMMAND_HELP_TEXT, { reply_markup: CUSTOM_COMMAND_KEYBOARD });
      return res.sendStatus(200);
    }

    if (/^\/(?:myid|chatid)(?:@\w+)?$/i.test(text)) {
      await reply(`รหัส Telegram chat ของคุณ: ${chatId}\nตั้งค่า TELEGRAM_ANNOUNCEMENT_ADMIN_CHAT_IDS=${chatId} ใน Render เพื่อใช้คำสั่งประกาศ`);
      return res.sendStatus(200);
    }


    if (/^\/news(?:@\w+)?$/i.test(text)) {
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะใช้ News Controller ได้ครับ");
        return res.sendStatus(200);
      }
      const config = await telegramNewsConfig(chatOwner);
      await closePreviousNewsPanel(chatOwner, chatId);
      const panel = await reply(telegramNewsControllerText(config), { reply_markup: telegramNewsControllerKeyboard(config) });
      await rememberNewsPanel(chatOwner, panel?.message_id);
      return res.sendStatus(200);
    }

    const newsAddMatch = text.match(/^\/news_add(?:@\w+)?(?:\s+([\s\S]+))?$/i);
    if (newsAddMatch) {
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
        return res.sendStatus(200);
      }
      const additions = normalizeTelegramNewsTopics(String(newsAddMatch[1] || "").split(","));
      if (!additions.length) {
        await reply("ใส่หัวข้อหลังคำสั่ง เช่น /news_add AI, เทคโนโลยี");
        return res.sendStatus(200);
      }
      const current = await telegramNewsTopics(chatOwner);
      const topics = await saveTelegramNewsTopics(chatOwner, [...current, ...additions]);
      const added = topics.filter((topic) => !current.some((old) => old.toLocaleLowerCase("th") === topic.toLocaleLowerCase("th")));
      await reply(added.length
        ? `✅ เพิ่มหัวข้อ: ${added.join(", ")}\n\n${telegramNewsTopicList(topics)}`
        : `หัวข้อนี้มีอยู่แล้ว หรือครบ ${TELEGRAM_NEWS_TOPIC_LIMIT} หัวข้อแล้ว\n\n${telegramNewsTopicList(topics)}`);
      return res.sendStatus(200);
    }

    const newsPriorityMatch = text.match(/^\/news_priority(?:@\w+)?(?:\s+([\s\S]+))?$/i);
    if (newsPriorityMatch) {
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะตั้งหัวข้อเร่งด่วนได้ครับ");
        return res.sendStatus(200);
      }
      const config = await telegramNewsConfig(chatOwner);
      const requested = String(newsPriorityMatch[1] || "").trim();
      if (!requested) {
        await reply(telegramNewsPriorityText(config, 0), { reply_markup: telegramNewsPriorityKeyboard(config, 0) });
        return res.sendStatus(200);
      }
      if (/^(off|clear|ปิด)$/i.test(requested)) {
        await saveTelegramNewsConfig(chatOwner, { priorityTopic: null });
        await syncPriorityNewsSubscription(chatOwner, null);
        await reply("ปิดหัวข้อข่าวเร่งด่วนแล้ว");
        return res.sendStatus(200);
      }
      const requestedTopic = normalizeTelegramNewsTopics([requested])[0];
      const topic = requestedTopic && config.topics.find(item => item.toLocaleLowerCase("th") === requestedTopic.toLocaleLowerCase("th"));
      if (!topic) {
        await reply("หัวข้อเร่งด่วนต้องเป็นหัวข้อที่ติดตามอยู่ก่อน เพิ่มด้วย /news_add แล้วเลือกใหม่ครับ");
        return res.sendStatus(200);
      }
      const next = await saveTelegramNewsConfig(chatOwner, { priorityTopic: topic });
      const subscription = await syncPriorityNewsSubscription(chatOwner, next.priorityTopic);
      await reply(`⚡ ตั้ง “${topic}” เป็นหัวข้อข่าวเร่งด่วนแล้ว\nระบบจะตรวจ Google News ทุก 5 นาที และส่งเมื่อพบข่าวใหม่`);
      if (subscription) checkPriorityNewsSubscription(subscription).catch(error => console.error("[telegram] initial priority news check failed:", error.message));
      return res.sendStatus(200);
    }

    if (/^\/news_list(?:@\w+)?$/i.test(text)) {
      const topics = await telegramNewsTopics(chatOwner);
      await reply(chatOwner ? telegramNewsTopicList(topics) : "เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
      return res.sendStatus(200);
    }

    const newsRemoveMatch = text.match(/^\/news_remove(?:@\w+)?(?:\s+([\s\S]+))?$/i);
    if (newsRemoveMatch) {
      if (!chatOwner) {
        await reply("เชื่อมบัญชี T.i.M.E.S. กับ Telegram ก่อน จึงจะบันทึกหัวข้อข่าวได้ครับ");
        return res.sendStatus(200);
      }
      const target = String(newsRemoveMatch[1] || "").trim();
      const current = await telegramNewsTopics(chatOwner);
      const position = /^\d+$/.test(target) ? Number(target) - 1 : -1;
      const removed = position >= 0 && position < current.length
        ? current[position]
        : current.find((topic) => topic.toLocaleLowerCase("th") === target.toLocaleLowerCase("th"));
      if (!removed) {
        await reply("ไม่พบหัวข้อที่ต้องการลบ ดูชื่อและหมายเลขได้ด้วย /news_list");
        return res.sendStatus(200);
      }
      const next = await saveTelegramNewsConfig(chatOwner, { topics: current.filter((topic) => topic !== removed) });
      await syncPriorityNewsSubscription(chatOwner, next.priorityTopic);
      await reply(`ลบหัวข้อ “${removed}” แล้ว\n\n${telegramNewsTopicList(next.topics)}`);
      return res.sendStatus(200);
    }

    const newsNowMatch = text.match(/^\/news_now(?:@\w+)?(?:\s+([\s\S]+))?$/i);
    if (newsNowMatch) {
      const requestedTopic = String(newsNowMatch[1] || "").trim();
      const config = await telegramNewsConfig(chatOwner);
      const topics = requestedTopic ? normalizeTelegramNewsTopics([requestedTopic]) : config.topics;
      if (!topics.length) {
        await reply(chatOwner ? telegramNewsTopicList(topics) : "ระบุหัวข้อได้โดยตรง เช่น /news_now AI");
        return res.sendStatus(200);
      }
      await sendTelegramNewsDigest(chatOwner, topics, reply, config.period, requestedTopic ? {} : { maxItemsPerTopic: TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC });
      return res.sendStatus(200);
    }

    const announcementMatch = text.match(/^\/announce(?:@\w+)?(?:\s+([\s\S]*))?$/i);
    if (announcementMatch) {
      if (!isAnnouncementAdmin(chatId)) {
        await reply("⛔ คุณไม่มีสิทธิ์เปลี่ยนประกาศ");
        return res.sendStatus(200);
      }

      if (announcementMatch[1]?.trim()) {
        await reply("ใช้ /announce เพียงคำสั่งเดียว แล้วกด ✏️ เปลี่ยนข้อความ ในแผงตั้งค่า");
        return res.sendStatus(200);
      }
      await sendAnnouncementPanel(reply);
      return res.sendStatus(200);
    }

    const pendingEditExpiresAt = pendingAnnouncementMessageEdits.get(String(chatId));
    if (pendingEditExpiresAt && pendingEditExpiresAt < Date.now()) pendingAnnouncementMessageEdits.delete(String(chatId));
    if (pendingAnnouncementMessageEdits.has(String(chatId)) && text && !text.startsWith("/")) {
      if (!isAnnouncementAdmin(chatId)) {
        pendingAnnouncementMessageEdits.delete(String(chatId));
        await reply("⛔ คุณไม่มีสิทธิ์เปลี่ยนประกาศ");
        return res.sendStatus(200);
      }
      if (text.length > MAX_ANNOUNCEMENT_LENGTH) {
        await reply(`ข้อความยาวเกินไป — จำกัด ${MAX_ANNOUNCEMENT_LENGTH} ตัวอักษร`);
        return res.sendStatus(200);
      }
      pendingAnnouncementMessageEdits.delete(String(chatId));
      await announcementDoc().set({ message: text, enabled: true, updatedAt: new Date().toISOString(), updatedByTelegramChatId: String(chatId) }, { merge: true });
      await reply("✅ อัปเดตข้อความประกาศแล้ว");
      await sendAnnouncementPanel(reply);
      return res.sendStatus(200);
    }

    if (/^\/ai_commands(?:@\w+)?$/i.test(text)) {
      await reply("🤖 ชุดคำสั่ง AI\n\nเลือกสิ่งที่ต้องการทำได้จากปุ่มด้านล่าง", { reply_markup: AI_COMMAND_COLLECTION_KEYBOARD });
      return res.sendStatus(200);
    }

    const freeAiCommand = text.match(/^\/ai(?:@\w+)?(?:\s+(on|off|clear|reset|status))?$/i)
      || text.match(/^\/ai_(on|off|clear|reset|status)(?:@\w+)?$/i);
    if (freeAiCommand) {
      const action = (freeAiCommand[1] || "status").toLowerCase();
      await runTelegramFreeAiCommand(chatId, chatOwner, action, reply);
      return res.sendStatus(200);
    }

    // When the owner enables free AI mode, ordinary text goes to Gemini before
    // the deterministic T.i.M.E.S. keyword responder. Commands still keep
    // their normal meaning and never become model input by accident.
    if (chatOwner && text && !text.startsWith("/") && isTelegramFreeAiAllowed(chatId, chatOwner)) {
      const freeAi = (await telegramAuthDoc(chatOwner).get()).data()?.telegramFreeAi;
      if (freeAi?.enabled) {
        try {
          const result = await answerTelegramFreeAi(chatOwner, text);
          await sendTelegramFreeAiReply(chatOwner, chatId, result.text);
        } catch (error) {
          console.error("[telegram] free AI reply failed:", error.message);
          await reply("ตอนนี้ AI ตอบไม่ได้ กรุณาลองใหม่อีกครั้งครับ");
        }
        return res.sendStatus(200);
      }
    }

    // Telegram can answer only documented product questions here. This is a
    // deterministic knowledge lookup, so it never calls Gemini or consumes
    // the Activity Mode AI quota.
    const commandName = text.match(/^\/(general_questions|times|features)(?:@\w+)?$/i)?.[1]?.toLowerCase();
    const requestedNode = commandName === "general_questions"
      ? "general-questions"
      : commandName || productNodeForText(text);
    if (commandName === "general_questions") {
      const { node, text: menuText } = productQuestionResponse(requestedNode);
      await reply(menuText, { reply_markup: productQuestionKeyboard(node) });
      return res.sendStatus(200);
    }
    const productQuestion = commandName ? PRODUCT_QUESTION_NODES[requestedNode].question : text;
    const productAnswer = answerTimesQuestion(productQuestion);
    if (productAnswer) {
      const node = PRODUCT_QUESTION_NODES[requestedNode];
      await reply(productAnswer, { reply_markup: productQuestionKeyboard(node) });
      return res.sendStatus(200);
    }

    const match = text.match(/^\/start\s+([A-Za-z0-9_-]{1,64})$/);
    if (!match) {
      if (/^\/start(?:@\w+)?$/i.test(text)) {
        await reply("ยินดีต้อนรับสู่ MR.Zettascale ✨\nกด /cmd เพื่อดูคำสั่งทั้งหมด\n\nหากต้องการเชื่อมบัญชี T.i.M.E.S. ให้กดปุ่ม Telegram ใน Reminder Mode", { reply_markup: CUSTOM_COMMAND_KEYBOARD });
      }
      return res.sendStatus(200);
    }
    const ref = telegramLinkDoc(match[1]);
    const link = (await ref.get()).data();
    if (!link || link.expiresAt < Date.now()) return res.sendStatus(200);
    await telegramChatOwnerDoc(chatId).set({ userId: link.userId, updatedAt: Date.now() }, { merge: true });
    await telegramAuthDoc(link.userId).set({ chatId: String(chatId), chatOwnerIndexedFor: String(chatId), connectedAt: new Date().toISOString() }, { merge: true });
    await ref.delete();
    if (text) await saveChatMessage(link.userId, { direction: "incoming", text, telegramMessageId: message.message_id, readAt: Date.now() });
    await sendChatReply(link.userId, chatId, "✅ เชื่อม MR.Zettascale กับ T.i.M.E.S. สำเร็จแล้ว", { reply_markup: CUSTOM_COMMAND_KEYBOARD });
    res.sendStatus(200);
  } catch (error) {
    // Let the shared error handler classify Firestore RESOURCE_EXHAUSTED,
    // open the quota circuit breaker, and suppress repeated Render logs from
    // Telegram retries. Non-quota failures are still logged centrally.
    next(error);
  }
};

  return {
    sendAnnouncementPanel,
    handleAnnouncementCallback,
    handleProductQuestionCallback,
    handleNewsCommandCallback,
    telegramWebhook,
  };
}

module.exports = { createTelegramWebhookHandlers };

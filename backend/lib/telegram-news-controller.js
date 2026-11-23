const TELEGRAM_MESSAGE_CHUNK_LIMIT = 3_900;
const TELEGRAM_NEWS_TOPIC_LIMIT = 20;
const TELEGRAM_NEWS_TOPIC_LENGTH_LIMIT = 80;
const TELEGRAM_NEWS_TOPIC_PAGE_SIZE = 4;
const TELEGRAM_NEWS_AI_BRIEF_LIMIT = 2_400;
const TELEGRAM_NEWS_INPUT_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_NEWS_MAX_REPORT_ITEMS = 10;
const TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC = 3;
const TELEGRAM_NEWS_PERIODS = Object.freeze({ "1h": "1 ชั่วโมง", "6h": "6 ชั่วโมง", "1d": "24 ชั่วโมง", "7d": "7 วัน" });
const TELEGRAM_NEWS_RESULTS_BY_PERIOD = Object.freeze({ "1h": 3, "6h": 5, "1d": 8, "7d": 10 });

function normalizeTelegramNewsTopics(topics) {
  const unique = new Map();
  for (const topic of Array.isArray(topics) ? topics : []) {
    const value = String(topic || "").trim().replace(/\s+/g, " ").slice(0, TELEGRAM_NEWS_TOPIC_LENGTH_LIMIT);
    if (value && !unique.has(value.toLocaleLowerCase("th"))) unique.set(value.toLocaleLowerCase("th"), value);
  }
  return [...unique.values()].slice(0, TELEGRAM_NEWS_TOPIC_LIMIT);
}

function telegramNewsTopicList(topics) {
  if (!topics.length) {
    return "ยังไม่มีหัวข้อข่าวที่ติดตาม\nเพิ่มได้ด้วย /news_add ตามด้วยหัวข้อ เช่น /news_add AI";
  }
  return "📋 หัวข้อข่าวที่ติดตาม\n\n" + topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n") +
    "\n\nเพิ่ม: /news_add หัวข้อ\nลบ: /news_remove ลำดับหรือชื่อหัวข้อ";
}

function telegramNewsControllerText(config) {
  return "📰 News Controller\n\n" +
    `ช่วงข่าว: ${TELEGRAM_NEWS_PERIODS[config.period]}\n` +
    `หัวข้อที่ติดตาม: ${config.topics.length}/${TELEGRAM_NEWS_TOPIC_LIMIT}\n` +
    `⚡ หัวข้อเร่งด่วน: ${config.priorityTopic || "ยังไม่ตั้ง"}\n\n` +
    "🤖 ปุ่มที่มีสัญลักษณ์นี้จะใช้ AI ย่อข่าว\n\n" +
    "เลือกการทำงานจากปุ่มด้านล่าง";
}

function telegramNewsControllerKeyboard(config) {
  return {
    inline_keyboard: [
      [{ text: "🤖 📰 อ่านทุกหัวข้อ", callback_data: "news:now" }, { text: "🤖 🌐 ข่าวเด่น Google News", callback_data: "news:top" }],
      [{ text: "🤖 🔎 ค้นหาข่าว", callback_data: "news:search" }],
      [{ text: `🗂 จัดการหัวข้อ (${config.topics.length})`, callback_data: "news:topics:0" }],
      [{ text: config.priorityTopic ? `⚡ 🤖 เร่งด่วน: ${config.priorityTopic}` : "⚡ 🤖 ตั้งหัวข้อเร่งด่วน", callback_data: "news:priority" }],
      [
        { text: config.period === "1h" ? "✓ 1 ชม." : "1 ชม.", callback_data: "news:period:1h" },
        { text: config.period === "6h" ? "✓ 6 ชม." : "6 ชม.", callback_data: "news:period:6h" },
        { text: config.period === "1d" ? "✓ 24 ชม." : "24 ชม.", callback_data: "news:period:1d" },
        { text: config.period === "7d" ? "✓ 7 วัน" : "7 วัน", callback_data: "news:period:7d" }
      ],
      [{ text: "↻ รีเฟรชแผง", callback_data: "news:panel" }, { text: "✕ ปิดแผง", callback_data: "news:close" }]
    ]
  };
}

function newsTopicPage(config, page = 0) {
  const pageCount = Math.max(1, Math.ceil(config.topics.length / TELEGRAM_NEWS_TOPIC_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(page, pageCount - 1));
  const start = currentPage * TELEGRAM_NEWS_TOPIC_PAGE_SIZE;
  return { currentPage, pageCount, start, topics: config.topics.slice(start, start + TELEGRAM_NEWS_TOPIC_PAGE_SIZE) };
}

function newsTopicPagination(prefix, currentPage, pageCount) {
  if (pageCount < 2) return [];
  const buttons = [];
  if (currentPage > 0) buttons.push({ text: "← ก่อนหน้า", callback_data: `news:${prefix}:${currentPage - 1}` });
  buttons.push({ text: `${currentPage + 1}/${pageCount}`, callback_data: "news:noop" });
  if (currentPage + 1 < pageCount) buttons.push({ text: "ถัดไป →", callback_data: `news:${prefix}:${currentPage + 1}` });
  return [buttons];
}

function telegramNewsTopicsText(config, page) {
  const view = newsTopicPage(config, page);
  const list = view.topics.length
    ? view.topics.map((topic, index) => `${view.start + index + 1}. ${topic}`).join("\n")
    : "ยังไม่มีหัวข้อข่าว";
  return `🗂 หัวข้อที่ติดตาม (${config.topics.length}/${TELEGRAM_NEWS_TOPIC_LIMIT})\n\n${list}\n\nกดหัวข้อ 🤖 เพื่ออ่านรายงานข่าวล่าสุด`;
}

function telegramNewsTopicsKeyboard(config, page) {
  const view = newsTopicPage(config, page);
  const topicRows = view.topics.map((topic, index) => [{ text: `🤖 🗞 ${topic}`, callback_data: `news:topic:${view.start + index}` }]);
  return {
    inline_keyboard: [
      ...topicRows,
      ...newsTopicPagination("topics", view.currentPage, view.pageCount),
      [{ text: "＋ เพิ่มหัวข้อ", callback_data: "news:add" }, { text: "− ลบหัวข้อ", callback_data: `news:remove:0` }],
      [{ text: "← กลับ News Controller", callback_data: "news:panel" }]
    ]
  };
}

function telegramNewsPriorityText(config, page) {
  const view = newsTopicPage(config, page);
  if (!config.topics.length) return "⚡ หัวข้อเร่งด่วน\n\nเพิ่มหัวข้อข่าวก่อน แล้วจึงเลือกหนึ่งหัวข้อเพื่อรับแจ้งข่าวใหม่";
  return `⚡ หัวข้อเร่งด่วน\n\nเลือกได้หนึ่งหัวข้อ ระบบจะตรวจ Google News ทุก 5 นาที และแจ้งเฉพาะข่าวใหม่ที่พบ\n\nกำลังติดตาม: ${config.priorityTopic || "ยังไม่ตั้ง"}`;
}

function telegramNewsPriorityKeyboard(config, page) {
  const view = newsTopicPage(config, page);
  return {
    inline_keyboard: [
      ...view.topics.map((topic, index) => [{ text: `${config.priorityTopic === topic ? "✓ " : ""}⚡ ${topic}`, callback_data: `news:priority_set:${view.start + index}` }]),
      ...newsTopicPagination("priority", view.currentPage, view.pageCount),
      ...(config.priorityTopic ? [[{ text: "ปิดหัวข้อเร่งด่วน", callback_data: "news:priority_off" }]] : []),
      [{ text: "← กลับ News Controller", callback_data: "news:panel" }]
    ]
  };
}

function telegramNewsRemoveTopicsKeyboard(config, page) {
  const view = newsTopicPage(config, page);
  const rows = view.topics.map((topic, index) => [{ text: `− ${topic}`, callback_data: `news:remove_item:${view.start + index}` }]);
  return {
    inline_keyboard: [
      ...rows,
      ...newsTopicPagination("remove", view.currentPage, view.pageCount),
      [{ text: "← กลับหัวข้อ", callback_data: `news:topics:${view.currentPage}` }]
    ]
  };
}

function thaiRelativeNewsTime(publishedAt) {
  if (!publishedAt) return "เวลาไม่ระบุ";
  const minutes = Math.max(0, Math.floor((Date.now() - publishedAt) / 60_000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

function googleNewsArticleKeyboard(items, trailingRows = []) {
  const articleRows = [];
  for (let index = 0; index < items.length; index += 2) {
    articleRows.push(items.slice(index, index + 2).map((item, offset) => ({
      text: `↗ อ่านข่าว ${index + offset + 1}`,
      url: item.url
    })));
  }
  return { inline_keyboard: [...articleRows, ...trailingRows] };
}

function formatGoogleNewsResults(topic, items, period = "1d") {
  if (period === "top") {
    if (!items.length) return { text: "🌐 ข่าวเด่น Google News\n\nยังไม่มีข่าวเด่นในขณะนี้", items: [] };
    let text = `🌐 ข่าวเด่น Google News\n${items.length} รายการล่าสุด\n`;
    const visibleItems = [];
    for (const item of items) {
      const index = visibleItems.length + 1;
      const metadata = [item.source, thaiRelativeNewsTime(item.publishedAt)].filter(Boolean).join(" · ");
      const entry = `\n${index}. ${item.title}\n   ${metadata}`;
      if ((text + entry).length > TELEGRAM_MESSAGE_CHUNK_LIMIT) break;
      text += entry;
      visibleItems.push(item);
    }
    return { text, items: visibleItems };
  }
  const periodLabel = TELEGRAM_NEWS_PERIODS[period] || TELEGRAM_NEWS_PERIODS["1d"];
  if (!items.length) {
    return {
      text: `📰 ${topic}\n\nไม่มีข่าวใหม่ในช่วง ${periodLabel} ที่ผ่านมา`,
      items: []
    };
  }
  let text = `📰 ${topic}\nข่าวย้อนหลัง ${periodLabel} · ${items.length} รายการ\n`;
  const visibleItems = [];
  for (const item of items) {
    const index = visibleItems.length + 1;
    const metadata = [item.source, thaiRelativeNewsTime(item.publishedAt)].filter(Boolean).join(" · ");
    const entry = `\n${index}. ${item.title}\n   ${metadata}`;
    if ((text + entry).length > TELEGRAM_MESSAGE_CHUNK_LIMIT) break;
    text += entry;
    visibleItems.push(item);
  }
  return { text, items: visibleItems };
}

function telegramNewsResultLimit(period) {
  return Math.min(TELEGRAM_NEWS_MAX_REPORT_ITEMS, TELEGRAM_NEWS_RESULTS_BY_PERIOD[period] || TELEGRAM_NEWS_RESULTS_BY_PERIOD["1d"]);
}

function spaceTelegramNewsBrief(brief) {
  const lines = String(brief || "").trim().split("\n").filter((line) => line.trim() !== "·");
  const spaced = [];
  let hasNewsItem = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const startsNewsItem = /^\d+[.)]\s+/.test(trimmed);
    const startsKeyDates = /^📅\s*กำหนดการสำคัญ/.test(trimmed);
    const startsSummary = /^สรุป\s*:/.test(trimmed);
    if ((startsNewsItem && hasNewsItem) || (startsKeyDates && hasNewsItem) || (startsSummary && hasNewsItem)) {
      if (spaced[spaced.length - 1] !== "·") spaced.push("", "·", "");
    }
    spaced.push(line);
    if (startsNewsItem) hasNewsItem = true;
  }
  return spaced.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

module.exports = {
  TELEGRAM_MESSAGE_CHUNK_LIMIT,
  TELEGRAM_NEWS_TOPIC_LIMIT,
  TELEGRAM_NEWS_TOPIC_LENGTH_LIMIT,
  TELEGRAM_NEWS_TOPIC_PAGE_SIZE,
  TELEGRAM_NEWS_AI_BRIEF_LIMIT,
  TELEGRAM_NEWS_INPUT_TTL_MS,
  TELEGRAM_NEWS_MAX_REPORT_ITEMS,
  TELEGRAM_NEWS_ALL_TOPICS_ITEMS_PER_TOPIC,
  TELEGRAM_NEWS_PERIODS,
  TELEGRAM_NEWS_RESULTS_BY_PERIOD,
  normalizeTelegramNewsTopics,
  telegramNewsTopicList,
  telegramNewsControllerText,
  telegramNewsControllerKeyboard,
  newsTopicPage,
  newsTopicPagination,
  telegramNewsTopicsText,
  telegramNewsTopicsKeyboard,
  telegramNewsPriorityText,
  telegramNewsPriorityKeyboard,
  telegramNewsRemoveTopicsKeyboard,
  thaiRelativeNewsTime,
  googleNewsArticleKeyboard,
  formatGoogleNewsResults,
  telegramNewsResultLimit,
  spaceTelegramNewsBrief,
};

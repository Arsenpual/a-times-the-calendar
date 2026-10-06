const { XMLParser } = require("fast-xml-parser");

const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const GOOGLE_NEWS_TIMEOUT_MS = 10_000;
const GOOGLE_NEWS_MAX_RESULTS = 10;

function textValue(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") return String(value["#text"] || "").trim();
  return "";
}

function normalizeNewsItem(item) {
  const title = textValue(item?.title);
  const url = textValue(item?.link);
  if (!title || !/^https:\/\//i.test(url)) return null;
  const source = textValue(item?.source);
  const publishedAt = Date.parse(textValue(item?.pubDate));
  return {
    title,
    url,
    source,
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : null
  };
}

async function searchGoogleNews(topic, { limit = 5, period = "1d" } = {}) {
  const normalizedTopic = String(topic || "").trim();
  if (!normalizedTopic) return [];
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 5, GOOGLE_NEWS_MAX_RESULTS));
  const query = new URLSearchParams({
    q: `${normalizedTopic} when:${period}`,
    hl: "th",
    gl: "TH",
    ceid: "TH:th"
  });
  const response = await fetch(`${GOOGLE_NEWS_RSS}?${query}`, {
    headers: { "User-Agent": "T.i.M.E.S. Telegram news reader/1.0" },
    signal: AbortSignal.timeout(GOOGLE_NEWS_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Google News ตอบกลับ ${response.status}`);
  const xml = await response.text();
  const parsed = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml);
  const rawItems = parsed?.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return items.map(normalizeNewsItem).filter(Boolean).slice(0, cappedLimit);
}

module.exports = { searchGoogleNews };

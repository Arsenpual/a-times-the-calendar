import type {
  GmailAttachmentMeta,
  GmailMessageDetail,
  GmailMessageSummary,
} from '../types/game';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type GmailFilterCategory = 'inbox' | 'unread' | 'starred';

export class GmailApiError extends Error {
  status: number;
  isScopeError: boolean;

  constructor(message: string, status: number, isScopeError = false) {
    super(message);
    this.name = 'GmailApiError';
    this.status = status;
    this.isScopeError = isScopeError;
  }
}

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailRawMessage {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
}

interface GmailLabelResponse {
  id?: string;
  name?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface GmailUnreadStatus {
  unreadCount: number;
  latestUnreadIds: string[];
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function decodeBase64UrlUtf8(data?: string): string {
  if (!data) return '';
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Safely converts an HTML email body into clean, readable plain text without injecting raw HTML.
 */
function htmlToReadableText(html: string): string {
  const withoutBlocks = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const withBreaks = withoutBlocks
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|tr|h[1-6]|blockquote|section|article|header|footer)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*li\s*>/gi, '')
    .replace(/<\s*hr[^>]*>/gi, '\n──────────\n')
    .replace(/<[^>]+>/g, '');

  const decoded = decodeHtmlEntities(withBreaks);
  return decoded
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseFromHeader(rawFrom?: string): { fromName: string; fromEmail: string } {
  if (!rawFrom) {
    return { fromName: 'ไม่ระบุผู้ส่ง', fromEmail: '' };
  }
  const cleaned = rawFrom.trim();
  const angleMatch = cleaned.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    const rawName = angleMatch[1].trim().replace(/^["']|["']$/g, '').trim();
    const email = angleMatch[2].trim();
    return {
      fromName: rawName || email,
      fromEmail: email,
    };
  }
  return {
    fromName: cleaned,
    fromEmail: cleaned.includes('@') ? cleaned : '',
  };
}

function getHeaderValue(headers: GmailHeader[] | undefined, targetName: string): string | undefined {
  if (!headers) return undefined;
  const lower = targetName.toLowerCase();
  return headers.find((h) => h.name?.toLowerCase() === lower)?.value;
}

function extractBodyAndAttachments(payload?: GmailMessagePart): {
  bodyText: string;
  attachments: GmailAttachmentMeta[];
} {
  if (!payload) {
    return { bodyText: '', attachments: [] };
  }

  let plainText = '';
  let htmlText = '';
  const attachments: GmailAttachmentMeta[] = [];

  const walk = (part: GmailMessagePart) => {
    const mime = (part.mimeType || '').toLowerCase();

    if (part.filename && part.filename.trim().length > 0) {
      attachments.push({
        filename: part.filename.trim(),
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body?.size ?? 0,
      });
    }

    if (mime === 'text/plain' && part.body?.data && !plainText) {
      plainText = decodeBase64UrlUtf8(part.body.data);
    } else if (mime === 'text/html' && part.body?.data && !htmlText) {
      htmlText = decodeBase64UrlUtf8(part.body.data);
    }

    if (part.parts && part.parts.length > 0) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  };

  walk(payload);

  if (plainText.trim()) {
    return {
      bodyText: plainText.replace(/\r\n/g, '\n').trim(),
      attachments,
    };
  }
  if (htmlText.trim()) {
    return {
      bodyText: htmlToReadableText(htmlText),
      attachments,
    };
  }
  if (payload.body?.data) {
    const fallback = decodeBase64UrlUtf8(payload.body.data);
    const isHtml = /<[a-z][\s\S]*>/i.test(fallback);
    return {
      bodyText: isHtml ? htmlToReadableText(fallback) : fallback.trim(),
      attachments,
    };
  }
  return { bodyText: '', attachments };
}

function mapRawToSummary(raw: GmailRawMessage): GmailMessageSummary {
  const headers = raw.payload?.headers;
  const rawSubject = getHeaderValue(headers, 'Subject')?.trim();
  const rawFrom = getHeaderValue(headers, 'From');
  const rawTo = getHeaderValue(headers, 'To');
  const rawDate = getHeaderValue(headers, 'Date');
  const { fromName, fromEmail } = parseFromHeader(rawFrom);
  const labelIds = raw.labelIds ?? [];
  const internalDate = Number(raw.internalDate) || Date.now();

  return {
    id: raw.id ?? '',
    threadId: raw.threadId ?? '',
    snippet: decodeHtmlEntities(raw.snippet ?? '').trim(),
    subject: rawSubject || '(ไม่มีหัวข้อ)',
    fromName,
    fromEmail,
    to: rawTo,
    dateRaw: rawDate,
    internalDate,
    isUnread: labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    labelIds,
  };
}

async function gmailFetch<T>(
  endpoint: string,
  accessToken: string,
  params?: URLSearchParams
): Promise<T> {
  const url = new URL(`${GMAIL_API_BASE}${endpoint}`);
  if (params) {
    params.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    let apiReason = '';
    try {
      const errJson = (await response.json()) as {
        error?: { message?: string; errors?: Array<{ reason?: string }> };
      };
      apiReason = errJson.error?.message || '';
    } catch {
      // ignore json parse failure
    }

    if (response.status === 401) {
      throw new GmailApiError('สิทธิ์การเข้าถึงบัญชี Google หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', 401);
    }
    if (response.status === 403) {
      const scopeHint =
        /insufficient|scope|permission/i.test(apiReason) || !apiReason;
      throw new GmailApiError(
        scopeHint
          ? 'บัญชีนี้ยังไม่ได้อนุญาตสิทธิ์อ่านอีเมลจาก Gmail กรุณากดเข้าสู่ระบบ Google อีกครั้งเพื่ออนุญาตสิทธิ์ Gmail'
          : `ไม่สามารถเข้าถึง Gmail ได้ (${apiReason})`,
        403,
        scopeHint
      );
    }
    if (response.status === 429) {
      throw new GmailApiError('เรียกข้อมูล Gmail ถี่เกินกำหนดชั่วคราว กรุณารอสักครู่แล้วลองใหม่', 429);
    }
    throw new GmailApiError(
      apiReason || `ไม่สามารถเชื่อมต่อ Gmail ได้ (รหัส ${response.status})`,
      response.status
    );
  }

  return (await response.json()) as T;
}

/**
 * Fetches live INBOX unread count and the latest unread message IDs for roadside mailbox notifications.
 */
export async function fetchGmailUnreadStatus(accessToken: string): Promise<GmailUnreadStatus> {
  const listParams = new URLSearchParams();
  listParams.append('labelIds', 'INBOX');
  listParams.append('labelIds', 'UNREAD');
  listParams.append('maxResults', '10');

  const [inboxLabel, unreadList] = await Promise.all([
    gmailFetch<GmailLabelResponse>('/labels/INBOX', accessToken),
    gmailFetch<GmailListResponse>('/messages', accessToken, listParams),
  ]);

  const latestUnreadIds = (unreadList.messages ?? []).map((m) => m.id).filter(Boolean);
  const unreadCount =
    typeof inboxLabel.messagesUnread === 'number'
      ? inboxLabel.messagesUnread
      : latestUnreadIds.length;

  return {
    unreadCount,
    latestUnreadIds,
  };
}

/**
 * Fetches a list of Gmail messages with fast metadata headers for the roadside mailbox reader.
 */
export async function fetchGmailMessages(
  accessToken: string,
  options?: {
    filter?: GmailFilterCategory;
    searchQuery?: string;
    maxResults?: number;
  }
): Promise<GmailMessageSummary[]> {
  const filter = options?.filter ?? 'inbox';
  const maxResults = options?.maxResults ?? 20;
  const searchQuery = options?.searchQuery?.trim() ?? '';

  const listParams = new URLSearchParams();
  listParams.append('maxResults', String(maxResults));

  if (filter === 'inbox') {
    listParams.append('labelIds', 'INBOX');
  } else if (filter === 'unread') {
    listParams.append('labelIds', 'INBOX');
    listParams.append('labelIds', 'UNREAD');
  } else if (filter === 'starred') {
    listParams.append('labelIds', 'STARRED');
  }

  if (searchQuery) {
    listParams.append('q', searchQuery);
  }

  const listRes = await gmailFetch<GmailListResponse>('/messages', accessToken, listParams);
  const refs = listRes.messages ?? [];
  if (refs.length === 0) {
    return [];
  }

  // Fetch metadata in small parallel batches to stay responsive and gentle on rate limits
  const results: GmailMessageSummary[] = [];
  const batchSize = 8;
  for (let i = 0; i < refs.length; i += batchSize) {
    const slice = refs.slice(i, i + batchSize);
    const batch = await Promise.all(
      slice.map(async (ref) => {
        const metaParams = new URLSearchParams();
        metaParams.append('format', 'metadata');
        metaParams.append('metadataHeaders', 'Subject');
        metaParams.append('metadataHeaders', 'From');
        metaParams.append('metadataHeaders', 'To');
        metaParams.append('metadataHeaders', 'Date');
        const raw = await gmailFetch<GmailRawMessage>(
          `/messages/${encodeURIComponent(ref.id)}`,
          accessToken,
          metaParams
        );
        return mapRawToSummary(raw);
      })
    );
    results.push(...batch);
  }

  return results.sort((a, b) => b.internalDate - a.internalDate);
}

/**
 * Fetches full message content (UTF-8 decoded body text + attachment metadata) for reading.
 */
export async function fetchGmailMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const params = new URLSearchParams();
  params.append('format', 'full');

  const raw = await gmailFetch<GmailRawMessage>(
    `/messages/${encodeURIComponent(messageId)}`,
    accessToken,
    params
  );

  const summary = mapRawToSummary(raw);
  const { bodyText, attachments } = extractBodyAndAttachments(raw.payload);

  return {
    ...summary,
    bodyText: bodyText || summary.snippet || '(ไม่มีเนื้อหาข้อความ)',
    attachments,
  };
}

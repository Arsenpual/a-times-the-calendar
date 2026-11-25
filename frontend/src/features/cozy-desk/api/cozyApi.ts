import { apiRequest } from '../../../shared/api/client.js';
import { auth } from '../../../shared/config/firebase-auth.js';

export function cozyStorageKey(baseKey: string): string {
  const uid = auth.currentUser?.uid;
  return uid ? `${baseKey}:${uid}` : baseKey;
}

function getStandaloneGeminiApiKey(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const fromVite = (env.VITE_GEMINI_API_KEY || '').trim();
  if (fromVite && fromVite !== 'MY_GEMINI_API_KEY') return fromVite;
  try {
    const fromStorage = (window.localStorage.getItem('cozy_desk_gemini_api_key') || '').trim();
    if (fromStorage) return fromStorage;
  } catch {
    // Ignore storage access errors
  }
  return '';
}

function buildSseResponse(events: Array<Record<string, unknown>>): Response {
  const payload = events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join('');
  return new Response(payload, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}

function buildJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function callDirectGemini(
  apiKey: string,
  geminiBody: Record<string, unknown>,
  signal?: AbortSignal | null
): Promise<Record<string, unknown>> {
  const model = 'gemini-2.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(geminiBody),
      signal: signal ?? undefined,
    }
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Gemini API error (${res.status})`);
  }
  return data;
}

async function handleStandaloneFallback(
  normalizedPath: string,
  options: RequestInit
): Promise<Response | null> {
  const apiKey = getStandaloneGeminiApiKey();

  if (normalizedPath === '/api/cozy-desk/characters/status') {
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    const ready = Boolean(apiKey);
    const makeChar = (id: string, name: string) => ({
      id,
      name,
      status: ready ? 'ready' : 'unavailable',
      tokensRemaining: 250_000,
      tokensUsed: 0,
      tokensLimit: 250_000,
      resetAt: nextMidnight.getTime(),
      currentTask: null,
      unavailableReason: ready ? null : 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY',
      unavailableCode: ready ? null : 'MISSING_API_KEY',
    });
    return buildJsonResponse({
      ok: true,
      characters: {
        mina: makeChar('mina', 'มีน่า'),
        antigravity: makeChar('antigravity', 'Antigravity'),
        ai_studio: makeChar('ai_studio', 'Google AI Studio'),
      },
      updatedAt: Date.now(),
    });
  }

  if (normalizedPath === '/api/cozy-desk/antigravity/status') {
    return buildJsonResponse({
      ok: true,
      agent: 'Antigravity AI Studio Sandbox Agent',
      host: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
      endpoint: '/api/cozy-desk/antigravity/chat',
      workspace: 'a-times-the-calendar',
      model: 'gemini-2.5-flash',
      fileCount: 6,
      files: [
        'frontend/src/app/app.jsx',
        'frontend/src/app/account-app.jsx',
        'frontend/src/features/cozy-desk/CozyDeskApp.tsx',
        'frontend/src/features/cozy-desk/components/GameCanvas.tsx',
        'backend/index.js',
        'package.json',
      ],
    });
  }

  if (
    normalizedPath === '/api/cozy-desk/assistant/chat' ||
    normalizedPath === '/api/cozy-desk/aistudio/chat' ||
    normalizedPath === '/api/cozy-desk/antigravity/chat'
  ) {
    if (!apiKey) {
      return buildSseResponse([
        {
          type: 'error',
          error:
            'โหมด Standalone (ไม่มี Backend): กรุณาตั้งค่า GEMINI_API_KEY หรือ VITE_GEMINI_API_KEY ในสภาพแวดล้อมก่อนใช้งาน AI',
        },
      ]);
    }
    try {
      const parsedBody = options.body ? JSON.parse(String(options.body)) : {};
      const rawMessages = Array.isArray(parsedBody.messages) ? parsedBody.messages : [];
      const contents = rawMessages
        .filter((m: { content?: string }) => typeof m?.content === 'string' && m.content.trim())
        .slice(-20)
        .map((m: { role?: string; content: string }) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content.trim() }],
        }));

      const sysText =
        normalizedPath === '/api/cozy-desk/aistudio/chat'
          ? `คุณคือ "Google AI Studio" ผู้เชี่ยวชาญด้าน Prompt Engineering และการออกแบบ Schema ประจำบ้าน Cozy Desk (T.i.M.E.S.) ตอบเป็นภาษาไทยที่ชัดเจน นำไปใช้ได้จริง ${parsedBody.systemInstruction || ''}`
          : normalizedPath === '/api/cozy-desk/antigravity/chat'
            ? 'คุณคือ "Antigravity (AGY)" ผู้ช่วยวิศวกรซอฟต์แวร์ประจำสถานี Dev Station ในบ้าน Cozy Desk (T.i.M.E.S.) ตอบเป็นภาษาไทยพร้อมโค้ดที่สะอาดและปลอดภัย'
            : 'คุณคือ "มีน่า (Mina)" ผู้ช่วยทำงานประจำห้องทำงานในบ้าน 2D Cozy Desk (T.i.M.E.S.) ตอบเป็นภาษาไทยอย่างอบอุ่น สุภาพ กระชับ และช่วยจัดการงานอย่างเป็นระบบ';

      const data = await callDirectGemini(
        apiKey,
        {
          systemInstruction: { parts: [{ text: sysText }] },
          contents,
        },
        options.signal
      );
      const candidates = data.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
      }> | undefined;
      const text =
        candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() ||
        'ดำเนินการเรียบร้อยแล้วครับ';
      return buildSseResponse([
        { type: 'chunk', text },
        { type: 'done' },
      ]);
    } catch (err) {
      return buildSseResponse([
        {
          type: 'error',
          error: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ Gemini API ได้',
        },
      ]);
    }
  }

  if (normalizedPath === '/api/cozy-desk/assistant/execute-task') {
    if (!apiKey) {
      return buildJsonResponse(
        { error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY สำหรับรันงานอัตโนมัติ' },
        401
      );
    }
    try {
      const parsedBody = options.body ? JSON.parse(String(options.body)) : {};
      const prompt = `ชื่องาน: ${parsedBody.title || ''}\nรายละเอียด: ${parsedBody.notes || ''}\nกรุณาสรุปผลงานเป็นภาษาไทยอย่างกระชับ ชัดเจน พร้อมนำไปใช้ต่อได้ทันที`;
      const data = await callDirectGemini(
        apiKey,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        },
        options.signal
      );
      const candidates = data.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
      }> | undefined;
      const summary =
        candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() ||
        'ดำเนินการตามรายการงานเรียบร้อยแล้วครับ';
      return buildJsonResponse({
        assistantId: parsedBody.assistantId || 'mina',
        summary,
        tokensUsed: 120,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      return buildJsonResponse(
        { error: err instanceof Error ? err.message : 'ไม่สามารถรันงานได้' },
        502
      );
    }
  }

  return null;
}

export async function cozyApiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const normalized = path.startsWith('/api/cozy-desk')
    ? path
    : path.replace(/^\/api\//, '/api/cozy-desk/');

  let nextOptions = options;
  if (options.headers) {
    const cleanedHeaders = new Headers(options.headers);
    cleanedHeaders.delete('content-type');
    const entries = [...cleanedHeaders.entries()];
    nextOptions = {
      ...options,
      headers: entries.length > 0 ? Object.fromEntries(entries) : undefined,
    };
  }

  try {
    const res = await apiRequest(normalized, nextOptions);
    if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 404) {
      const fallback = await handleStandaloneFallback(normalized, nextOptions);
      if (fallback) return fallback;
    }
    return res;
  } catch (err) {
    const fallback = await handleStandaloneFallback(normalized, nextOptions);
    if (fallback) return fallback;
    throw err;
  }
}

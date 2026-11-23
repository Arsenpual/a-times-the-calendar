import { apiRequest } from '../../../shared/api/client.js';
import { auth } from '../../../shared/config/firebase-auth.js';

export function cozyStorageKey(baseKey: string): string {
  const uid = auth.currentUser?.uid;
  return uid ? `${baseKey}:${uid}` : baseKey;
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

  return apiRequest(normalized, nextOptions);
}

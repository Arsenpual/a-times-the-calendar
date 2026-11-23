import type { GoogleDriveFile } from '../types/game';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_DOC_MIME = 'application/vnd.google-apps.document';
export const DRIVE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
export const DRIVE_SLIDE_MIME = 'application/vnd.google-apps.presentation';

export type DriveCategoryFilter = 'all' | 'folders' | 'docs' | 'sheets' | 'pdfs' | 'starred';

export class GoogleDriveApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleDriveApiError(
        401,
        'เซสชัน Google หมดอายุ กรุณากด Sign in with Google ใหม่อีกครั้ง'
      );
    }
    if (res.status === 403) {
      throw new GoogleDriveApiError(
        403,
        'ยังไม่มีสิทธิ์เข้าถึง Google Drive กรุณากด Sign in with Google เพื่ออนุญาตสิทธิ์ Drive ใหม่อีกครั้ง'
      );
    }
    throw new GoogleDriveApiError(
      res.status,
      `ไม่สามารถเชื่อมต่อ Google Drive ได้ (${res.status})`
    );
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

interface RawDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  starred?: boolean;
  owners?: Array<{ displayName?: string }>;
  parents?: string[];
}

function mapRawFile(raw: RawDriveFile): GoogleDriveFile | null {
  if (!raw.id || !raw.name || !raw.mimeType) return null;
  return {
    id: raw.id,
    name: raw.name,
    mimeType: raw.mimeType,
    modifiedTime: raw.modifiedTime,
    size: raw.size,
    webViewLink: raw.webViewLink,
    iconLink: raw.iconLink,
    starred: Boolean(raw.starred),
    ownerName: raw.owners?.[0]?.displayName,
    parents: raw.parents,
  };
}

export async function fetchDriveFiles(
  accessToken: string,
  options: {
    folderId?: string | null;
    searchQuery?: string;
    category?: DriveCategoryFilter;
  } = {}
): Promise<GoogleDriveFile[]> {
  const { folderId, searchQuery = '', category = 'all' } = options;
  const clauses: string[] = ['trashed = false'];
  const trimmedSearch = searchQuery.trim();

  if (trimmedSearch) {
    clauses.push(`name contains '${escapeDriveQuery(trimmedSearch)}'`);
  } else if (folderId) {
    clauses.push(`'${escapeDriveQuery(folderId)}' in parents`);
  } else if (category === 'all') {
    clauses.push("'root' in parents");
  }

  if (category === 'folders') {
    clauses.push(`mimeType = '${DRIVE_FOLDER_MIME}'`);
  } else if (category === 'docs') {
    clauses.push(
      `(mimeType = '${DRIVE_DOC_MIME}' or mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')`
    );
  } else if (category === 'sheets') {
    clauses.push(
      `(mimeType = '${DRIVE_SHEET_MIME}' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'text/csv')`
    );
  } else if (category === 'pdfs') {
    clauses.push("mimeType = 'application/pdf'");
  } else if (category === 'starred') {
    clauses.push('starred = true');
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields:
      'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,starred,owners(displayName),parents)',
    orderBy: 'folder,modifiedTime desc',
    pageSize: '60',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const data = await driveFetch<{ files?: RawDriveFile[] }>(
    `${DRIVE_API_BASE}/files?${params.toString()}`,
    accessToken
  );

  return (data.files ?? [])
    .map(mapRawFile)
    .filter((item): item is GoogleDriveFile => item !== null);
}

export function isPreviewableDriveFile(mimeType: string): boolean {
  return (
    mimeType === DRIVE_DOC_MIME ||
    mimeType === DRIVE_SHEET_MIME ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/json'
  );
}

export async function previewDriveFileText(
  accessToken: string,
  file: GoogleDriveFile
): Promise<string> {
  let url = '';
  if (file.mimeType === DRIVE_DOC_MIME) {
    url = `${DRIVE_API_BASE}/files/${encodeURIComponent(file.id)}/export?mimeType=text/plain`;
  } else if (file.mimeType === DRIVE_SHEET_MIME) {
    url = `${DRIVE_API_BASE}/files/${encodeURIComponent(file.id)}/export?mimeType=text/csv`;
  } else if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
    url = `${DRIVE_API_BASE}/files/${encodeURIComponent(file.id)}?alt=media`;
  } else {
    throw new Error('ไฟล์ประเภทนี้ไม่รองรับการแสดงตัวอย่างข้อความโดยตรง');
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleDriveApiError(
        401,
        'เซสชัน Google หมดอายุ กรุณากด Sign in with Google ใหม่อีกครั้ง'
      );
    }
    if (res.status === 403) {
      throw new GoogleDriveApiError(
        403,
        'ไม่มีสิทธิ์อ่านเนื้อหาไฟล์นี้ใน Google Drive'
      );
    }
    throw new GoogleDriveApiError(res.status, `ไม่สามารถโหลดตัวอย่างไฟล์ได้ (${res.status})`);
  }

  const text = await res.text();
  if (text.length > 14000) {
    return `${text.slice(0, 14000)}\n\n... (แสดงตัวอย่างบางส่วน กด "เปิดใน Google Drive" เพื่อดูเนื้อหาเต็ม)`;
  }
  return text;
}

export async function fetchDriveFolders(
  accessToken: string
): Promise<GoogleDriveFile[]> {
  return fetchDriveFiles(accessToken, { category: 'folders' });
}

export async function ensureCozyDeskDriveFolder(
  accessToken: string
): Promise<GoogleDriveFile> {
  const folderName = 'Cozy Desk AI';
  const params = new URLSearchParams({
    q: `name = '${escapeDriveQuery(folderName)}' and mimeType = '${DRIVE_FOLDER_MIME}' and 'root' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink)',
    pageSize: '5',
  });

  const existing = await driveFetch<{ files?: RawDriveFile[] }>(
    `${DRIVE_API_BASE}/files?${params.toString()}`,
    accessToken
  );
  const first = existing.files?.[0];
  if (first?.id && first.name && first.mimeType) {
    return {
      id: first.id,
      name: first.name,
      mimeType: first.mimeType,
      webViewLink: first.webViewLink,
    };
  }

  const created = await driveFetch<RawDriveFile>(
    `${DRIVE_API_BASE}/files?fields=id,name,mimeType,webViewLink`,
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME,
        parents: ['root'],
      }),
    }
  );

  if (!created.id || !created.name || !created.mimeType) {
    throw new GoogleDriveApiError(500, 'ไม่สามารถสร้างโฟลเดอร์ Cozy Desk AI ใน Google Drive ได้');
  }
  return {
    id: created.id,
    name: created.name,
    mimeType: created.mimeType,
    webViewLink: created.webViewLink,
  };
}

export async function uploadConvertedDriveDocument(
  accessToken: string,
  options: {
    name: string;
    targetMimeType: string;
    sourceMimeType: string;
    content: string;
    parentFolderId?: string;
  }
): Promise<GoogleDriveFile> {
  const boundary = `cozy_desk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const metadata: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name: options.name.trim() || 'เอกสารจาก Cozy Desk AI',
    mimeType: options.targetMimeType,
  };
  if (options.parentFolderId && options.parentFolderId !== 'root') {
    metadata.parents = [options.parentFolderId];
  }

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${options.sourceMimeType}; charset=UTF-8`,
    '',
    options.content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink,iconLink,parents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    let reason = '';
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      reason = errBody.error?.message || '';
    } catch {
      // ignore json parse failure
    }
    if (res.status === 401) {
      throw new GoogleDriveApiError(
        401,
        'เซสชัน Google หมดอายุ กรุณากด Sign in with Google ใหม่อีกครั้ง'
      );
    }
    if (res.status === 403) {
      throw new GoogleDriveApiError(
        403,
        'ยังไม่มีสิทธิ์บันทึกไฟล์ลง Google Drive กรุณากดปุ่ม "ขอสิทธิ์เขียน Google Drive" ด้านล่างเพื่ออนุญาตสิทธิ์เพิ่มเติม'
      );
    }
    throw new GoogleDriveApiError(
      res.status,
      reason
        ? `ไม่สามารถบันทึกไฟล์ลง Google Drive ได้ (${reason})`
        : `ไม่สามารถบันทึกไฟล์ลง Google Drive ได้ (${res.status})`
    );
  }

  const raw = (await res.json()) as RawDriveFile;
  const mapped = mapRawFile(raw);
  if (!mapped) {
    throw new GoogleDriveApiError(500, 'Google Drive ตอบกลับข้อมูลไฟล์ไม่สมบูรณ์');
  }
  return mapped;
}

import type { GoogleTask, GoogleTaskList } from '../types/game';

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

export class GoogleTasksApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function tasksFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${TASKS_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleTasksApiError(
        401,
        'เซสชัน Google หมดอายุ กรุณากด Sign in with Google ใหม่อีกครั้ง'
      );
    }
    if (res.status === 403) {
      throw new GoogleTasksApiError(
        403,
        'ยังไม่มีสิทธิ์เข้าถึง Google Tasks กรุณากด Sign in with Google เพื่ออนุญาตสิทธิ์ Tasks ใหม่อีกครั้ง'
      );
    }
    throw new GoogleTasksApiError(
      res.status,
      `ไม่สามารถเชื่อมต่อ Google Tasks ได้ (${res.status})`
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function fetchTaskLists(accessToken: string): Promise<GoogleTaskList[]> {
  interface ListsResponse {
    nextPageToken?: string;
    items?: Array<{ id?: string; title?: string; updated?: string }>;
  }

  const allItems: NonNullable<ListsResponse['items']> = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  do {
    const query = new URLSearchParams({ maxResults: '100' });
    if (pageToken) {
      query.set('pageToken', pageToken);
    }

    const data = await tasksFetch<ListsResponse>(
      `/users/@me/lists?${query.toString()}`,
      accessToken
    );
    if (data.items?.length) {
      allItems.push(...data.items);
    }
    pageToken = data.nextPageToken;
    pageCount += 1;
  } while (pageToken && pageCount < 5);

  return allItems
    .filter((item): item is { id: string; title?: string; updated?: string } => Boolean(item.id))
    .map((item) => ({
      id: item.id,
      title: item.title || 'รายการงาน',
      updated: item.updated,
    }));
}

export async function fetchTasks(
  accessToken: string,
  taskListId: string
): Promise<GoogleTask[]> {
  interface TasksResponse {
    nextPageToken?: string;
    items?: Array<{
      id?: string;
      title?: string;
      notes?: string;
      due?: string;
      status?: string;
      updated?: string;
      parent?: string;
      deleted?: boolean;
    }>;
  }

  const allItems: NonNullable<TasksResponse['items']> = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  do {
    const query = new URLSearchParams({
      showCompleted: 'true',
      showHidden: 'true',
      maxResults: '100',
    });
    if (pageToken) {
      query.set('pageToken', pageToken);
    }

    const data = await tasksFetch<TasksResponse>(
      `/lists/${encodeURIComponent(taskListId)}/tasks?${query.toString()}`,
      accessToken
    );

    if (data.items?.length) {
      allItems.push(...data.items);
    }
    pageToken = data.nextPageToken;
    pageCount += 1;
  } while (pageToken && pageCount < 10);

  return allItems
    .filter(
      (
        item
      ): item is {
        id: string;
        title?: string;
        notes?: string;
        due?: string;
        status?: string;
        updated?: string;
        parent?: string;
      } => Boolean(item.id) && !item.deleted
    )
    .map((item) => ({
      id: item.id,
      title: item.title || '(ไม่มีชื่องาน)',
      notes: item.notes,
      due: item.due,
      status: item.status === 'completed' ? 'completed' : 'needsAction',
      updated: item.updated,
      parent: item.parent,
    }));
}

export interface GoogleTaskListWithTasks extends GoogleTaskList {
  tasks: GoogleTask[];
}

export async function fetchAllTaskListsWithTasks(
  accessToken: string
): Promise<GoogleTaskListWithTasks[]> {
  const lists = await fetchTaskLists(accessToken);
  const settled = await Promise.allSettled(
    lists.map(async (list) => ({
      ...list,
      tasks: await fetchTasks(accessToken, list.id),
    }))
  );

  const results: GoogleTaskListWithTasks[] = [];
  let firstError: unknown = null;

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      const err = outcome.reason;
      if (err instanceof GoogleTasksApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
      if (!firstError) firstError = err;
      // Preserve list shell even if one list transiently failed
      results.push({ ...lists[i], tasks: [] });
    }
  }

  if (results.length === 0 && firstError) {
    throw firstError;
  }

  return results;
}

export async function createTask(
  accessToken: string,
  taskListId: string,
  payload: { title: string; notes?: string; dueDate?: string }
): Promise<GoogleTask> {
  const body: Record<string, string> = {
    title: payload.title.trim(),
  };
  if (payload.notes?.trim()) {
    body.notes = payload.notes.trim();
  }
  if (payload.dueDate) {
    body.due = `${payload.dueDate}T00:00:00.000Z`;
  }

  const created = await tasksFetch<{
    id: string;
    title?: string;
    notes?: string;
    due?: string;
    status?: string;
    updated?: string;
  }>(`/lists/${encodeURIComponent(taskListId)}/tasks`, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    id: created.id,
    title: created.title || payload.title.trim(),
    notes: created.notes,
    due: created.due,
    status: created.status === 'completed' ? 'completed' : 'needsAction',
    updated: created.updated,
  };
}

export async function updateTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  patch: {
    title?: string;
    notes?: string;
    dueDate?: string | null;
    status?: 'needsAction' | 'completed';
  }
): Promise<GoogleTask> {
  const body: Record<string, string | null> = {};
  if (patch.title !== undefined) body.title = patch.title.trim();
  if (patch.notes !== undefined) body.notes = patch.notes.trim();
  if (patch.status !== undefined) {
    body.status = patch.status;
    if (patch.status === 'needsAction') {
      body.completed = null;
    }
  }
  if (patch.dueDate !== undefined) {
    body.due = patch.dueDate ? `${patch.dueDate}T00:00:00.000Z` : null;
  }

  const updated = await tasksFetch<{
    id: string;
    title?: string;
    notes?: string;
    due?: string;
    status?: string;
    updated?: string;
  }>(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );

  return {
    id: updated.id,
    title: updated.title || '(ไม่มีชื่องาน)',
    notes: updated.notes,
    due: updated.due,
    status: updated.status === 'completed' ? 'completed' : 'needsAction',
    updated: updated.updated,
  };
}

export async function deleteTask(
  accessToken: string,
  taskListId: string,
  taskId: string
): Promise<void> {
  await tasksFetch<void>(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}

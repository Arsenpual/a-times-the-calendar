import type { TvFeedItem, YouTubePlaylist } from '../types/game';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface YouTubeThumbnailSet {
  high?: { url?: string };
  medium?: { url?: string };
  default?: { url?: string };
}

function pickThumb(thumbs?: YouTubeThumbnailSet, videoId?: string): string {
  return (
    thumbs?.high?.url ||
    thumbs?.medium?.url ||
    thumbs?.default?.url ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '')
  );
}

function parseIsoDuration(iso?: string): string | undefined {
  if (!iso) return undefined;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return undefined;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  if (h === 0 && m === 0 && s === 0) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

async function ytFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${YT_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let reason = '';
    try {
      const errJson = (await res.json()) as {
        error?: { message?: string; errors?: Array<{ reason?: string }> };
      };
      reason = errJson.error?.errors?.[0]?.reason || errJson.error?.message || '';
    } catch {
      // Ignore non-JSON error body
    }

    if (res.status === 401) {
      throw new YouTubeApiError(
        401,
        'เซสชันการเข้าสู่ระบบหมดอายุ กรุณากด Sign in with Google ใหม่อีกครั้ง'
      );
    }
    if (res.status === 403) {
      if (reason.includes('quota')) {
        throw new YouTubeApiError(
          403,
          'โควต้า YouTube API วันนี้เต็มชั่วคราว กรุณาลองใหม่ภายหลัง'
        );
      }
      throw new YouTubeApiError(
        403,
        'ยังไม่มีสิทธิ์ดึงข้อมูล YouTube กรุณาตรวจสอบว่าได้เปิดใช้งาน YouTube Data API v3 และอนุญาตสิทธิ์แล้ว'
      );
    }
    throw new YouTubeApiError(
      res.status,
      `ไม่สามารถโหลดฟีดจาก YouTube ได้ (${res.status})`
    );
  }

  return (await res.json()) as T;
}

/**
 * Fetches recent videos from the signed-in user's YouTube subscriptions.
 * Uses uploads playlist IDs (UC... -> UU...) for fast, low-quota personalized feed loading.
 */
export async function fetchSubscriptionFeed(
  accessToken: string
): Promise<TvFeedItem[]> {
  interface SubResponse {
    items?: Array<{
      snippet?: {
        title?: string;
        resourceId?: { channelId?: string };
      };
    }>;
  }

  const subs = await ytFetch<SubResponse>(
    '/subscriptions?part=snippet&mine=true&maxResults=12&order=relevance',
    accessToken
  );

  const channelIds = (subs.items ?? [])
    .map((item) => item.snippet?.resourceId?.channelId)
    .filter((id): id is string => Boolean(id && id.startsWith('UC')))
    .slice(0, 8);

  if (channelIds.length === 0) {
    return [];
  }

  interface PlaylistItemsResponse {
    items?: Array<{
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: YouTubeThumbnailSet;
        resourceId?: { videoId?: string };
      };
    }>;
  }

  const results = await Promise.allSettled(
    channelIds.map((channelId) => {
      const uploadsPlaylistId = `UU${channelId.slice(2)}`;
      return ytFetch<PlaylistItemsResponse>(
        `/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=3`,
        accessToken
      );
    })
  );

  const seen = new Set<string>();
  const videos: TvFeedItem[] = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title;
      if (
        !videoId ||
        !title ||
        title === 'Private video' ||
        title === 'Deleted video' ||
        seen.has(videoId)
      ) {
        continue;
      }
      seen.add(videoId);
      videos.push({
        id: `sub-${videoId}`,
        videoId,
        title,
        channel: item.snippet?.channelTitle || 'YouTube',
        category: 'ฟีดติดตาม',
        publishedAt: item.snippet?.publishedAt,
        thumbnailUrl: pickThumb(item.snippet?.thumbnails, videoId),
      });
    }
  }

  videos.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return videos.slice(0, 24);
}

/**
 * Fetches the signed-in user's liked videos.
 */
export async function fetchLikedVideos(
  accessToken: string
): Promise<TvFeedItem[]> {
  interface VideosResponse {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        liveBroadcastContent?: string;
        thumbnails?: YouTubeThumbnailSet;
      };
      contentDetails?: {
        duration?: string;
      };
    }>;
  }

  const data = await ytFetch<VideosResponse>(
    '/videos?part=snippet,contentDetails&myRating=like&maxResults=18',
    accessToken
  );

  return (data.items ?? [])
    .filter((item): item is typeof item & { id: string } => Boolean(item.id))
    .map((item) => {
      const isLive = item.snippet?.liveBroadcastContent === 'live';
      return {
        id: `liked-${item.id}`,
        videoId: item.id,
        title: item.snippet?.title || 'วิดีโอที่ถูกใจ',
        channel: item.snippet?.channelTitle || 'YouTube',
        category: 'วิดีโอที่ถูกใจ',
        publishedAt: item.snippet?.publishedAt,
        duration: isLive ? undefined : parseIsoDuration(item.contentDetails?.duration),
        isLive,
        thumbnailUrl: pickThumb(item.snippet?.thumbnails, item.id),
      };
    });
}

/**
 * Fetches the signed-in user's personal YouTube playlists.
 */
export async function fetchMyPlaylists(
  accessToken: string
): Promise<YouTubePlaylist[]> {
  interface PlaylistsResponse {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        thumbnails?: YouTubeThumbnailSet;
      };
      contentDetails?: {
        itemCount?: number;
      };
    }>;
  }

  const data = await ytFetch<PlaylistsResponse>(
    '/playlists?part=snippet,contentDetails&mine=true&maxResults=18',
    accessToken
  );

  return (data.items ?? [])
    .filter((item): item is typeof item & { id: string } => Boolean(item.id))
    .map((item) => ({
      id: item.id,
      title: item.snippet?.title || 'เพลย์ลิสต์',
      itemCount: item.contentDetails?.itemCount ?? 0,
      thumbnailUrl: pickThumb(item.snippet?.thumbnails),
    }));
}

/**
 * Fetches videos inside a selected YouTube playlist.
 */
export async function fetchPlaylistVideos(
  accessToken: string,
  playlistId: string,
  playlistTitle: string
): Promise<TvFeedItem[]> {
  interface PlaylistItemsResponse {
    items?: Array<{
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: YouTubeThumbnailSet;
        resourceId?: { videoId?: string };
      };
    }>;
  }

  const data = await ytFetch<PlaylistItemsResponse>(
    `/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=24`,
    accessToken
  );

  return (data.items ?? [])
    .map((item) => {
      const videoId = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title;
      if (!videoId || !title || title === 'Private video' || title === 'Deleted video') {
        return null;
      }
      return {
        id: `pl-${playlistId}-${videoId}`,
        videoId,
        title,
        channel: item.snippet?.channelTitle || 'YouTube',
        category: playlistTitle,
        publishedAt: item.snippet?.publishedAt,
        thumbnailUrl: pickThumb(item.snippet?.thumbnails, videoId),
      } as TvFeedItem;
    })
    .filter((v): v is TvFeedItem => Boolean(v));
}

/**
 * Searches real YouTube videos across the entire platform using the user's OAuth token.
 */
export async function searchYouTubeVideos(
  accessToken: string,
  query: string
): Promise<TvFeedItem[]> {
  interface SearchResponse {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        liveBroadcastContent?: string;
        thumbnails?: YouTubeThumbnailSet;
      };
    }>;
  }

  const data = await ytFetch<SearchResponse>(
    `/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(query.trim())}`,
    accessToken
  );

  return (data.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      return {
        id: `search-${videoId}`,
        videoId,
        title: decodeHtmlEntities(item.snippet?.title || 'YouTube Video'),
        channel: decodeHtmlEntities(item.snippet?.channelTitle || 'YouTube'),
        category: 'ผลค้นหา YouTube',
        publishedAt: item.snippet?.publishedAt,
        isLive: item.snippet?.liveBroadcastContent === 'live',
        thumbnailUrl: pickThumb(item.snippet?.thumbnails, videoId),
      } as TvFeedItem;
    })
    .filter((v): v is TvFeedItem => Boolean(v));
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

import { ArrowLeft, ListVideo, Play, Trash2 } from 'lucide-react';
import type { TvFeedItem, YouTubePlaylist } from '../types/game';

export type FeedTabId =
  | 'subscriptions'
  | 'liked'
  | 'playlists'
  | 'search'
  | 'all'
  | 'Lo-fi & โฟกัส'
  | 'คาเฟ่ & แจ๊ส'
  | 'ธรรมชาติ & ผ่อนคลาย'
  | 'โค้ดดิ้ง & ทำงาน'
  | 'รายการของฉัน';

export const VALID_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export const CURATED_TABS: Array<{ id: FeedTabId; label: string }> = [
  { id: 'all', label: 'แนะนำในบ้าน' },
  { id: 'Lo-fi & โฟกัส', label: 'Lo-fi & โฟกัส' },
  { id: 'คาเฟ่ & แจ๊ส', label: 'คาเฟ่ & แจ๊ส' },
  { id: 'ธรรมชาติ & ผ่อนคลาย', label: 'ธรรมชาติ & ผ่อนคลาย' },
  { id: 'โค้ดดิ้ง & ทำงาน', label: 'โค้ดดิ้ง & ทำงาน' },
  { id: 'รายการของฉัน', label: 'รายการที่เพิ่มเอง' },
];

export function extractYouTubeVideoId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (VALID_VIDEO_ID.test(trimmed)) {
    return trimmed;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return VALID_VIDEO_ID.test(candidate) ? candidate : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const vParam = url.searchParams.get('v') ?? '';
      if (VALID_VIDEO_ID.test(vParam)) {
        return vParam;
      }

      const segments = url.pathname.split('/').filter(Boolean);
      if (
        segments.length >= 2 &&
        ['embed', 'shorts', 'live', 'v'].includes(segments[0]) &&
        VALID_VIDEO_ID.test(segments[1])
      ) {
        return segments[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getChannelInitial(channel: string): string {
  const trimmed = channel.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : 'Y';
}

export function formatPublishedDate(iso?: string): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const diffDays = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'วันนี้';
  if (diffDays === 1) return 'เมื่อวาน';
  if (diffDays < 30) return `${diffDays} วันที่แล้ว`;
  return new Date(ts).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export function GoogleSignInButton({
  onClick,
  disabled,
  compact = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-[#DADCE0] bg-white font-medium text-[#1F1F1F] shadow-xs transition-colors duration-150 hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-sm'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      <span>{disabled ? 'กำลังเข้าสู่ระบบ...' : 'Sign in with Google'}</span>
    </button>
  );
}


export function TvFeedGridSection({
  isLoadingFeed,
  selectedTab,
  openedPlaylist,
  playlists,
  handleOpenPlaylist,
  failedThumbs,
  handleThumbError,
  displayedVideos,
  isAuthenticated,
  onSelectItem,
  onDeleteCustomItem,
}: any) {
  return (
    <>
              {/* Loading Skeleton Grid */}
              {isLoadingFeed ? (
                <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="animate-pulse space-y-3">
                      <div
                        className="w-full rounded-xl bg-[#222222]"
                        style={{ aspectRatio: '16 / 9' }}
                      />
                      <div className="flex gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-[#222222]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-5/6 rounded bg-[#222222]" />
                          <div className="h-3 w-1/2 rounded bg-[#1C1C1C]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedTab === 'playlists' && !openedPlaylist ? (
                /* Playlists Grid */
                playlists && playlists.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => void handleOpenPlaylist(pl)}
                        className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[#262626] bg-[#161616] text-left transition-colors hover:border-[#3E3E3E] hover:bg-[#1C1C1C]"
                      >
                        <div
                          className="relative w-full overflow-hidden bg-[#202020]"
                          style={{ aspectRatio: '16 / 9' }}
                        >
                          {pl.thumbnailUrl && !failedThumbs.has(pl.id) ? (
                            <img
                              src={pl.thumbnailUrl}
                              alt={pl.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() => handleThumbError(pl.id)}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#231E1A]">
                              <ListVideo className="h-8 w-8 text-[#D97736]" />
                            </div>
                          )}
                          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-black/85 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                            <ListVideo className="h-3 w-3" />
                            <span>{pl.itemCount} คลิป</span>
                          </span>
                        </div>
                        <div className="p-3.5">
                          <p className="line-clamp-2 text-sm font-semibold text-[#F1F1F1]">
                            {pl.title}
                          </p>
                          <p className="mt-1 text-xs text-[#9E9E9E]">
                            เพลย์ลิสต์ YouTube ของคุณ
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mx-auto max-w-md rounded-xl border border-[#272727] bg-[#181818] p-8 text-center">
                    <p className="text-sm font-semibold text-[#F1F1F1]">
                      ยังไม่มีเพลย์ลิสต์ในบัญชีนี้
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-[#AAAAAA]">
                      สามารถสลับไปดูแท็บ “ฟีดติดตาม” “วิดีโอที่ถูกใจ” หรือค้นหาคลิป YouTube ด้านบนได้เลยครับ
                    </p>
                  </div>
                )
              ) : displayedVideos.length === 0 ? (
                <div className="mx-auto max-w-md rounded-xl border border-[#272727] bg-[#181818] p-8 text-center">
                  <p className="text-sm font-semibold text-[#F1F1F1]">
                    {selectedTab === 'subscriptions'
                      ? 'ยังไม่พบวิดีโอล่าสุดจากช่องที่กดติดตาม'
                      : selectedTab === 'liked'
                        ? 'ยังไม่พบวิดีโอที่กดถูกใจในบัญชีนี้'
                        : 'ไม่พบวิดีโอในหมวดนี้'}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#AAAAAA]">
                    {isAuthenticated
                      ? 'ลองพิมพ์คำค้นหาในช่องด้านบนเพื่อค้นหาคลิปจริงจาก YouTube หรือเลือกหมวดแนะนำในบ้านได้เลยครับ'
                      : 'คุณสามารถวางลิงก์ YouTube ใดก็ได้ลงในช่องค้นหาด้านบนเพื่อเปิดดูและเก็บไว้ในรายการที่เพิ่มเองได้ทันทีครับ'}
                  </p>
                </div>
              ) : (
                /* Standard 3-Column YouTube Video Feed Grid */
                <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedVideos.map((item) => {
                    const thumbKey = item.id;
                    const thumbFailed = failedThumbs.has(thumbKey);
                    const thumbSrc =
                      item.thumbnailUrl ||
                      `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
                    const publishedLabel = formatPublishedDate(item.publishedAt);

                    return (
                      <article key={item.id} className="group flex flex-col">
                        <button
                          type="button"
                          onClick={() => onSelectItem(item)}
                          className="relative w-full cursor-pointer overflow-hidden rounded-xl bg-[#1E1E1E] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D97736]"
                          style={{ aspectRatio: '16 / 9' }}
                        >
                          {!thumbFailed ? (
                            <img
                              src={thumbSrc}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() => handleThumbError(thumbKey)}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2B211B] to-[#161616]">
                              <Play className="h-8 w-8 text-[#D97736]" />
                            </div>
                          )}

                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-150 group-hover:bg-black/25">
                            <span className="inline-flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-black/75 text-white opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
                              <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                            </span>
                          </div>

                          {(item.isLive || item.duration) && (
                            <span
                              className={`pointer-events-none absolute right-2 bottom-2 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                                item.isLive
                                  ? 'bg-[#CC0000] text-white'
                                  : 'bg-black/85 text-[#F1F1F1]'
                              }`}
                            >
                              {item.isLive ? 'LIVE' : item.duration}
                            </span>
                          )}
                        </button>

                        <div className="mt-3 flex items-start gap-3">
                          <div
                            aria-hidden="true"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2522] text-xs font-bold text-[#E6B88A]"
                          >
                            {getChannelInitial(item.channel)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onSelectItem(item)}
                              className="line-clamp-2 cursor-pointer text-left text-sm font-semibold leading-snug text-[#F1F1F1] transition-colors group-hover:text-white"
                            >
                              {item.title}
                            </button>
                            <p className="mt-1 truncate text-xs text-[#AAAAAA]">
                              {item.channel}
                              {publishedLabel
                                ? ` · ${publishedLabel}`
                                : ` · ${item.category}`}
                            </p>
                          </div>
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomItem(item.id)}
                              aria-label={`ลบ ${item.title}`}
                              className="cursor-pointer rounded-md p-1 text-[#777777] transition-colors hover:bg-[#281A18] hover:text-[#F2A08C]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
    </>
  );
}

export function TvWatchViewSection({
  safeActiveVideoId,
  activeItem,
  onBackToFeed,
  upNextItems,
  failedThumbs,
  handleThumbError,
  onSelectItem,
}: any) {
  return (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.85fr_1fr] lg:overflow-hidden">
            <div className="cozy-scroll flex flex-col p-5 lg:overflow-y-auto">
              <div
                className="relative w-full overflow-hidden rounded-xl bg-black"
                style={{ aspectRatio: '16 / 9' }}
              >
                {safeActiveVideoId && (
                  <iframe
                    key={safeActiveVideoId}
                    src={`https://www.youtube-nocookie.com/embed/${safeActiveVideoId}?autoplay=1&rel=0`}
                    title={activeItem.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full border-0"
                  />
                )}
              </div>

              <div className="mt-4">
                <h2 className="font-display text-lg font-semibold leading-snug text-white">
                  {activeItem.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#242424] pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2A2522] text-sm font-bold text-[#E6B88A]"
                    >
                      {getChannelInitial(activeItem.channel)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#F1F1F1]">
                        {activeItem.channel}
                      </p>
                      <p className="text-xs text-[#AAAAAA]">
                        {activeItem.category}
                        {activeItem.isLive ? ' · ถ่ายทอดสด' : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onBackToFeed}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#222222] px-3.5 py-2 text-xs font-semibold text-[#F1F1F1] transition-colors hover:bg-[#323232]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>ดูวิดีโออื่นในหน้า Feed</span>
                  </button>
                </div>
              </div>
            </div>

            <aside className="flex min-h-0 flex-col border-t border-[#242424] bg-[#141414] lg:border-t-0 lg:border-l">
              <div className="shrink-0 border-b border-[#242424] px-4 py-3">
                <p className="text-xs font-semibold text-[#F1F1F1]">
                  วิดีโอแนะนำถัดไป
                </p>
              </div>
              <div className="cozy-scroll flex-1 space-y-3 overflow-y-auto p-4">
                {upNextItems.map((item) => {
                  const thumbKey = `up-${item.id}`;
                  const thumbFailed = failedThumbs.has(thumbKey);
                  const thumbSrc =
                    item.thumbnailUrl ||
                    `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="group flex w-full cursor-pointer items-start gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-[#222222]"
                    >
                      <div
                        className="relative w-36 shrink-0 overflow-hidden rounded-lg bg-[#202020]"
                        style={{ aspectRatio: '16 / 9' }}
                      >
                        {!thumbFailed ? (
                          <img
                            src={thumbSrc}
                            alt={item.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => handleThumbError(thumbKey)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[#26201C]">
                            <Play className="h-4 w-4 text-[#D97736]" />
                          </div>
                        )}
                        {(item.isLive || item.duration) && (
                          <span
                            className={`absolute right-1 bottom-1 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${
                              item.isLive
                                ? 'bg-[#CC0000] text-white'
                                : 'bg-black/85 text-[#F1F1F1]'
                            }`}
                          >
                            {item.isLive ? 'LIVE' : item.duration}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-[#F1F1F1] group-hover:text-white">
                          {item.title}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-[#9E9E9E]">
                          {item.channel}
                        </p>
                        <p className="truncate text-[11px] text-[#7D7D7D]">
                          {item.category}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
  );
}

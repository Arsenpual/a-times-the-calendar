import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Home,
  ListVideo,
  Loader2,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Search,
  ThumbsUp,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import type { TvFeedItem, YouTubePlaylist } from '../types/game';
import {
  fetchLikedVideos,
  fetchMyPlaylists,
  fetchPlaylistVideos,
  fetchSubscriptionFeed,
  searchYouTubeVideos,
  YouTubeApiError,
} from '../utils/youtubeApi';
import { cozyApiFetch } from '../utils/cozyApi';

interface TvModalProps {
  feedItems: TvFeedItem[];
  activeItem: TvFeedItem | null;
  googleUser: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  authError: string | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onTokenExpired: () => void;
  onSelectItem: (item: TvFeedItem) => void;
  onBackToFeed: () => void;
  onAddCustomItem: (item: { title: string; channel: string; videoId: string }) => void;
  onDeleteCustomItem: (id: string) => void;
  onClose: () => void;
}

type FeedTabId =
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

const VALID_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

const CURATED_TABS: Array<{ id: FeedTabId; label: string }> = [
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

function getChannelInitial(channel: string): string {
  const trimmed = channel.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : 'Y';
}

function formatPublishedDate(iso?: string): string | null {
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

function GoogleSignInButton({
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

export function TvModal({
  feedItems,
  activeItem,
  googleUser,
  accessToken,
  isSigningIn,
  authError,
  onGoogleSignIn,
  onGoogleSignOut,
  onTokenExpired,
  onSelectItem,
  onBackToFeed,
  onAddCustomItem,
  onDeleteCustomItem,
  onClose,
}: TvModalProps) {
  const isAuthenticated = Boolean(googleUser && accessToken);

  const [selectedTab, setSelectedTab] = useState<FeedTabId>(() =>
    isAuthenticated ? 'subscriptions' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchKeyword, setLastSearchKeyword] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  // Live YouTube Data API state
  const [subVideos, setSubVideos] = useState<TvFeedItem[] | null>(null);
  const [likedVideos, setLikedVideos] = useState<TvFeedItem[] | null>(null);
  const [playlists, setPlaylists] = useState<YouTubePlaylist[] | null>(null);
  const [openedPlaylist, setOpenedPlaylist] = useState<YouTubePlaylist | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<TvFeedItem[]>([]);
  const [searchResults, setSearchResults] = useState<TvFeedItem[]>([]);

  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  const detectedVideoId = useMemo(
    () => extractYouTubeVideoId(searchQuery),
    [searchQuery]
  );

  // Switch automatically to personalized subscriptions feed right after signing in
  useEffect(() => {
    if (isAuthenticated) {
      setSelectedTab((curr) => (curr === 'all' ? 'subscriptions' : curr));
    } else {
      setSubVideos(null);
      setLikedVideos(null);
      setPlaylists(null);
      setOpenedPlaylist(null);
      setPlaylistVideos([]);
      setSearchResults([]);
      setFeedError(null);
      setSelectedTab((curr) =>
        ['subscriptions', 'liked', 'playlists', 'search'].includes(curr)
          ? 'all'
          : curr
      );
    }
  }, [isAuthenticated]);

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof YouTubeApiError) {
        if (err.status === 401) {
          onTokenExpired();
        }
        setFeedError(err.message);
      } else {
        setFeedError('ไม่สามารถเชื่อมต่อกับ YouTube API ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    },
    [onTokenExpired]
  );

  const loadTabFeed = useCallback(
    async (tab: FeedTabId, forceRefresh = false) => {
      if (!accessToken) return;
      if (tab === 'subscriptions' && (forceRefresh || subVideos === null)) {
        setIsLoadingFeed(true);
        setFeedError(null);
        try {
          const items = await fetchSubscriptionFeed(accessToken);
          setSubVideos(items);
        } catch (err) {
          handleApiError(err);
        } finally {
          setIsLoadingFeed(false);
        }
      } else if (tab === 'liked' && (forceRefresh || likedVideos === null)) {
        setIsLoadingFeed(true);
        setFeedError(null);
        try {
          const items = await fetchLikedVideos(accessToken);
          setLikedVideos(items);
        } catch (err) {
          handleApiError(err);
        } finally {
          setIsLoadingFeed(false);
        }
      } else if (tab === 'playlists' && (forceRefresh || playlists === null)) {
        setIsLoadingFeed(true);
        setFeedError(null);
        try {
          const lists = await fetchMyPlaylists(accessToken);
          setPlaylists(lists);
        } catch (err) {
          handleApiError(err);
        } finally {
          setIsLoadingFeed(false);
        }
      }
    },
    [accessToken, handleApiError, likedVideos, playlists, subVideos]
  );

  useEffect(() => {
    if (isAuthenticated && !activeItem) {
      void loadTabFeed(selectedTab, false);
    }
  }, [activeItem, isAuthenticated, loadTabFeed, selectedTab]);

  const handleOpenPlaylist = async (pl: YouTubePlaylist) => {
    if (!accessToken) return;
    setOpenedPlaylist(pl);
    setIsLoadingFeed(true);
    setFeedError(null);
    try {
      const items = await fetchPlaylistVideos(accessToken, pl.id, pl.title);
      setPlaylistVideos(items);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const handleThumbError = (key: string) => {
    setFailedThumbs((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const videoId = extractYouTubeVideoId(trimmed);
    if (videoId) {
      const existing = feedItems.find((item) => item.videoId === videoId);
      if (existing) {
        setSearchQuery('');
        onSelectItem(existing);
        return;
      }

      setIsAddingUrl(true);
      let title = `วิดีโอ YouTube (${videoId.slice(0, 6)})`;
      let channel = 'YouTube';
      try {
        const res = await cozyApiFetch(
          `/api/youtube/oembed?videoId=${encodeURIComponent(videoId)}`
        );
        if (res.ok) {
          const meta = (await res.json()) as { title?: string; channel?: string };
          if (meta.title) title = meta.title;
          if (meta.channel) channel = meta.channel;
        }
      } catch {
        // Use fallback title
      } finally {
        setIsAddingUrl(false);
      }

      onAddCustomItem({ title, channel, videoId });
      setSearchQuery('');
      return;
    }

    // If signed in to YouTube, execute live platform-wide YouTube search!
    if (accessToken) {
      if (activeItem) onBackToFeed();
      setSelectedTab('search');
      setLastSearchKeyword(trimmed);
      setIsLoadingFeed(true);
      setFeedError(null);
      try {
        const results = await searchYouTubeVideos(accessToken, trimmed);
        setSearchResults(results);
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingFeed(false);
      }
      return;
    }

    // Otherwise filter local feed
    if (activeItem) {
      onBackToFeed();
    }
  };

  // Compute displayed videos for current tab
  const displayedVideos: TvFeedItem[] = useMemo(() => {
    if (selectedTab === 'subscriptions') return subVideos ?? [];
    if (selectedTab === 'liked') return likedVideos ?? [];
    if (selectedTab === 'playlists') return openedPlaylist ? playlistVideos : [];
    if (selectedTab === 'search') return searchResults;

    const q = searchQuery.trim().toLowerCase();
    return feedItems.filter((item) => {
      if (selectedTab === 'รายการของฉัน') {
        if (!item.isCustom) return false;
      } else if (selectedTab !== 'all') {
        if (item.category !== selectedTab) return false;
      }

      if (!q || detectedVideoId) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.channel.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [
    detectedVideoId,
    feedItems,
    likedVideos,
    openedPlaylist,
    playlistVideos,
    searchQuery,
    searchResults,
    selectedTab,
    subVideos,
  ]);

  // Up Next list during Watch View draws from current feed first, then curated items
  const upNextItems = useMemo(() => {
    const pool = displayedVideos.length > 1 ? displayedVideos : feedItems;
    if (!activeItem) return pool;
    return pool.filter((item) => item.videoId !== activeItem.videoId);
  }, [activeItem, displayedVideos, feedItems]);

  const safeActiveVideoId =
    activeItem && VALID_VIDEO_ID.test(activeItem.videoId)
      ? activeItem.videoId
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="YouTube ทีวีห้องพักผ่อน"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0C0A09]/82 p-3 backdrop-blur-xs sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border-2 border-[#3E342C] bg-[#0F0F0F] text-[#F1F1F1] shadow-2xl"
      >
        {/* YouTube App Header Bar */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#272727] bg-[#0F0F0F] px-4 py-3 sm:px-5">
          {/* Left: Brand or Back to Feed */}
          <div className="flex items-center gap-3">
            {activeItem ? (
              <button
                type="button"
                onClick={onBackToFeed}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#222222] px-3 text-xs font-semibold text-[#F1F1F1] transition-colors hover:bg-[#303030]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>หน้า Feed</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-9 items-center justify-center rounded-lg bg-[#FF0000] text-white">
                  <Play className="h-3.5 w-3.5 fill-current" />
                </span>
                <span className="font-display text-base font-bold tracking-tight text-white">
                  YouTube
                </span>
                <span aria-hidden="true" className="hidden text-[#555555] md:inline">
                  ·
                </span>
                <span className="hidden text-xs text-[#AAAAAA] md:inline">
                  ทีวีห้องพักผ่อน
                </span>
              </div>
            )}
          </div>

          {/* Center: Search YouTube or Paste Any Link */}
          <form
            onSubmit={handleSearchSubmit}
            className="order-3 flex w-full items-center gap-2 sm:order-2 sm:max-w-md sm:flex-1"
          >
            <div className="relative flex flex-1 items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#888888]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAuthenticated
                    ? 'ค้นหา YouTube จริง หรือวางลิงก์วิดีโอ...'
                    : 'ค้นหาในฟีด หรือวางลิงก์ YouTube เพื่อเปิดดู...'
                }
                className="h-9 w-full rounded-lg border border-[#303030] bg-[#121212] pr-3 pl-9 text-xs text-[#F1F1F1] placeholder:text-[#7A7A7A] focus:border-[#D97736] focus:outline-none"
              />
            </div>
            {(detectedVideoId || (isAuthenticated && searchQuery.trim().length > 0)) && (
              <button
                type="submit"
                disabled={isAddingUrl || isLoadingFeed}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#FF0000] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#CC0000] disabled:opacity-60"
              >
                {isAddingUrl || isLoadingFeed ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : detectedVideoId ? (
                  <Plus className="h-3.5 w-3.5" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>{detectedVideoId ? 'เปิดเล่น' : 'ค้นหา'}</span>
              </button>
            )}
          </form>

          {/* Right: Google Account / Sign In + Close TV */}
          <div className="order-2 flex items-center gap-2 sm:order-3">
            {isAuthenticated && googleUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 md:flex">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName || 'Google User'}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full border border-[#383838] object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#332B24] text-xs font-semibold text-[#E6B88A]">
                      {getChannelInitial(googleUser.displayName || googleUser.email || 'U')}
                    </div>
                  )}
                  <span className="max-w-[110px] truncate text-xs font-medium text-[#E5E5E5]">
                    {googleUser.displayName || googleUser.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  title="ออกจากระบบบัญชี Google"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#303030] bg-[#181818] px-2.5 text-xs font-medium text-[#CCCCCC] transition-colors hover:bg-[#282828] hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ออก</span>
                </button>
              </div>
            ) : (
              <GoogleSignInButton
                onClick={onGoogleSignIn}
                disabled={isSigningIn}
                compact
              />
            )}

            {activeItem && (
              <button
                type="button"
                onClick={onBackToFeed}
                aria-label="กลับหน้าแรกฟีด"
                className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#2C2C2C] bg-[#181818] px-3 text-xs font-medium text-[#D4D4D4] transition-colors hover:bg-[#262626] lg:inline-flex"
              >
                <Home className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#303030] bg-[#1E1E1E] px-3 text-xs font-medium text-[#E5E5E5] transition-colors hover:bg-[#2E2E2E]"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ปิดทีวี</span>
            </button>
          </div>
        </header>

        {/* Auth or API Error Banner */}
        {(authError || feedError) && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3E2420] bg-[#241513] px-5 py-2.5 text-xs text-[#F5B4A4]"
          >
            <span>{authError || feedError}</span>
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="cursor-pointer rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#1F1F1F] hover:bg-[#EFEFEF]"
              >
                ลองเข้าสู่ระบบใหม่
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void loadTabFeed(selectedTab, true)}
                className="cursor-pointer rounded-md bg-[#3B2622] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4D322C]"
              >
                ลองโหลดใหม่
              </button>
            )}
          </div>
        )}

        {/* VIEW 1: YouTube Home Feed Grid */}
        {!activeItem ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Category & Personal Feed Tabs */}
            <nav
              aria-label="หมวดหมู่ฟีด YouTube"
              className="cozy-scroll flex shrink-0 items-center justify-between gap-3 overflow-x-auto border-b border-[#222222] bg-[#0F0F0F] px-5 py-3"
            >
              <div className="flex items-center gap-2">
                {isAuthenticated && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenedPlaylist(null);
                        setSelectedTab('subscriptions');
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                        selectedTab === 'subscriptions'
                          ? 'bg-[#FF0000] text-white'
                          : 'bg-[#222222] text-[#E5E5E5] hover:bg-[#323232]'
                      }`}
                    >
                      <Tv className="h-3.5 w-3.5" />
                      <span>ฟีดติดตาม</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenedPlaylist(null);
                        setSelectedTab('liked');
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                        selectedTab === 'liked'
                          ? 'bg-[#FF0000] text-white'
                          : 'bg-[#222222] text-[#E5E5E5] hover:bg-[#323232]'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>วิดีโอที่ถูกใจ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenedPlaylist(null);
                        setSelectedTab('playlists');
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                        selectedTab === 'playlists'
                          ? 'bg-[#FF0000] text-white'
                          : 'bg-[#222222] text-[#E5E5E5] hover:bg-[#323232]'
                      }`}
                    >
                      <ListVideo className="h-3.5 w-3.5" />
                      <span>เพลย์ลิสต์ของฉัน</span>
                    </button>
                    {lastSearchKeyword && (
                      <button
                        type="button"
                        onClick={() => setSelectedTab('search')}
                        className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                          selectedTab === 'search'
                            ? 'bg-[#F1F1F1] text-[#0F0F0F]'
                            : 'bg-[#222222] text-[#E5E5E5] hover:bg-[#323232]'
                        }`}
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span>ค้นหา: {lastSearchKeyword.slice(0, 14)}</span>
                      </button>
                    )}
                    <span aria-hidden="true" className="mx-1 h-4 w-px bg-[#2C2C2C]" />
                  </>
                )}

                {CURATED_TABS.map((tab) => {
                  const active = selectedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setOpenedPlaylist(null);
                        setSelectedTab(tab.id);
                      }}
                      className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                        active
                          ? 'bg-[#F1F1F1] text-[#0F0F0F]'
                          : 'bg-[#222222] text-[#E5E5E5] hover:bg-[#323232]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {isAuthenticated &&
                ['subscriptions', 'liked', 'playlists'].includes(selectedTab) && (
                  <button
                    type="button"
                    onClick={() => void loadTabFeed(selectedTab, true)}
                    disabled={isLoadingFeed}
                    title="รีเฟรชฟีดจาก YouTube"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1C1C1C] px-2.5 py-1.5 text-xs font-medium text-[#CCCCCC] transition-colors hover:bg-[#2A2A2A] hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isLoadingFeed ? 'animate-spin' : ''}`}
                    />
                    <span className="hidden sm:inline">รีเฟรช</span>
                  </button>
                )}
            </nav>

            {/* Main Scrollable Feed Content */}
            <div className="cozy-scroll flex-1 overflow-y-auto p-5">
              {/* Sign-in invite strip when not connected to YouTube */}
              {!isAuthenticated && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#2B2520] bg-[#181513] px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#FAF6F0]">
                      เชื่อมต่อบัญชี YouTube เพื่อรับฟีดส่วนตัวของคุณ
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#A89C90]">
                      ดูวิดีโอล่าสุดจากช่องที่กดติดตาม วิดีโอที่กดถูกใจ เพลย์ลิสต์ส่วนตัว และค้นหาคลิป YouTube จริงได้ทันทีบนทีวีเครื่องนี้
                    </p>
                  </div>
                  <GoogleSignInButton
                    onClick={onGoogleSignIn}
                    disabled={isSigningIn}
                  />
                </div>
              )}

              {/* Playlist Back Header when browsing inside a playlist */}
              {selectedTab === 'playlists' && openedPlaylist && (
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#242424] pb-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenedPlaylist(null)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#222222] px-3 py-1.5 text-xs font-semibold text-[#F1F1F1] hover:bg-[#303030]"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>เพลย์ลิสต์ทั้งหมด</span>
                    </button>
                    <h3 className="font-display text-sm font-semibold text-white">
                      {openedPlaylist.title}
                    </h3>
                  </div>
                  <span className="text-xs tabular-nums text-[#9E9E9E]">
                    {playlistVideos.length} วิดีโอ
                  </span>
                </div>
              )}

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
            </div>
          </div>
        ) : (
          /* VIEW 2: YouTube Watch View (Player + Up Next Feed Sidebar) */
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
        )}
      </div>
    </div>
  );
}

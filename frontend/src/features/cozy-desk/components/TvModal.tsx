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
} from '../api/youtubeApi';
import { cozyApiFetch } from '../api/cozyApi';

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

import {
  CURATED_TABS,
  extractYouTubeVideoId,
  type FeedTabId,
  getChannelInitial,
  GoogleSignInButton,
  TvFeedGridSection,
  TvWatchViewSection,
  VALID_VIDEO_ID,
} from './TvModalSubsections';
export { extractYouTubeVideoId };

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

              <TvFeedGridSection
                isLoadingFeed={isLoadingFeed}
                selectedTab={selectedTab}
                openedPlaylist={openedPlaylist}
                playlists={playlists}
                handleOpenPlaylist={handleOpenPlaylist}
                failedThumbs={failedThumbs}
                handleThumbError={handleThumbError}
                displayedVideos={displayedVideos}
                isAuthenticated={isAuthenticated}
                onSelectItem={onSelectItem}
                onDeleteCustomItem={onDeleteCustomItem}
              />
            </div>
          </div>
        ) : (
          <TvWatchViewSection
            safeActiveVideoId={safeActiveVideoId}
            activeItem={activeItem}
            onBackToFeed={onBackToFeed}
            upNextItems={upNextItems}
            failedThumbs={failedThumbs}
            handleThumbError={handleThumbError}
            onSelectItem={onSelectItem}
          />
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ChevronRight,
  ExternalLink,
  File,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Presentation,
  RefreshCw,
  Search,
  Star,
  X,
} from 'lucide-react';
import type { GoogleDriveFile } from '../types/game';
import {
  DRIVE_DOC_MIME,
  DRIVE_FOLDER_MIME,
  DRIVE_SHEET_MIME,
  DRIVE_SLIDE_MIME,
  type DriveCategoryFilter,
  fetchDriveFiles,
  GoogleDriveApiError,
  isPreviewableDriveFile,
  previewDriveFileText,
} from '../utils/driveApi';

interface DriveTableModalProps {
  googleUser: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  authError: string | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onTokenExpired: () => void;
  onClose: () => void;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

function formatThaiDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatBytes(sizeStr?: string): string | null {
  if (!sizeStr) return null;
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeMeta(mimeType: string): {
  label: string;
  badgeColor: string;
  Icon: typeof File;
} {
  if (mimeType === DRIVE_FOLDER_MIME) {
    return { label: 'โฟลเดอร์', badgeColor: 'text-[#B57A2D] bg-[#FBF2E1]', Icon: Folder };
  }
  if (mimeType === DRIVE_DOC_MIME) {
    return { label: 'Google Docs', badgeColor: 'text-[#2B6CB0] bg-[#EBF4FF]', Icon: FileText };
  }
  if (mimeType === DRIVE_SHEET_MIME) {
    return { label: 'Google Sheets', badgeColor: 'text-[#2F7A54] bg-[#E8F5EE]', Icon: FileSpreadsheet };
  }
  if (mimeType === DRIVE_SLIDE_MIME) {
    return { label: 'Google Slides', badgeColor: 'text-[#C07A1D] bg-[#FEF6E6]', Icon: Presentation };
  }
  if (mimeType === 'application/pdf') {
    return { label: 'PDF', badgeColor: 'text-[#B8412C] bg-[#FDEEEB]', Icon: FileText };
  }
  if (mimeType.startsWith('image/')) {
    return { label: 'รูปภาพ', badgeColor: 'text-[#6B4E9B] bg-[#F3EEFA]', Icon: ImageIcon };
  }
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return { label: 'โน้ต / ข้อความ', badgeColor: 'text-[#4D7C6F] bg-[#EDF5F2]', Icon: FileCode2 };
  }
  return { label: 'ไฟล์', badgeColor: 'text-[#6E6258] bg-[#F2ECE3]', Icon: File };
}

function GoogleSignInButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-[#DADCE0] bg-white px-4 text-sm font-medium text-[#1F1F1F] shadow-xs transition-colors duration-150 hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60"
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

const CATEGORIES: ReadonlyArray<{ id: DriveCategoryFilter; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'folders', label: 'โฟลเดอร์' },
  { id: 'docs', label: 'เอกสาร' },
  { id: 'sheets', label: 'สเปรดชีต' },
  { id: 'pdfs', label: 'PDF' },
  { id: 'starred', label: 'ติดดาว' },
];

export function DriveTableModal({
  googleUser,
  accessToken,
  isSigningIn,
  authError,
  onGoogleSignIn,
  onGoogleSignOut,
  onTokenExpired,
  onClose,
}: DriveTableModalProps) {
  const isAuthenticated = Boolean(googleUser && accessToken);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [category, setCategory] = useState<DriveCategoryFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Selected file & live text preview
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof GoogleDriveApiError) {
        if (err.status === 401 || err.status === 403) {
          onTokenExpired();
        }
        setApiError(err.message);
      } else {
        setApiError('ไม่สามารถเชื่อมต่อกับ Google Drive ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    },
    [onTokenExpired]
  );

  const loadFiles = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const list = await fetchDriveFiles(accessToken, {
        folderId: category === 'all' && !activeSearch ? currentFolder.id : null,
        searchQuery: activeSearch,
        category,
      });
      setFiles(list);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, activeSearch, category, currentFolder.id, handleApiError]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadFiles();
    } else {
      setFiles([]);
      setSelectedFile(null);
      setPreviewText(null);
      setApiError(null);
    }
  }, [isAuthenticated, loadFiles]);

  const handleOpenFileOrFolder = async (file: GoogleDriveFile) => {
    if (file.mimeType === DRIVE_FOLDER_MIME) {
      setActiveSearch('');
      setSearchInput('');
      setCategory('all');
      setSelectedFile(null);
      setPreviewText(null);
      setPreviewError(null);
      setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
      return;
    }

    setSelectedFile(file);
    setPreviewText(null);
    setPreviewError(null);

    if (!accessToken || !isPreviewableDriveFile(file.mimeType)) {
      return;
    }

    setIsLoadingPreview(true);
    try {
      const text = await previewDriveFileText(accessToken, file);
      setPreviewText(text);
    } catch (err) {
      if (err instanceof GoogleDriveApiError && (err.status === 401 || err.status === 403)) {
        onTokenExpired();
      }
      setPreviewError(
        err instanceof Error ? err.message : 'ไม่สามารถโหลดตัวอย่างเนื้อหาไฟล์นี้ได้'
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCategory('all');
    setActiveSearch('');
    setSearchInput('');
    setSelectedFile(null);
    setPreviewText(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
    setSelectedFile(null);
    setPreviewText(null);
  };

  const selectedMeta = useMemo(
    () => (selectedFile ? getFileTypeMeta(selectedFile.mimeType) : null),
    [selectedFile]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="โต๊ะเอกสารกลางห้อง Google Drive"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0C0A09]/80 p-3 backdrop-blur-xs sm:p-6"
    >
      {/* Oak Desk-Folio Framed Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-4 border-[#69462D] bg-[#FAF6F0] text-[#29221D] shadow-2xl"
      >
        {/* Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#D8C5AE] bg-[#EFE5D7] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D97736] text-[#FAF6F0]">
              <HardDrive className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-bold text-[#29221D]">
                โต๊ะเอกสารกลางห้อง · Google Drive
              </h2>
              <p className="truncate text-xs text-[#6E6258]">
                เปิดอ่าน ค้นหาเอกสาร สมุดบันทึก และโฟลเดอร์จาก Google Drive ของคุณ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && googleUser && (
              <>
                <button
                  type="button"
                  onClick={() => void loadFiles()}
                  disabled={isLoading}
                  title="รีเฟรชรายการไฟล์"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] text-[#52473E] transition-colors hover:bg-[#E7DCCE] disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  title="ออกจากระบบบัญชี Google"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-2.5 text-xs font-medium text-[#52473E] transition-colors hover:bg-[#E7DCCE]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ออกจากระบบ</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-3 text-xs font-semibold text-[#3D342D] transition-colors hover:bg-[#E7DCCE]"
            >
              <X className="h-3.5 w-3.5" />
              <span>ปิดโต๊ะเอกสาร</span>
            </button>
          </div>
        </header>

        {/* Auth or API Error Strip */}
        {(authError || apiError) && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFB4A8] bg-[#FDF2EF] px-5 py-2.5 text-xs text-[#8C2F1B]"
          >
            <span>{authError || apiError}</span>
            <button
              type="button"
              onClick={isAuthenticated ? () => void loadFiles() : onGoogleSignIn}
              className="cursor-pointer rounded-md bg-[#8C2F1B] px-3 py-1 font-semibold text-white hover:bg-[#732515]"
            >
              {isAuthenticated ? 'ลองโหลดใหม่' : 'Sign in with Google'}
            </button>
          </div>
        )}

        {/* Unauthenticated Sign-In View */}
        {!isAuthenticated ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-5 rounded-2xl border border-[#DFD2C0] bg-white p-8 shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#FDF2E7] text-[#D97736]">
                <HardDrive className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-[#29221D]">
                  เชื่อมต่อโต๊ะเอกสารกับ Google Drive
                </h3>
                <p className="text-sm leading-relaxed text-[#6E6258]">
                  เข้าสู่ระบบด้วยบัญชี Google เพื่อเปิดดูเอกสาร โฟลเดอร์ สมุดบันทึก และไฟล์ใน Google Drive ของคุณได้โดยตรงจากโต๊ะทำงานกลางห้อง
                </p>
              </div>
              <div className="pt-1">
                <GoogleSignInButton onClick={onGoogleSignIn} disabled={isSigningIn} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Search & Filter Toolbar */}
            <div className="flex shrink-0 flex-col gap-2.5 border-b border-[#E2D9CC] bg-[#F6EFE5] px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <form onSubmit={handleSearchSubmit} className="flex min-w-[220px] flex-1 items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8E8074]" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="ค้นหาเอกสาร สมุดบันทึก หรือโฟลเดอร์ใน Google Drive..."
                      className="h-9 w-full rounded-lg border border-[#D4C6B4] bg-white pr-8 pl-8.5 text-xs text-[#29221D] placeholder:text-[#96897D] focus:border-[#D97736] focus:outline-none"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput('');
                          setActiveSearch('');
                        }}
                        aria-label="ล้างคำค้นหา"
                        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-[#8E8074] hover:text-[#29221D]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="h-9 cursor-pointer rounded-lg border border-[#D4C6B4] bg-[#FAF6F0] px-3 text-xs font-semibold text-[#3D342D] transition-colors hover:bg-[#E7DCCE]"
                  >
                    ค้นหา
                  </button>
                </form>

                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4C6B4] bg-[#FAF6F0] px-3 text-xs font-semibold text-[#3D342D] transition-colors hover:bg-[#E7DCCE]"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#D97736]" />
                  <span>เปิด Google Drive</span>
                </a>
              </div>

              {/* Breadcrumbs + Category Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <nav
                  aria-label="ตำแหน่งโฟลเดอร์"
                  className="flex flex-wrap items-center gap-1 text-xs text-[#6E6258]"
                >
                  {breadcrumbs.map((crumb, idx) => {
                    const isLast = idx === breadcrumbs.length - 1;
                    return (
                      <span key={`${crumb.id ?? 'root'}-${idx}`} className="inline-flex items-center gap-1">
                        {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#A89C90]" />}
                        <button
                          type="button"
                          onClick={() => handleBreadcrumbClick(idx)}
                          className={`cursor-pointer rounded px-1.5 py-0.5 transition-colors ${
                            isLast && !activeSearch && category === 'all'
                              ? 'font-semibold text-[#29221D]'
                              : 'hover:bg-[#E8DDD0] hover:text-[#29221D]'
                          }`}
                        >
                          {crumb.name}
                        </button>
                      </span>
                    );
                  })}
                  {activeSearch && (
                    <span className="ml-1 text-[#D97736]">
                      · ผลการค้นหา “{activeSearch}”
                    </span>
                  )}
                </nav>

                <div className="cozy-scroll flex items-center gap-1 overflow-x-auto rounded-lg bg-[#EAE0D3] p-0.5">
                  {CATEGORIES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCategory(item.id);
                        setSelectedFile(null);
                        setPreviewText(null);
                      }}
                      className={`cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        category === item.id
                          ? 'bg-[#FAF6F0] text-[#29221D] shadow-xs'
                          : 'text-[#6E6258] hover:text-[#29221D]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Desk Content: File List + Document Preview Pane */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Left: Drive Files & Folders */}
              <div className="cozy-scroll flex-1 overflow-y-auto bg-[#F3E9DC] p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#6E6258]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#D97736]" />
                    <span>กำลังหยิบเอกสารจาก Google Drive...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-xl border border-[#DFD2C0] bg-[#FAF6F0] p-8 text-center">
                    <p className="text-sm font-semibold text-[#29221D]">
                      ไม่พบเอกสารหรือไฟล์ในหมวดหมู่นี้
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#6E6258]">
                      ลองเปลี่ยนหมวดหมู่หรือค้นหาด้วยคำอื่นเพื่อเรียกดูเอกสารใน Google Drive ครับ
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {files.map((file) => {
                      const meta = getFileTypeMeta(file.mimeType);
                      const FileIcon = meta.Icon;
                      const isSelected = selectedFile?.id === file.id;
                      const sizeLabel = formatBytes(file.size);

                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => void handleOpenFileOrFolder(file)}
                          className={`group flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                            isSelected
                              ? 'border-[#D97736] bg-[#FFFDF7] shadow-xs'
                              : 'border-[#E3D5C2] bg-[#FAF6F0] hover:border-[#C9B399] hover:bg-[#FFFDF7]'
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.badgeColor}`}
                          >
                            <FileIcon className="h-4 w-4" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-semibold text-[#29221D]">
                                {file.name}
                              </p>
                              {file.starred && (
                                <Star className="h-3.5 w-3.5 shrink-0 fill-[#E2A84B] text-[#E2A84B]" />
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-[#7D7065]">
                              <span>{meta.label}</span>
                              <span>·</span>
                              <span>อัปเดต {formatThaiDate(file.modifiedTime)}</span>
                              {sizeLabel && (
                                <>
                                  <span>·</span>
                                  <span>{sizeLabel}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: Selected Document Reading Sheet */}
              {selectedFile && selectedMeta && (
                <aside className="flex h-[44%] w-full shrink-0 flex-col border-t border-[#D8C5AE] bg-[#FFFDF7] md:h-full md:w-[340px] md:border-t-0 md:border-l lg:w-[380px]">
                  <div className="flex items-start justify-between gap-2 border-b border-[#EAE0D3] px-4 py-3.5">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${selectedMeta.badgeColor}`}
                      >
                        {selectedMeta.label}
                      </span>
                      <h3 className="mt-1.5 break-words text-sm font-bold leading-snug text-[#29221D]">
                        {selectedFile.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-[#7D7065]">
                        แก้ไขล่าสุด {formatThaiDate(selectedFile.modifiedTime)}
                        {selectedFile.ownerName ? ` · ${selectedFile.ownerName}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewText(null);
                        setPreviewError(null);
                      }}
                      aria-label="ปิดหน้าต่างตัวอย่าง"
                      className="cursor-pointer rounded p-1 text-[#8E8074] hover:bg-[#EFE5D7] hover:text-[#29221D]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="cozy-scroll flex-1 overflow-y-auto px-4 py-3.5">
                    {isLoadingPreview ? (
                      <div className="flex items-center gap-2 py-8 text-xs text-[#6E6258]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#D97736]" />
                        <span>กำลังเปิดอ่านเนื้อหาเอกสาร...</span>
                      </div>
                    ) : previewError ? (
                      <p className="rounded-lg border border-[#E8CFC7] bg-[#FDF2EF] p-3 text-xs leading-relaxed text-[#8C2F1B]">
                        {previewError}
                      </p>
                    ) : previewText !== null ? (
                      <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-[#3B312A]">
                        {previewText.trim() || '(เอกสารนี้ยังไม่มีข้อความ)'}
                      </pre>
                    ) : (
                      <div className="rounded-xl border border-[#EAE0D3] bg-[#FAF6F0] p-4 text-xs leading-relaxed text-[#6E6258]">
                        ไฟล์ประเภท <strong>{selectedMeta.label}</strong> สามารถเปิดดูแบบเต็มรูปแบบได้โดยตรงบน Google Drive ด้วยปุ่มด้านล่างครับ
                      </div>
                    )}
                  </div>

                  {selectedFile.webViewLink && (
                    <div className="shrink-0 border-t border-[#EAE0D3] bg-[#FAF6F0] p-3.5">
                      <a
                        href={selectedFile.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#29221D] px-4 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#3F342C]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>เปิดใน Google Drive</span>
                      </a>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

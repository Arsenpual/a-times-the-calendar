import {
  ChevronRight,
  Folder,
  HardDrive,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  Star,
  X,
} from 'lucide-react';
import { DRIVE_FOLDER_MIME } from '../api/driveApi';

export interface DriveBreadcrumbItem {
  id: string | null;
  name: string;
}

export function formatThaiShortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export function formatDriveFileSize(sizeStr?: string): string | null {
  if (!sizeStr) return null;
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseOptionalNum(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}


export function SleepDriveImagePicker({
  showDrivePicker,
  setShowDrivePicker,
  isAuthenticated,
  loadDrivePickerItems,
  isLoadingDrive,
  downloadingDriveFileId,
  authError,
  driveError,
  setDriveError,
  onGoogleSignIn,
  isSigningIn,
  driveViewMode,
  setDriveViewMode,
  handleDriveSearchSubmit,
  driveSearchInput,
  setDriveSearchInput,
  driveActiveSearch,
  setDriveActiveSearch,
  driveBreadcrumbs,
  handleDriveBreadcrumbClick,
  driveItems,
  isExtracting,
  handleSelectDriveItem,
}: any) {
  return (
    <>
                {/* Inline Google Drive Image Picker Panel */}
                {showDrivePicker && (
                  <div className="flex flex-col overflow-hidden rounded-xl border border-[#4D446A] bg-[#1C1824] shadow-lg">
                    {/* Picker Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#322C45] bg-[#242031] px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <HardDrive className="h-4 w-4 shrink-0 text-[#A5B4FC]" />
                        <span className="truncate text-xs font-semibold text-[#FAF6F0]">
                          เลือกรูปภาพการนอนจาก Google Drive
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isAuthenticated && (
                          <button
                            type="button"
                            onClick={() => void loadDrivePickerItems()}
                            disabled={isLoadingDrive || Boolean(downloadingDriveFileId)}
                            title="รีเฟรชรายการรูปภาพจาก Google Drive"
                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#3E3756] bg-[#1B1726] text-[#C7D2FE] transition-colors hover:border-[#6366F1] hover:text-white disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`}
                            />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowDrivePicker(false)}
                          aria-label="ปิดหน้าต่างเลือกภาพจาก Google Drive"
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#3E3756] bg-[#1B1726] text-[#A89C90] transition-colors hover:border-[#6366F1] hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Error Alert inside Drive Picker */}
                    {(authError || driveError) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#7F1D1D] bg-[#2B1717] px-3.5 py-2 text-xs text-[#FCA5A5]">
                        <span>{driveError || authError}</span>
                        {isAuthenticated ? (
                          <button
                            type="button"
                            onClick={() => void loadDrivePickerItems()}
                            className="cursor-pointer rounded bg-[#7F1D1D] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#991B1B]"
                          >
                            ลองใหม่
                          </button>
                        ) : (
                          onGoogleSignIn && (
                            <button
                              type="button"
                              onClick={onGoogleSignIn}
                              disabled={isSigningIn}
                              className="cursor-pointer rounded bg-[#7F1D1D] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#991B1B]"
                            >
                              Sign in with Google
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {!isAuthenticated ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-5 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2A243B] text-[#A5B4FC]">
                          <HardDrive className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-[#FAF6F0]">
                            เชื่อมต่อบัญชี Google เพื่อเลือกรูปภาพจาก Drive
                          </p>
                          <p className="text-[11px] leading-relaxed text-[#A89C90]">
                            เปิดดูรูปภาพหน้าจอสถิติการนอนที่ซิงก์ไว้ใน Google Drive ของคุณ แล้วนำมาสกัดเป็นไฟล์ .json ได้ทันที
                          </p>
                        </div>
                        {onGoogleSignIn ? (
                          <button
                            type="button"
                            onClick={onGoogleSignIn}
                            disabled={isSigningIn}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1F1F] shadow-xs transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <HardDrive className="h-3.5 w-3.5 text-[#4F46E5]" />
                            <span>
                              {isSigningIn ? 'กำลังเข้าสู่ระบบ Google...' : 'Sign in with Google'}
                            </span>
                          </button>
                        ) : (
                          <p className="text-[11px] text-[#FBBF24]">
                            กรุณาเข้าสู่ระบบ Google จากมุมขวาบนหรือโต๊ะเอกสารกลางห้องก่อนใช้งาน
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {/* View Mode Tabs & Search */}
                        <div className="flex flex-col gap-2 border-b border-[#2D273D] bg-[#201C2C] p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {(
                              [
                                { id: 'recent_images', label: 'รูปภาพล่าสุด' },
                                { id: 'folders', label: 'เปิดตามโฟลเดอร์' },
                                { id: 'starred_images', label: 'ติดดาว' },
                              ] as const
                            ).map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                  setDriveViewMode(tab.id);
                                  setDriveError(null);
                                }}
                                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                  driveViewMode === tab.id
                                    ? 'bg-[#4F46E5] text-white'
                                    : 'bg-[#171320] text-[#B5A89C] hover:text-[#FAF6F0]'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          <form
                            onSubmit={handleDriveSearchSubmit}
                            className="flex items-center gap-1.5"
                          >
                            <div className="relative flex-1">
                              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#8E8277]" />
                              <input
                                type="text"
                                value={driveSearchInput}
                                onChange={(e) => setDriveSearchInput(e.target.value)}
                                placeholder="ค้นหาชื่อรูปภาพหรือโฟลเดอร์ใน Drive..."
                                className="h-8 w-full rounded-lg border border-[#3B3452] bg-[#15121D] pr-7 pl-8 text-xs text-[#FAF6F0] placeholder:text-[#7D7268] focus:border-[#818CF8] focus:outline-none"
                              />
                              {driveSearchInput && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDriveSearchInput('');
                                    setDriveActiveSearch('');
                                  }}
                                  aria-label="ล้างคำค้นหาใน Google Drive"
                                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-[#8E8277] hover:text-white"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <button
                              type="submit"
                              className="h-8 cursor-pointer rounded-lg border border-[#453D5E] bg-[#282338] px-2.5 text-xs font-medium text-[#E0E7FF] transition-colors hover:border-[#6366F1] hover:text-white"
                            >
                              ค้นหา
                            </button>
                          </form>

                          {/* Folder Breadcrumbs when browsing folders */}
                          {(driveViewMode === 'folders' || driveActiveSearch) && (
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#A89C90]">
                              {driveViewMode === 'folders' &&
                                driveBreadcrumbs.map((crumb, idx) => {
                                  const isLast = idx === driveBreadcrumbs.length - 1;
                                  return (
                                    <span
                                      key={`${crumb.id ?? 'root'}-${idx}`}
                                      className="inline-flex items-center gap-1"
                                    >
                                      {idx > 0 && (
                                        <ChevronRight className="h-3 w-3 text-[#6F655E]" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDriveBreadcrumbClick(idx)}
                                        className={`cursor-pointer rounded px-1 py-0.5 transition-colors ${
                                          isLast && !driveActiveSearch
                                            ? 'font-semibold text-[#C7D2FE]'
                                            : 'hover:bg-[#2C263D] hover:text-white'
                                        }`}
                                      >
                                        {crumb.name}
                                      </button>
                                    </span>
                                  );
                                })}
                              {driveActiveSearch && (
                                <span className="text-[#A5B4FC]">
                                  · ผลการค้นหา “{driveActiveSearch}”
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* File / Image List */}
                        <div className="max-h-72 overflow-y-auto p-2.5">
                          {isLoadingDrive ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-xs text-[#A89C90]">
                              <Loader2 className="h-4 w-4 animate-spin text-[#818CF8]" />
                              <span>กำลังโหลดรายการรูปภาพจาก Google Drive...</span>
                            </div>
                          ) : driveItems.length === 0 ? (
                            <div className="py-8 text-center text-xs text-[#9C9084]">
                              ไม่พบรูปภาพหรือโฟลเดอร์ในมุมมองนี้ ลองเปลี่ยนแท็บหรือค้นหาด้วยชื่อไฟล์
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {driveItems.map((item) => {
                                const isFolder = item.mimeType === DRIVE_FOLDER_MIME;
                                const isDownloadingThis = downloadingDriveFileId === item.id;
                                const sizeText = formatDriveFileSize(item.size);

                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    disabled={Boolean(downloadingDriveFileId) || isExtracting}
                                    onClick={() => void handleSelectDriveItem(item)}
                                    className={`group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isDownloadingThis
                                        ? 'border-[#818CF8] bg-[#2B2640]'
                                        : 'border-[#2E283E] bg-[#16131F] hover:border-[#6366F1] hover:bg-[#221D30]'
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      {isFolder ? (
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2E251A] text-[#FBBF24]">
                                          <Folder className="h-4 w-4" />
                                        </span>
                                      ) : item.thumbnailLink ? (
                                        <img
                                          src={item.thumbnailLink}
                                          alt={item.name}
                                          referrerPolicy="no-referrer"
                                          className="h-10 w-10 shrink-0 rounded-lg border border-[#38314B] bg-[#0F0D15] object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#262138] text-[#A5B4FC]">
                                          <ImagePlus className="h-4 w-4" />
                                        </span>
                                      )}

                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="truncate text-xs font-medium text-[#FAF6F0]">
                                            {item.name}
                                          </span>
                                          {item.starred && (
                                            <Star className="h-3 w-3 shrink-0 fill-[#FBBF24] text-[#FBBF24]" />
                                          )}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-[#9C9084]">
                                          <span>{isFolder ? 'โฟลเดอร์' : 'รูปภาพ'}</span>
                                          <span>·</span>
                                          <span>{formatThaiShortDate(item.modifiedTime)}</span>
                                          {sizeText && (
                                            <>
                                              <span>·</span>
                                              <span>{sizeText}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="shrink-0">
                                      {isDownloadingThis ? (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-[#4F46E5] px-2 py-1 text-[11px] font-semibold text-white">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          <span>กำลังดึงภาพ...</span>
                                        </span>
                                      ) : isFolder ? (
                                        <span className="inline-flex items-center gap-0.5 text-[11px] text-[#A89C90] group-hover:text-[#FAF6F0]">
                                          <span>เปิด</span>
                                          <ChevronRight className="h-3.5 w-3.5" />
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-md border border-[#433B5C] bg-[#252036] px-2 py-1 text-[11px] font-medium text-[#C7D2FE] group-hover:border-[#818CF8] group-hover:bg-[#4F46E5] group-hover:text-white">
                                          เลือกภาพนี้
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

    </>
  );
}

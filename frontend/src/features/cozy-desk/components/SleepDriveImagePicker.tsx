import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileJson,
  Folder,
  HardDrive,
  ImagePlus,
  Loader2,
  Moon,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DRIVE_FOLDER_MIME } from '../api/driveApi';
import { getLocalIsoDate } from '../api/sleepLogsApi';
import type { DailySleepRecord } from '../types/game';

export interface DriveBreadcrumbItem {
  id: string | null;
  name: string;
}

export function createEmptyManualSleepDraft(dateIso = getLocalIsoDate()): DailySleepRecord {
  const nowIso = new Date().toISOString();
  return {
    id: `sleep_${dateIso}`,
    date: dateIso,
    dateLabel: dateIso,
    sourceApp: 'Huawei Health',
    userLabel: null,
    sleepScore: null,
    percentileBeat: null,
    bedtime: null,
    wakeTime: null,
    totalSleepMinutes: null,
    totalSleepText: null,
    totalSleepStatus: null,
    totalSleepReference: null,
    stages: {
      deep: { minutes: null, durationText: null, percent: null, status: null, referenceRange: null },
      light: { minutes: null, durationText: null, percent: null, status: null, referenceRange: null },
      rem: { minutes: null, durationText: null, percent: null, status: null, referenceRange: null },
    },
    deepSleepContinuityScore: null,
    deepSleepContinuityStatus: null,
    deepSleepContinuityReference: null,
    awakeCount: null,
    awakeStatus: null,
    awakeReference: null,
    breathingQualityScore: null,
    breathingQualityStatus: null,
    breathingQualityReference: null,
    previousDayStressScore: null,
    appInsights: [],
    appRecommendation: null,
    scanSummary: null,
    rawInfographic: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function SleepQuestModalHeader({
  hasLoggedToday,
  todaySleepLabel,
  logsCount,
  avgScore,
  activeTab,
  setActiveTab,
  onClose,
  statusMessage,
  statusTone,
  setStatusMessage,
}: any) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#342B26] bg-[#251F1B] px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#433E68] bg-[#26233A] text-[#A5B4FC]">
            <Moon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-[#FAF6F0]">
              ภารกิจห้องนอน · สแกนและบันทึกข้อมูลการนอน (.json)
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#A89C90]">
              <span
                className={
                  hasLoggedToday
                    ? 'font-medium text-[#6EE7B7] tabular-nums'
                    : 'font-medium text-[#FBBF24]'
                }
              >
                {hasLoggedToday
                  ? `วันนี้สำเร็จแล้ว · ${todaySleepLabel ?? 'บันทึกการนอนแล้ว'}`
                  : 'ยังไม่ได้อัปโหลดวันนี้ (อย่างน้อยวันละ 1 ครั้ง)'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">รีเซ็ต 00:00 น.</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">สะสม {logsCount} วัน</span>
              {avgScore != null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">เฉลี่ย {avgScore} คะแนน</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="มุมมองบันทึกการนอน"
            className="flex items-center gap-1 rounded-lg border border-[#3B312B] bg-[#191512] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-[#4F46E5] text-white'
                  : 'text-[#B5A89C] hover:text-[#FAF6F0]'
              }`}
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>สแกนภาพ → JSON</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-[#4F46E5] text-white'
                  : 'text-[#B5A89C] hover:text-[#FAF6F0]'
              }`}
            >
              <FileJson className="h-3.5 w-3.5 shrink-0" />
              <span className="tabular-nums">คลัง .json ({logsCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างบันทึกการนอน"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#3E332C] bg-[#2B2420] text-[#B8ABA0] transition-colors hover:border-[#5D4C42] hover:text-[#FAF6F0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center justify-between gap-3 border-b px-6 py-2.5 text-xs ${
            statusTone === 'warning'
              ? 'border-[#78531B] bg-[#2B2214] text-[#FDE68A]'
              : 'border-[#2C4438] bg-[#1A2922] text-[#A7F3D0]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusTone === 'warning' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#FBBF24]" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
            )}
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="cursor-pointer opacity-80 hover:opacity-100"
          >
            ปิด
          </button>
        </div>
      )}
    </>
  );
}

export function SleepUploadPreviewCard({
  previewUrl,
  isDraggingFile,
  setIsDraggingFile,
  handleFileSelected,
  isExtracting,
  cancelExtraction,
  fileInputRef,
  showDrivePicker,
  setShowDrivePicker,
  setDriveError,
  selectedSourceLabel,
  handleRemoveUploadedImage,
  extractPhaseText,
  duplicateSkipDate,
  onForceRescan,
}: any) {
  if (!previewUrl) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingFile(false);
          handleFileSelected(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center transition-colors ${
          isDraggingFile
            ? 'border-[#818CF8] bg-[#242138]'
            : 'border-[#4A3E36] bg-[#241E1A] hover:border-[#6A5A4E]'
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2E273B] text-[#A5B4FC]">
          {isExtracting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </div>

        <p className="mt-3 text-sm font-medium text-[#FAF6F0]">
          {isExtracting
            ? 'กำลังเตรียมภาพและสแกนข้อมูลตามมาตรฐาน Huawei Health...'
            : 'อัปโหลดภาพสถิติการนอน (มาตรฐาน Huawei Health)'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#A89C90]">
          ยึดชุดตัวเลขของ Huawei Health เป็นมาตรฐานกลาง — รองรับแอพสุขภาพอื่นโดยสกัดเฉพาะฟิลด์ที่ตรงมาตรฐาน (ค่าที่ไม่มีจะเป็น null และค่านอกมาตรฐานจะถูกข้าม)
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {isExtracting ? (
            <button
              type="button"
              onClick={cancelExtraction}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#7F1D1D] bg-[#2B1717] px-4 py-2 text-xs font-semibold text-[#FCA5A5] transition-colors hover:bg-[#3A1E1E]"
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              <span>ยกเลิกการสแกน</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#D97736] px-4 py-2 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A]"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>เลือกรูปภาพจากเครื่อง</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDriveError(null);
                  setShowDrivePicker((prev: boolean) => !prev);
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  showDrivePicker
                    ? 'border-[#818CF8] bg-[#312B4A] text-white'
                    : 'border-[#54463C] bg-[#2D2621] text-[#FAF6F0] hover:border-[#818CF8] hover:bg-[#352E42]'
                }`}
              >
                <HardDrive className="h-3.5 w-3.5 shrink-0 text-[#A5B4FC]" />
                <span>เลือกจาก Google Drive</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#382F29] bg-[#161210]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2D2520] bg-[#1E1916] px-3.5 py-2.5 text-xs text-[#A89C90]">
        <span className="min-w-0 truncate font-medium text-[#E5DDD3]">
          {selectedSourceLabel ? `ภาพจาก ${selectedSourceLabel}` : 'ภาพต้นฉบับที่อัปโหลด'}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={isExtracting}
            onClick={() => {
              setDriveError(null);
              setShowDrivePicker((prev: boolean) => !prev);
            }}
            className="cursor-pointer whitespace-nowrap text-[#A5B4FC] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            เลือกจาก Drive
          </button>
          <span className="text-[#4A3E36]" aria-hidden="true">·</span>
          <button
            type="button"
            disabled={isExtracting}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer whitespace-nowrap text-[#C7D2FE] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            เปลี่ยนภาพ
          </button>
          <span className="text-[#4A3E36]" aria-hidden="true">·</span>
          <button
            type="button"
            onClick={handleRemoveUploadedImage}
            title="ลบภาพนี้ (เก็บข้อมูลที่สแกนไว้ด้านขวา)"
            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-medium text-[#FCA5A5] transition-colors hover:text-[#FECACA]"
          >
            <Trash2 className="h-3 w-3 shrink-0" />
            <span>ลบภาพ</span>
          </button>
        </div>
      </div>

      {isExtracting && (
        <div className="flex items-center justify-between gap-2 border-b border-[#312B4A] bg-[#211D32] px-3.5 py-2 text-xs text-[#C7D2FE]">
          <div className="flex min-w-0 items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#A5B4FC]" />
            <span className="truncate">{extractPhaseText}</span>
          </div>
          <button
            type="button"
            onClick={cancelExtraction}
            className="shrink-0 cursor-pointer whitespace-nowrap rounded border border-[#7F1D1D] bg-[#2B1717] px-2 py-0.5 text-[11px] font-medium text-[#FCA5A5] hover:bg-[#3A1E1E]"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {duplicateSkipDate && !isExtracting && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#78531B] bg-[#2B2214] px-3.5 py-2 text-xs text-[#FDE68A]">
          <div className="flex min-w-0 items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#FBBF24]" />
            <span>วันที่ {duplicateSkipDate} เคยสแกนไว้แล้ว (ข้ามการสแกนซ้ำ)</span>
          </div>
          <button
            type="button"
            onClick={onForceRescan}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded border border-[#92651E] bg-[#3B2E18] px-2.5 py-1 text-[11px] font-semibold text-[#FEF3C7] transition-colors hover:bg-[#4E3D20]"
          >
            <RefreshCw className="h-3 w-3 shrink-0" />
            <span>สแกนซ้ำเพื่อทับข้อมูลเดิม</span>
          </button>
        </div>
      )}

      <div className="max-h-[460px] overflow-y-auto p-3">
        <img
          src={previewUrl}
          alt="ภาพหน้าจอสถิติการนอนที่อัปโหลด"
          referrerPolicy="no-referrer"
          className="mx-auto w-full max-w-[300px] rounded-lg object-contain"
        />
      </div>
    </div>
  );
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

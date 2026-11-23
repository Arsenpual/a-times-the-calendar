import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  Folder,
  HardDrive,
  ImagePlus,
  Loader2,
  MessageCircle,
  Moon,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { DailySleepRecord, GoogleDriveFile } from '../types/game';
import {
  DRIVE_FOLDER_MIME,
  type DriveImagePickerViewMode,
  downloadDriveImageAsFile,
  fetchDriveImagePickerItems,
  GoogleDriveApiError,
} from '../api/driveApi';
import {
  buildRawSleepInfographic,
  downloadSleepJsonFile,
  extractSleepRecordFromImage,
  formatMinutesToThaiDuration,
  getLocalIsoDate,
  isRawSleepInfographicShape,
  isValidSleepRecordShape,
  parseRawSleepInfographicToRecord,
  prepareImageForSleepExtraction,
  SAMPLE_SLEEP_IMAGE_URL,
} from '../api/sleepLogsApi';
import { soundEngine } from '../lib/sound';

type SleepModalTab = 'upload' | 'history';

interface SleepQuestModalProps {
  logs: DailySleepRecord[];
  hasLoggedToday: boolean;
  todaySleepLabel?: string | null;
  googleUser?: User | null;
  accessToken?: string | null;
  isSigningIn?: boolean;
  authError?: string | null;
  onGoogleSignIn?: () => void;
  onTokenExpired?: () => void;
  onAskMinaAnalyzeSleep?: () => void;
  onSaveLog: (record: DailySleepRecord) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
  onClose: () => void;
}

import {
  type DriveBreadcrumbItem,
  parseOptionalNum,
  SleepDriveImagePicker,
} from './SleepDriveImagePicker';
import {
  SleepDraftEditorColumn,
  SleepHistoryArchiveSection,
} from './SleepQuestSubsections';

export function SleepQuestModal({
  logs,
  hasLoggedToday,
  todaySleepLabel = null,
  googleUser = null,
  accessToken = null,
  isSigningIn = false,
  authError = null,
  onGoogleSignIn,
  onTokenExpired,
  onAskMinaAnalyzeSleep,
  onSaveLog,
  onDeleteLog,
  onClose,
}: SleepQuestModalProps) {
  const isAuthenticated = Boolean(googleUser && accessToken);

  const [activeTab, setActiveTab] = useState<SleepModalTab>(
    logs.length > 0 && hasLoggedToday ? 'history' : 'upload'
  );
  const [selectedId, setSelectedId] = useState<string | null>(logs[0]?.id ?? null);

  // Upload & extraction state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedSourceLabel, setSelectedSourceLabel] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [draftRecord, setDraftRecord] = useState<DailySleepRecord | null>(null);
  const [showRawDraftJson, setShowRawDraftJson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Google Drive image picker state
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveViewMode, setDriveViewMode] = useState<DriveImagePickerViewMode>('recent_images');
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState<DriveBreadcrumbItem[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [driveSearchInput, setDriveSearchInput] = useState('');
  const [driveActiveSearch, setDriveActiveSearch] = useState('');
  const [driveItems, setDriveItems] = useState<GoogleDriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [downloadingDriveFileId, setDownloadingDriveFileId] = useState<string | null>(null);

  // Archive / JSON tools state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);

  const selectedRecord = useMemo(() => {
    if (selectedId) {
      const found = logs.find((r) => r.id === selectedId);
      if (found) return found;
    }
    return logs[0] ?? null;
  }, [logs, selectedId]);

  const multiDayStats = useMemo(() => {
    if (logs.length === 0) return null;
    const scores = logs
      .map((l) => l.sleepScore)
      .filter((n): n is number => typeof n === 'number');
    const durations = logs
      .map((l) => l.totalSleepMinutes)
      .filter((n): n is number => typeof n === 'number' && n > 0);
    const deepPcts = logs
      .map((l) => l.stages.deep.percent)
      .filter((n): n is number => typeof n === 'number');

    return {
      totalDays: logs.length,
      avgScore:
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
      avgMinutes:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
      avgDeepPct:
        deepPcts.length > 0
          ? Math.round(deepPcts.reduce((a, b) => a + b, 0) / deepPcts.length)
          : null,
    };
  }, [logs]);

  const runExtraction = async (source: File | string) => {
    setExtractError(null);
    setStatusMessage(null);
    setIsExtracting(true);
    try {
      const prepared = await prepareImageForSleepExtraction(source);
      setPreviewUrl(prepared.previewDataUrl);
      const { record } = await extractSleepRecordFromImage(
        prepared.imageBase64,
        prepared.mimeType,
        getLocalIsoDate()
      );
      setDraftRecord(record);
      soundEngine.playMessageReceived();
      setStatusMessage('แปลงข้อมูลจากภาพเป็นโครงสร้าง .json เรียบร้อยแล้ว ตรวจสอบและกดบันทึกได้เลย');
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : 'ไม่สามารถสกัดข้อมูลจากภาพได้ กรุณาลองใหม่'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileSelected = (file: File | null | undefined) => {
    if (!file) return;
    setSelectedSourceLabel(file.name || 'รูปภาพจากเครื่อง');
    void runExtraction(file);
  };

  const currentDriveFolder = driveBreadcrumbs[driveBreadcrumbs.length - 1];

  const loadDrivePickerItems = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingDrive(true);
    setDriveError(null);
    try {
      const items = await fetchDriveImagePickerItems(accessToken, {
        viewMode: driveViewMode,
        folderId: driveViewMode === 'folders' ? currentDriveFolder.id : null,
        searchQuery: driveActiveSearch,
      });
      setDriveItems(items);
    } catch (err) {
      if (err instanceof GoogleDriveApiError) {
        if (err.status === 401 || err.status === 403) {
          onTokenExpired?.();
        }
        setDriveError(err.message);
      } else {
        setDriveError('ไม่สามารถโหลดรายการรูปภาพจาก Google Drive ได้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsLoadingDrive(false);
    }
  }, [accessToken, currentDriveFolder.id, driveActiveSearch, driveViewMode, onTokenExpired]);

  useEffect(() => {
    if (showDrivePicker && isAuthenticated) {
      void loadDrivePickerItems();
    } else if (!isAuthenticated) {
      setDriveItems([]);
      setDriveError(null);
    }
  }, [isAuthenticated, loadDrivePickerItems, showDrivePicker]);

  const handleSelectDriveItem = async (item: GoogleDriveFile) => {
    if (item.mimeType === DRIVE_FOLDER_MIME) {
      setDriveActiveSearch('');
      setDriveSearchInput('');
      setDriveViewMode('folders');
      setDriveBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
      return;
    }

    if (!accessToken || downloadingDriveFileId || isExtracting) return;
    setDownloadingDriveFileId(item.id);
    setDriveError(null);
    setExtractError(null);
    try {
      const imageFile = await downloadDriveImageAsFile(accessToken, item);
      setSelectedSourceLabel(`Google Drive: ${item.name}`);
      setShowDrivePicker(false);
      await runExtraction(imageFile);
    } catch (err) {
      if (err instanceof GoogleDriveApiError) {
        if (err.status === 401 || err.status === 403) {
          onTokenExpired?.();
        }
        setDriveError(err.message);
      } else {
        setDriveError(
          err instanceof Error
            ? err.message
            : 'ไม่สามารถดึงรูปภาพจาก Google Drive ได้ กรุณาลองใหม่อีกครั้ง'
        );
      }
    } finally {
      setDownloadingDriveFileId(null);
    }
  };

  const handleDriveBreadcrumbClick = (index: number) => {
    setDriveBreadcrumbs((prev) => prev.slice(0, index + 1));
    setDriveViewMode('folders');
    setDriveActiveSearch('');
    setDriveSearchInput('');
  };

  const handleDriveSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDriveActiveSearch(driveSearchInput.trim());
  };

  const handleSaveDraft = async () => {
    if (!draftRecord || isSaving) return;
    setIsSaving(true);
    setExtractError(null);
    try {
      const nowIso = new Date().toISOString();
      const normalizedId = `sleep_${draftRecord.date}`;
      const recordToSave: DailySleepRecord = {
        ...draftRecord,
        id: normalizedId,
        userLabel: null,
        previousDayStressScore: null,
        appInsights: [],
        appRecommendation: null,
        rawInfographic: buildRawSleepInfographic(draftRecord),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await onSaveLog(recordToSave);
      setSelectedId(recordToSave.id);
      soundEngine.playMessageReceived();

      setStatusMessage(
        `บันทึกไฟล์ข้อมูลประจำวัน ${recordToSave.date}.json เรียบร้อยแล้ว สะสมข้อมูลแล้วกดส่งให้มีน่าสรุปภาพรวมทางแชท AI ได้เลย`
      );
      setActiveTab('history');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyJson = async (payload: unknown, key: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  const handleImportJsonFile = async (file: File | null | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const valid: DailySleepRecord[] = [];
      for (const item of list) {
        if (isValidSleepRecordShape(item)) {
          valid.push({
            ...item,
            rawInfographic: item.rawInfographic ?? buildRawSleepInfographic(item),
          });
        } else if (isRawSleepInfographicShape(item)) {
          valid.push(parseRawSleepInfographicToRecord(item));
        }
      }
      if (valid.length === 0) {
        throw new Error('ไฟล์ .json นี้ไม่ตรงกับโครงสร้างข้อมูลการนอน');
      }
      for (const rec of valid) {
        await onSaveLog(rec);
      }
      setSelectedId(valid[0].id);
      soundEngine.playMessageReceived();
      setStatusMessage(`นำเข้าข้อมูลการนอนจำนวน ${valid.length} รายการเรียบร้อยแล้ว`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ .json ได้');
    }
  };

  const updateDraftField = <K extends keyof DailySleepRecord>(
    key: K,
    value: DailySleepRecord[K]
  ) => {
    setDraftRecord((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateDraftStage = (
    stageKey: 'deep' | 'light' | 'rem',
    field: 'minutes' | 'percent',
    rawValue: string
  ) => {
    setDraftRecord((prev) => {
      if (!prev) return prev;
      const num = parseOptionalNum(rawValue);
      const nextStage = {
        ...prev.stages[stageKey],
        [field]: field === 'minutes' ? Math.max(0, Math.round(num ?? 0)) : num,
      };
      if (field === 'minutes') {
        nextStage.durationText = formatMinutesToThaiDuration(nextStage.minutes);
      }
      return {
        ...prev,
        stages: {
          ...prev.stages,
          [stageKey]: nextStage,
        },
      };
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#463932] bg-[#1E1916] text-[#F5EFE6] shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#342B26] bg-[#251F1B] px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#433E68] bg-[#26233A] text-[#A5B4FC]">
              <Moon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight text-[#FAF6F0]">
                ภารกิจห้องนอน · สมุดบันทึกการนอนประจำวัน (.json)
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
                <span className="tabular-nums">สะสม {logs.length} วัน</span>
                {multiDayStats?.avgScore != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">เฉลี่ย {multiDayStats.avgScore} คะแนน</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Functional Segmented Tab Bar */}
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
                <span>อัปโหลดภาพ → JSON</span>
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
                <span className="tabular-nums">คลัง .json ({logs.length})</span>
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

        {/* Status Banner */}
        {statusMessage && (
          <div className="flex items-center justify-between gap-3 border-b border-[#2C4438] bg-[#1A2922] px-6 py-2.5 text-xs text-[#A7F3D0]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="cursor-pointer text-[#6EE7B7] hover:text-white"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ============================================================== */}
          {/* TAB 1: UPLOAD SCREENSHOT -> STRUCTURED JSON                    */}
          {/* ============================================================== */}
          {activeTab === 'upload' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left column: Upload dropzone & preview */}
              <div className="flex flex-col gap-4 lg:col-span-5">
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handleFileSelected(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2E273B] text-[#A5B4FC]">
                    {isExtracting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                  </div>

                  <p className="mt-3 text-sm font-medium text-[#FAF6F0]">
                    {isExtracting
                      ? 'AI กำลังอ่านตัวเลขและแปลงเป็นไฟล์ .json...'
                      : 'อัปโหลดภาพสรุปการนอนจากแอพสุขภาพ'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#A89C90]">
                    รองรับ Huawei Health, Apple Health, Samsung Health, Garmin และ Zepp (.jpg, .png, .webp)
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#D97736] px-4 py-2 text-xs font-semibold text-[#FAF6F0] transition-colors hover:bg-[#C6682A] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Upload className="h-3.5 w-3.5 shrink-0" />
                      <span>เลือกรูปภาพจากเครื่อง</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={() => {
                        setDriveError(null);
                        setShowDrivePicker((prev) => !prev);
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        showDrivePicker
                          ? 'border-[#818CF8] bg-[#312B4A] text-white'
                          : 'border-[#54463C] bg-[#2D2621] text-[#FAF6F0] hover:border-[#818CF8] hover:bg-[#352E42]'
                      }`}
                    >
                      <HardDrive className="h-3.5 w-3.5 shrink-0 text-[#A5B4FC]" />
                      <span>เลือกจาก Google Drive</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={() => {
                        setSelectedSourceLabel('ตัวอย่าง Huawei Health');
                        void runExtraction(SAMPLE_SLEEP_IMAGE_URL);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#473E59] bg-[#272336] px-3.5 py-2 text-xs font-medium text-[#C7D2FE] transition-colors hover:border-[#6366F1] hover:bg-[#312B4A] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>ทดสอบด้วยภาพ Huawei Health</span>
                    </button>
                  </div>
                </div>

                <SleepDriveImagePicker
                  showDrivePicker={showDrivePicker}
                  setShowDrivePicker={setShowDrivePicker}
                  isAuthenticated={isAuthenticated}
                  loadDrivePickerItems={loadDrivePickerItems}
                  isLoadingDrive={isLoadingDrive}
                  downloadingDriveFileId={downloadingDriveFileId}
                  authError={authError}
                  driveError={driveError}
                  setDriveError={setDriveError}
                  onGoogleSignIn={onGoogleSignIn}
                  isSigningIn={isSigningIn}
                  driveViewMode={driveViewMode}
                  setDriveViewMode={setDriveViewMode}
                  handleDriveSearchSubmit={handleDriveSearchSubmit}
                  driveSearchInput={driveSearchInput}
                  setDriveSearchInput={setDriveSearchInput}
                  driveActiveSearch={driveActiveSearch}
                  setDriveActiveSearch={setDriveActiveSearch}
                  driveBreadcrumbs={driveBreadcrumbs}
                  handleDriveBreadcrumbClick={handleDriveBreadcrumbClick}
                  driveItems={driveItems}
                  isExtracting={isExtracting}
                  handleSelectDriveItem={handleSelectDriveItem}
                />

                {extractError && (
                  <div className="rounded-xl border border-[#7F1D1D] bg-[#2B1717] px-4 py-3 text-xs text-[#FCA5A5]">
                    {extractError}
                  </div>
                )}

                {previewUrl && (
                  <div className="overflow-hidden rounded-xl border border-[#382F29] bg-[#161210]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2D2520] px-3.5 py-2 text-xs text-[#A89C90]">
                      <span className="truncate">
                        {selectedSourceLabel ? `ภาพจาก ${selectedSourceLabel}` : 'ภาพต้นฉบับที่อัปโหลด'}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowDrivePicker(true)}
                          className="cursor-pointer text-[#A5B4FC] hover:underline"
                        >
                          เลือกจาก Drive
                        </button>
                        <span className="text-[#4A3E36]">·</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="cursor-pointer text-[#C7D2FE] hover:underline"
                        >
                          เปลี่ยนภาพ
                        </button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      <img
                        src={previewUrl}
                        alt="ภาพหน้าจอสถิติการนอนที่อัปโหลด"
                        referrerPolicy="no-referrer"
                        className="mx-auto w-full max-w-[260px] rounded-lg object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              <SleepDraftEditorColumn
                draftRecord={draftRecord}
                showRawDraftJson={showRawDraftJson}
                setShowRawDraftJson={setShowRawDraftJson}
                handleCopyJson={handleCopyJson}
                copiedId={copiedId}
                updateDraftField={updateDraftField}
                updateDraftStage={updateDraftStage}
                isSaving={isSaving}
                handleSaveDraft={handleSaveDraft}
              />
            </div>
          )}

          <SleepHistoryArchiveSection
            activeTab={activeTab}
            jsonImportRef={jsonImportRef}
            handleImportJsonFile={handleImportJsonFile}
            logs={logs}
            onAskMinaAnalyzeSleep={onAskMinaAnalyzeSleep}
            importError={importError}
            selectedRecord={selectedRecord}
            setSelectedId={setSelectedId}
            onDeleteLog={onDeleteLog}
            handleCopyJson={handleCopyJson}
            copiedId={copiedId}
          />
        </div>
      </div>
    </div>
  );
}

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
} from '../utils/driveApi';
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
} from '../utils/sleepLogsApi';
import { soundEngine } from '../utils/sound';

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

interface DriveBreadcrumbItem {
  id: string | null;
  name: string;
}

function formatThaiShortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatDriveFileSize(sizeStr?: string): string | null {
  if (!sizeStr) return null;
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseOptionalNum(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

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

              {/* Right column: Extracted Structured Data + JSON Preview */}
              <div className="flex flex-col gap-4 lg:col-span-7">
                {!draftRecord ? (
                  <div className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-xl border border-[#342B26] bg-[#231D1A] p-8 text-center">
                    <FileJson className="h-9 w-9 text-[#6F655E]" />
                    <h3 className="mt-3 text-sm font-semibold text-[#E8DFD4]">
                      รอรับภาพเพื่อแปลงเป็นข้อมูล .json ประจำวัน
                    </h3>
                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#9C9084]">
                      เมื่ออัปโหลดภาพ ระบบจะสกัดคะแนนการนอน ช่วงเวลาเข้านอน–ตื่นนอน ระยะหลับลึก/หลับตื้น/REM คุณภาพการหายใจ และความเครียด ออกมาเป็นไฟล์ .json ที่มีโครงสร้างพร้อมเก็บสะสมรายวันให้ AI และผู้ช่วยมีน่าวิเคราะห์ต่อได้ทันที
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 rounded-xl border border-[#3B312B] bg-[#241E1A] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#342B26] pb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#FAF6F0]">
                          ตรวจสอบข้อมูลที่แปลงได้ก่อนบันทึก
                        </h3>
                        <p className="mt-0.5 text-xs text-[#A89C90]">
                          {draftRecord.sourceApp} · {draftRecord.dateLabel || draftRecord.date}
                          {draftRecord.userLabel ? ` · ${draftRecord.userLabel}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRawDraftJson((v) => !v)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#453A33] bg-[#2D2621] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] transition-colors hover:border-[#66564B] hover:text-white"
                        >
                          <FileJson className="h-3.5 w-3.5 shrink-0" />
                          <span>{showRawDraftJson ? 'ดูแบบฟอร์ม' : 'ดูโค้ด .json'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadSleepJsonFile(
                              buildRawSleepInfographic(draftRecord),
                              `sleep-${draftRecord.date}.json`
                            )
                          }
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#453A33] bg-[#2D2621] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] transition-colors hover:border-[#66564B] hover:text-white"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          <span>ดาวน์โหลด .json</span>
                        </button>
                      </div>
                    </div>

                    {showRawDraftJson ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyJson(buildRawSleepInfographic(draftRecord), 'draft')
                          }
                          className="absolute top-3 right-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#453A33] bg-[#26201C] px-2.5 py-1 text-[11px] font-medium text-[#E5DDD3] hover:border-[#66564B]"
                        >
                          {copiedId === 'draft' ? (
                            <>
                              <Check className="h-3 w-3 text-[#34D399]" />
                              <span>คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>คัดลอก JSON</span>
                            </>
                          )}
                        </button>
                        <pre className="max-h-[340px] overflow-auto rounded-lg border border-[#342B26] bg-[#161210] p-4 font-mono text-[11px] leading-relaxed text-[#C7D2FE]">
                          {JSON.stringify(buildRawSleepInfographic(draftRecord), null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {/* Primary Fields */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">วันที่ (YYYY-MM-DD)</span>
                            <input
                              type="date"
                              value={draftRecord.date}
                              onChange={(e) => updateDraftField('date', e.target.value)}
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs text-[#FAF6F0] focus:border-[#818CF8] focus:outline-none"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">คะแนนการนอน</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={draftRecord.sleepScore ?? ''}
                              onChange={(e) =>
                                updateDraftField('sleepScore', parseOptionalNum(e.target.value))
                              }
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] focus:border-[#818CF8] focus:outline-none"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">เวลาเข้านอน</span>
                            <input
                              type="text"
                              placeholder="06:43"
                              value={draftRecord.bedtime ?? ''}
                              onChange={(e) =>
                                updateDraftField('bedtime', e.target.value || null)
                              }
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] focus:border-[#818CF8] focus:outline-none"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">เวลาตื่นนอน</span>
                            <input
                              type="text"
                              placeholder="14:47"
                              value={draftRecord.wakeTime ?? ''}
                              onChange={(e) =>
                                updateDraftField('wakeTime', e.target.value || null)
                              }
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] focus:border-[#818CF8] focus:outline-none"
                            />
                          </label>
                        </div>

                        {/* Sleep Stages Table */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          {(
                            [
                              { key: 'deep', label: 'หลับลึก (Deep)', accent: 'text-[#A78BFA]' },
                              { key: 'light', label: 'หลับตื้น (Light)', accent: 'text-[#E879F9]' },
                              { key: 'rem', label: 'หลับฝัน (REM)', accent: 'text-[#FB7185]' },
                            ] as const
                          ).map((st) => {
                            const data = draftRecord.stages[st.key];
                            return (
                              <div
                                key={st.key}
                                className="rounded-lg border border-[#382F29] bg-[#1C1714] p-3"
                              >
                                <div className={`text-xs font-semibold ${st.accent}`}>
                                  {st.label}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <label className="flex flex-col gap-1 text-[11px] text-[#A89C90]">
                                    <span>นาที</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={data.minutes}
                                      onChange={(e) =>
                                        updateDraftStage(st.key, 'minutes', e.target.value)
                                      }
                                      className="rounded border border-[#3F342D] bg-[#14100E] px-2 py-1 font-mono text-xs tabular-nums text-[#FAF6F0]"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1 text-[11px] text-[#A89C90]">
                                    <span>สัดส่วน (%)</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={data.percent ?? ''}
                                      onChange={(e) =>
                                        updateDraftStage(st.key, 'percent', e.target.value)
                                      }
                                      className="rounded border border-[#3F342D] bg-[#14100E] px-2 py-1 font-mono text-xs tabular-nums text-[#FAF6F0]"
                                    />
                                  </label>
                                </div>
                                <div className="mt-1.5 text-[11px] text-[#8E8277]">
                                  {data.durationText || formatMinutesToThaiDuration(data.minutes)}
                                  {data.status ? ` · ${data.status}` : ''}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Secondary Health Metrics */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">รวม (นาที)</span>
                            <input
                              type="number"
                              min={0}
                              value={draftRecord.totalSleepMinutes ?? ''}
                              onChange={(e) => {
                                const mins = parseOptionalNum(e.target.value);
                                updateDraftField('totalSleepMinutes', mins);
                                updateDraftField(
                                  'totalSleepText',
                                  mins != null ? formatMinutesToThaiDuration(mins) : null
                                );
                              }}
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0]"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">ความต่อเนื่องหลับลึก</span>
                            <input
                              type="number"
                              value={draftRecord.deepSleepContinuityScore ?? ''}
                              onChange={(e) =>
                                updateDraftField(
                                  'deepSleepContinuityScore',
                                  parseOptionalNum(e.target.value)
                                )
                              }
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0]"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">คุณภาพการหายใจ</span>
                            <input
                              type="number"
                              value={draftRecord.breathingQualityScore ?? ''}
                              onChange={(e) =>
                                updateDraftField(
                                  'breathingQualityScore',
                                  parseOptionalNum(e.target.value)
                                )
                              }
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0]"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-[#A89C90]">จำนวนครั้งที่ตื่นนอน</span>
                            <input
                              type="number"
                              min={0}
                              value={draftRecord.awakeCount ?? ''}
                              onChange={(e) =>
                                updateDraftField('awakeCount', parseOptionalNum(e.target.value))
                              }
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0]"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#342B26] pt-4">
                      <span className="text-[11px] text-[#9C9084]">
                        บันทึกสะสมข้อมูลรายวันแล้วกดส่งให้มีน่าสรุปภาพรวมทั้งหมดทางแชทผู้ช่วย AI ได้เลย
                      </span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleSaveDraft()}
                        className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:opacity-60"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : (
                          <FileJson className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>บันทึกเป็น .json ประจำวัน</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: DAILY .JSON ARCHIVE & EXPORT                            */}
          {/* ============================================================== */}
          {activeTab === 'history' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#342B26] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#FAF6F0]">
                    คลังไฟล์ .json ข้อมูลการนอนประจำวัน
                  </h3>
                  <p className="mt-0.5 text-xs text-[#A89C90]">
                    เก็บสะสมข้อมูลการนอนรายวัน แล้วกดส่งให้มีน่าสรุปภาพรวมทั้งหมดที่เก็บไว้ทางแชทผู้ช่วย AI ได้เลย
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={jsonImportRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      void handleImportJsonFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => jsonImportRef.current?.click()}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#453A33] bg-[#2B2420] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] hover:border-[#66564B] hover:text-white"
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span>นำเข้า .json</span>
                  </button>
                  <button
                    type="button"
                    disabled={logs.length === 0}
                    onClick={() =>
                      downloadSleepJsonFile(
                        logs.map((l) => l.rawInfographic ?? buildRawSleepInfographic(l)),
                        `sleep-daily-dataset-${getLocalIsoDate()}.json`
                      )
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#453A33] bg-[#2B2420] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] hover:border-[#66564B] hover:text-white disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>ส่งออกทั้งหมด (.json)</span>
                  </button>
                  {onAskMinaAnalyzeSleep && (
                    <button
                      type="button"
                      disabled={logs.length === 0}
                      onClick={onAskMinaAnalyzeSleep}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#4F46E5] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>ให้มีน่าสรุปภาพรวมการนอนทางแชท AI ({logs.length} วัน)</span>
                    </button>
                  )}
                </div>
              </div>

              {logs.length > 0 && logs.length < 3 && (
                <div className="rounded-lg border border-[#473E59] bg-[#231F31] px-3.5 py-2.5 text-xs text-[#C7D2FE]">
                  ตอนนี้มีข้อมูลสะสม {logs.length} วัน — ยิ่งสะสมหลายวัน มีน่าจะยิ่งสรุปภาพรวมการนอนได้ครบถ้วนขึ้น หรือกด “ให้มีน่าสรุปภาพรวมการนอนทางแชท AI” ได้ทันที
                </div>
              )}

              {importError && (
                <div className="rounded-lg border border-[#7F1D1D] bg-[#2B1717] px-3.5 py-2.5 text-xs text-[#FCA5A5]">
                  {importError}
                </div>
              )}

              {logs.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-[#342B26] bg-[#231D1A] p-8 text-center">
                  <FileJson className="h-9 w-9 text-[#6F655E]" />
                  <p className="mt-3 text-sm font-medium text-[#E8DFD4]">
                    ยังไม่มีไฟล์ .json ในคลังประจำวัน
                  </p>
                  <p className="mt-1 text-xs text-[#A89C90]">
                    อัปโหลดภาพสถิติการนอนครั้งแรกในแท็บ “อัปโหลดภาพ → JSON” เพื่อเริ่มสะสมข้อมูล
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  {/* Left: Daily List */}
                  <div className="flex flex-col gap-2 lg:col-span-5">
                    {logs.map((item) => {
                      const isSelected = selectedRecord?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedId(item.id);
                            }
                          }}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                            isSelected
                              ? 'border-[#6366F1] bg-[#252236]'
                              : 'border-[#342B26] bg-[#231D1A] hover:border-[#4D4139]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#FAF6F0]">
                              <span className="font-mono tabular-nums">{item.date}</span>
                              <span className="text-[#8E8277]">·</span>
                              <span className="truncate text-[#C6B9AC]">{item.dateLabel}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-[#9C9084]">
                              <span>
                                {item.sleepScore != null ? `${item.sleepScore} คะแนน` : 'ไม่ระบุคะแนน'}
                              </span>
                              <span>·</span>
                              <span>{formatMinutesToThaiDuration(item.totalSleepMinutes)}</span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              title="ลบบันทึกวันนี้"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDeleteLog(item.id);
                              }}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#3E352F] bg-[#2B2420] text-[#A89C90] hover:border-[#991B1B] hover:text-[#FCA5A5]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Selected Day JSON Inspector */}
                  <div className="flex flex-col gap-3 rounded-xl border border-[#342B26] bg-[#171311] p-4 lg:col-span-7">
                    {selectedRecord && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2C2420] pb-2.5">
                          <span className="font-mono text-xs text-[#C7D2FE]">
                            sleep-{selectedRecord.date}.json
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyJson(
                                  selectedRecord.rawInfographic ??
                                    buildRawSleepInfographic(selectedRecord),
                                  selectedRecord.id
                                )
                              }
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#3F352E] bg-[#241E1A] px-2.5 py-1 text-xs text-[#D6CBC0] hover:text-white"
                            >
                              {copiedId === selectedRecord.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-[#34D399]" />
                                  <span>คัดลอกแล้ว</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>คัดลอก</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadSleepJsonFile(
                                  selectedRecord.rawInfographic ??
                                    buildRawSleepInfographic(selectedRecord),
                                  `sleep-${selectedRecord.date}.json`
                                )
                              }
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#3F352E] bg-[#241E1A] px-2.5 py-1 text-xs text-[#D6CBC0] hover:text-white"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>ดาวน์โหลดไฟล์นี้</span>
                            </button>
                          </div>
                        </div>
                        <pre className="max-h-[380px] overflow-auto font-mono text-[11px] leading-relaxed text-[#E2E8F0]">
                          {JSON.stringify(
                            selectedRecord.rawInfographic ??
                              buildRawSleepInfographic(selectedRecord),
                            null,
                            2
                          )}
                        </pre>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

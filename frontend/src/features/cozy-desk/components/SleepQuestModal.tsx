import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type {
  DailySleepRecord,
  GoogleDriveFile,
} from '../types/game';
import {
  DRIVE_FOLDER_MIME,
  type DriveImagePickerViewMode,
  downloadDriveImageAsFile,
  fetchDriveImagePickerItems,
  GoogleDriveApiError,
} from '../api/driveApi';
import {
  buildRawSleepInfographic,
  countStandardHuaweiFields,
  extractSleepRecordFromImage,
  formatMinutesToThaiDuration,
  getLocalIsoDate,
  isRawSleepInfographicShape,
  isValidSleepRecordShape,
  loadSleepScanBackups,
  parseRawSleepInfographicToRecord,
  prepareImageForSleepExtraction,
  saveSleepScanBackup,
  STANDARD_HUAWEI_FIELDS_TOTAL,
  type SleepScanBackupEntry,
  type SleepSyncResult,
} from '../api/sleepLogsApi';
import { soundEngine } from '../lib/sound';
import {
  createEmptyManualSleepDraft,
  type DriveBreadcrumbItem,
  parseOptionalNum,
  SleepDriveImagePicker,
  SleepQuestModalHeader,
  SleepUploadPreviewCard,
} from './SleepDriveImagePicker';
import {
  SleepDraftEditorColumn,
  SleepHistoryArchiveSection,
} from './SleepQuestSubsections';

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
  onSaveLog: (record: DailySleepRecord) => Promise<SleepSyncResult | void>;
  onSaveLogsBatch?: (records: DailySleepRecord[]) => Promise<SleepSyncResult | void>;
  onDeleteLog: (id: string) => Promise<SleepSyncResult | void>;
  onClose: () => void;
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
  onSaveLogsBatch,
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
  const [extractPhaseText, setExtractPhaseText] = useState(
    'กำลังตรวจหาวันที่และสแกนข้อมูลตามมาตรฐาน Huawei Health...'
  );
  const [extractError, setExtractError] = useState<string | null>(null);
  const [duplicateSkipDate, setDuplicateSkipDate] = useState<string | null>(null);
  const [scanBackups, setScanBackups] = useState<SleepScanBackupEntry[]>(() =>
    loadSleepScanBackups()
  );
  const [draftRecord, setDraftRecord] = useState<DailySleepRecord>(() =>
    createEmptyManualSleepDraft()
  );
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
  const [statusTone, setStatusTone] = useState<'success' | 'warning'>('success');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);
  const extractAbortRef = useRef<AbortController | null>(null);
  const extractSeqRef = useRef(0);
  const lastPreparedImageRef = useRef<{
    imageBase64: string;
    mimeType: string;
    previewDataUrl: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      extractAbortRef.current?.abort();
    };
  }, []);

  const selectedRecord = useMemo(() => {
    if (selectedId) {
      const found = logs.find((r) => r.id === selectedId);
      if (found) return found;
    }
    return logs[0] ?? null;
  }, [logs, selectedId]);

  const existingDateMatch = useMemo(() => {
    if (!draftRecord?.date) return null;
    return logs.find((r) => r.date === draftRecord.date) ?? null;
  }, [draftRecord?.date, logs]);

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

  const cancelExtraction = () => {
    extractSeqRef.current += 1;
    extractAbortRef.current?.abort();
    extractAbortRef.current = null;
    setIsExtracting(false);
    setStatusTone('warning');
    setStatusMessage('ยกเลิกการสแกนภาพแล้ว');
  };

  const handleRemoveUploadedImage = () => {
    if (isExtracting) {
      extractSeqRef.current += 1;
      extractAbortRef.current?.abort();
      extractAbortRef.current = null;
      setIsExtracting(false);
    }
    setPreviewUrl(null);
    setSelectedSourceLabel(null);
    setExtractError(null);
    setDuplicateSkipDate(null);
    lastPreparedImageRef.current = null;
    const preservedCount = countStandardHuaweiFields(draftRecord);
    if (preservedCount > 0) {
      setStatusTone('success');
      setStatusMessage(
        `ลบภาพออกแล้ว — ข้อมูลที่สแกนไว้ (${preservedCount}/${STANDARD_HUAWEI_FIELDS_TOTAL} ค่ามาตรฐาน) ยังคงอยู่ด้านขวา พร้อมกดบันทึกได้ทันที`
      );
    }
  };

  const runExtraction = async (
    source: File | string | null,
    options: { forceRescan?: boolean } = {}
  ) => {
    extractAbortRef.current?.abort();
    const controller = new AbortController();
    extractAbortRef.current = controller;
    const reqSeq = extractSeqRef.current + 1;
    extractSeqRef.current = reqSeq;

    const forceRescan = options.forceRescan === true;
    const existingDates = Array.from(
      new Set([...logs.map((l) => l.date), ...scanBackups.map((b) => b.date)])
    );

    setExtractError(null);
    setStatusMessage(null);
    setDuplicateSkipDate(null);
    setExtractPhaseText(
      existingDates.length > 0 && !forceRescan
        ? 'กำลังตรวจหาวันที่ในภาพก่อน เพื่อป้องกันการสแกนซ้ำ...'
        : 'กำลังสแกนและสกัดข้อมูลตามมาตรฐาน Huawei Health...'
    );
    setIsExtracting(true);
    try {
      const prepared =
        source != null
          ? await prepareImageForSleepExtraction(source)
          : lastPreparedImageRef.current;
      if (!prepared) {
        throw new Error('ไม่พบภาพต้นฉบับสำหรับสแกนซ้ำ กรุณาเลือกภาพใหม่อีกครั้ง');
      }
      if (extractSeqRef.current !== reqSeq || controller.signal.aborted) return;
      lastPreparedImageRef.current = prepared;
      setPreviewUrl(prepared.previewDataUrl);

      const extraction = await extractSleepRecordFromImage(
        prepared.imageBase64,
        prepared.mimeType,
        getLocalIsoDate(),
        {
          signal: controller.signal,
          existingDates,
          forceRescan,
        }
      );
      if (extractSeqRef.current !== reqSeq || controller.signal.aborted) return;

      if (extraction.skippedDuplicate) {
        const dupDate = extraction.duplicateDate;
        setDuplicateSkipDate(dupDate);
        const existingLog = logs.find((item) => item.date === dupDate) ?? null;
        const existingBackup = scanBackups.find((item) => item.date === dupDate) ?? null;

        if (existingLog) {
          setDraftRecord({
            ...existingLog,
            stages: {
              deep: { ...existingLog.stages.deep },
              light: { ...existingLog.stages.light },
              rem: { ...existingLog.stages.rem },
            },
          });
          setStatusTone('warning');
          setStatusMessage(
            `วันที่ ${dupDate} เคยสแกนบันทึกไว้แล้ว จึงข้ามการสแกนซ้ำ และโหลดข้อมูลเดิมขึ้นมาให้ตรวจสอบด้านขวา`
          );
        } else if (existingBackup) {
          setDraftRecord(parseRawSleepInfographicToRecord(existingBackup.payload));
          setStatusTone('warning');
          setStatusMessage(
            `วันที่ ${dupDate} เคยสแกนไว้แล้ว จึงข้ามการสแกนซ้ำและดึงข้อมูลเดิมขึ้นมาด้านขวาให้พร้อมบันทึก`
          );
        } else {
          setStatusTone('warning');
          setStatusMessage(`วันที่ ${dupDate} เคยสแกนไว้แล้ว จึงข้ามการสแกนซ้ำ`);
        }
        return;
      }

      const { record } = extraction;
      // Silently persist canonical .json backup internally to prevent duplicate re-scans
      saveSleepScanBackup(record);
      setScanBackups(loadSleepScanBackups());

      setDraftRecord(record);
      soundEngine.playMessageReceived();
      const foundCount = countStandardHuaweiFields(record);
      setStatusTone('success');
      setStatusMessage(
        `สแกนภาพจาก ${record.sourceApp} สำเร็จ · พบ ${foundCount}/${STANDARD_HUAWEI_FIELDS_TOTAL} ค่ามาตรฐาน Huawei Health ตรวจสอบและกดบันทึกได้เลย`
      );
    } catch (err) {
      if (extractSeqRef.current !== reqSeq) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setExtractError(
        err instanceof Error ? err.message : 'ไม่สามารถสแกนและสกัดข้อมูลจากภาพได้ กรุณาลองใหม่'
      );
    } finally {
      if (extractSeqRef.current === reqSeq) {
        extractAbortRef.current = null;
        setIsExtracting(false);
      }
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
      const nextDraft: DailySleepRecord = {
        ...draftRecord,
        id: normalizedId,
        sourceApp: draftRecord.sourceApp.trim() || 'Health App',
        userLabel: null,
        previousDayStressScore: null,
        appInsights: [],
        appRecommendation: null,
      };
      const recordToSave: DailySleepRecord = {
        ...nextDraft,
        rawInfographic: buildRawSleepInfographic(nextDraft),
        createdAt: draftRecord.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const syncResult = await onSaveLog(recordToSave);
      setSelectedId(recordToSave.id);
      soundEngine.playMessageReceived();

      if (syncResult && !syncResult.synced) {
        setStatusTone('warning');
        setStatusMessage(
          `บันทึก ${recordToSave.date}.json ไว้ในเครื่องแล้ว แต่ยังซิงก์ขึ้นคลาวด์ไม่สำเร็จ (${syncResult.syncError || 'ตรวจสอบการเชื่อมต่อ'})`
        );
      } else {
        setStatusTone('success');
        setStatusMessage(
          `บันทึกไฟล์ข้อมูลประจำวัน ${recordToSave.date}.json เรียบร้อยแล้ว สะสมข้อมูลแล้วกดส่งให้มีน่าสรุปภาพรวมทางแชท AI ได้เลย`
        );
      }
      setActiveTab('history');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditArchivedRecord = (record: DailySleepRecord) => {
    setDraftRecord({
      ...record,
      stages: {
        deep: { ...record.stages.deep },
        light: { ...record.stages.light },
        rem: { ...record.stages.rem },
      },
    });
    setPreviewUrl(null);
    setSelectedSourceLabel(`แก้ไขบันทึกเดิม (${record.date})`);
    setExtractError(null);
    setShowRawDraftJson(false);
    setActiveTab('upload');
  };

  const handleDeleteWithFeedback = async (id: string) => {
    const syncResult = await onDeleteLog(id);
    if (syncResult && !syncResult.synced) {
      setStatusTone('warning');
      setStatusMessage(
        syncResult.syncError || 'ลบออกจากเครื่องแล้ว และจะซิงก์การลบบนคลาวด์เมื่อเชื่อมต่อได้'
      );
    } else {
      setStatusTone('success');
      setStatusMessage('ลบบันทึกการนอนออกจากคลัง .json เรียบร้อยแล้ว');
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
      const capped = valid.slice(0, 31);
      let syncResult: SleepSyncResult | void;
      if (onSaveLogsBatch) {
        syncResult = await onSaveLogsBatch(capped);
      } else {
        for (const rec of capped) {
          syncResult = await onSaveLog(rec);
        }
      }
      setSelectedId(capped[0].id);
      soundEngine.playMessageReceived();
      if (syncResult && !syncResult.synced) {
        setStatusTone('warning');
        setStatusMessage(
          `นำเข้าข้อมูล ${capped.length} รายการไว้ในเครื่องแล้ว แต่ซิงก์ขึ้นคลาวด์ไม่สำเร็จ (${syncResult.syncError || 'ตรวจสอบการเชื่อมต่อ'})`
        );
      } else {
        setStatusTone('success');
        setStatusMessage(
          valid.length > 31
            ? `นำเข้าข้อมูลการนอนจำนวน 31 รายการล่าสุด (จากทั้งหมด ${valid.length} รายการ) เรียบร้อยแล้ว`
            : `นำเข้าข้อมูลการนอนจำนวน ${capped.length} รายการเรียบร้อยแล้ว`
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ .json ได้');
    }
  };

  const updateDraftField = <K extends keyof DailySleepRecord>(
    key: K,
    value: DailySleepRecord[K]
  ) => {
    setDraftRecord((prev) => {
      if (key === 'date' && typeof value === 'string' && !prev.scanSummary) {
        return { ...prev, date: value, dateLabel: value };
      }
      return { ...prev, [key]: value };
    });
  };

  const resetManualDraft = () => {
    setDraftRecord(createEmptyManualSleepDraft());
    setPreviewUrl(null);
    setSelectedSourceLabel(null);
    setExtractError(null);
    setDuplicateSkipDate(null);
    lastPreparedImageRef.current = null;
    setShowRawDraftJson(false);
  };

  const updateDraftStage = (
    stageKey: 'deep' | 'light' | 'rem',
    field: 'minutes' | 'percent',
    rawValue: string
  ) => {
    setDraftRecord((prev) => {
      const num = parseOptionalNum(rawValue);
      const nextMinutes =
        field === 'minutes'
          ? num !== null
            ? Math.max(0, Math.round(num))
            : null
          : prev.stages[stageKey].minutes;
      const nextStage = {
        ...prev.stages[stageKey],
        [field]: field === 'minutes' ? nextMinutes : num,
      };
      if (field === 'minutes') {
        nextStage.durationText =
          nextMinutes !== null ? formatMinutesToThaiDuration(nextMinutes) : null;
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

  const recalcTotalFromStages = () => {
    setDraftRecord((prev) => {
      const sum =
        (prev.stages.deep.minutes ?? 0) +
        (prev.stages.light.minutes ?? 0) +
        (prev.stages.rem.minutes ?? 0);
      if (sum <= 0) return prev;
      return {
        ...prev,
        totalSleepMinutes: sum,
        totalSleepText: formatMinutesToThaiDuration(sum),
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
        <SleepQuestModalHeader
          hasLoggedToday={hasLoggedToday}
          todaySleepLabel={todaySleepLabel}
          logsCount={logs.length}
          avgScore={multiDayStats?.avgScore}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={onClose}
          statusMessage={statusMessage}
          statusTone={statusTone}
          setStatusMessage={setStatusMessage}
        />

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'upload' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="flex flex-col gap-4 lg:col-span-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFileSelected(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />

                <SleepUploadPreviewCard
                  previewUrl={previewUrl}
                  isDraggingFile={isDraggingFile}
                  setIsDraggingFile={setIsDraggingFile}
                  handleFileSelected={handleFileSelected}
                  isExtracting={isExtracting}
                  cancelExtraction={cancelExtraction}
                  fileInputRef={fileInputRef}
                  showDrivePicker={showDrivePicker}
                  setShowDrivePicker={setShowDrivePicker}
                  setDriveError={setDriveError}
                  selectedSourceLabel={selectedSourceLabel}
                  handleRemoveUploadedImage={handleRemoveUploadedImage}
                  extractPhaseText={extractPhaseText}
                  duplicateSkipDate={duplicateSkipDate}
                  onForceRescan={() => void runExtraction(null, { forceRescan: true })}
                />

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
              </div>

              <SleepDraftEditorColumn
                draftRecord={draftRecord}
                existingDateMatch={existingDateMatch}
                showRawDraftJson={showRawDraftJson}
                setShowRawDraftJson={setShowRawDraftJson}
                handleCopyJson={handleCopyJson}
                copiedId={copiedId}
                updateDraftField={updateDraftField}
                updateDraftStage={updateDraftStage}
                recalcTotalFromStages={recalcTotalFromStages}
                onResetDraft={resetManualDraft}
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
            onEditRecord={handleEditArchivedRecord}
            onDeleteLog={handleDeleteWithFeedback}
            handleCopyJson={handleCopyJson}
            copiedId={copiedId}
          />
        </div>
      </div>
    </div>
  );
}

import { useMemo, useRef, useState } from 'react';
import {
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileJson,
  ImagePlus,
  Loader2,
  Moon,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { DailySleepRecord } from '../types/game';
import {
  analyzeSleepRecordWithAi,
  downloadSleepJsonFile,
  extractSleepRecordFromImage,
  formatMinutesToThaiDuration,
  getLocalIsoDate,
  isValidSleepRecordShape,
  prepareImageForSleepExtraction,
  SAMPLE_SLEEP_IMAGE_URL,
} from '../utils/sleepLogsApi';
import { soundEngine } from '../utils/sound';

type SleepModalTab = 'upload' | 'analysis' | 'history';

interface SleepQuestModalProps {
  logs: DailySleepRecord[];
  hasLoggedToday: boolean;
  todaySleepLabel?: string | null;
  onSaveLog: (record: DailySleepRecord) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
  onClose: () => void;
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
  onSaveLog,
  onDeleteLog,
  onClose,
}: SleepQuestModalProps) {
  const [activeTab, setActiveTab] = useState<SleepModalTab>(
    logs.length > 0 && hasLoggedToday ? 'analysis' : 'upload'
  );
  const [selectedId, setSelectedId] = useState<string | null>(logs[0]?.id ?? null);

  // Upload & extraction state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [draftRecord, setDraftRecord] = useState<DailySleepRecord | null>(null);
  const [showRawDraftJson, setShowRawDraftJson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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
    void runExtraction(file);
  };

  const handleSaveDraft = async (andAnalyze: boolean) => {
    if (!draftRecord || isSaving) return;
    setIsSaving(true);
    setExtractError(null);
    setAnalysisError(null);
    try {
      const nowIso = new Date().toISOString();
      const normalizedId = `sleep_${draftRecord.date}`;
      const recordToSave: DailySleepRecord = {
        ...draftRecord,
        id: normalizedId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await onSaveLog(recordToSave);
      setSelectedId(recordToSave.id);
      soundEngine.playMessageReceived();

      if (andAnalyze) {
        setActiveTab('analysis');
        setIsSaving(false);
        await handleRunAiAnalysis(recordToSave);
        return;
      }

      setStatusMessage(`บันทึกไฟล์ข้อมูลประจำวัน ${recordToSave.date}.json เรียบร้อยแล้ว`);
      setActiveTab('history');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunAiAnalysis = async (target: DailySleepRecord | null) => {
    if (!target || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const analysis = await analyzeSleepRecordWithAi(target, logs);
      const updated: DailySleepRecord = {
        ...target,
        aiAnalysis: analysis,
        updatedAt: new Date().toISOString(),
      };
      await onSaveLog(updated);
      setSelectedId(updated.id);
      soundEngine.playMessageReceived();
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์ด้วย AI ได้ในขณะนี้'
      );
    } finally {
      setIsAnalyzing(false);
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
      const valid = list.filter(isValidSleepRecordShape);
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
                ภารกิจห้องนอน · บันทึกและวิเคราะห์การนอนประจำวัน
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
                aria-selected={activeTab === 'analysis'}
                onClick={() => setActiveTab('analysis')}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === 'analysis'
                    ? 'bg-[#4F46E5] text-white'
                    : 'text-[#B5A89C] hover:text-[#FAF6F0]'
                }`}
              >
                <Brain className="h-3.5 w-3.5 shrink-0" />
                <span>วิเคราะห์ด้วย AI</span>
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
                      onClick={() => void runExtraction(SAMPLE_SLEEP_IMAGE_URL)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#473E59] bg-[#272336] px-3.5 py-2 text-xs font-medium text-[#C7D2FE] transition-colors hover:border-[#6366F1] hover:bg-[#312B4A] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>ทดสอบด้วยภาพ Huawei Health</span>
                    </button>
                  </div>
                </div>

                {extractError && (
                  <div className="rounded-xl border border-[#7F1D1D] bg-[#2B1717] px-4 py-3 text-xs text-[#FCA5A5]">
                    {extractError}
                  </div>
                )}

                {previewUrl && (
                  <div className="overflow-hidden rounded-xl border border-[#382F29] bg-[#161210]">
                    <div className="flex items-center justify-between border-b border-[#2D2520] px-3.5 py-2 text-xs text-[#A89C90]">
                      <span>ภาพต้นฉบับที่อัปโหลด</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer text-[#C7D2FE] hover:underline"
                      >
                        เปลี่ยนภาพ
                      </button>
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
                            downloadSleepJsonFile(draftRecord, `sleep-${draftRecord.date}.json`)
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
                          onClick={() => void handleCopyJson(draftRecord, 'draft')}
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
                          {JSON.stringify(draftRecord, null, 2)}
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
                            <span className="text-[#A89C90]">ความเครียดวันก่อน</span>
                            <input
                              type="number"
                              value={draftRecord.previousDayStressScore ?? ''}
                              onChange={(e) =>
                                updateDraftField(
                                  'previousDayStressScore',
                                  parseOptionalNum(e.target.value)
                                )
                              }
                              className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0]"
                            />
                          </label>
                        </div>

                        {draftRecord.appInsights.length > 0 && (
                          <div className="rounded-lg border border-[#342B26] bg-[#1A1512] p-3 text-xs text-[#C6B9AC]">
                            <div className="font-medium text-[#E8DFD4]">
                              บันทึกเพิ่มเติมจากแอพ ({draftRecord.sourceApp})
                            </div>
                            <ul className="mt-1.5 space-y-1">
                              {draftRecord.appInsights.map((note, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  · {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#342B26] pt-4">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleSaveDraft(false)}
                        className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#4B3F37] bg-[#2D2621] px-4 py-2 text-xs font-medium text-[#FAF6F0] transition-colors hover:border-[#6E5C50] hover:bg-[#382F29] disabled:opacity-60"
                      >
                        <FileJson className="h-3.5 w-3.5 shrink-0" />
                        <span>บันทึกเป็น .json ประจำวัน</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleSaveDraft(true)}
                        className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:opacity-60"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : (
                          <Brain className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>บันทึก & ให้ AI วิเคราะห์ทันที</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: AI SLEEP ANALYSIS & VISUAL METRICS                      */}
          {/* ============================================================== */}
          {activeTab === 'analysis' && (
            <div>
              {!selectedRecord ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-[#342B26] bg-[#231D1A] p-8 text-center">
                  <Brain className="h-9 w-9 text-[#6F655E]" />
                  <h3 className="mt-3 text-sm font-semibold text-[#FAF6F0]">
                    ยังไม่มีข้อมูลการนอนสำหรับวิเคราะห์
                  </h3>
                  <p className="mt-1.5 max-w-md text-xs text-[#A89C90]">
                    อัปโหลดรูปภาพการนอนจากแอพสุขภาพก่อน เพื่อแปลงเป็นไฟล์ .json ประจำวันแล้วให้ AI วิเคราะห์เชิงลึก
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="mt-4 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#D97736] px-4 py-2 text-xs font-semibold text-[#FAF6F0] hover:bg-[#C6682A]"
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span>ไปหน้าอัปโหลดภาพการนอน</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Date Selector & Primary Action */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#342B26] pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs text-[#A89C90]" htmlFor="sleep-day-select">
                        เลือกวันที่:
                      </label>
                      <select
                        id="sleep-day-select"
                        value={selectedRecord.id}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="rounded-lg border border-[#453A33] bg-[#27201C] px-3 py-1.5 text-xs font-medium text-[#FAF6F0] focus:border-[#818CF8] focus:outline-none"
                      >
                        {logs.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.date} ({item.dateLabel}) —{' '}
                            {item.sleepScore != null ? `${item.sleepScore} คะแนน` : 'ไม่ระบุคะแนน'}
                          </option>
                        ))}
                      </select>

                      <span className="text-xs text-[#9C9084]">
                        {selectedRecord.sourceApp}
                        {selectedRecord.bedtime && selectedRecord.wakeTime
                          ? ` · เข้านอน ${selectedRecord.bedtime} – ตื่น ${selectedRecord.wakeTime}`
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadSleepJsonFile(selectedRecord, `sleep-${selectedRecord.date}.json`)
                        }
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#453A33] bg-[#2B2420] px-3 py-2 text-xs font-medium text-[#D6CBC0] hover:border-[#66564B] hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        <span>ดาวน์โหลด .json</span>
                      </button>

                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => void handleRunAiAnalysis(selectedRecord)}
                        className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:opacity-60"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>
                          {selectedRecord.aiAnalysis ? 'วิเคราะห์ใหม่ด้วย AI' : 'เริ่มวิเคราะห์ด้วย AI'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 4-Column Quantitative KPI Strip (Zero-pill, Tabular Numerals) */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#342B26] bg-[#241E1A] p-4">
                      <div className="text-xs text-[#A89C90]">คะแนนการนอน</div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-bold tabular-nums text-[#FAF6F0]">
                          {selectedRecord.sleepScore ?? '—'}
                        </span>
                        <span className="text-xs text-[#8E8277]">/ 100</span>
                      </div>
                      <div className="mt-1 text-xs text-[#A5B4FC]">
                        {selectedRecord.percentileBeat != null
                          ? `ดีกว่า ${selectedRecord.percentileBeat}% ของผู้ใช้`
                          : selectedRecord.sourceApp}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#342B26] bg-[#241E1A] p-4">
                      <div className="text-xs text-[#A89C90]">ระยะเวลานอนรวม</div>
                      <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#FAF6F0]">
                        {formatMinutesToThaiDuration(selectedRecord.totalSleepMinutes)}
                      </div>
                      <div className="mt-1 text-xs text-[#8E8277]">
                        {selectedRecord.totalSleepStatus || 'บันทึกแล้ว'}
                        {selectedRecord.totalSleepReference
                          ? ` · เกณฑ์ ${selectedRecord.totalSleepReference}`
                          : ''}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#342B26] bg-[#241E1A] p-4">
                      <div className="text-xs text-[#A89C90]">ความต่อเนื่อง / การหายใจ</div>
                      <div className="mt-1.5 flex items-baseline gap-2 font-mono text-xl font-bold tabular-nums text-[#FAF6F0]">
                        <span>{selectedRecord.deepSleepContinuityScore ?? '—'}</span>
                        <span className="text-sm font-normal text-[#6F655E]">/</span>
                        <span>{selectedRecord.breathingQualityScore ?? '—'}</span>
                      </div>
                      <div className="mt-1 text-xs text-[#8E8277]">
                        ตื่นกลางดึก {selectedRecord.awakeCount ?? '—'} ครั้ง
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#342B26] bg-[#241E1A] p-4">
                      <div className="text-xs text-[#A89C90]">ช่วงเวลานอน · ความเครียด</div>
                      <div className="mt-1.5 flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums text-[#FAF6F0]">
                        <Clock className="h-4 w-4 shrink-0 text-[#A5B4FC]" />
                        <span>
                          {selectedRecord.bedtime && selectedRecord.wakeTime
                            ? `${selectedRecord.bedtime}–${selectedRecord.wakeTime}`
                            : '—'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#FBBF24]">
                        {selectedRecord.previousDayStressScore != null
                          ? `ความเครียดวันก่อนหน้า ${selectedRecord.previousDayStressScore}`
                          : 'ไม่มีค่าความเครียดระบุในภาพ'}
                      </div>
                    </div>
                  </div>

                  {/* Proportional Sleep Stages Distribution Bar */}
                  <div className="rounded-xl border border-[#342B26] bg-[#241E1A] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#FAF6F0]">สัดส่วนระยะการนอน</span>
                      <span className="tabular-nums text-[#A89C90]">
                        หลับลึก {selectedRecord.stages.deep.percent ?? '—'}% · หลับตื้น{' '}
                        {selectedRecord.stages.light.percent ?? '—'}% · REM{' '}
                        {selectedRecord.stages.rem.percent ?? '—'}%
                      </span>
                    </div>

                    {(() => {
                      const d = selectedRecord.stages.deep.percent ?? selectedRecord.stages.deep.minutes;
                      const l = selectedRecord.stages.light.percent ?? selectedRecord.stages.light.minutes;
                      const r = selectedRecord.stages.rem.percent ?? selectedRecord.stages.rem.minutes;
                      const sum = Math.max(1, d + l + r);
                      return (
                        <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-md bg-[#161210]">
                          <div
                            style={{ width: `${(d / sum) * 100}%` }}
                            className="bg-[#7C3AED]"
                            title={`หลับลึก ${selectedRecord.stages.deep.durationText}`}
                          />
                          <div
                            style={{ width: `${(l / sum) * 100}%` }}
                            className="bg-[#C084FC]"
                            title={`หลับตื้น ${selectedRecord.stages.light.durationText}`}
                          />
                          <div
                            style={{ width: `${(r / sum) * 100}%` }}
                            className="bg-[#FB7185]"
                            title={`REM ${selectedRecord.stages.rem.durationText}`}
                          />
                        </div>
                      );
                    })()}

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#C6B9AC] sm:grid-cols-3">
                      <div className="flex items-center justify-between border-t border-[#312924] pt-2">
                        <span className="text-[#C4B5FD]">หลับลึก (Deep)</span>
                        <span className="font-mono tabular-nums">
                          {selectedRecord.stages.deep.durationText ||
                            formatMinutesToThaiDuration(selectedRecord.stages.deep.minutes)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#312924] pt-2">
                        <span className="text-[#E9D5FF]">หลับตื้น (Light)</span>
                        <span className="font-mono tabular-nums">
                          {selectedRecord.stages.light.durationText ||
                            formatMinutesToThaiDuration(selectedRecord.stages.light.minutes)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#312924] pt-2">
                        <span className="text-[#FDA4AF]">หลับฝัน (REM)</span>
                        <span className="font-mono tabular-nums">
                          {selectedRecord.stages.rem.durationText ||
                            formatMinutesToThaiDuration(selectedRecord.stages.rem.minutes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Analysis Report */}
                  {analysisError && (
                    <div className="rounded-xl border border-[#7F1D1D] bg-[#2B1717] px-4 py-3 text-xs text-[#FCA5A5]">
                      {analysisError}
                    </div>
                  )}

                  {selectedRecord.aiAnalysis ? (
                    <div className="flex flex-col gap-5 rounded-xl border border-[#3E3959] bg-[#211E2D] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#34304B] pb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#E0E7FF]">
                          <Brain className="h-4 w-4 text-[#818CF8]" />
                          <span>ผลวิเคราะห์การนอนโดย AI</span>
                        </div>
                        <span className="text-xs text-[#9E99B8]">
                          วิเคราะห์เมื่อ{' '}
                          {new Date(selectedRecord.aiAnalysis.analyzedAt).toLocaleString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · ผู้ช่วยมีน่าในห้องทำงานก็อ่านข้อมูลนี้ได้แล้ว
                        </span>
                      </div>

                      <p className="text-sm leading-relaxed text-[#F5F3FF]">
                        {selectedRecord.aiAnalysis.summary}
                      </p>

                      {selectedRecord.aiAnalysis.circadianNote && (
                        <div className="rounded-lg border border-[#3B3654] bg-[#1A1725] p-3.5">
                          <div className="text-xs font-semibold text-[#C7D2FE]">
                            จังหวะนาฬิกาชีวภาพ (Circadian Rhythm)
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-[#D8D4EB]">
                            {selectedRecord.aiAnalysis.circadianNote}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-[#2B4237] bg-[#17241E] p-4">
                          <h4 className="text-xs font-semibold text-[#6EE7B7]">
                            จุดแข็งของการนอนรอบนี้
                          </h4>
                          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[#D1FAE5]">
                            {selectedRecord.aiAnalysis.strengths.map((item, idx) => (
                              <li key={idx}>· {item}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-lg border border-[#4D3B24] bg-[#251E15] p-4">
                          <h4 className="text-xs font-semibold text-[#FCD34D]">
                            จุดที่ควรสังเกตและดูแล
                          </h4>
                          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[#FEF3C7]">
                            {selectedRecord.aiAnalysis.concerns.map((item, idx) => (
                              <li key={idx}>· {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="border-t border-[#34304B] pt-4">
                        <h4 className="text-xs font-semibold text-[#C7D2FE]">
                          คำแนะนำที่ทำได้จริงสำหรับการนอนรอบถัดไป
                        </h4>
                        <ol className="mt-2 space-y-2 text-xs leading-relaxed text-[#E5E2F5]">
                          {selectedRecord.aiAnalysis.actionableTips.map((tip, idx) => (
                            <li key={idx}>
                              <span className="font-mono font-semibold text-[#A5B4FC]">
                                0{idx + 1}.
                              </span>{' '}
                              {tip}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-[#3B3654] bg-[#211E2D] p-6 text-center">
                      <p className="text-sm font-medium text-[#E0E7FF]">
                        ข้อมูล .json วันที่ {selectedRecord.date} พร้อมให้ AI วิเคราะห์แล้ว
                      </p>
                      <p className="mt-1 text-xs text-[#A5A0BD]">
                        กดปุ่มด้านล่างเพื่อให้ AI ประเมินสัดส่วนการนอน นาฬิกาชีวภาพ ความเครียด และเปรียบเทียบแนวโน้มย้อนหลัง
                      </p>
                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => void handleRunAiAnalysis(selectedRecord)}
                        className="mt-4 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : (
                          <Brain className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>เริ่มวิเคราะห์ข้อมูลการนอนด้วย AI</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: DAILY .JSON ARCHIVE & EXPORT                            */}
          {/* ============================================================== */}
          {activeTab === 'history' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#342B26] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#FAF6F0]">
                    คลังไฟล์ .json ข้อมูลการนอนประจำวัน
                  </h3>
                  <p className="mt-0.5 text-xs text-[#A89C90]">
                    เก็บสะสมอัตโนมัติทั้งบนเซิร์ฟเวอร์และเบราว์เซอร์ ส่งออกเป็นไฟล์ .json หรือให้มีน่าช่วยวิเคราะห์ต่อในห้องทำงานได้ตลอดเวลา
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
                      downloadSleepJsonFile(logs, `sleep-daily-dataset-${getLocalIsoDate()}.json`)
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#D97736] px-3.5 py-1.5 text-xs font-semibold text-[#FAF6F0] hover:bg-[#C6682A] disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>ส่งออกทั้งหมด (.json)</span>
                  </button>
                </div>
              </div>

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
                              {item.aiAnalysis && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#6EE7B7]">AI วิเคราะห์แล้ว</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              title="เปิดดูผลวิเคราะห์ AI"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(item.id);
                                setActiveTab('analysis');
                              }}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#3E352F] bg-[#2B2420] text-[#C7D2FE] hover:border-[#6366F1]"
                            >
                              <Brain className="h-3.5 w-3.5" />
                            </button>
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
                              onClick={() => void handleCopyJson(selectedRecord, selectedRecord.id)}
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
                                  selectedRecord,
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
                          {JSON.stringify(selectedRecord, null, 2)}
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

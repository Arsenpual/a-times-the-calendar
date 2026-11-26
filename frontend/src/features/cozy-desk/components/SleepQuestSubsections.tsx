import { useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  Copy,
  Download,
  FileJson,
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  ScanSearch,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DailySleepRecord } from '../types/game';
import {
  buildRawSleepInfographic,
  countStandardHuaweiFields,
  downloadSleepJsonFile,
  formatMinutesToThaiDuration,
  getLocalIsoDate,
  STANDARD_HUAWEI_FIELDS_TOTAL,
} from '../api/sleepLogsApi';
import { parseOptionalNum } from './SleepDriveImagePicker';

const CONFIDENCE_LABELS: Record<'high' | 'medium' | 'low', { text: string; tone: string }> = {
  high: { text: 'ความมั่นใจสูง', tone: 'text-[#6EE7B7]' },
  medium: { text: 'ความมั่นใจปานกลาง', tone: 'text-[#FDE68A]' },
  low: { text: 'ควรตรวจทานตัวเลข', tone: 'text-[#FCA5A5]' },
};

interface SleepDraftEditorColumnProps {
  draftRecord: DailySleepRecord;
  existingDateMatch: DailySleepRecord | null;
  showRawDraftJson: boolean;
  setShowRawDraftJson: Dispatch<SetStateAction<boolean>>;
  handleCopyJson: (payload: unknown, key: string) => Promise<void>;
  copiedId: string | null;
  updateDraftField: <K extends keyof DailySleepRecord>(key: K, value: DailySleepRecord[K]) => void;
  updateDraftStage: (stageKey: 'deep' | 'light' | 'rem', field: 'minutes' | 'percent', rawValue: string) => void;
  recalcTotalFromStages: () => void;
  onResetDraft: () => void;
  isSaving: boolean;
  handleSaveDraft: () => Promise<void>;
}

export function SleepDraftEditorColumn({
  draftRecord,
  existingDateMatch,
  showRawDraftJson,
  setShowRawDraftJson,
  handleCopyJson,
  copiedId,
  updateDraftField,
  updateDraftStage,
  recalcTotalFromStages,
  onResetDraft,
  isSaving,
  handleSaveDraft,
}: SleepDraftEditorColumnProps) {
  const stageSum =
    (draftRecord.stages.deep.minutes ?? 0) +
    (draftRecord.stages.light.minutes ?? 0) +
    (draftRecord.stages.rem.minutes ?? 0);
  const totalDiffersFromStages =
    stageSum > 0 &&
    draftRecord.totalSleepMinutes != null &&
    Math.abs(draftRecord.totalSleepMinutes - stageSum) >= 2;
  const scanSummary = draftRecord.scanSummary ?? null;
  const standardFound = countStandardHuaweiFields(draftRecord);
  const confidenceInfo = scanSummary ? CONFIDENCE_LABELS[scanSummary.confidence] : null;
  const isManualMode = !scanSummary;

  return (
    <div className="flex flex-col gap-4 lg:col-span-7">
      <div className="flex flex-col gap-4 rounded-xl border border-[#3B312B] bg-[#241E1A] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#342B26] pb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#FAF6F0]">
              {isManualMode
                ? 'กรอกข้อมูลการนอนแบบ Manual (มาตรฐาน Huawei Health)'
                : 'ตรวจสอบข้อมูลมาตรฐาน Huawei Health ก่อนบันทึก'}
            </h3>
            <p className="mt-0.5 text-xs text-[#A89C90] tabular-nums">
              {draftRecord.sourceApp} · {draftRecord.dateLabel || draftRecord.date} ·{' '}
              {isManualMode ? 'กรอกแล้ว' : 'พบ'} {standardFound}/{STANDARD_HUAWEI_FIELDS_TOTAL}{' '}
              ค่ามาตรฐาน
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(standardFound > 0 || scanSummary != null) && (
              <button
                type="button"
                onClick={onResetDraft}
                title="ล้างค่าเพื่อเริ่มกรอกใหม่"
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#453A33] bg-[#2D2621] px-2.5 py-1.5 text-xs font-medium text-[#B8ABA0] transition-colors hover:border-[#66564B] hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                <span>ล้างค่า</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowRawDraftJson((v) => !v)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#453A33] bg-[#2D2621] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] transition-colors hover:border-[#66564B] hover:text-white"
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
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#453A33] bg-[#2D2621] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] transition-colors hover:border-[#66564B] hover:text-white"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>ดาวน์โหลด .json</span>
            </button>
          </div>
        </div>

          {/* Canonical Scan Summary Report (Flat single-elevation, unboxed metadata) */}
          {scanSummary && (
            <div className="rounded-lg border border-[#3B3452] bg-[#1D1929] px-3.5 py-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[#E0E7FF]">
                  <ScanSearch className="h-3.5 w-3.5 shrink-0 text-[#A5B4FC]" />
                  <span className="font-semibold">ผลสแกนมาตรฐาน Huawei Health:</span>
                  <span>{scanSummary.detectedApp}</span>
                  {scanSummary.detectedLanguage && scanSummary.detectedLanguage !== 'unknown' && (
                    <>
                      <span className="text-[#6F658A]" aria-hidden="true">·</span>
                      <span className="font-mono text-[11px] uppercase text-[#A5B4FC]">
                        {scanSummary.detectedLanguage}
                      </span>
                    </>
                  )}
                  <span className="text-[#6F658A]" aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[#C7D2FE]">
                    {standardFound}/{STANDARD_HUAWEI_FIELDS_TOTAL} ค่ามาตรฐาน
                  </span>
                </div>
                {confidenceInfo && (
                  <span className={`text-[11px] font-medium ${confidenceInfo.tone}`}>
                    {confidenceInfo.text}
                  </span>
                )}
              </div>
              {scanSummary.scannableSections.length > 0 && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#C7D2FE]">
                  <span className="text-[#9C9084]">ส่วนที่สกัดตามมาตรฐาน: </span>
                  {scanSummary.scannableSections.join(' · ')}
                </p>
              )}
              {scanSummary.skippedSections.length > 0 && (
                <p className="mt-1 text-[11px] leading-relaxed text-[#FDE68A]/85">
                  <span className="text-[#9C9084]">ข้ามส่วนนอกมาตรฐาน / ไม่มีตัวเลข (ไม่เก็บลง .json): </span>
                  {scanSummary.skippedSections.join(' · ')}
                </p>
              )}
            </div>
          )}

          {showRawDraftJson ? (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  void handleCopyJson(buildRawSleepInfographic(draftRecord), 'draft')
                }
                className="absolute top-3 right-3 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#453A33] bg-[#26201C] px-2.5 py-1 text-[11px] font-medium text-[#E5DDD3] hover:border-[#66564B]"
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
              <pre className="max-h-[380px] overflow-auto rounded-lg border border-[#342B26] bg-[#161210] p-4 font-mono text-[11px] leading-relaxed text-[#C7D2FE]">
                {JSON.stringify(buildRawSleepInfographic(draftRecord), null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Primary Fields */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                  <span className="text-[#A89C90]">แอพต้นทาง</span>
                  <input
                    type="text"
                    value={draftRecord.sourceApp}
                    placeholder="Huawei Health"
                    onChange={(e) => updateDraftField('sourceApp', e.target.value)}
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 text-xs text-[#FAF6F0] focus:border-[#818CF8] focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">วันที่ (YYYY-MM-DD)</span>
                  <input
                    type="date"
                    value={draftRecord.date}
                    onChange={(e) => updateDraftField('date', e.target.value)}
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] focus:border-[#818CF8] focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">เวลาเข้านอน</span>
                  <input
                    type="text"
                    placeholder="null"
                    value={draftRecord.bedtime ?? ''}
                    onChange={(e) => updateDraftField('bedtime', e.target.value || null)}
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B] focus:border-[#818CF8] focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">เวลาตื่นนอน</span>
                  <input
                    type="text"
                    placeholder="null"
                    value={draftRecord.wakeTime ?? ''}
                    onChange={(e) => updateDraftField('wakeTime', e.target.value || null)}
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B] focus:border-[#818CF8] focus:outline-none"
                  />
                </label>
              </div>

              {/* 3 Canonical Sleep Stages */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {(
                  [
                    { key: 'deep', label: 'หลับลึก (Deep)', accent: 'text-[#A78BFA]' },
                    { key: 'light', label: 'หลับตื้น (Light / นอนน้อย)', accent: 'text-[#E879F9]' },
                    { key: 'rem', label: 'หลับฝัน (REM)', accent: 'text-[#FB7185]' },
                  ] as const
                ).map((st) => {
                  const data = draftRecord.stages[st.key];
                  return (
                    <div
                      key={st.key}
                      className="rounded-lg border border-[#382F29] bg-[#1C1714] p-3"
                    >
                      <div className={`text-xs font-semibold ${st.accent}`}>{st.label}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-[11px] text-[#A89C90]">
                          <span>นาที</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="null"
                            value={data.minutes ?? ''}
                            onChange={(e) =>
                              updateDraftStage(st.key, 'minutes', e.target.value)
                            }
                            className="rounded border border-[#3F342D] bg-[#14100E] px-2 py-1 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B]"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-[#A89C90]">
                          <span>สัดส่วน (%)</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="null"
                            value={data.percent ?? ''}
                            onChange={(e) =>
                              updateDraftStage(st.key, 'percent', e.target.value)
                            }
                            className="rounded border border-[#3F342D] bg-[#14100E] px-2 py-1 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B]"
                          />
                        </label>
                      </div>
                      <div className="mt-1.5 text-[11px] text-[#8E8277] tabular-nums">
                        {data.durationText || formatMinutesToThaiDuration(data.minutes)}
                        {data.status ? ` · ${data.status}` : ''}
                        {data.referenceRange ? ` · ${data.referenceRange}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Core Totals & 3 Huawei Health Sub-Metrics */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">คะแนนการนอน</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="null"
                    value={draftRecord.sleepScore ?? ''}
                    onChange={(e) =>
                      updateDraftField('sleepScore', parseOptionalNum(e.target.value))
                    }
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B] focus:border-[#818CF8] focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">ดีกว่าผู้ใช้ (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="null"
                    value={draftRecord.percentileBeat ?? ''}
                    onChange={(e) =>
                      updateDraftField('percentileBeat', parseOptionalNum(e.target.value))
                    }
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B] focus:border-[#818CF8] focus:outline-none"
                  />
                </label>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="sleep-total-mins" className="text-[#A89C90]">
                      เวลานอนรวม (นาที)
                    </label>
                    {totalDiffersFromStages && (
                      <button
                        type="button"
                        onClick={recalcTotalFromStages}
                        title={`ปรับให้ตรงกับผลรวม 3 ช่วง (${stageSum} นาที)`}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[10px] font-medium text-[#A5B4FC] hover:text-white"
                      >
                        <Calculator className="h-3 w-3" />
                        <span>ใช้ {stageSum}</span>
                      </button>
                    )}
                  </div>
                  <input
                    id="sleep-total-mins"
                    type="number"
                    min={0}
                    placeholder="null"
                    value={draftRecord.totalSleepMinutes ?? ''}
                    onChange={(e) => {
                      const mins = parseOptionalNum(e.target.value);
                      updateDraftField('totalSleepMinutes', mins);
                      updateDraftField(
                        'totalSleepText',
                        mins != null ? formatMinutesToThaiDuration(mins) : null
                      );
                    }}
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B]"
                  />
                  {(draftRecord.totalSleepStatus || draftRecord.totalSleepReference) && (
                    <span className="text-[10px] text-[#8E8277]">
                      {[draftRecord.totalSleepStatus, draftRecord.totalSleepReference]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">ความต่อเนื่องหลับลึก</span>
                  <input
                    type="number"
                    placeholder="null"
                    value={draftRecord.deepSleepContinuityScore ?? ''}
                    onChange={(e) =>
                      updateDraftField(
                        'deepSleepContinuityScore',
                        parseOptionalNum(e.target.value)
                      )
                    }
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B] focus:border-[#818CF8] focus:outline-none"
                  />
                  {(draftRecord.deepSleepContinuityStatus || draftRecord.deepSleepContinuityReference) && (
                    <span className="text-[10px] text-[#8E8277]">
                      {[draftRecord.deepSleepContinuityStatus, draftRecord.deepSleepContinuityReference]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">คุณภาพการหายใจ</span>
                  <input
                    type="number"
                    placeholder="null"
                    value={draftRecord.breathingQualityScore ?? ''}
                    onChange={(e) =>
                      updateDraftField(
                        'breathingQualityScore',
                        parseOptionalNum(e.target.value)
                      )
                    }
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B] focus:border-[#818CF8] focus:outline-none"
                  />
                  {(draftRecord.breathingQualityStatus || draftRecord.breathingQualityReference) && (
                    <span className="text-[10px] text-[#8E8277]">
                      {[draftRecord.breathingQualityStatus, draftRecord.breathingQualityReference]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#A89C90]">จำนวนครั้งที่ตื่นนอน</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="null"
                    value={draftRecord.awakeCount ?? ''}
                    onChange={(e) =>
                      updateDraftField('awakeCount', parseOptionalNum(e.target.value))
                    }
                    className="rounded-lg border border-[#423730] bg-[#1A1512] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#FAF6F0] placeholder:text-[#5F544B] focus:border-[#818CF8] focus:outline-none"
                  />
                  {(draftRecord.awakeStatus || draftRecord.awakeReference) && (
                    <span className="text-[10px] text-[#8E8277]">
                      {[draftRecord.awakeStatus, draftRecord.awakeReference]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Overwrite Notice */}
          {existingDateMatch && (
            <div className="flex items-center gap-2 rounded-lg border border-[#78531B] bg-[#2B2214] px-3 py-2 text-[11px] text-[#FDE68A]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#FBBF24]" />
              <span>
                วันที่ {draftRecord.date} มีบันทึกอยู่แล้วในคลัง — หากกดบันทึก ระบบจะอัปเดตทับข้อมูลเดิมของวันนี้
              </span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#342B26] pt-4">
            <span className="text-[11px] text-[#9C9084]">
              {standardFound === 0
                ? 'กรอกข้อมูลเองอย่างน้อย 1 ช่อง หรืออัปโหลดภาพด้านซ้ายเพื่อให้ AI สกัดค่าลงฟอร์มนี้'
                : 'ช่องที่ว่างจะถูกบันทึกเป็น null ตามมาตรฐาน Huawei Health — กดบันทึกเพื่อสะสมและส่งให้มีน่าสรุปได้ทันที'}
            </span>
            <button
              type="button"
              disabled={isSaving || standardFound === 0}
              onClick={() => void handleSaveDraft()}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <FileJson className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {existingDateMatch ? 'อัปเดต .json ประจำวัน' : 'บันทึกเป็น .json ประจำวัน'}
              </span>
            </button>
          </div>
        </div>
    </div>
  );
}

interface SleepHistoryArchiveSectionProps {
  activeTab: 'upload' | 'history';
  jsonImportRef: RefObject<HTMLInputElement | null>;
  handleImportJsonFile: (file: File | null | undefined) => Promise<void>;
  logs: DailySleepRecord[];
  onAskMinaAnalyzeSleep?: () => void;
  importError: string | null;
  selectedRecord: DailySleepRecord | null;
  setSelectedId: (id: string) => void;
  onEditRecord: (record: DailySleepRecord) => void;
  onDeleteLog: (id: string) => Promise<void>;
  handleCopyJson: (payload: unknown, key: string) => Promise<void>;
  copiedId: string | null;
}

export function SleepHistoryArchiveSection({
  activeTab,
  jsonImportRef,
  handleImportJsonFile,
  logs,
  onAskMinaAnalyzeSleep,
  importError,
  selectedRecord,
  setSelectedId,
  onEditRecord,
  onDeleteLog,
  handleCopyJson,
  copiedId,
}: SleepHistoryArchiveSectionProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <>
      {/* ============================================================== */}
      {/* TAB 2: DAILY .JSON ARCHIVE & EXPORT                            */}
      {/* ============================================================== */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#342B26] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#FAF6F0]">
                คลังไฟล์ .json ข้อมูลการนอนมาตรฐาน Huawei Health
              </h3>
              <p className="mt-0.5 text-xs text-[#A89C90]">
                ทุกไฟล์เก็บโครงสร้างมาตรฐานเดียวกันทั้งหมด พร้อมส่งให้มีน่าสรุปภาพรวมทางแชทผู้ช่วย AI
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
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#453A33] bg-[#2B2420] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] hover:border-[#66564B] hover:text-white"
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
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#453A33] bg-[#2B2420] px-3 py-1.5 text-xs font-medium text-[#D6CBC0] hover:border-[#66564B] hover:text-white disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>ส่งออกทั้งหมด (.json)</span>
              </button>
              {onAskMinaAnalyzeSleep && (
                <button
                  type="button"
                  disabled={logs.length === 0}
                  onClick={onAskMinaAnalyzeSleep}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#4F46E5] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
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
                อัปโหลดภาพสถิติการนอนครั้งแรกในแท็บ “สแกนภาพ → JSON” เพื่อเริ่มสะสมข้อมูล
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Left: Daily List */}
              <div className="flex flex-col gap-2 lg:col-span-5">
                {logs.map((item) => {
                  const isSelected = selectedRecord?.id === item.id;
                  const isConfirmingDelete = confirmDeleteId === item.id;
                  const itemFound = countStandardHuaweiFields(item);
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
                          <span className="text-[#8E8277]" aria-hidden="true">·</span>
                          <span className="truncate text-[#C6B9AC]">{item.sourceApp}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-[#9C9084]">
                          <span>
                            {item.sleepScore != null ? `${item.sleepScore} คะแนน` : 'ไม่ระบุคะแนน'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatMinutesToThaiDuration(item.totalSleepMinutes)}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {itemFound}/{STANDARD_HUAWEI_FIELDS_TOTAL} ค่ามาตรฐาน
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex shrink-0 items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isConfirmingDelete ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                void onDeleteLog(item.id);
                              }}
                              className="cursor-pointer whitespace-nowrap rounded-md bg-[#991B1B] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#B91C1C]"
                            >
                              ยืนยันลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="cursor-pointer whitespace-nowrap rounded-md border border-[#3E352F] bg-[#2B2420] px-2 py-1 text-[11px] text-[#C6B9AC] hover:text-white"
                            >
                              ยกเลิก
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              title="แก้ไขบันทึกวันนี้"
                              aria-label={`แก้ไขบันทึกวันที่ ${item.date}`}
                              onClick={() => onEditRecord(item)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#3E352F] bg-[#2B2420] text-[#C7D2FE] hover:border-[#6366F1] hover:text-white"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="ลบบันทึกวันนี้"
                              aria-label={`ลบบันทึกวันที่ ${item.date}`}
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#3E352F] bg-[#2B2420] text-[#A89C90] hover:border-[#991B1B] hover:text-[#FCA5A5]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
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
                          onClick={() => onEditRecord(selectedRecord)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-[#3F352E] bg-[#241E1A] px-2.5 py-1 text-xs text-[#C7D2FE] hover:border-[#6366F1] hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>แก้ไข</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyJson(
                              selectedRecord.rawInfographic ??
                                buildRawSleepInfographic(selectedRecord),
                              selectedRecord.id
                            )
                          }
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-[#3F352E] bg-[#241E1A] px-2.5 py-1 text-xs text-[#D6CBC0] hover:text-white"
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
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-[#3F352E] bg-[#241E1A] px-2.5 py-1 text-xs text-[#D6CBC0] hover:text-white"
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
    </>
  );
}

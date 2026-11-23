import {
  Check,
  Copy,
  Download,
  FileJson,
  Loader2,
  MessageCircle,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  buildRawSleepInfographic,
  downloadSleepJsonFile,
  formatMinutesToThaiDuration,
  getLocalIsoDate,
} from '../api/sleepLogsApi';
import { parseOptionalNum } from './SleepDriveImagePicker';

export function SleepDraftEditorColumn({
  draftRecord,
  showRawDraftJson,
  setShowRawDraftJson,
  handleCopyJson,
  copiedId,
  updateDraftField,
  updateDraftStage,
  isSaving,
  handleSaveDraft,
}: any) {
  return (
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
  );
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
  onDeleteLog,
  handleCopyJson,
  copiedId,
}: any) {
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
    </>
  );
}

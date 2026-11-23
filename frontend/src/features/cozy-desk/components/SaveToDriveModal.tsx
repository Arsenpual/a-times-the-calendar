import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  HardDriveUpload,
  Loader2,
  Table2,
  X,
} from 'lucide-react';
import type { GoogleDriveFile } from '../types/game';
import {
  DRIVE_DOC_MIME,
  DRIVE_SHEET_MIME,
  ensureCozyDeskDriveFolder,
  fetchDriveFolders,
  GoogleDriveApiError,
  uploadConvertedDriveDocument,
} from '../api/driveApi';
import {
  type DriveExportFormat,
  extractCleanDocumentBody,
  markdownToGoogleDocHtml,
  markdownToSpreadsheetRows,
  rowsToUtf8Csv,
  suggestDocumentTitle,
} from '../lib/driveExport';

interface SaveToDriveModalProps {
  isOpen: boolean;
  initialContent: string;
  initialTitle?: string;
  assistantName?: string;
  googleUser: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  authError: string | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut?: () => void;
  onRequestDriveWriteAccess?: () => Promise<boolean>;
  onTokenExpired: () => void;
  onSaved?: (file: GoogleDriveFile, format: DriveExportFormat) => void;
  onClose: () => void;
}

const FORMAT_OPTIONS: Array<{
  id: DriveExportFormat;
  label: string;
  desc: string;
  icon: typeof FileText;
  accentClass: string;
}> = [
  {
    id: 'google_doc',
    label: 'Google Docs',
    desc: 'แปลงเป็นเอกสารจัดหน้า พร้อมอ่านและแก้ไข',
    icon: FileText,
    accentClass: 'text-[#2563EB]',
  },
  {
    id: 'google_sheet',
    label: 'Google Sheets',
    desc: 'แปลงตาราง/รายการเป็นสเปรดชีตอัตโนมัติ',
    icon: Table2,
    accentClass: 'text-[#15803D]',
  },
  {
    id: 'markdown',
    label: 'Markdown (.md)',
    desc: 'ไฟล์ข้อความพร้อมโค้ดและหัวข้อเดิม',
    icon: FileCode2,
    accentClass: 'text-[#B45309]',
  },
];

export function SaveToDriveModal({
  isOpen,
  initialContent,
  initialTitle,
  assistantName = 'ผู้ช่วย AI',
  googleUser,
  accessToken,
  isSigningIn,
  authError,
  onGoogleSignIn,
  onGoogleSignOut,
  onRequestDriveWriteAccess,
  onTokenExpired,
  onSaved,
  onClose,
}: SaveToDriveModalProps) {
  const isAuthenticated = Boolean(googleUser && accessToken);

  const [format, setFormat] = useState<DriveExportFormat>('google_doc');
  const [fileName, setFileName] = useState('');
  const [contentText, setContentText] = useState('');
  const [targetFolder, setTargetFolder] = useState<string>('cozy_folder');
  const [folders, setFolders] = useState<GoogleDriveFile[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [needsScopeReauth, setNeedsScopeReauth] = useState(false);
  const [savedFile, setSavedFile] = useState<GoogleDriveFile | null>(null);
  const [showRawEditForSheet, setShowRawEditForSheet] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const cleanBody = extractCleanDocumentBody(initialContent);
    const suggested =
      initialTitle?.trim() || suggestDocumentTitle(initialContent, 'เอกสารจาก Cozy Desk AI');
    setFileName(suggested);
    setContentText(cleanBody);
    setSaveError(null);
    setNeedsScopeReauth(false);
    setSavedFile(null);
    setShowRawEditForSheet(false);

    // Auto-select Google Sheets if the message contains a Markdown table
    const hasMarkdownTable = cleanBody
      .split('\n')
      .some((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));
    setFormat(hasMarkdownTable ? 'google_sheet' : 'google_doc');
  }, [isOpen, initialContent, initialTitle]);

  useEffect(() => {
    if (!isOpen || !accessToken) return;
    let active = true;
    setIsLoadingFolders(true);
    fetchDriveFolders(accessToken)
      .then((list) => {
        if (active) setFolders(list);
      })
      .catch(() => {
        // Folder listing is optional; user can still save to Cozy Desk AI folder or My Drive root
      })
      .finally(() => {
        if (active) setIsLoadingFolders(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, isOpen]);

  const sheetPreviewRows = useMemo(() => {
    if (format !== 'google_sheet') return [];
    return markdownToSpreadsheetRows(fileName || 'ตารางจาก Cozy Desk AI', contentText);
  }, [contentText, fileName, format]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!accessToken || !fileName.trim() || !contentText.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    setNeedsScopeReauth(false);

    try {
      let parentFolderId: string | undefined;
      if (targetFolder === 'cozy_folder') {
        const cozyFolder = await ensureCozyDeskDriveFolder(accessToken);
        parentFolderId = cozyFolder.id;
      } else if (targetFolder !== 'root') {
        parentFolderId = targetFolder;
      }

      const trimmedTitle = fileName.trim();
      let uploadName = trimmedTitle;
      let targetMimeType = DRIVE_DOC_MIME;
      let sourceMimeType = 'text/html';
      let uploadContent = '';

      if (format === 'google_doc') {
        targetMimeType = DRIVE_DOC_MIME;
        sourceMimeType = 'text/html';
        uploadContent = markdownToGoogleDocHtml(trimmedTitle, contentText);
      } else if (format === 'google_sheet') {
        targetMimeType = DRIVE_SHEET_MIME;
        sourceMimeType = 'text/csv';
        const rows = markdownToSpreadsheetRows(trimmedTitle, contentText);
        uploadContent = rowsToUtf8Csv(rows);
      } else {
        uploadName = trimmedTitle.toLowerCase().endsWith('.md')
          ? trimmedTitle
          : `${trimmedTitle}.md`;
        targetMimeType = 'text/markdown';
        sourceMimeType = 'text/markdown';
        uploadContent = contentText;
      }

      const created = await uploadConvertedDriveDocument(accessToken, {
        name: uploadName,
        targetMimeType,
        sourceMimeType,
        content: uploadContent,
        parentFolderId,
      });

      setSavedFile(created);
      onSaved?.(created, format);
    } catch (err) {
      if (err instanceof GoogleDriveApiError) {
        if (err.status === 401) {
          onTokenExpired();
        } else if (err.status === 403) {
          setNeedsScopeReauth(true);
        }
        setSaveError(err.message);
      } else {
        setSaveError('ไม่สามารถบันทึกลง Google Drive ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatButtonLabel =
    format === 'google_doc'
      ? 'เปิดใน Google Docs'
      : format === 'google_sheet'
        ? 'เปิดใน Google Sheets'
        : 'เปิดใน Google Drive';

  const handleLocalDownload = () => {
    const trimmedTitle = (fileName.trim() || 'เอกสารจาก Cozy Desk AI').replace(
      /[\\/:*?"<>|]/g,
      '-'
    );
    let blobContent = '';
    let mimeType = 'text/plain;charset=utf-8';
    let ext = 'txt';

    if (format === 'google_doc') {
      blobContent = markdownToGoogleDocHtml(trimmedTitle, contentText);
      mimeType = 'application/msword;charset=utf-8';
      ext = 'doc';
    } else if (format === 'google_sheet') {
      const rows = markdownToSpreadsheetRows(trimmedTitle, contentText);
      blobContent = rowsToUtf8Csv(rows);
      mimeType = 'text/csv;charset=utf-8';
      ext = 'csv';
    } else {
      blobContent = contentText;
      mimeType = 'text/markdown;charset=utf-8';
      ext = 'md';
    }

    const blob = new Blob([blobContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trimmedTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="แปลงและบันทึกผลงานลง Google Drive"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0C0A09]/80 p-3 backdrop-blur-xs sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-[#6B5A49] bg-[#FAF6F0] text-[#29221D] shadow-2xl"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E2D9CC] bg-[#EFE5D7] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white">
              <HardDriveUpload className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-bold text-[#29221D]">
                แปลงงานจาก {assistantName} ลง Google Drive
              </h2>
              <p className="truncate text-xs text-[#6E6258]">
                เลือกแปลงเป็น Google Docs, Google Sheets หรือ Markdown แล้วบันทึกเข้า Drive ทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#D4C5B3] bg-[#FAF6F0] px-2.5 text-xs font-semibold text-[#3D342D] hover:bg-[#E7DCCE]"
          >
            <X className="h-3.5 w-3.5" />
            <span>ปิด</span>
          </button>
        </header>

        {/* Body */}
        <div className="cozy-scroll flex-1 space-y-4 overflow-y-auto p-5">
          {/* Format Selector */}
          <div>
            <span className="block text-xs font-semibold text-[#5C5046]">
              รูปแบบเอกสารที่ต้องการแปลง
            </span>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setFormat(opt.id);
                      setSavedFile(null);
                    }}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-[#D97736] bg-[#FFF8F1] shadow-xs'
                        : 'border-[#DFD2C0] bg-white hover:border-[#C9B8A3] hover:bg-[#F9F4EC]'
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${opt.accentClass}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#29221D]">{opt.label}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-[#6E6258]">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* File Name & Destination Folder */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="drive-export-filename"
                className="block text-xs font-semibold text-[#5C5046]"
              >
                ชื่อเอกสาร
              </label>
              <input
                id="drive-export-filename"
                type="text"
                value={fileName}
                disabled={isSaving}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="ตั้งชื่อเอกสาร..."
                className="mt-1 h-9 w-full rounded-lg border border-[#D4C6B4] bg-white px-3 text-sm font-medium text-[#29221D] focus:border-[#D97736] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="drive-export-folder"
                className="flex items-center gap-1 text-xs font-semibold text-[#5C5046]"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#7A6D62]" />
                <span>โฟลเดอร์ปลายทางใน Google Drive</span>
              </label>
              <select
                id="drive-export-folder"
                value={targetFolder}
                disabled={isSaving || isLoadingFolders}
                onChange={(e) => setTargetFolder(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#D4C6B4] bg-white px-2.5 text-xs font-medium text-[#29221D] focus:border-[#D97736] focus:outline-none"
              >
                <option value="cozy_folder">Cozy Desk AI (สร้างโฟลเดอร์ให้อัตโนมัติ)</option>
                <option value="root">My Drive (หน้าหลัก)</option>
                {folders
                  .filter((f) => f.name !== 'Cozy Desk AI')
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      โฟลเดอร์: {f.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Preview / Editable Content */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#5C5046]">
                {format === 'google_sheet' && !showRawEditForSheet
                  ? `ตัวอย่างตาราง Google Sheets (${sheetPreviewRows.length} แถว × ${sheetPreviewRows[0]?.length ?? 0} คอลัมน์)`
                  : 'เนื้อหาที่จะบันทึก (แก้ไขก่อนบันทึกได้)'}
              </span>
              {format === 'google_sheet' && (
                <button
                  type="button"
                  onClick={() => setShowRawEditForSheet((prev) => !prev)}
                  className="cursor-pointer text-[11px] font-semibold text-[#2563EB] hover:underline"
                >
                  {showRawEditForSheet ? 'ดูตัวอย่างตาราง' : 'แก้ไขข้อความต้นฉบับ'}
                </button>
              )}
            </div>

            {format === 'google_sheet' && !showRawEditForSheet ? (
              <div className="cozy-scroll mt-1.5 max-h-56 overflow-auto rounded-xl border border-[#DFD2C0] bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E5DCCF] bg-[#F4EDE3]">
                      {(sheetPreviewRows[0] ?? []).map((cell, idx) => (
                        <th
                          key={idx}
                          className="border-r border-[#E5DCCF] px-3 py-2 font-bold text-[#29221D] last:border-r-0"
                        >
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetPreviewRows.slice(1, 20).map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-[#EFE8DC] last:border-b-0 odd:bg-white even:bg-[#FBF9F5]"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="border-r border-[#EFE8DC] px-3 py-1.5 text-[#3D342D] last:border-r-0"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sheetPreviewRows.length > 20 && (
                  <p className="border-t border-[#EFE8DC] bg-[#FBF9F5] px-3 py-1.5 text-[11px] text-[#7D7065]">
                    ... และอีก {sheetPreviewRows.length - 20} แถว (จะถูกบันทึกครบทั้งหมดลง Google Sheets)
                  </p>
                )}
              </div>
            ) : (
              <textarea
                rows={9}
                value={contentText}
                disabled={isSaving}
                onChange={(e) => setContentText(e.target.value)}
                className="cozy-scroll mt-1.5 w-full rounded-xl border border-[#D4C6B4] bg-white p-3 font-sans text-xs leading-relaxed text-[#29221D] focus:border-[#D97736] focus:outline-none"
              />
            )}
          </div>

          {/* Auth warning or API error */}
          {(!isAuthenticated || saveError || authError) && (
            <div className="rounded-xl border border-[#DFB4A8] bg-[#FDF2EF] p-3.5 text-xs text-[#8C2F1B]">
              <p className="leading-relaxed">
                {saveError ||
                  authError ||
                  'กรุณาเชื่อมต่อบัญชี Google ก่อน เพื่ออนุญาตให้บันทึกเอกสารลงใน Google Drive ของคุณ'}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {needsScopeReauth && onRequestDriveWriteAccess && (
                  <button
                    type="button"
                    disabled={isSigningIn}
                    onClick={async () => {
                      const ok = await onRequestDriveWriteAccess();
                      if (ok) {
                        setSaveError(null);
                        setNeedsScopeReauth(false);
                      }
                    }}
                    className="cursor-pointer rounded-lg bg-[#8C2F1B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#732515] disabled:opacity-60"
                  >
                    {isSigningIn ? 'กำลังขอสิทธิ์...' : 'ขอสิทธิ์เขียน Google Drive'}
                  </button>
                )}
                {needsScopeReauth && onGoogleSignOut && (
                  <button
                    type="button"
                    onClick={() => {
                      onGoogleSignOut();
                      setSaveError(null);
                      setNeedsScopeReauth(false);
                    }}
                    className="cursor-pointer rounded-lg border border-[#C88E7F] bg-white px-3 py-1.5 text-xs font-semibold text-[#8C2F1B] hover:bg-[#FAF0ED]"
                  >
                    ออกจากระบบก่อน
                  </button>
                )}
                {!isAuthenticated && (
                  <button
                    type="button"
                    disabled={isSigningIn}
                    onClick={onGoogleSignIn}
                    className="cursor-pointer rounded-lg bg-[#8C2F1B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#732515] disabled:opacity-60"
                  >
                    {isSigningIn ? 'กำลังเชื่อมต่อ...' : 'Sign in with Google'}
                  </button>
                )}
              </div>
              {needsScopeReauth && (
                <p className="mt-2 text-[11px] text-[#7D3A2A]">
                  หมายเหตุ: ตอนติ๊กอนุมัติสิทธิ์ในหน้าต่าง Google กรุณาติ๊กเลือกสิทธิ์แก้ไข/สร้างไฟล์ใน Google Drive หรือสามารถกดปุ่ม &ldquo;ดาวน์โหลด&rdquo; ด้านล่างเพื่อบันทึกไฟล์ลงเครื่องได้ทันทีครับ
                </p>
              )}
            </div>
          )}

          {/* Success Result Card */}
          {savedFile && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#9DC3B8] bg-[#E8F5F0] p-3.5 text-[#1F5347]">
              <div className="flex min-w-0 items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2E7D6B]" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">
                    บันทึก &ldquo;{savedFile.name}&rdquo; ลง Google Drive เรียบร้อยแล้ว!
                  </p>
                  <p className="text-[11px] text-[#356B5E]">
                    พร้อมเปิดใช้งานใน Google Drive ของคุณทันที
                  </p>
                </div>
              </div>
              {savedFile.webViewLink && (
                <a
                  href={savedFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2E7D6B] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#226153]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>{formatButtonLabel}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E2D9CC] bg-[#EFE5D7] px-5 py-3">
          <span className="truncate text-[11px] text-[#6E6258]">
            {isAuthenticated && googleUser?.email
              ? `บัญชี: ${googleUser.email}`
              : 'ยังไม่ได้เชื่อมต่อบัญชี Google'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!fileName.trim() || !contentText.trim()}
              onClick={handleLocalDownload}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#C8B9A6] bg-white px-3 py-1.5 text-xs font-semibold text-[#3D342D] hover:bg-[#F5EFE7] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>
                ดาวน์โหลด{' '}
                {format === 'google_doc' ? '.doc' : format === 'google_sheet' ? '.csv' : '.md'}
              </span>
            </button>
            <button
              type="button"
              disabled={!isAuthenticated || isSaving || !fileName.trim() || !contentText.trim()}
              onClick={() => void handleSave()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#D97736] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C6682A] disabled:cursor-not-allowed disabled:bg-[#CFC4B6]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>กำลังแปลงและบันทึก...</span>
                </>
              ) : (
                <>
                  <HardDriveUpload className="h-3.5 w-3.5" />
                  <span>บันทึกลง Google Drive</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

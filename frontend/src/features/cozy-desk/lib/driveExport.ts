export type DriveExportFormat = 'google_doc' | 'google_sheet' | 'markdown';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdownHtml(raw: string): string {
  let out = escapeHtml(raw);
  out = out.replace(/`([^`]+)`/g, '<code style="background:#f3efe8;padding:1px 4px;border-radius:3px;font-family:monospace;">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

function stripInlineMarkdown(raw: string): string {
  return raw
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/, '')
    .trim();
}

/**
 * Strips the chat delivery header/footer chrome if the message came from an automated Google Task delivery,
 * leaving the core deliverable clean for Google Docs / Google Sheets export.
 */
export function extractCleanDocumentBody(markdown: string): string {
  let body = markdown.replace(/\r\n/g, '\n').trim();

  // Remove trailing delivery instruction footer if present
  body = body.replace(
    /\n+---\nหากต้องการให้ปรับแก้[^\n]*$/s,
    ''
  );

  // Remove leading delivery meta lines (keep the task title as H1 if present)
  const taskHeaderMatch = body.match(
    /^(?:📋|⚠️)\s*\*\*(?:ส่งงานจาก Google Tasks|แจ้งข้อผิดพลาดระหว่างทำงาน Google Tasks):\s*([^*]+)\*\*\n[^\n]*\n+/
  );
  if (taskHeaderMatch) {
    const cleanTaskName = taskHeaderMatch[1].trim();
    const rest = body.slice(taskHeaderMatch[0].length).trim();
    return `# ${cleanTaskName}\n\n${rest}`;
  }

  return body.trim();
}

export function suggestDocumentTitle(
  markdown: string,
  fallback = 'เอกสารจาก Cozy Desk AI'
): string {
  const cleaned = extractCleanDocumentBody(markdown);
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('```') || line === '---') continue;
    const stripped = stripInlineMarkdown(line)
      .replace(/^[-*•\d.)\]]+\s*/, '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length >= 2) {
      return stripped.slice(0, 72);
    }
  }
  return fallback;
}

function isMarkdownTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.includes('|');
}

function isMarkdownTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes('-')) return false;
  return /^\|?[\s:|-]+\|?$/.test(t);
}

function splitMarkdownTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => stripInlineMarkdown(cell.trim()));
}

/**
 * Converts Markdown content into clean semantic HTML suitable for Google Drive -> Google Docs import.
 */
export function markdownToGoogleDocHtml(title: string, markdown: string): string {
  const body = extractCleanDocumentBody(markdown);
  const lines = body.split('\n');
  const htmlParts: string[] = [];

  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listType) {
      htmlParts.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [header, ...rows] = tableRows;
    const ths = header
      .map(
        (c) =>
          `<th style="border:1px solid #cbd5e1;background:#f1f5f9;padding:6px 10px;text-align:left;font-weight:bold;">${formatInlineMarkdownHtml(c)}</th>`
      )
      .join('');
    const trs = rows
      .map(
        (row) =>
          `<tr>${row
            .map(
              (c) =>
                `<td style="border:1px solid #cbd5e1;padding:6px 10px;vertical-align:top;">${formatInlineMarkdownHtml(c)}</td>`
            )
            .join('')}</tr>`
      )
      .join('');
    htmlParts.push(
      `<table style="border-collapse:collapse;width:100%;margin:10px 0;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
    );
    tableRows = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      flushList();
      flushTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        htmlParts.push(
          `<pre style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;font-family:monospace;white-space:pre-wrap;"><code>${escapeHtml(
            codeLines.join('\n')
          )}</code></pre>`
        );
        inCodeBlock = false;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (isMarkdownTableRow(trimmed)) {
      flushList();
      if (isMarkdownTableSeparator(trimmed)) {
        continue;
      }
      tableRows.push(splitMarkdownTableCells(trimmed));
      continue;
    } else {
      flushTable();
    }

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      flushList();
      htmlParts.push('<hr style="border:none;border-top:1px solid #d6d3d1;margin:12px 0;" />');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      htmlParts.push(`<${tag}>${formatInlineMarkdownHtml(headingMatch[2])}</${tag}>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
        htmlParts.push('<ul>');
      }
      htmlParts.push(`<li>${formatInlineMarkdownHtml(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
        htmlParts.push('<ol>');
      }
      htmlParts.push(`<li>${formatInlineMarkdownHtml(olMatch[1])}</li>`);
      continue;
    }

    flushList();
    htmlParts.push(`<p>${formatInlineMarkdownHtml(trimmed)}</p>`);
  }

  flushList();
  flushTable();
  if (inCodeBlock && codeLines.length > 0) {
    htmlParts.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  // Ensure document starts with the user-chosen title if not already the first H1
  const safeTitle = escapeHtml(title.trim() || 'เอกสารจาก Cozy Desk AI');
  const firstPart = htmlParts[0] ?? '';
  const hasMatchingH1 = firstPart.startsWith('<h1>');

  return [
    '<!DOCTYPE html>',
    '<html lang="th">',
    '<head><meta charset="UTF-8" /><title>' + safeTitle + '</title></head>',
    '<body style="font-family:sans-serif;line-height:1.6;color:#1f2937;">',
    hasMatchingH1 ? '' : `<h1>${safeTitle}</h1>`,
    ...htmlParts,
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Extracts structured 2D spreadsheet rows from Markdown (supports Markdown tables natively,
 * or parses headings, key-value lines, numbered lists, and bullets into clean spreadsheet rows).
 */
export function markdownToSpreadsheetRows(title: string, markdown: string): string[][] {
  const body = extractCleanDocumentBody(markdown);
  const lines = body.split('\n');

  // 1. Collect Markdown tables if present
  const tableRows: string[][] = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (isMarkdownTableRow(trimmed)) {
      if (isMarkdownTableSeparator(trimmed)) continue;
      tableRows.push(splitMarkdownTableCells(trimmed));
    }
  }

  if (tableRows.length >= 2) {
    const maxCols = Math.max(...tableRows.map((r) => r.length));
    return tableRows.map((r) => {
      const padded = [...r];
      while (padded.length < maxCols) padded.push('');
      return padded;
    });
  }

  // 2. Fallback: structure headings, key: value pairs, numbered items, bullets & paragraphs cleanly
  const rows: string[][] = [['ลำดับ', 'หัวข้อ / หมวดหมู่', 'รายละเอียด']];
  let currentSection = title.trim() || 'ทั่วไป';
  let seq = 1;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed === '---' || trimmed === '***' || trimmed.startsWith('```')) {
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      currentSection = stripInlineMarkdown(headingMatch[1]);
      continue;
    }

    const itemText = stripInlineMarkdown(
      trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')
    );
    if (!itemText) continue;

    // Check for "Key: Value" structure
    const kvMatch = itemText.match(/^([^:：]{2,40})[:：]\s*(.+)$/);
    if (kvMatch) {
      rows.push([String(seq++), kvMatch[1].trim(), kvMatch[2].trim()]);
    } else {
      rows.push([String(seq++), currentSection, itemText]);
    }
  }

  if (rows.length === 1) {
    rows.push(['1', currentSection, stripInlineMarkdown(body)]);
  }

  return rows;
}

function escapeCsvCell(value: string): string {
  const safe = value.replace(/\r?\n/g, ' ');
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Converts 2D rows into RFC-4180 UTF-8 CSV with BOM (\uFEFF) so Thai characters import cleanly into Google Sheets.
 */
export function rowsToUtf8Csv(rows: string[][]): string {
  const csvBody = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell ?? '')).join(','))
    .join('\r\n');
  return `\uFEFF${csvBody}`;
}

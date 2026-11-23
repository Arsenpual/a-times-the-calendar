const fs = require("node:fs/promises");
const path = require("node:path");
const { formatSleepLogsContext } = require("./cozy-desk-sleep.js");

const PROPOSE_GOOGLE_TASK_TOOL = {
  name: "propose_google_task",
  description:
    "Prepare a new Google Task item to pin on the user home office pinboard (Google Tasks) whenever the user asks to add, create, schedule, remind, or record a task or to-do item, or delegates a scheduled/automatic task to Mina.",
  parameters: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      notes: { type: "STRING" },
      dueDate: { type: "STRING" },
      assignToMina: { type: "BOOLEAN" },
      assistantId: { type: "STRING" },
      scheduledTime: { type: "STRING" },
    },
    required: ["title"],
  },
};

function classifyGeminiError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const statusNum = typeof err?.status === "number" ? err.status : undefined;

  if (lower.includes("aborted") || lower.includes("timeout") || err?.name === "TimeoutError") {
    return {
      status: 504,
      code: "TIMEOUT",
      message: "ผู้ช่วย AI ใช้เวลาประมวลผลนานกว่าปกติ กรุณากด “ส่งใหม่” อีกครั้งครับ",
    };
  }
  if (
    raw === "MISSING_API_KEY" ||
    lower.includes("ยังไม่ได้ตั้งค่า gemini_api_key") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key") ||
    statusNum === 401 ||
    statusNum === 503
  ) {
    return {
      status: 401,
      code: "API_KEY_INVALID",
      message: "ยังไม่ได้ตั้งค่าหรือคีย์ Gemini API ไม่ถูกต้อง กรุณาตรวจสอบ GEMINI_API_KEY บนเซิร์ฟเวอร์",
    };
  }
  if (lower.includes("permission_denied") || lower.includes("403") || statusNum === 403) {
    return {
      status: 403,
      code: "PERMISSION_DENIED",
      message: "สิทธิ์การเข้าถึง Gemini API ถูกปฏิเสธ กรุณาตรวจสอบการตั้งค่า API Key",
    };
  }
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    statusNum === 429
  ) {
    const retrySec =
      typeof err?.retryAfterSeconds === "number" && err.retryAfterSeconds > 0
        ? err.retryAfterSeconds
        : null;
    const quotaWindow = err?.quotaWindow || "unknown";

    let resetHint = "";
    if (retrySec != null) {
      const resetAt = new Date(Date.now() + retrySec * 1000);
      const resetTimeStr = resetAt.toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      resetHint = `โควต้าจะรีเซ็ตในอีกประมาณ ${retrySec} วินาที (เวลา ~${resetTimeStr} น.)`;
    } else if (quotaWindow === "day") {
      resetHint =
        "โควต้ารายวัน (RPD) ของ Gemini API จะรีเซ็ตเวลา 00:00 น. PT (ประมาณ 15:00 น. เวลาไทย)";
    } else if (quotaWindow === "minute") {
      resetHint = "โควต้ารายนาที (RPM) จะรีเซ็ตภายใน ~1 นาที กรุณารอสักครู่แล้วลองใหม่";
    } else {
      resetHint =
        "หากเป็นโควต้ารายนาทีจะรีเซ็ตภายใน ~1 นาที แต่หากเกินโควต้ารายวันจะรีเซ็ตเวลา 00:00 น. PT (ประมาณ 15:00 น. เวลาไทย)";
    }

    return {
      status: 429,
      code: "RESOURCE_EXHAUSTED",
      message: `ใช้งานเกินโควต้าของ Gemini API ชั่วคราว — ${resetHint}`,
    };
  }
  return {
    status: statusNum ?? 500,
    code: String(statusNum ?? err?.code ?? "UNKNOWN"),
    message: "ไม่สามารถเชื่อมต่อกับผู้ช่วย AI ได้ในขณะนี้ กรุณาลองส่งข้อความใหม่อีกครั้ง",
  };
}

function buildAiStudioSystemInstruction(mode, customInstruction) {
  const modeGuidance = {
    prompt: [
      "โหมดปัจจุบัน: Prompt Lab (ออกแบบ ทดสอบ และปรับแต่ง Prompt)",
      "- ช่วยวิเคราะห์โจทย์ เขียน/รีไรต์ Prompt ให้คมชัด แยกโครงสร้าง Role / Context / Constraints / Output Format",
      "- แนะนำวิธีปรับจูนให้ผลลัพธ์แม่นยำและสม่ำเสมอขึ้น",
    ].join("\n"),
    build: [
      "โหมดปัจจุบัน: App Builder (วางโครงสร้างและออกแบบต้นแบบเว็บแอพ)",
      "- เสนอสถาปัตยกรรมคอมโพเนนต์ โฟลว์การใช้งาน UI และตัวอย่างโค้ด React + TypeScript + Tailwind CSS ที่พร้อมต่อยอด",
      "- ชี้จุดควรระวังด้าน UX และ Edge Cases อย่างกระชับ",
    ].join("\n"),
    schema: [
      "โหมดปัจจุบัน: JSON & Schema (ออกแบบ Structured Output / JSON Schema / TypeScript Interface)",
      "- สร้าง JSON Schema หรือ TypeScript Type ที่สะอาด ถูกต้องตามมาตรฐาน พร้อมตัวอย่าง JSON ที่ใช้งานได้จริง",
      "- อธิบายฟิลด์สำคัญสั้นๆ ในรูปแบบอ่านง่าย",
    ].join("\n"),
  };

  return [
    'คุณคือ "Google AI Studio" ตัวละครผู้เชี่ยวชาญด้าน Prompt Engineering, การสร้างต้นแบบแอพ และการออกแบบ Structured Schema ประจำสถานี AI Lab ในห้องทำงาน Cozy Desk (โหมดหนึ่งใน T.i.M.E.S.)',
    "บุคลิกของคุณ: ทันสมัย เป็นระบบ ฉับไว เป็นมิตร และเน้นผลลัพธ์ที่นำไปใช้จริงได้ทันที",
    "ภาษา: ตอบเป็นภาษาไทยอย่างเป็นธรรมชาติเป็นหลัก (ใช้ศัพท์เทคนิคและโค้ดภาษาอังกฤษตามมาตรฐาน)",
    modeGuidance[mode] ?? modeGuidance.prompt,
    customInstruction?.trim()
      ? `คำสั่งเพิ่มเติมจากผู้ใช้ (System Instruction):\n${customInstruction.trim().slice(0, 2000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", ".gemini", "secrets"]);
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");

async function listSafeWorkspaceFiles(dir = WORKSPACE_ROOT, prefix = "", depth = 0) {
  if (depth > 3) return [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const sub = await listSafeWorkspaceFiles(path.join(dir, entry.name), rel, depth + 1);
        results.push(...sub);
      } else if (/\.(ts|tsx|js|jsx|json|css|html|md)$/i.test(entry.name) && !/secret|credential/i.test(entry.name)) {
        results.push(rel);
      }
      if (results.length >= 80) break;
    }
    return results.slice(0, 80);
  } catch {
    return [];
  }
}

async function readSafeWorkspaceFile(relPath) {
  try {
    const cleanRel = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanRel || cleanRel.includes("..") || cleanRel.startsWith(".env") || /secret|credential/i.test(cleanRel)) {
      return null;
    }
    const segs = cleanRel.split("/");
    if (segs.some((seg) => EXCLUDED_DIRS.has(seg) || seg.startsWith("."))) {
      return null;
    }
    const fullPath = path.resolve(WORKSPACE_ROOT, cleanRel);
    const rootWithSep = WORKSPACE_ROOT.endsWith(path.sep) ? WORKSPACE_ROOT : `${WORKSPACE_ROOT}${path.sep}`;
    if (!fullPath.startsWith(rootWithSep)) {
      return null;
    }
    const stat = await fs.stat(fullPath);
    if (!stat.isFile() || stat.size > 250_000) {
      return null;
    }
    const raw = await fs.readFile(fullPath, "utf8");
    return raw.slice(0, 14_000);
  } catch {
    return null;
  }
}

function buildAntigravitySystemInstruction(mode, workspaceFiles, fileContexts) {
  const modeGuidance = {
    code: [
      "โหมดปัจจุบัน: Code & Debug (เขียนโค้ด แก้บัค และรีวิวโค้ด)",
      "- วิเคราะห์ปัญหาอย่างแม่นยำ พร้อมแสดงตัวอย่างโค้ด TypeScript / React / Node.js ที่สะอาด ปลอดภัย และไม่เสี่ยงเกิดบัค",
      "- ชี้จุดที่ควรระวัง (Edge Cases) และวิธีทดสอบอย่างกระชับ",
    ].join("\n"),
    workspace: [
      "โหมดปัจจุบัน: Workspace Explorer (สำรวจและอธิบายไฟล์ในโปรเจกต์บน localhost)",
      "- อ้างอิงจากรายชื่อไฟล์และเนื้อหาไฟล์ในโปรเจกต์ที่แนบให้ด้านล่างตามจริง",
      "- อธิบายการทำงานของแต่ละไฟล์ ความเชื่อมโยงของระบบ และจุดที่สามารถปรับปรุงต่อได้",
    ].join("\n"),
    arch: [
      "โหมดปัจจุบัน: Architecture & Localhost CLI (ออกแบบสถาปัตยกรรมและคำสั่งรันงาน)",
      "- แนะนำโครงสร้างระบบ การเชื่อมต่อ API บน localhost คำสั่ง CLI/Terminal และแนวทางที่เสถียรที่สุด",
      "- จัดลำดับขั้นตอนเป็นข้อๆ ที่นำไปรันหรือพัฒนาต่อได้ทันที",
    ].join("\n"),
  };

  const fileListBlock =
    workspaceFiles.length > 0
      ? `รายชื่อไฟล์ในโปรเจกต์ (${path.basename(WORKSPACE_ROOT)}):\n${workspaceFiles.map((f) => `- ${f}`).join("\n")}`
      : "";

  const attachedFilesBlock =
    fileContexts.length > 0
      ? `เนื้อหาไฟล์จริงที่ถูกดึงมาตรวจสอบ:\n\n${fileContexts
          .map((f) => `### ไฟล์: \`${f.path}\`\n\`\`\`\n${f.content}\n\`\`\``)
          .join("\n\n")}`
      : "";

  return [
    'คุณคือ "Antigravity (AGY)" ตัวละคร AI Coding & Localhost Agent ประจำสถานี Dev Station ในห้องทำงานของ Cozy Desk (โหมดหนึ่งใน T.i.M.E.S.)',
    "บุคลิกของคุณ: เชี่ยวชาญด้านวิศวกรรมซอฟต์แวร์ เฉียบคม สุภาพ เป็นกันเอง เน้นความเสถียรของระบบ (Zero-Bug Mindset) และอธิบายเรื่องเทคนิคให้เข้าใจง่าย",
    "ภาษา: ตอบเป็นภาษาไทยอย่างเป็นธรรมชาติ (ใช้ศัพท์เทคนิคและโค้ดภาษาอังกฤษตามมาตรฐาน)",
    "รูปแบบการตอบ: ใช้ Markdown และ Code Block ที่มีระบุภาษาชัดเจน กระชับ ตรงประเด็น",
    modeGuidance[mode] ?? modeGuidance.code,
    fileListBlock,
    attachedFilesBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatGoogleTasksContext(tasksContext, localDate) {
  const status = tasksContext?.status;
  if (!tasksContext || status === "not_signed_in") {
    return [
      "สถานะ Google Tasks ปัจจุบัน: ผู้ใช้ยังไม่ได้เชื่อมต่อสิทธิ์ Google Tasks ในโหมด Cozy Desk",
      '- หากผู้ใช้ถามถึงงานใน Google Tasks ให้แจ้งอย่างสุภาพว่ายังมองไม่เห็นรายการงานเพราะยังไม่ได้กดปุ่ม "Sign in with Google" ในแถบ Google Tasks ด้านบนช่องแชทก่อน (ห้ามเดาหรือแต่งชื่องานขึ้นมาเอง)',
    ].join("\n");
  }
  if (status === "auth_expired") {
    return [
      "สถานะ Google Tasks ปัจจุบัน: เซสชัน Google หมดอายุหรือยังไม่มีสิทธิ์เข้าถึง Google Tasks",
      '- หากผู้ใช้ถามถึงรายการงาน ให้แจ้งอย่างสุภาพว่าสิทธิ์เชื่อมต่อ Google หมดอายุแล้ว กรุณากด "Sign in with Google" ใหม่อีกครั้ง',
    ].join("\n");
  }
  if (status === "unavailable") {
    return [
      `สถานะ Google Tasks ปัจจุบัน: ไม่สามารถดึงข้อมูลจาก Google Tasks ได้ชั่วคราว${tasksContext.errorDetail ? ` (${tasksContext.errorDetail})` : ""}`,
      '- หากผู้ใช้ถามถึงรายการงาน ให้แนะนำให้กดปุ่ม "ซิงค์" ในแถบ Google Tasks หรือเปิดดูที่กระดานโน้ตในห้องทำงานแล้วลองถามใหม่อีกครั้ง',
    ].join("\n");
  }

  const rawLists = Array.isArray(tasksContext.lists) ? tasksContext.lists.slice(0, 50) : [];
  const MAX_RENDERED_TASKS = 300;
  const preparedLists = rawLists.map((list) => {
    const listTitle = typeof list?.title === "string" && list.title.trim() ? list.title.trim().slice(0, 100) : "รายการงาน";
    const rawTasks = Array.isArray(list?.tasks) ? list.tasks : [];
    const pending = rawTasks.filter((t) => t?.status !== "completed");
    const completed = rawTasks
      .filter((t) => t?.status === "completed")
      .sort((a, b) => String(b.updated ?? "").localeCompare(String(a.updated ?? "")));
    return { title: listTitle, pending, completed, lines: [] };
  });

  const totalPending = preparedLists.reduce((acc, l) => acc + l.pending.length, 0);
  const totalCompleted = preparedLists.reduce((acc, l) => acc + l.completed.length, 0);

  const formatTaskLine = (task, isDone) => {
    const title = typeof task?.title === "string" && task.title.trim() ? task.title.trim().slice(0, 200) : "(ไม่มีชื่องาน)";
    const dueDate = typeof task?.due === "string" && /^\d{4}-\d{2}-\d{2}/.test(task.due) ? task.due.slice(0, 10) : "";
    const notes = typeof task?.notes === "string" && task.notes.trim() ? task.notes.trim().replace(/\s+/g, " ").slice(0, 180) : "";
    let dueTag = "";
    if (dueDate) {
      if (!isDone && dueDate < localDate) dueTag = ` | กำหนดส่ง: ${dueDate} (เลยกำหนด)`;
      else if (!isDone && dueDate === localDate) dueTag = ` | กำหนดส่ง: ${dueDate} (วันนี้)`;
      else dueTag = ` | กำหนดส่ง: ${dueDate}`;
    }
    const notesTag = notes ? ` | โน้ต: ${notes}` : "";
    const indent = task.parent ? "    ↳ " : "  - ";
    return `${indent}[${isDone ? "✓ เสร็จแล้ว" : "ยังไม่เสร็จ"}] ${title}${dueTag}${notesTag}`;
  };

  let renderedTaskCount = 0;
  for (const list of preparedLists) {
    for (const task of list.pending) {
      if (renderedTaskCount >= MAX_RENDERED_TASKS) break;
      list.lines.push(formatTaskLine(task, false));
      renderedTaskCount += 1;
    }
  }
  const remainingForCompleted = Math.max(0, MAX_RENDERED_TASKS - renderedTaskCount);
  if (remainingForCompleted > 0 && preparedLists.length > 0) {
    const listsWithCompleted = preparedLists.filter((l) => l.completed.length > 0);
    const perListQuota = Math.max(5, Math.floor(remainingForCompleted / Math.max(1, listsWithCompleted.length)));
    for (const list of listsWithCompleted) {
      let addedInList = 0;
      for (const task of list.completed) {
        if (renderedTaskCount >= MAX_RENDERED_TASKS || addedInList >= perListQuota) break;
        list.lines.push(formatTaskLine(task, true));
        renderedTaskCount += 1;
        addedInList += 1;
      }
    }
  }

  const listBlocks = preparedLists.map((list) =>
    list.lines.length === 0
      ? `• รายการ "${list.title}" (ไม่มีงานในรายการนี้)`
      : `• รายการ "${list.title}" (ค้าง ${list.pending.length} / เสร็จแล้ว ${list.completed.length}):\n${list.lines.join("\n")}`
  );

  return [
    `ข้อมูล Google Tasks จริงล่าสุดทั้งหมดของผู้ใช้ (ณ ${localDate} | ทั้งหมด ${preparedLists.length} รายการ | งานค้างทั้งหมด ${totalPending} งาน, เสร็จแล้ว ${totalCompleted} งาน):`,
    listBlocks.length > 0 ? listBlocks.join("\n\n") : "(ยังไม่มีรายการงานใน Google Tasks)",
  ].join("\n");
}

function buildMinaSystemInstruction(mode, timeOfDay, localDate, tasksContext, sleepLogsContext) {
  const timeContext = {
    morning: "ตอนนี้เป็นช่วงเช้าในบ้าน บรรยากาศสดใสเหมาะกับการวางแผนและเริ่มงาน",
    afternoon: "ตอนนี้เป็นช่วงบ่ายอุ่นๆ ในบ้าน บรรยากาศสบายๆ เหมาะกับการโฟกัสและต่อยอดงาน",
    evening: "ตอนนี้เป็นช่วงค่ำในห้องทำงาน เปิดโคมไฟอุ่นๆ บรรยากาศสงบเหมาะกับการสรุปและร่างงาน",
  };
  const modeGuidance = {
    qa: "โหมดปัจจุบัน: ถาม-ตอบช่วยทำงาน (Work Q&A)\n- ตอบคำถามอย่างตรงประเด็น กระชับ ชัดเจน และนำไปใช้งานได้จริง",
    brainstorm: "โหมดปัจจุบัน: คิดไอเดียและระดมสมอง (Brainstorm)\n- เสนอไอเดียหลากหลายมุมมองอย่างน้อย 3–5 แนวทาง พร้อมชื่อแนวคิดสั้นๆ และจุดเด่น",
    draft: "โหมดปัจจุบัน: ร่างเอกสารและข้อความ (Document Drafting)\n- ร่างข้อความหรือเอกสารให้สมบูรณ์พร้อมนำไปคัดลอกใช้งานได้ทันที",
  };
  return [
    'คุณคือ "มีน่า (Mina)" ผู้ช่วยทำงานประจำโต๊ะคอมพิวเตอร์ในห้องทำงานของบ้านจำลอง 2D Cozy Desk (โหมดหนึ่งใน T.i.M.E.S.)',
    timeContext[timeOfDay] ?? timeContext.afternoon,
    `วันที่ปัจจุบันของผู้ใช้คือ ${localDate}`,
    "บุคลิกของคุณ: อบอุ่น เป็นกันเอง สุภาพ ฉลาดจัดระเบียบ และพูดจาเป็นธรรมชาติเหมือนเพื่อนร่วมโต๊ะทำงานที่พึ่งพาได้",
    "ความสามารถเสริม — ดู/รายงาน และเพิ่มงานลง Google Tasks บนกระดานโน้ตในห้องทำงาน:",
    "- หากผู้ใช้สั่งให้เพิ่มงาน สร้าง task จดสิ่งที่ต้องทำ หรือสั่งให้มีน่า/Antigravity/AI Studio ทำงานอัตโนมัติลง Task ให้เรียกเครื่องมือ `propose_google_task`",
    formatGoogleTasksContext(tasksContext, localDate),
    formatSleepLogsContext(sleepLogsContext),
    modeGuidance[mode] ?? modeGuidance.qa,
  ].join("\n\n");
}

module.exports = {
  WORKSPACE_ROOT,
  PROPOSE_GOOGLE_TASK_TOOL,
  classifyGeminiError,
  buildAiStudioSystemInstruction,
  listSafeWorkspaceFiles,
  readSafeWorkspaceFile,
  buildAntigravitySystemInstruction,
  formatGoogleTasksContext,
  buildMinaSystemInstruction,
};

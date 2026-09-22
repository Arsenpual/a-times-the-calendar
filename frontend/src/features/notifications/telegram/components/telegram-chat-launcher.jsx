import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "times-telegram-chat-launcher-position-v1";

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null;
  } catch { return null; }
}

/**
 * A movable shortcut only. It opens the single MR.Zettascale AI dialog,
 * where Telegram history and messaging now live alongside the AI chat.
 */
export default function TelegramChatLauncher({ connected, unreadCount = 0, onOpenChat }) {
  const [position, setPosition] = useState(loadPosition);
  const [expanded, setExpanded] = useState(false);
  const drag = useRef(null);
  const lastDragWasMove = useRef(false);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (position) localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);
  if (!connected) return null;

  const startDrag = (event) => {
    const rect = launcherRef.current?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, startX: event.clientX, startY: event.clientY };
    lastDragWasMove.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.current.startX) > 3 || Math.abs(event.clientY - drag.current.startY) > 3) lastDragWasMove.current = true;
    const width = launcherRef.current?.offsetWidth || 52;
    const height = launcherRef.current?.offsetHeight || 52;
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - drag.current.offsetX));
    const y = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - drag.current.offsetY));
    setPosition({ x, y });
  };
  const finishDrag = (event) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  const style = position ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" } : undefined;
  return <div ref={launcherRef} className={`telegram-chat-launcher${expanded ? " is-expanded" : ""}`} style={style}>
    {expanded && <div className="telegram-chat-launcher__commands" role="menu" aria-label="คำสั่ง MR.Zettascale">
      <button type="button" role="menuitem" onClick={() => { onOpenChat?.(); setExpanded(false); }}>เปิดแชท</button>
      <button type="button" role="menuitem" className="telegram-chat-launcher__drag" aria-label="ลากปุ่ม MR.Zettascale" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>⠿ ลากย้าย</button>
    </div>}
    <button type="button" className="telegram-chat-launcher__main" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onClick={() => { if (lastDragWasMove.current) { lastDragWasMove.current = false; return; } setExpanded((value) => !value); }} aria-expanded={expanded} aria-label={expanded ? "ปิดกล่องคำสั่ง MR.Zettascale" : "เปิดกล่องคำสั่ง MR.Zettascale"} title="MR.Zettascale">
      <span aria-hidden="true">✈</span>
      {unreadCount > 0 && <span className="telegram-chat-launcher__unread">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
  </div>;
}

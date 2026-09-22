import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "times-telegram-chat-launcher-position-v1";

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null;
  } catch { return null; }
}

/**
 * A movable shortcut only. It never moves/resizes TelegramWebChat itself;
 * opening it still uses the familiar chat dialog at its original location.
 */
export default function TelegramChatLauncher({ connected, unreadCount = 0, onOpenChat }) {
  const [position, setPosition] = useState(loadPosition);
  const [expanded, setExpanded] = useState(false);
  const drag = useRef(null);

  useEffect(() => {
    if (position) localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);
  if (!connected) return null;

  const startDrag = (event) => {
    event.preventDefault();
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const width = event.currentTarget.parentElement.offsetWidth || 52;
    const height = event.currentTarget.parentElement.offsetHeight || 52;
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - drag.current.offsetX));
    const y = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - drag.current.offsetY));
    setPosition({ x, y });
  };
  const finishDrag = (event) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  const style = position ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" } : undefined;
  return <div className={`telegram-chat-launcher${expanded ? " is-expanded" : ""}`} style={style}>
    <button type="button" className="telegram-chat-launcher__drag" aria-label="ลากปุ่ม MR.Zettascale" title="ลากไปวางตำแหน่งที่ต้องการ" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>⠿</button>
    <button type="button" className="telegram-chat-launcher__main" onClick={onOpenChat} aria-label="เปิดแชท MR.Zettascale" title="เปิดแชท MR.Zettascale">
      <span aria-hidden="true">✈</span><span className="telegram-chat-launcher__name">MR.Zettascale</span>
      {unreadCount > 0 && <span className="telegram-chat-launcher__unread">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    <button type="button" className="telegram-chat-launcher__toggle" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "ย่อปุ่มควบคุม" : "ขยายปุ่มควบคุม"} title={expanded ? "ย่อ" : "ขยาย"}>{expanded ? "−" : "+"}</button>
  </div>;
}

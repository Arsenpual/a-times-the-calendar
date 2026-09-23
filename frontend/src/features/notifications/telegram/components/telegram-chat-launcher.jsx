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
  const launcherRef = useRef(null);

  useEffect(() => {
    if (position) localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);
  if (!connected) return null;

  const startDrag = (event) => {
    const rect = launcherRef.current?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, startX: event.clientX, startY: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const width = launcherRef.current?.offsetWidth || 196;
    const height = launcherRef.current?.offsetHeight || 42;
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - drag.current.offsetX));
    const y = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - drag.current.offsetY));
    setPosition({ x, y });
  };
  const finishDrag = (event) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  const style = position ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" } : undefined;
  // GitHub Pages serves this app below /a-times-the-calendar/, while local
  // Vite serves it at /.  BASE_URL keeps the public mascot asset valid in both.
  const avatarSrc = `${import.meta.env.BASE_URL}mr_zettascale_avatar_profile.png`;
  return <div ref={launcherRef} className={`telegram-chat-launcher${expanded ? " is-expanded" : ""}`} style={style}>
    {expanded && <div className="telegram-chat-launcher__commands" role="menu" aria-label="คำสั่ง MR.Zettascale">
      <button type="button" role="menuitem" onClick={() => { onOpenChat?.(); setExpanded(false); }}>เปิดแชท</button>
      <button type="button" role="menuitem" className="telegram-chat-launcher__drag" aria-label="ลากปุ่ม MR.Zettascale" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>⠿ ลากย้าย</button>
    </div>}
    <nav className="telegram-chat-launcher__bar" aria-label="ทางลัด MR.Zettascale">
      <button type="button" className="telegram-chat-launcher__avatar" onClick={() => onOpenChat?.()} aria-label="เปิดแชท MR.Zettascale" title="เปิดแชท MR.Zettascale">
        <img src={avatarSrc} alt="" />
        {unreadCount > 0 && <span className="telegram-chat-launcher__unread">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      <button type="button" className="telegram-chat-launcher__identity" onClick={() => onOpenChat?.()}>
        <strong>MR.Zettascale</strong><small>Telegram</small>
      </button>
      <button type="button" className="telegram-chat-launcher__menu" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? "ปิดเมนู MR.Zettascale" : "เปิดเมนู MR.Zettascale"} title="เมนู MR.Zettascale">☰</button>
    </nav>
  </div>;
}

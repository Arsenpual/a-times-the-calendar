import React, { useRef, useState } from "react";

/** Generic, hidden canvas for any Activity Mode mockup component. */
export default function ActivityModeMockupPreview({ mockups }) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlPosition, setControlPosition] = useState(null);
  const controlDragRef = useRef(null);
  const suppressControlClickRef = useRef(false);
  const url = new URL(window.location.href);
  const selectedId = url.searchParams.get("mockup");
  const selected = mockups.find((mockup) => mockup.id === selectedId) || mockups[0];
  const Mockup = selected?.Component;

  const changeMockup = (event) => {
    url.searchParams.set("mockup", event.target.value);
    window.location.assign(url.toString());
  };

  const beginControlDrag = (event) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    controlDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveControlDrag = (event) => {
    const drag = controlDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const buttonWidth = event.currentTarget.offsetWidth;
    const buttonHeight = event.currentTarget.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - buttonWidth - 8, event.clientX - drag.offsetX));
    const top = Math.max(8, Math.min(window.innerHeight - buttonHeight - 8, event.clientY - drag.offsetY));
    if (Math.abs(left - event.currentTarget.getBoundingClientRect().left) > 2 || Math.abs(top - event.currentTarget.getBoundingClientRect().top) > 2) drag.moved = true;
    setControlPosition({ left, top });
  };

  const endControlDrag = (event) => {
    const drag = controlDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    suppressControlClickRef.current = drag.moved;
    controlDragRef.current = null;
  };

  const toggleControls = () => {
    // Pointerup generates a click after a drag; do not accidentally open the
    // picker when the person was simply moving it out of the mockup layout.
    if (suppressControlClickRef.current) {
      suppressControlClickRef.current = false;
      return;
    }
    setControlsOpen((open) => !open);
  };

  // The base CSS parks controls at the top-right. Once moved, explicitly
  // clear `right` so CSS never stretches/anchors the fixed button from both
  // sides; its original compact size stays intact anywhere on screen.
  const controlStyle = controlPosition ? { ...controlPosition, right: "auto" } : undefined;
  const pickerStyle = controlPosition ? { left: controlPosition.left, top: controlPosition.top + 48, right: "auto" } : undefined;

  return (
    <main className="mockup-preview-mode">
      <button
        className="mockup-preview-toggle"
        type="button"
        style={controlStyle}
        onPointerDown={beginControlDrag}
        onPointerMove={moveControlDrag}
        onPointerUp={endControlDrag}
        onPointerCancel={endControlDrag}
        onClick={toggleControls}
      >
        Mockup
      </button>
      {controlsOpen && (
        <label className="mockup-preview-picker" style={pickerStyle}>
          <span>เลือก mockup</span>
          <select value={selected?.id || ""} onChange={changeMockup}>
            {mockups.map((mockup) => <option key={mockup.id} value={mockup.id}>{mockup.label}</option>)}
          </select>
        </label>
      )}
      <section className="mockup-preview-canvas">
        {Mockup ? <Mockup /> : <p>ไม่พบ mockup</p>}
      </section>
    </main>
  );
}

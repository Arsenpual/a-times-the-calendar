import React, { useState } from "react";

/** Generic, hidden canvas for any Activity Mode mockup component. */
export default function ActivityModeMockupPreview({ mockups }) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const url = new URL(window.location.href);
  const selectedId = url.searchParams.get("mockup");
  const selected = mockups.find((mockup) => mockup.id === selectedId) || mockups[0];
  const Mockup = selected?.Component;

  const changeMockup = (event) => {
    url.searchParams.set("mockup", event.target.value);
    window.location.assign(url.toString());
  };

  return (
    <main className="mockup-preview-mode">
      <button className="mockup-preview-toggle" type="button" onClick={() => setControlsOpen((open) => !open)}>
        Mockup
      </button>
      {controlsOpen && (
        <label className="mockup-preview-picker">
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

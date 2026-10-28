import React from "react";

/** Keep the exported design and its runtime isolated from the app's styles. */
export default function SevenDayFocusMockup() {
  const source = `${import.meta.env.BASE_URL}src/dev/mockups/new%20calendar%207%20day%20focus/Main.dc.html`;
  return <iframe className="seven-day-focus-mockup" src={source} title="ตัวอย่างปฏิทิน Focus 7 วัน" />;
}

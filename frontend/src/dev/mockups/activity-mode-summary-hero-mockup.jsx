import React from "react";

/** Keep the exported design and its runtime isolated from the app's styles. */
export default function SummaryHeroMockup() {
  const source = `${import.meta.env.BASE_URL}src/dev/mockups/summary-hero/ConceptA.dc.html`;
  return <iframe className="summary-hero-mockup" src={source} title="ตัวอย่าง Summary Hero" />;
}

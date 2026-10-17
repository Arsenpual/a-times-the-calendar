# TXph brand assets

TXph is the visual identity of T.i.M.E.S.: T / Tau for time, X / Chi for the brand's Chronos association, and ph / Phi for mathematical balance. The logo is the four-letter wordmark, with no separate symbol.

The vector master is `public/logo/txph-wordmark.svg`. Its outlined paths need no font. The p has a true descender, the T and h share an ascender, and the X carries a small burnt-orange seam. The monochrome derivative preserves the complete silhouette.

Light: #1C1C1A. Dark: #F2F1ED. Accent: #D85A30 on both themes. UI components inherit the existing brand ink token. Keep the SVG aspect ratio and clear space; use at least 80px width for UI. The full wordmark is retained in favicons, although four letters necessarily lose detail at 16px.

Run `node scripts/generate-brand-assets.mjs` from frontend to regenerate dark/monochrome SVGs, adaptive SVG favicon, PNG favicons, OS/notification icons, social image, and the size-comparison preview. Uses the existing Playwright dependency and installed Chrome. No archived assets are deployed.

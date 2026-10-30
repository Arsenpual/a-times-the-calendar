# A · สรุปเด่น (Summary Hero) — design reference

This is a design mockup created in a visual design tool, exported as a
standalone page. Treat it as a REFERENCE MOCKUP, not production code:
the markup and inline styles carry the design's precise values — colors,
font sizes, spacing, radii, shadows, layout — which an implementation
should replicate faithfully in its own components and styling system
rather than copy wholesale.

## Contents

- `ConceptA.dc.html` — the artboard (a Design Component: an `<x-dc>`
  template + a small logic class). The values to replicate live in its
  inline `style="…"` attributes and the `<helmet><style>` block.
- `support.js`, `vendor/react*.js` — the runtime that renders the
  component in a browser; not part of the design.

## Viewing

In the app running with `npm run dev`, press **Ctrl + Alt + S** outside a
text field to open Summary Hero. It is also available as **summary hero**
in the Mockup picker (Ctrl + Alt + W). Mockups are excluded from production builds.

Serve the folder (e.g. `python3 -m http.server`) and open `ConceptA.dc.html`;
some browsers block the scripts over file://.

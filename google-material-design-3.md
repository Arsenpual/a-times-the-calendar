---
version: 1.0.0
name: google-material-design-3
description: Google's Material Design 3 (M3) — a highly expressive, accessible, and adaptable design system. M3 shifts away from the heavy drop-shadows of M2, relying heavily on tonal elevation, fluid shapes, and generous spacing. The aesthetic is clean, rounded, and legible. The primary CTA buttons are fully rounded (pill-shaped), cards feature medium-to-large corner radii, and elevation is primarily expressed through subtle shifts in surface color rather than shadows. 

colors:
  primary: "#0b57d0"
  on-primary: "#ffffff"
  primary-container: "#d3e3fd"
  on-primary-container: "#041e49"
  secondary: "#00639b"
  on-secondary: "#ffffff"
  secondary-container: "#c2e7ff"
  on-secondary-container: "#001d35"
  tertiary: "#146c2e"
  on-tertiary: "#ffffff"
  tertiary-container: "#c4eed0"
  on-tertiary-container: "#002107"
  error: "#b3261e"
  on-error: "#ffffff"
  error-container: "#f9dedc"
  on-error-container: "#410e0b"
  background: "#fef7ff"
  on-background: "#1d1b20"
  surface: "#fef7ff"
  on-surface: "#1d1b20"
  surface-variant: "#e7e0ec"
  on-surface-variant: "#49454f"
  outline: "#79747e"
  outline-variant: "#cac4d0"
  surface-container-highest: "#e6e0e9"
  surface-container-high: "#ece6f0"
  surface-container: "#f3edf7"
  surface-container-low: "#f7f2fa"
  surface-container-lowest: "#ffffff"
  scrim: "#000000"

typography:
  display-lg:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 57px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: -0.25px
  display-md:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 45px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: 0px
  display-sm:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 36px
    fontWeight: 400
    lineHeight: 1.22
    letterSpacing: 0px
  headline-lg:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: 0px
  headline-md:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.28
    letterSpacing: 0px
  headline-sm:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0px
  title-lg:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1.27
    letterSpacing: 0px
  title-md:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0.15px
  title-sm:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.42
    letterSpacing: 0.1px
  body-lg:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.5px
  body-md:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.42
    letterSpacing: 0.25px
  body-sm:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0.4px
  label-lg:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.42
    letterSpacing: 0.1px
  label-md:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: 0.5px
  label-sm:
    fontFamily: "'Roboto', 'Google Sans', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: 0.5px

rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 28px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 72px

components:
  top-app-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title-lg}"
    height: 64px
    padding: 0 16px
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: 10px 24px
    height: 40px
  button-tonal:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: 10px 24px
    height: 40px
  button-outlined:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    border: "1px solid {colors.outline}"
    padding: 10px 24px
    height: 40px
  button-text:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: 10px 12px
    height: 40px
  fab-primary:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.lg}"
    width: 56px
    height: 56px
  card-elevated:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
  card-filled:
    backgroundColor: "{colors.surface-container-highest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
  card-outlined:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.outline-variant}"
    rounded: "{rounded.md}"
    padding: 16px
  text-field-filled:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface}"
    borderBottom: "1px solid {colors.on-surface}"
    roundedTop: "{rounded.xs}"
    roundedBottom: "{rounded.none}"
    height: 56px
    padding: 8px 16px
  text-field-outlined:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.outline}"
    rounded: "{rounded.xs}"
    height: 56px
    padding: 16px
  chip-assist:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.outline}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.sm}"
    padding: 6px 16px
    height: 32px
  dialog:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: 24px
---

## Overview

Google Material Design 3 (M3) is characterized by its personalized, expressive, and adaptable nature. The interface leans heavily into **tonal elevation** (using color shifts to represent height instead of relying entirely on drop shadows), prominent **rounded corners**, and clearly defined typography scales. 

The aesthetic is friendly yet highly functional. Primary interactions use fully rounded (pill-shaped) elements, while structural components like cards and dialogs use varying degrees of softened rectangles. Spacing is generous, utilizing a strict 8px/4px grid system, making the UI highly legible across mobile and desktop environments.

**Key Characteristics:**
- Tonal Palettes override flat hex codes. Backgrounds range from `{colors.surface-container-lowest}` to `{colors.surface-container-highest}` to signify depth.
- Primary CTA buttons are always fully rounded `{rounded.full}` (pill-shaped).
- Typography relies on the Roboto typeface, utilizing specific weights (Regular 400 for structural text, Medium 500 for actionable labels).
- Elevation is established mostly via surface color (Light grey to darker grey in Light Mode) rather than heavy drop shadows.
- Generous padding and margins: Layouts feel breathable and uncrowded.

## Colors

### Tonal Surface & Elevation
In M3, shadows are minimized. Instead, elevation is expressed via surface colors:
- **Level 0:** `{colors.surface}` or `{colors.background}` (Default app background)
- **Level 1:** `{colors.surface-container-low}` (Used for Elevated Cards)
- **Level 2:** `{colors.surface-container}`
- **Level 3:** `{colors.surface-container-high}` (Used for Dialogs, Menus)
- **Level 4:** `{colors.surface-container-highest}` (Used for Filled Cards)

### Brand & Accent
- **Primary:** `{colors.primary}` — The main action color. Paired with `{colors.on-primary}` for text. 
- **Primary Container:** `{colors.primary-container}` — Used for less emphasized actions like Tonal Buttons or FABs.
- **Secondary:** `{colors.secondary}` — Used for secondary UI elements, floating actions, or selection controls.
- **Tertiary:** `{colors.tertiary}` — Used for contrasting accents that need to stand out from primary/secondary elements.

### Outlines & Borders
- **Outline:** `{colors.outline}` — High contrast outline (e.g., Outlined Text Fields, Outlined Buttons).
- **Outline Variant:** `{colors.outline-variant}` — Low contrast outline (e.g., Outlined Cards, dividers).

## Typography

### Font Family
The system utilizes **Roboto** as the default typeface (with Google Sans as an alternative for displays if available). Fallback stack: `system-ui, sans-serif`.

### Hierarchy & Scale

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.display-lg}` | 57px | 400 | 1.12 | Massive hero text, numerals |
| `{typography.headline-md}`| 28px | 400 | 1.28 | Primary page headers, major sections |
| `{typography.title-lg}` | 22px | 400 | 1.27 | Top App Bar titles, dialog headers |
| `{typography.title-md}` | 16px | 500 | 1.5 | Subtitles, list item primary text |
| `{typography.body-lg}` | 16px | 400 | 1.5 | Primary reading text, paragraphs |
| `{typography.body-md}` | 14px | 400 | 1.42 | Secondary reading text |
| `{typography.label-lg}` | 14px | 500 | 1.42 | Button text, tabs, critical UI labels |
| `{typography.label-md}` | 12px | 500 | 1.33 | Chips, badges, tooltips |

### Principles
- M3 typography scales are very specifically calibrated.
- Never use bold (700) for standard buttons; M3 buttons use Medium (500) weight (`label-lg`).
- Display and Headline styles are strictly Regular (400) to keep large text from looking too heavy.

## Layout

### Spacing System
- **Base unit:** 8px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px.
- **Screen Margins:** Minimum 16px on mobile, 24px on tablet/desktop.

### Grid & Container
- Standard 4/8/12 column grids depending on window size (Compact, Medium, Expanded).
- Max width for comfortable reading is typically capped at 840px (or similar) on desktop, centered with fluid margins.

## Elevation & Depth

Material 3 shifts the paradigm from shadow-based depth to color-based depth.

| Elevation | Treatment | Use |
|---|---|---|
| Level 0 | `{colors.surface}` — no shadow | App background |
| Level 1 | `{colors.surface-container-low}` + very subtle soft shadow | Elevated cards |
| Level 2 | `{colors.surface-container}` + subtle shadow | Navigation bars |
| Level 3 | `{colors.surface-container-high}` + standard soft shadow | Dialogs, Search bars |
| Level 4 | `{colors.surface-container-highest}` | Menus, FABs |

## Shapes

M3 introduces a robust shape scale. 
- `{rounded.none}` (0px) - Full bleed imagery, bottom sheets touching edges.
- `{rounded.xs}` (4px) - Text fields, snackbars.
- `{rounded.sm}` (8px) - Chips.
- `{rounded.md}` (12px) - Cards, tooltips.
- `{rounded.lg}` (16px) - FABs (Floating Action Buttons). Note: FABs are rounded rectangles in M3, not circles.
- `{rounded.xl}` (28px) - Dialogs, large containers.
- `{rounded.full}` (9999px) - Standard CTA buttons, circular avatars.

## Components

### Buttons
- **`button-filled`** — High emphasis. Background `{colors.primary}`, text `{colors.on-primary}`, fully rounded `{rounded.full}`.
- **`button-tonal`** — Medium emphasis. Background `{colors.primary-container}`, fully rounded.
- **`button-outlined`** — Medium-low emphasis. Transparent background, 1px `{colors.outline}` border.
- **`button-text`** — Low emphasis. Transparent background, `{colors.primary}` text.

### Cards
- **`card-elevated`** — Uses tonal elevation. Background `{colors.surface-container-low}`, no border, radius `{rounded.md}` (12px).
- **`card-filled`** — Background `{colors.surface-container-highest}`, no border, radius `{rounded.md}`.
- **`card-outlined`** — Background `{colors.surface}`, 1px `{colors.outline-variant}` border, radius `{rounded.md}`.

### Inputs (Text Fields)
- **`text-field-filled`** — Background `{colors.surface-variant}`, top radius `{rounded.xs}` (4px), bottom radius 0, with a bottom border indicator.
- **`text-field-outlined`** — Transparent background, full border `{colors.outline}`, radius `{rounded.xs}` (4px) all around.

### Dialogs
- **`dialog`** — Highly rounded. Background `{colors.surface-container-high}`, radius `{rounded.xl}` (28px), padding 24px.

## Do's and Don'ts

### Do
- Always use fully rounded (pill-shaped) corners for standard buttons.
- Use Tonal palettes (`surface-container`) to indicate elevation instead of heavy CSS drop-shadows.
- Ensure all interactive labels use `{typography.label-lg}` (14px, Medium 500).
- Provide a minimum touch target size of 48x48px for all interactive elements.

### Don't
- Don't use 90-degree sharp corners (`{rounded.none}`) for standard UI components like cards or buttons.
- Don't use circular FABs; M3 FABs are rounded rectangles (`{rounded.lg}` or 16px).
- Don't use heavy, dark drop-shadows. Shadows should be extremely subtle, relying mostly on surface color contrast.
- Don't capitalize entire words in buttons unless it aligns with a specific brand guideline (M3 defaults to sentence case).

## Responsive Behavior

- **Compact (Mobile):** Navigation typically relies on a Bottom Navigation Bar. Side margins are 16px.
- **Medium (Tablet):** Navigation shifts to a Navigation Rail (left side). Side margins are 24px.
- **Expanded (Desktop):** Navigation shifts to a persistent Navigation Drawer. Max-width containers center the content to prevent excessive stretching.

## Iteration Guide

1. When instructed to build a component, check the `components:` block first.
2. If a specific component isn't listed, compose it using base tokens: Background from `colors: surface-container-*`, corners from `rounded:`, and text from `typography:`.
3. Default to Sentence case for all buttons and titles (e.g., "Submit form", not "SUBMIT FORM").
4. Always implement focus rings for accessibility using `{colors.primary}`.

## Known Gaps
- Material 3 supports "Dynamic Color" (Material You) where colors are generated from a user's wallpaper. This specification uses a static "Baseline" color theme for structural consistency.
- Motion and easing curves (Emphasized, Standard, Decelerated) are critical to M3 but are out of scope for static CSS tokenization.
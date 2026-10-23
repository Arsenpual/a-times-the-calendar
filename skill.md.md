# skill: google-dna-design-system

## Description
Comprehensive specification and implementation guidelines for building software with Google's iconic Design Language (Material Design 3 / Material You). Designed to ensure apps deliver Google's signature tactile, accessible, and intuitive user experience without requiring an explicit brand logo.

---

## Project Adaptation: T.i.M.E.S.

Apply this visual language to the existing product structure. The following
project requirements take precedence over the generic component examples below.

- **Top header:** Keep a shared header across features. Use it for product
  identity, shared controls, account access, and tools relevant to the active view.
- **Side taskbar:** Provide a shared side taskbar for navigating between product
  features. Give the active feature a clear tonal selection indicator, consistent
  icons, and readable labels. Establish the destinations from the actual features
  before implementing navigation.
- **First phase:** Design and refine the header and side taskbar together as the
  app's shared navigation frame. Include their spacing, visual hierarchy, surface
  colors, typography, shapes, and interaction states. Review this frame before
  extending the visual changes into individual feature content.
- **Responsive behavior:** Keep the top header on compact screens. Adapt the side
  taskbar into a collapsible panel or drawer when needed; preserve access to the
  same destinations and show the active feature clearly.
- **Brand:** Retain T.i.M.E.S. identity and its established accent color. Apply
  tonal surfaces and the shape/type/spacing system using the project's palette.
  The sample dark colors and Google four-color accents below are references,
  not mandatory replacements for the product's colors or semantic status colors.
- **Behavior scope:** FABs, bottom navigation, and drag-to-dismiss gestures are
  optional patterns. Introduce them only when the agreed feature scope calls for
  them. Preserve existing feature behavior during visual styling work.
- **Web units:** Translate dp guidance into appropriate CSS sizing. Distinguish
  a control's visible shape from its hit area and verify touch targets, text
  contrast, keyboard focus, and Thai text rendering in both themes.

---

## 1. Core Design Philosophy
- **Tactile Material Metaphor:** UI elements exist as dynamic, stacked surfaces (cards, sheets, dialogs) governed by physical lighting and depth.
- **Content-First Hierarchy:** Minimal visual noise. Space, contrast, and scale guide the user’s eye rather than decorative dividers or heavy drop shadows.
- **Expressive Personalization:** Dynamic color systems (Material You) where primary, secondary, and surface colors harmoniously adapt to dark/light contexts.
- **Universal Accessibility:** Strict adherence to touch targets (48x48dp minimum) and WCAG 2.1 contrast ratios.

---

## 2. Layout, Grid & Spatial System
- **Base Grid Unit:** Strict `8dp` spatial grid for outer margins, card spacing, and component alignment (use `4dp` strictly for tight internal padding).
- **Adaptive Layout Breakpoints:**
  - **Compact (Mobile):** `0–599dp` | 4 columns | 16dp margins.
  - **Medium (Tablets/Foldables):** `600–839dp` | 8 columns | 24dp margins.
  - **Expanded (Desktop/Web):** `840dp+` | 12 columns | 24dp+ margins (centered container max-width).
- **Minimum Touch Target:** All interactive controls (buttons, chips, icons) must measure at least `48x48dp`.

---

## 3. Typography Scale & Hierarchy
Use **Google Sans** as primary font family (fallback: Inter, Roboto). Maintain proportional scale and generous line-heights:

| Category | Role | Weight | Tracking (Letter Spacing) | Line Height |
| :--- | :--- | :--- | :--- | :--- |
| **Display / Headline** | Page Title / Hero | Bold (700) / Medium (500) | Tight (-0.25px to 0) | 1.25x |
| **Title** | Section Headers / Cards | Medium (500) | Normal (0px) | 1.3x |
| **Body** | Long-form / Descriptions | Regular (400) | Relaxed (+0.15px) | 1.5x - 1.6x |
| **Label / Action** | Buttons, Chips, Nav | Medium (500) | Emphasized (+0.1px) | 1.2x |

---

## 4. Color Architecture & Surface Tonal Elevation
Avoid traditional drop shadows for depth; rely on **Tonal Surface Layers** to create elevation.

### Dark Mode Palette Tokens (Recommended Base):
- **Surface Level 0 (App Canvas):** `#121212` or `#141318`
- **Surface Level 1 (Background Containers):** `#1E1B24` (8% tint elevation)
- **Surface Level 2 (Cards & Tiles):** `#25232A` (12% tint elevation)
- **Primary Accent:** Desaturated vibrant color (e.g., `#D0BCFF` or `#A8C7FA`) for primary call-to-actions.
- **On-Surface Text:** `#E6E1E5` (High Contrast ~87% opacity), `#C6C5D0` (Medium Contrast ~60% opacity).

### The Google 4-Color Micro-Accents:
Restrain main interface colors to neutral/tonal variants. Reserve the 4 core brand colors (`Blue: #4285F4`, `Red: #EA4335`, `Yellow: #FBBC05`, `Green: #34A853`) exclusively for status indicators, micro-badges, or multi-step progress animations.

---

## 5. Shape System & Geometry
Apply precise corner radiuses based on component scale to create a cohesive silhouette:

- **Pill Shape (`9999px`):** Search bars, Filter Chips, Action Badges, Primary Pill Buttons.
- **Large Radius (`28px`):** Modals, Floating Action Buttons (FAB), Floating Sheets.
- **Medium Radius (`16px - 20px`):** Content Cards, Grid Tiles, Alert Dialogs.
- **Small Radius (`8px - 12px`):** Input Text Fields, Tooltips, Dropdown Menus.

---

## 6. Signature Components & Interaction Patterns
1. **Floating Action Button (FAB):**
   - Positioned bottom-right or bottom-center.
   - Container shape: `16px` rounded square or `28px` pill.
   - Dedicated solely to the primary creation action (e.g., Compose, Add, New).
2. **Bottom Sheet / Drawer:**
   - Rounded top corners (`28px`).
   - Smooth drag-to-dismiss velocity gesture.
3. **Pill-Indicator Navigation Bar:**
   - For T.i.M.E.S., use the shared side taskbar alongside the top header;
     collapse the side taskbar on compact screens as described above.
   - Selected tab highlighted with a horizontal capsule pill indicator around the icon.
4. **Interactive State Layers:**
   - Visual state feedback over elements using translucent overlays:
     - **Hover:** `8%` opacity overlay of content color.
     - **Focus / Press:** `12%` opacity overlay with subtle expanding ripple effect.

---

## 7. Motion & Micro-interactions
- **Standard Easing (Deceleration):** `cubic-bezier(0.05, 0.7, 0.1, 1.0)` — Elements enter quickly and settle smoothly.
- **Duration Scale:**
  - *Micro-interactions (Checkboxes, Toggles):* `100ms - 200ms`
  - *Component Transitions (Cards expanding, Modals):* `300ms - 400ms`
  - *Screen Layout Morphing:* `500ms`

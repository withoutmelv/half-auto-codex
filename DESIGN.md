# Design System Document: Azure Clarity

## 1. Overview & Creative North Star
The Creative North Star for this system is **"Azure Clarity."** 

In a world of cluttered terminal interfaces and "hacker-aesthetic" dark modes, this system takes the opposite approach: a high-performance, editorial-grade workspace that feels like a premium command deck. We are moving away from the "grid-of-boxes" look toward a **Layered Atmospheric** experience. 

The design breaks the "template" look by utilizing intentional asymmetry, expansive white space, and a sophisticated hierarchy of blue tones. We reject the rigidity of 1px borders in favor of depth created through tonal shifts and ambient light. This is not just a tool; it is a clear, reliable environment for high-stakes decision-making.

---

## 2. Colors & Surface Architecture

### The Palette
We utilize a sophisticated range of blues and neutrals to define function and focus.
*   **Primary (#004ac6):** Our "Authoritative Blue." Used for high-level branding and primary actions.
*   **Primary Container (#2563eb):** Our "Action Blue." High energy, used for focal points.
*   **Surface / Background (#f7f9fb):** A cool-tinted white that prevents eye strain.

### Theme Modes
The application supports explicit light and dark modes. Light mode keeps the canonical Azure Clarity palette. Dark mode must remain atmospheric and blue-tinted, never pure black.

*   **Light Base:** `surface` (#f7f9fb), `surface-container-low` (#f2f4f6), `surface-container-lowest` (#ffffff), `surface-container-highest` (#e0e3e5).
*   **Dark Base:** `surface` (#101826), `surface-container-low` (#172235), `surface-container-lowest` (#233149), `surface-container-highest` (#0c1422).
*   **Dark Text:** `on-surface` (#f7f9fb), `on-surface-variant` (#d9e2f1), muted metadata (#98a6ba).
*   **Dark Accent:** Use soft Azure accent (#8bb8ff) for interactive text and selected states, with hover emphasis (#b7d2ff).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through:
1.  **Background Shifts:** Placing a `surface-container-low` component on a `surface` background.
2.  **Tonal Transitions:** Using the hierarchy of `surface-container` tiers to denote containment.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of "Azure Glass."
*   **Level 0 (Base):** `surface` (#f7f9fb) – The canvas.
*   **Level 1 (Sections):** `surface-container-low` (#f2f4f6) – Use for sidebars or background groupings.
*   **Level 2 (Active Cards):** `surface-container-lowest` (#ffffff) – Use for the highest-priority content blocks to make them "pop" against the grey.
*   **Level 3 (Overlays):** `surface-bright` (#f7f9fb) with Glassmorphism.

### The "Glass & Gradient" Rule
To elevate the "Azure" feel, use **Glassmorphism** for floating terminal windows or command palettes. Apply `surface-container-lowest` at 80% opacity with a `20px` backdrop blur. 
*   **Signature Texture:** Primary buttons should use a subtle linear gradient from `primary` (#004ac6) to `primary-container` (#2563eb) at a 135° angle to provide a "jewel-toned" depth.

---

## 3. Typography: The Editorial Command
We use a dual-sans-serif approach to balance technical precision with high-end editorial feel.

*   **The Power Couple:** **Manrope** (Display/Headlines) for an authoritative, modern personality, and **Inter** (Body/Labels) for clinical readability.
*   **Hierarchy as Navigation:**
    *   **Display-LG (Manrope, 3.5rem):** Reserved for data-heavy hero numbers or system states.
    *   **Headline-SM (Manrope, 1.5rem):** Used for section titles. This should feel like a magazine header.
    *   **Body-MD (Inter, 0.875rem):** The workhorse for terminal logs and descriptions.
    *   **Label-SM (Inter, 0.6875rem):** Used for metadata, always in uppercase with +0.05em letter spacing for a "pro" look.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved via **Tonal Layering**. Instead of shadows on every card, use the "Stacking Rule": 
Place a `#ffffff` (`surface-container-lowest`) card on top of a `#f2f4f6` (`surface-container-low`) background. The 3% difference in luminance creates a clean, natural edge that mimics professional print.

### Ambient Shadows
When an element must float (e.g., a modal or a floating action button):
*   **Value:** Blur: 32px, Y: 8px, Opacity: 6%.
*   **Color:** Tint the shadow with `on-surface` (#191c1e) to ensure the shadow feels like it belongs to the environment, not a generic grey drop.

### The "Ghost Border" Fallback
If accessibility requires a container edge in high-glare environments, use a **Ghost Border**:
*   **Stroke:** 1px
*   **Color:** `outline-variant` (#c3c6d7) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary` to `primary-container`. Corner radius: `md` (0.75rem). No border.
*   **Secondary:** `surface-container-high` background with `on-primary-fixed-variant` text.
*   **Tertiary:** Transparent background, `primary` text. Use for low-emphasis system commands.

### Terminal Inputs & Fields
*   **Surface:** Use `surface-container-highest` (#e0e3e5) to create a "recessed" look for input areas.
*   **Focus State:** Instead of a thick border, use a 2px "Glow" using the `primary` color at 30% opacity.

### Cards & Data Lists
*   **Strict Rule:** No horizontal dividers.
*   **Separation:** Use `xl` spacing (1.5rem) between items or a subtle background toggle (zebra striping) using `surface` and `surface-container-low`.
*   **Radius:** Always `lg` (1rem) for main containers to soften the "terminal" feel.

### Activity Chips
*   Use `full` (9999px) roundedness. 
*   **Success state:** `primary-fixed` background with `on-primary-fixed` text. This keeps the "Azure" theme even for status indicators.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. A sidebar that doesn't reach the bottom or a header that overlaps a content card creates a custom, high-end feel.
*   **Do** use "Negative Space" as a functional element. High-performance tools need room to breathe to reduce cognitive load.
*   **Do** use `primary-fixed` for subtle highlights in logs or code blocks to keep the "Azure Clarity" thread throughout.

### Don’t:
*   **Don’t** use pure black (#000000) for text. Use `on-surface` (#191c1e) to maintain the soft professional tone.
*   **Don’t** use standard "Material Design" shadows. They are too heavy for this editorial system.
*   **Don’t** use 1px dividers to separate menu items. Use vertical padding and font-weight shifts instead.
*   **Don’t** use sharp corners. Everything in this system should feel "ergonomic" and approachable, hence the 8px+ (`DEFAULT` or `lg`) radius.

### Accessibility Note:
While we lean into subtle tonal shifts, always ensure that text (`on-surface`) against backgrounds (`surface`) maintains a contrast ratio of at least 4.5:1. Use `primary` (#004ac6) for all interactive text links to guarantee visibility.

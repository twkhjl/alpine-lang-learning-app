```markdown
# Design System Document: The Focused Scholar

## 1. Overview & Creative North Star
This design system moves away from the "industrial" feel of traditional educational software, instead embracing a **Creative North Star** we call **"The Serene Atelier."** 

The goal is to create a digital environment that mimics a high-end, quiet study—where focus is a byproduct of beauty. We achieve this by rejecting rigid grids and harsh dividers in favor of **Tonal Layering** and **Intentional Asymmetry**. The layout should feel organic, using expansive white space (breathing room) to lower the user's cognitive load. By utilizing soft, mint-to-blue shifts and sophisticated "Lexend" headlines, we transform a simple flashcard app into a premium editorial experience.

---

## 2. Colors: The Tonal Landscape
Our palette is rooted in a "friendly-focused" spectrum. We utilize Material Design token logic but apply it with an editorial touch.

### The "No-Line" Rule
**Designers are strictly prohibited from using 1px solid borders for sectioning.** 
Structure must be defined through background color shifts. A `surface-container-low` section sitting on a `surface` background provides enough contrast to be felt, rather than seen. This creates a seamless, sophisticated flow.

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of fine, heavy-weight paper.
- **Base Layer:** `background` (#f6fafe) — the vast, quiet canvas.
- **Section Layer:** `surface-container` (#e7eff5) — for grouping broad content areas.
- **Interaction Layer:** `surface-container-lowest` (#ffffff) — reserved for the flashcards themselves to provide maximum "pop" and focus.

### The "Glass & Gradient" Rule
Floating elements (like a navigation bar or a "Quick Search" modal) should utilize **Glassmorphism**. Apply `surface` colors at 70% opacity with a `24px` backdrop blur. 
- **Signature Texture:** For primary CTAs (e.g., "Start Study Session"), use a subtle linear gradient from `primary` (#1c6d25) to `primary_container` (#9df197) at a 135-degree angle. This adds a "soul" and depth that flat hex codes lack.

---

## 3. Typography: Editorial Authority
We pair the geometric clarity of **Lexend** with the highly readable, humanistic **Manrope**.

*   **Display & Headlines (Lexend):** These are your "Anchors." Use `display-lg` for session milestones and `headline-md` for deck titles. Lexend’s open counters reduce eye strain during long study periods.
*   **Body & Titles (Manrope):** These are your "Narrators." Use `title-md` for the question/answer text on cards to ensure maximum legibility. 
*   **Hierarchy as Identity:** Use extreme scale shifts. A `display-sm` progress number next to a `label-sm` "Cards Remaining" creates a sophisticated, high-contrast look that feels custom-designed rather than templated.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "software-heavy." We use light to guide the eye.

*   **The Layering Principle:** Depth is achieved by stacking. Place a card (`surface-container-lowest`) on a background (`surface-container-low`) to create a soft, natural lift.
*   **Ambient Shadows:** For the "Active Study Card," use a shadow tinted with the `on-surface` color: `box-shadow: 0 20px 40px rgba(42, 52, 58, 0.06);`. This mimics natural sunlight rather than a digital effect.
*   **The "Ghost Border" Fallback:** If a divider is essential for accessibility, use `outline-variant` (#a9b3bb) at **15% opacity**. It should be a whisper, not a shout.
*   **Motion Depth:** When a card is flipped, increase the blur of the ambient shadow and scale the card by 2% to simulate the card moving toward the user.

---

## 5. Components: Primitives for Study

### Buttons
- **Primary:** Gradient-filled (`primary` to `primary_container`), `xl` roundedness (3rem). Text: `on_primary`.
- **Tertiary (Audio/Search):** No background. Use `tertiary` (#356579) for the icon color. On hover, apply a `surface-container-high` circular backplate.

### Flashcards (The Hero Component)
- **Styling:** `surface-container-lowest` background, `lg` corners (2rem). 
- **Constraint:** **No Dividers.** Use vertical spacing (e.g., 2rem) to separate the question from the supplemental audio icon.
- **Study Mode:** When in "Study Mode," the card should occupy 85% of the viewport width to force focus, utilizing `display-sm` for the primary text.

### Search & Audio Inputs
- **Search Bar:** Use `surface-container-low` with a `full` (9999px) corner radius. 
- **Audio Toggle:** A soft-pulsing `secondary_container` background when active, signifying a "listening" or "playing" state without harsh red colors.

### Chips (Subject Tags)
- Use `secondary_container` with `on_secondary_container` text. Roundedness should be `full`. These should feel like smooth river pebbles.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use `xl` (3rem) or `full` rounding for interactive elements to maintain the "friendly" educational feel.
- **Do** use `tertiary` tones for "secondary" information like metadata or hints—it’s softer than pure grey.
- **Do** favor "Overlapping Layouts"—let an icon slightly break the boundary of a container to create a custom, high-end feel.

### Don’t:
- **Don’t** use a black (#000000) font. Use `on_surface` (#2a343a) for a softer, premium contrast.
- **Don’t** use 1px dividers. If content needs to be separated, use an 8px or 16px vertical gap.
- **Don’t** use "Standard" easing. Use a "Quartic Out" transition for card flips (0.6s) to give them a weighted, physical presence.
- **Don’t** require a login. The interface should be an open door, not a gate. Use the `surface-container-lowest` to make the entry point feel inviting.

---

## 7. Signature Interaction: The "Focus Fade"
When the user begins a study session, use a staggered animation to fade out the `surface-container` elements of the navigation, leaving only the `surface-container-lowest` card against the `background`. This "Stage Lighting" effect signals to the brain that it is time to learn.```
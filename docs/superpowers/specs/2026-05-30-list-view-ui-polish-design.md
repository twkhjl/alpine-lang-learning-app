# List View UI Polish Design

## Goal

Refine the frontend list loop-play page so the selected-word summary is explorable, the control bar becomes icon-first and more compact, and the page feels cleaner and more intentional in day-to-day use.

## Feasibility

Feasible.

This work is frontend-only and builds directly on the already implemented list loop-play flow. No backend or schema change is required.

Complexity: low to medium.

## Scope

Included:

- make the selected-word summary clickable
- show a selected-word panel listing currently selected words
- compact the control bar into icon-first controls
- reduce text clutter in the top control area
- improve selected-card and active-playing-card visual hierarchy
- improve overall list card composition

Excluded:

- changes to playback rules
- drag-and-drop ordering
- persistence changes
- backend changes

## Functional Requirements

### 1. Selected Summary Becomes Interactive

The current `Selected N` summary concept must become clickable.

Behavior:

- clicking it opens a selected-word panel
- clicking it again closes the panel
- pressing `Escape` closes the panel
- clicking outside the panel closes the panel

### 2. Selected-Word Panel

The panel must show which words are currently selected.

Required content per selected item:

- image thumbnail if available
- current active list language text
- remove-from-selection action

Required panel-level actions:

- clear all selected words
- close panel

Ordering:

- items follow the same playback order as current list ordering

### 3. Responsive Presentation

Presentation rules:

- desktop uses a popover or dropdown panel anchored to the selected summary
- mobile uses a bottom sheet or full-width floating panel

Implementation may use one shared floating panel style across devices only if it remains readable, touch-friendly, and visually anchored to the selected summary action.

### 4. Icon-Only Control Bar

The following controls should become icon-first and not rely on full text labels in the visible UI:

- language switch
- loop toggle
- clear selection

Rules:

- keep accessible `aria-label`
- keep tooltip or title behavior where practical on desktop
- use recognizable icons with consistent sizing

### 5. Language Control Compact Form

The current visible language control should avoid long full text labels.

Required direction:

- short label badge like `ZH`, `ID`, `EN`
- or icon plus short code

The control must still make it clear which language is currently active and which language will be switched to next.

### 6. Loop Toggle Compact Form

The visible loop control should prioritize:

- loop icon
- play or stop state

Visible text is not required.

The active or inactive state must remain obvious through:

- icon change
- color change
- pressed or active background treatment

### 7. Clear Selection Compact Form

The clear-selection control should use an icon-first treatment and should not require persistent visible text.

The action must remain discoverable through:

- tooltip
- `aria-label`
- placement near the selected summary

### 8. Card Visual Polish

The list cards should be cleaned up visually.

Required direction:

- stronger separation between image area and content area
- clearer vertical rhythm between word, pronunciation, and actions
- stronger selected-state styling
- stronger playing-state styling

### 9. Selected-State Styling

When a word is selected:

- the select control must clearly show selected state
- the card itself should also show subtle selection state

Recommended signals:

- tinted border
- soft background emphasis
- small selected badge or check indicator

### 10. Playing-State Styling

When a word is currently playing in the loop:

- the playing state must visually outrank normal selected state

Recommended signals:

- brighter border or ring
- active glow or subtle pulse
- small loop or play indicator near the card header

## UI Recommendations

### Control Bar Layout

Control order:

- selected summary button
- language toggle
- loop size selector
- loop toggle
- clear selection

Visual direction:

- keep the loop size selector as the only text-heavy control
- other actions become circular or pill icon buttons

### Selected Panel Layout

Panel structure:

- header: selected count plus close button
- body: selected items list
- footer: clear all button

If the selected list is long:

- panel scrolls internally
- panel has a capped visible height

### Card Layout Refinement

Card structure:

- image block
- content block
- compact action row

Avoid:

- too many equally strong badges
- oversized action buttons competing with the word itself

## Acceptance Criteria

1. Clicking the selected summary opens a panel showing selected words.
2. The selected-word panel lists selected words in playback order.
3. A selected word can be removed directly from the panel.
4. The panel provides a clear-all action.
5. Language switch, loop toggle, and clear selection controls can be rendered without visible text labels.
6. These icon-only controls remain accessible through `aria-label` and discoverable hover or focus affordances.
7. Selected cards are visually distinct from unselected cards.
8. Currently playing cards are visually distinct from selected-but-not-playing cards.
9. The page remains readable and usable on both desktop and mobile.
10. The selected summary button clearly communicates how many words are selected before the panel is opened.

## Risks

### 1. Discoverability

Icon-only controls can become ambiguous if icon choice is weak.

Mitigation:

- keep `aria-label`
- add tooltip or title on desktop
- use standard icons only

### 2. Panel Complexity

Selected-word panel can become visually noisy if each row carries too many actions.

Mitigation:

- keep each row simple
- one remove action per row
- reserve bulk actions for panel footer

### 3. Over-Styling

Too many glows, badges, or colored borders can make the page feel busy.

Mitigation:

- selected state should be subtle
- playing state should be strongest
- keep only one dominant highlight per card

## Implementation Notes

Likely file touch points:

- `index.html`
  - selected summary button markup
  - selected-word panel markup
  - compact icon-first control bar
  - list card visual adjustments
- `public/assets/js/main.js`
  - panel open or close state
  - selected panel helpers
  - remove-from-panel action
  - outside click or `Escape` handling if needed
- tests
  - extend list e2e checks for selected panel
  - verify icon-only controls remain accessible

## Open Questions Resolved

The following points are fixed by this spec and should not be re-opened during implementation unless product requirements change:

- the selected summary remains a count-first summary concept, not a separate page
- clicking the selected summary opens a selected-word panel rather than navigating away
- language switch, loop toggle, and clear selection are visible as icon-first controls
- loop size remains the only text-heavy control in the top bar
- desktop uses a popover or dropdown-style selected panel
- mobile uses a bottom-sheet or full-width floating selected panel
- selected-state styling is subtler than playing-state styling

## Out of Scope Follow-Ups

- animated drag sorting inside the selected panel
- pinned or favorite grouping inside the selected panel
- batch selection presets
- keyboard shortcut system for loop controls

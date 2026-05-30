# Frontend Grid View Design

## Goal

Add a new frontend `grid` view that presents the current filtered words in a fixed 2x3 layout, supports paging through consecutive groups of six words, allows existing display-language switching, and provides a manual loop-play toggle that plays audio from top-left to bottom-right with active-card highlighting.

## Feasibility

This feature is feasible within the current frontend architecture.

Reasons:

- The app already uses `activeView` to switch between frontend views.
- The app already has global display-language state via `displayLanguage1` and `displayLanguage2`.
- The app already resolves per-word audio paths and exposes `playAudio(word)`.
- The required word source can reuse the current filtered result set instead of introducing new backend APIs or schema changes.

The feature is primarily a frontend state-management and UI addition. No database migration or API contract change is required.

## Current Context

Relevant existing structure:

- `index.html`
  - Renders frontend views by `activeView`
  - Owns bottom navigation
  - Already contains card, list, favorites, and settings sections
- `public/assets/js/main.js`
  - Owns `lexiconApp()`
  - Stores view state, language preferences, filters, word status state, and audio helpers
  - Persists preferences through `persistPreferences()`

This means the new `grid` view should follow existing frontend patterns instead of introducing a parallel rendering model.

## Chosen Direction

Add `grid` as a first-class frontend view alongside `card`, `list`, `favorites`, and `settings`.

Why this direction:

- Lowest implementation risk
- Cleanest alignment with current `activeView` architecture
- Avoids mixing single-card navigation and six-grid pagination into one shared mode
- Reuses existing language, filtering, and audio behavior with minimal backend impact

Alternatives considered but rejected:

- Extending `card` into `single/grid` sub-modes
  - Rejected because it would mix two different navigation models into one view state
- Embedding six-grid inside list page
  - Rejected because playback scope and page intent would become ambiguous

## Scope

Included:

- New `grid` entry in frontend navigation
- New grid section in frontend UI
- Six-slot paging based on current filtered result set
- Empty-slot padding when fewer than six words remain
- Grid-level previous/next paging controls
- Grid-level loop-play toggle button
- Active playing-card highlight
- Reuse of existing display-language switching
- Reuse of existing word filtering result
- Correct cleanup when leaving the view or changing the page/filter set
- New UI translation keys for grid-specific labels

Excluded:

- Backend schema changes
- New admin configuration
- Auto-play on entering grid view
- Custom playback order
- Per-card playback toggle or queue editing
- Restoring loop-play state after reload

## Functional Requirements

### 1. New View Entry

The frontend must expose a new `grid` view in the bottom navigation.

Requirements:

- `activeView` must accept `grid`
- persisted preferences must allow `grid`
- `lastContentView` must treat `grid` like other content views

### 2. Grid Layout

The grid view must render exactly six visual slots in a 2-column by 3-row layout.

Requirements:

- Slot dimensions should remain visually consistent across all six positions
- Each populated slot represents one word
- Each empty slot keeps layout structure intact
- Empty slots must not be interactive

### 3. Word Source

The grid must use the current filtered result set as its source.

Rules:

- Grid paging source = current filtered words after existing tag/status filtering
- Search behavior should match the currently chosen source collection if the implementation shares list-style search logic in the future
- No grid-specific data source is introduced

### 4. Paging Model

Grid pages are contiguous groups of six words.

Rules:

- Page 0 = filtered results 1-6
- Page 1 = filtered results 7-12
- Continue in this pattern until source exhaustion
- Previous and next controls must move by exactly one group of six
- When the final page has fewer than six words, render empty slots to fill the remaining positions
- If filtering changes and current page becomes invalid, clamp to the last valid page or zero when empty

### 5. Language Display

Grid cards must honor the existing global display-language settings.

Rules:

- Grid text updates when `displayLanguage1` or `displayLanguage2` changes
- No grid-only language selector is introduced
- Switching display language changes visible text only
- Switching display language must not automatically start, stop, or restart loop play

### 6. Manual Loop Play

Loop play must be controlled by a single toggle button inside grid view.

Rules:

- Initial state is stopped
- First press starts loop play
- Second press stops loop play
- Loop play never starts automatically on entering grid view

### 7. Playback Order

Playback order must be fixed from top-left to bottom-right.

Slot order:

1. row 1 col 1
2. row 1 col 2
3. row 2 col 1
4. row 2 col 2
5. row 3 col 1
6. row 3 col 2

Rules:

- Empty slots are skipped
- Populated slots without audio are skipped
- After the last playable slot finishes, playback resumes from the first playable slot
- If no playable slot exists on the current page, loop play must not enter playing state

### 8. Playback Timing

Playback advances when the current audio finishes, not by fixed interval.

Reason:

- Preserves full audio playback
- Avoids clipping longer audio
- Matches learning-oriented listening behavior better than fixed delay

### 9. Active Highlight

While loop play is active, exactly one currently playing populated card must appear highlighted.

Rules:

- Highlight moves with playback order
- Highlight clears when loop play stops
- Highlight clears when leaving grid view
- Highlight clears when paging to a different group

### 10. Stop Conditions

Any existing grid loop session must stop immediately when one of the following occurs:

- User presses the loop button again
- User switches to another frontend view
- User pages to previous group
- User pages to next group
- Filters change and alter the current grid content
- Page unload or refresh occurs

Display-language changes are explicitly not a stop condition.

## UI / UX Design

### Grid Header / Control Area

The grid view should include a compact control area near the grid.

Recommended controls:

- Previous group button
- Next group button
- Loop-play toggle button
- Group progress label such as `7-12 / 25`

Behavior:

- Previous button disabled on first page
- Next button disabled on last page
- Loop-play button label/icon changes between play and stop states

### Card Content

Each populated card should show:

- Primary display-language text
- Secondary display-language text
- Optional pronunciation if current card treatment can include it without visual clutter

This feature should avoid introducing excessive per-card controls. Grid is for quick scanning and passive loop listening, not full detail editing.

### Empty Slots

Empty slots should:

- Keep the same size as populated slots
- Use a subdued placeholder treatment
- Avoid showing fake text or fake playback affordances

### Active Playing State

The active playing card needs a strong enough visual signal to be noticed during loop playback.

Recommended treatment:

- Elevated border contrast
- Slight background emphasis
- Shadow or glow aligned with current visual system

Only one card may be visually active at a time.

## State Model

New or expanded frontend state should include:

- `activeView` including `grid`
- `gridPageIndex: number`
- `gridPageSize: 6`
- `gridLoopPlaying: boolean`
- `gridLoopActiveIndex: number`
- `gridLoopGeneration: number`
- `gridCurrentAudio: Audio | null`

Derived state should include:

- `gridSourceWords`
  - current filtered words used by grid mode
- `gridPageWords`
  - current page slice from source
- `gridSlots`
  - six total items, padded with empty placeholders
- `gridPlayableIndexes`
  - indexes of non-empty slots that have playable audio

Notes:

- A generation token is recommended to invalidate stale async audio callbacks when view/page/filter state changes.
- An active `Audio` reference is recommended so stop behavior can pause and release current playback cleanly.

## Integration Requirements

### Preferences

Preference normalization and persistence must be updated so `grid` behaves like other valid content views.

Touch points expected:

- `VALID_VIEWS`
- `DEFAULT_PREFERENCES`
- `normalizePreferences(...)`
- `persistPreferences()`
- `switchView(...)`

### Keyboard Handling

Keyboard support is optional for initial delivery.

If implemented in this phase:

- Left arrow = previous group
- Right arrow = next group

If omitted, it should remain an explicit non-goal for this feature slice.

### Internationalization

New UI strings will be required for grid-specific controls and empty states.

Expected translation keys:

- `gridView`
- `gridLoopPlay`
- `gridLoopStop`
- `gridPreviousGroup`
- `gridNextGroup`
- `gridProgress`
- `gridNoPlayableAudio`
- `gridEmptySlot`

Exact key names can change during implementation, but the spec requires dedicated grid-view copy instead of hardcoded text.

## Error Handling

### No Playable Audio on Current Page

If the current grid page contains no playable audio:

- pressing loop-play must not set the UI into active playing mode
- the app should surface a lightweight user-facing message consistent with current frontend feedback patterns

### Audio Playback Failure Mid-Loop

If a playable slot fails at runtime:

- treat the slot as failed for that turn
- continue to the next playable slot
- do not crash the loop controller

### Filter/Page Drift

If source data changes while the grid is active:

- clamp the page index
- stop any active loop
- recompute slots and playable indexes from the new source

## Non-Functional Requirements

- Must work on mobile and desktop
- Must preserve fixed six-slot structure on smaller screens
- Must not introduce backend dependency changes
- Must not leave orphaned audio playback running after state changes
- Must remain compatible with current Alpine-based single-file frontend structure

## Acceptance Criteria

1. A new grid entry appears in bottom navigation and successfully switches to grid view.
2. Grid view renders six slots in a fixed 2x3 layout.
3. The first page shows the first six words from the current filtered result set.
4. Previous/next group controls move exactly one six-word page at a time.
5. The final page preserves six slots by filling remaining positions with non-interactive empty cards.
6. Changing display language updates grid text immediately.
7. Loop play starts only when the user presses the toggle button.
8. Loop play plays from top-left to bottom-right and repeats indefinitely until stopped.
9. Empty slots are skipped during playback.
10. Populated cards without audio are skipped during playback.
11. Only the currently playing card is highlighted.
12. Pressing the toggle button while playing stops loop playback and clears active highlight.
13. Switching view, changing grid page, changing filters, or unloading the page stops the loop immediately.
14. Reloading the page never restores an active loop-playing state.

## Risks

### 1. `main.js` Growth

`public/assets/js/main.js` already owns many unrelated responsibilities. Adding grid logic directly will further increase coupling.

Mitigation:

- keep grid behavior grouped in clearly named helpers
- prefer pure helpers for page slicing and playable-slot calculation

### 2. Audio Race Conditions

Async audio completion events can fire after the user has switched view or page.

Mitigation:

- use `gridLoopGeneration` or equivalent invalidation token
- keep a current `Audio` reference and clear listeners on stop

### 3. UI Density on Mobile

Six cards plus control bar can feel crowded on smaller screens.

Mitigation:

- prioritize legibility over card detail density
- keep controls compact
- avoid adding per-card action buttons in initial version

## Implementation Notes

Expected file touch points during implementation:

- `index.html`
  - add grid section
  - add navigation button
  - add grid controls and card-slot markup
- `public/assets/js/main.js`
  - add grid state
  - add grid derived-state helpers
  - add loop-play controller
  - add stop/cleanup hooks
  - extend preference persistence
- translation seed/source used by frontend UI labels
  - add grid-specific copy

No change is expected in:

- Supabase schema
- frontend data fetch contract
- admin pages

## Testing Guidance

Implementation should verify at least:

- view switching to and from grid
- correct page slicing for 0, full, and partial final pages
- language-switch update behavior
- loop-play start/stop behavior
- skip behavior for empty and no-audio slots
- cleanup behavior on view/page/filter change

If automated frontend tests exist or are extended, include coverage for:

- grid view render
- pagination logic
- loop cleanup behavior

## Out of Scope Follow-Ups

These are valid future enhancements but not part of this spec:

- per-card manual audio button inside grid cards
- custom playback speed
- random playback order
- remembering last viewed grid page across reload
- keyboard navigation parity across all grid controls

# List View Multi-Select Loop Play Design

## Goal

Move loop-play behavior into the frontend list page so users can search words, multi-select a session-level playback list that survives search changes, and loop only the selected words with a single-column card layout on both desktop and mobile.

## Why Change Direction

The original grid view solved a narrow problem: show six words and loop them in order.

The new requirements are broader:

- search and multi-select words
- keep selected words across search changes
- choose loop size `1 / 3 / 6`
- show image
- show one display language plus pronunciation
- quickly switch to the second display language
- use one-column layout on all devices

This is no longer a grid-view enhancement. It is a list-page playback workflow.

Because of that, the correct home is `list` view, not `grid` view.

## Feasibility

Feasible.

Reasons:

- `list` view already has searchable word data
- frontend already has global display-language state
- frontend already resolves per-word audio paths
- current app already has loop-play concepts from `grid` work that can be adapted or replaced
- no backend schema change is required

Complexity: medium.

Main work is frontend state, list UI restructuring, and playback queue rules.

## Product Direction

The list page becomes the primary place for:

- browsing words
- searching words
- selecting words
- managing loop-play source
- controlling playback language and loop size

Loop play source is explicitly:

- selected words only

Search results are only:

- candidate words that can be selected

## Scope

Included:

- convert list page cards to one-column layout on desktop and mobile
- add multi-select on list items
- keep selected words across search changes
- add list-page loop-play control bar
- add loop-size selector with options `1 / 3 / 6`
- interpret loop size as `6 / 18 / 36` words maximum
- show one display language and matching pronunciation
- add quick toggle to switch displayed language to the second language
- show image in list cards
- highlight the currently playing card
- loop only selected words
- preserve selected-word order according to current list ordering

Excluded:

- drag-and-drop custom ordering
- backend persistence of selected words unless explicitly added later
- custom playback speed
- random playback
- per-word playback queue editing

## Core User Flow

1. User opens `list` page.
2. User searches words.
3. User selects multiple words from the result list.
4. Selected words remain selected even if the search keyword changes.
5. User chooses loop size `1 / 3 / 6`.
6. User starts loop play.
7. App loops only the selected words, capped at `6 / 18 / 36` items depending on loop size.
8. User can switch displayed language quickly.
9. Current playing card is visibly highlighted.

## Functional Requirements

### 1. List Page Layout

The list page must change from multi-item compact rows to one-column cards on all screen sizes.

Requirements:

- desktop uses one card per row
- mobile uses one card per row
- each card remains readable with image, word text, pronunciation, and selection state

### 2. Card Content

Each list card must display:

- word image
- one active display language text
- pronunciation for the active display language
- multi-select control

Do not show both display languages at the same time in the main card content.

### 3. Quick Language Toggle

The list page must provide a fast way to switch card language between:

- `displayLanguage1`
- `displayLanguage2`

Rules:

- quick toggle changes visible text and pronunciation on list cards
- quick toggle should also define the preferred playback language attempt for loop play
- if the active language has no pronunciation, pronunciation area may hide
- if the active language has no audio, playback falls back to existing audio fallback order unless product decides strict language-only playback later

### 4. Multi-Select Behavior

List items must support multi-select.

Rules:

- selection is independent from favorite/ignored status
- selected words remain selected when search keyword changes
- selected words remain selected while scrolling within the view
- selected-word count must be visible in the loop-play control area

Recommended state:

- `selectedLoopWordIds: number[]`

### 5. Search Behavior

Search continues to filter the visible candidate list only.

Rules:

- search does not clear selected words
- search does not change the selected-word set
- a selected word may be temporarily hidden if it does not match the current search
- app must still remember it as selected

### 6. Loop Source

Loop playback must use only selected words.

Rules:

- if no words are selected, loop play cannot start
- if selected words exist, build playback source from selected words ordered by current list ordering
- search filtering does not remove already selected words from playback source

### 7. Loop Size Selector

The control bar must include a selector with options:

- `1`
- `3`
- `6`

Interpretation:

- `1` = play up to `6` selected words
- `3` = play up to `18` selected words
- `6` = play up to `36` selected words

Rules:

- if selected-word count is below the cap, play all selected words
- if selected-word count is above the cap, play the first N words according to current list ordering

### 8. Playback Order

Playback order must follow current list ordering, not selection click order.

Reason:

- simpler mental model
- no separate custom ordering UI needed
- matches current page sorting behavior

### 9. Loop Toggle

Loop playback is controlled by a single toggle button.

Rules:

- initial state is stopped
- first press starts loop
- second press stops loop
- loop continues until user stops it or a stop condition occurs

### 10. Stop Conditions

Loop playback must stop immediately when:

- user presses loop toggle again
- user switches away from list view
- user changes loop-size setting
- selected-word set changes
- active list language changes
- page unload or refresh occurs

When the user changes the active list language, loop playback must stop immediately. The user must press the loop toggle again to restart with the new language preference. This keeps behavior predictable and avoids silent mid-loop queue changes.

### 11. Active Highlight

Exactly one currently playing card must be highlighted.

Rules:

- highlight moves as playback advances
- highlight clears when playback stops
- highlight clears when the selected word is removed from the loop source

### 12. Images

List cards must show the word image when available.

Rules:

- keep image aspect ratio stable
- if image is missing, show a consistent placeholder treatment
- image must not dominate the card to the point where text and select controls become hard to use

## Data Model and State

Recommended new state:

- `selectedLoopWordIds: number[]`
- `listLoopPlaying: boolean`
- `listLoopActiveWordId: number | null`
- `listLoopGeneration: number`
- `listLoopCurrentAudio: Audio | null`
- `listLoopGroupCount: 1 | 3 | 6`
- `listQuickLanguageSlot: 1 | 2`

Derived state:

- `activeListLanguage`
  - `displayLanguage1` when slot is `1`
  - `displayLanguage2` when slot is `2`
- `selectedLoopWords`
  - all selected words ordered by current list ordering
- `cappedLoopWords`
  - selected words trimmed to `6 / 18 / 36`
- `playableLoopWords`
  - capped loop words that actually have audio

## UI Structure

### Control Bar

Add a control bar near the top of list view.

Recommended controls:

- selected count
- quick language toggle
- loop-size selector `1 / 3 / 6`
- start/stop loop button
- clear selection button

Optional:

- selected-only filter chip

Not required for first phase.

### Card Actions

Each card should expose:

- selection checkbox or toggle button
- existing detail/open action if still needed
- optional per-card one-shot audio button if retained

Selection affordance must be visually obvious.

## Playback Rules

### Language Rule

- playback first attempts audio for `activeListLanguage`
- if unavailable, fall back to existing audio fallback order

This keeps playback practical without making words silently unplayable just because one language audio file is missing.

### No Playable Words

If selected words exist but none are playable:

- loop must not enter playing state
- show lightweight feedback to user

### Mixed Playable / Unplayable Selection

If some selected words have no audio:

- skip them
- continue loop on playable words

## Persistence

Rules for first phase:

- persist loop-size selection
- persist list quick-language slot
- do not persist selected loop words across full page reload yet

Reason:

- language and loop-size are user preferences
- selected words are more session-like and can create confusion if silently restored much later

If product wants selected-word persistence later, add it as a separate requirement.

## Grid View Impact

Product decision:

- deprecate `grid` view as primary loop-play experience

Options:

1. Remove `grid` view entirely
2. Keep `grid` view temporarily but stop extending it
3. Redirect users from `grid` to improved `list` flow

Required implementation stance for this spec:

- keep `grid` view temporarily if removal would increase delivery risk
- do not add any new product behavior to `grid` view
- treat `list` view as the only actively developed loop-play surface

## Acceptance Criteria

1. List page renders one card per row on desktop and mobile.
2. Each card shows image, one display language, and matching pronunciation.
3. User can multi-select words from the list page.
4. Selected words remain selected after search keyword changes.
5. Loop playback cannot start when no words are selected.
6. Loop playback source uses selected words only.
7. Loop-size selector `1 / 3 / 6` correctly limits playback to `6 / 18 / 36` selected words.
8. If selected count is below the cap, all selected words are used.
9. Playback order follows current list ordering.
10. Active card highlight tracks the currently playing selected word.
11. Quick language toggle updates visible text and pronunciation.
12. Loop playback stops when selected-word set changes, loop size changes, active list language changes, view changes, or page unload occurs.

## Risks

### 1. UI Density

One-column cards with image, pronunciation, select state, and playback controls can become visually heavy.

Mitigation:

- keep cards editorial and simple
- avoid too many per-card actions

### 2. Hidden Selected Words

Because selected words survive search changes, users may forget words remain selected outside the current visible filter.

Mitigation:

- show clear selected count
- add `clear selection`
- consider later adding `show selected only`

### 3. Loop Restart Rules

Stopping loop when selection or loop-size changes is simple and safe, but some users may expect playback to continue automatically.

Mitigation:

- keep phase 1 strict and predictable
- only consider smart resume later if requested

## Implementation Notes

Likely file touch points:

- `index.html`
  - reshape list page cards
  - add selection UI
  - add list-page control bar
- `public/assets/js/main.js`
  - selected-word state
  - capped loop queue logic
  - list-page loop controller
  - quick language slot state
- tests
  - update list-view unit/e2e coverage
  - remove or downgrade grid-specific assumptions if product drops grid

## Open Questions Resolved

The following requirements are fixed by this spec and should not be re-opened during implementation unless product requirements change:

- loop playback source uses selected words only
- selected words remain selected across search keyword changes
- list cards use one-column layout on desktop and mobile
- cards show one active display language at a time, not both
- loop-size selector `1 / 3 / 6` means a playback cap of `6 / 18 / 36` words
- playback order follows current list ordering, not selection order
- selected words are not persisted across full page reload in phase 1
- changing active list language stops loop playback and requires manual restart

## Out of Scope Follow-Ups

- persist selected loop words across reload
- selected-only subview
- custom manual ordering
- batch selection tools by tag
- random/shuffle playback
- playback history and progress memory

# Mobile Card Controls Visibility Design

## Goal

Adjust the mobile card layout so the three status buttons at the bottom of the word card stay visible within the first viewport on devices with reduced usable height, such as Samsung A25 when the browser URL bar is present.

## Problem

The current card layout uses a fixed card height and large internal vertical spacing. On shorter effective mobile viewports, the browser chrome reduces visible height and can push the three status buttons below the fold.

## Chosen Direction

Use mobile-only internal compression of the card layout, with a small card-height reduction if needed.

This means:

- Prioritize keeping the three status buttons visible without scrolling.
- Keep the desktop card layout unchanged.
- Keep card switching behavior unchanged.
- Keep the card modal unchanged unless later verification proves it is affected.

## Scope

Only the card view in the main mobile layout will change.

Expected touch points:

- Mobile card container height
- Mobile card top and bottom padding
- Mobile title maximum height and font scale
- Spacing between title, pronunciation, media buttons, and status buttons
- Possibly the size of the translation/audio buttons if visibility still fails after spacing changes

## Non-Goals

- No change to desktop layout
- No change to favorites/list/settings layouts
- No change to swipe or previous/next interactions
- No change to data flow or translations

## Implementation Shape

Apply mobile-first responsive class adjustments in `index.html`:

- Reduce mobile card height from the current fixed value while keeping the larger desktop value.
- Reduce mobile-only vertical padding inside the card content wrapper.
- Reduce mobile title size and maximum block height so long words still fit without pushing controls down.
- Tighten the gap around pronunciation and the audio/translation button row.
- Keep the three status buttons in the same structural position, but move them upward by reclaiming space above them.

If spacing-only changes are not enough, add a small additional mobile reduction to the card shell height.

## Verification

- Run the existing Playwright regression suite.
- Add or update a mobile viewport check so the three status buttons fit within the initial viewport height.
- Verify against a short effective viewport representative of Samsung A25 with browser chrome visible.

## Risks

- Over-compressing the card can make the title feel cramped on long entries.
- Reducing card height too aggressively can make the background image feel cut off.

The preferred tradeoff is to preserve visibility of the status buttons first, then keep the card visually balanced within the remaining space.

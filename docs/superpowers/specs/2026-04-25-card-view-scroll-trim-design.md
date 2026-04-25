# Card View Scroll Trim Design

## Goal

Remove the empty downward scroll space from the word card page while preserving normal scrolling behavior on other views.

## Problem

The card page can still scroll downward even when there is no meaningful content below the visible card. This creates a dead-scroll area that feels like the layout is unfinished.

The likely cause is shared page-level bottom spacing that is appropriate for list-style views but unnecessary for the card view.

## Chosen Direction

Use view-specific bottom spacing instead of globally disabling page scrolling.

This means:

- Do not globally disable `body` or `main` scrolling.
- Do not lock vertical scrolling for the entire application.
- Only reduce or remove the extra bottom spacing when `activeView === 'card'`.
- Keep existing scrolling behavior for `list`, `favorites`, and `settings`.

## Scope

Only the main page layout around the card view should change.

Expected touch points:

- The root `<main>` container bottom padding
- Possibly the card view section bottom spacing if the main container change alone is not enough

## Non-Goals

- No change to card swipe behavior
- No change to modal behavior
- No change to filter panel behavior
- No change to list, favorites, or settings page scroll behavior
- No global `overflow: hidden` solution

## Implementation Shape

Apply conditional styling to the main content wrapper in `index.html`:

- Keep the existing top spacing because the fixed header still needs room.
- Replace the shared fixed bottom padding with a view-aware class binding.
- When `activeView === 'card'`, use a smaller bottom padding value or no bottom padding.
- When `activeView !== 'card'`, keep the current larger bottom padding so lower navigation and scrollable pages still feel correct.

If a main container adjustment alone does not fully remove the dead-scroll area:

- Add a small card-view-specific spacing adjustment at the section level.
- Avoid introducing overflow locking unless spacing changes are proven insufficient.

## Verification

- Confirm the card page no longer scrolls into empty space on mobile.
- Confirm list, favorites, and settings still scroll normally.
- Run the existing Playwright regression suite.
- Add or update a regression check if needed to verify the card page document height no longer exceeds the visible layout unnecessarily.

## Risks

- Reducing bottom spacing too aggressively could make the fixed bottom navigation feel too close to the card.
- Solving this at the wrong layer could accidentally break scrolling in other views.

The preferred tradeoff is to keep the card view visually tight while preserving the current behavior of all other pages.

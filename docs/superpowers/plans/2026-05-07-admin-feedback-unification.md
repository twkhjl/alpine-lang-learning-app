# Admin Feedback Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared admin feedback layer that replaces native confirm dialogs and provides toast feedback for all admin write actions while preserving existing inline status messaging.

**Architecture:** Introduce a global `lexiconAdminFeedback` module that mounts its own dialog and toast DOM once per page, style it in `admin.css`, and wire write pages to call the shared APIs instead of `window.confirm()`. Extend existing page tests and add new feedback-module tests to cover the shared behavior and page integration boundaries.

**Tech Stack:** Plain browser JavaScript modules in UMD style, shared CSS, Node `--test` unit tests

---

### Task 1: Add shared feedback runtime

**Files:**
- Create: `public/assets/js/admin-feedback.js`
- Modify: `public/assets/css/admin.css`
- Test: `local-tests/admin-feedback.test.js`

- [ ] Add shared feedback styles for toast viewport/cards and reusable dialog states.
- [ ] Write failing tests for feedback helper defaults and mounting behavior.
- [ ] Implement `lexiconAdminFeedback` helpers for confirm dialog, alert dialog, and toast.
- [ ] Re-run the feedback tests until they pass.

### Task 2: Wire shared feedback into admin write pages

**Files:**
- Modify: `admin-word-edit.html`
- Modify: `admin-tags.html`
- Modify: `admin-assets.html`
- Modify: `public/assets/js/admin-word-edit.js`
- Modify: `public/assets/js/admin-tags.js`
- Modify: `public/assets/js/admin-assets.js`
- Modify: `public/assets/js/admin-i18n.js`

- [ ] Write or extend failing tests for page-level integration expectations.
- [ ] Load `admin-feedback.js` in all in-scope admin write pages.
- [ ] Replace native confirm usage with `showConfirmDialog()` and add tag-delete confirmation.
- [ ] Add success/error toast calls for save, delete, upload, and purge outcomes while keeping inline status updates.
- [ ] Add minimal shared i18n keys needed by the feedback UI.

### Task 3: Verify page contracts and regressions

**Files:**
- Modify: `local-tests/admin-pages.test.js`
- Modify: `local-tests/admin-word-edit.test.js`
- Modify: `local-tests/admin-tags.test.js`
- Modify: `local-tests/admin-assets.test.js`

- [ ] Add checks that in-scope pages load `admin-feedback.js`.
- [ ] Add coverage that page modules no longer rely on native confirm usage.
- [ ] Keep existing render-helper tests passing after integration changes.

### Task 4: Full verification

**Files:**
- No code changes required unless failures are found.

- [ ] Run targeted admin tests for feedback, pages, word edit, tags, and assets.
- [ ] Run the full `npm run test:admin` suite to catch regressions in related admin behavior.
- [ ] Review failures, fix them, and rerun verification until green.

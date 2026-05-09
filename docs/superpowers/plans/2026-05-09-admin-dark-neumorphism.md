# Admin Dark Neumorphism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve all admin behavior while restyling the full backoffice, including login, into a dark neumorphism theme with a technology-glow direction.
**Architecture:** Keep the existing admin HTML structure and JavaScript bindings intact. Move the visual change into the shared design system in `public/assets/css/admin.css`, using the approved reference mapping from the dark-neumorphism spec and only introducing minimal markup changes if CSS alone cannot achieve a consistent component treatment.
**Tech Stack:** Static HTML, shared CSS, vanilla browser JavaScript, Node `--test` verification

---

### Task 1: Align plan and design-system scope

**Files:**
- Modify: `docs/superpowers/specs/2026-05-09-admin-dark-neumorphism-design.md`
- Create: `docs/superpowers/plans/2026-05-09-admin-dark-neumorphism.md`

- [ ] Confirm the spec explicitly records the approved reference mapping and the “component reference only” integration rule.
- [ ] Capture the implementation sequence so the visual rewrite stays centralized in `admin.css`.

### Task 2: Replace the shared admin visual language

**Files:**
- Modify: `public/assets/css/admin.css`

- [ ] Redefine admin design tokens for dark backgrounds, raised/inset neumorphic surfaces, lava-orange accents, and high-contrast text.
- [ ] Restyle shell primitives: page background, sidebar, topbar, cards, buttons, nav links, tabs, badges, and status panels.
- [ ] Restyle data-entry and data-display primitives: filters, inputs, textareas, tables, empty states, pagination, media panels, modals, and toasts.
- [ ] Bring the login page into the same design language without changing auth behavior or form structure.

### Task 3: Page-specific refinement pass

**Files:**
- Modify: `public/assets/css/admin.css`
- Modify only if strictly needed: `admin-login.html`, `admin-dashboard.html`, `admin-words.html`, `admin-word-edit.html`, `admin-assets.html`, `admin-tags.html`

- [ ] Check whether any page needs a tiny wrapper/modifier class to make the shared CSS read correctly.
- [ ] Keep any markup changes minimal and non-behavioral.
- [ ] Preserve all current admin class names and selectors relied on by JavaScript.

### Task 4: Regression verification

**Files:**
- No new code required unless regressions are found.

- [ ] Run the page and admin test suites that cover the backoffice HTML/JS contracts.
- [ ] Review failures, fix regressions, and rerun until green.
- [ ] Confirm the final diff keeps the change scoped to visual behavior and planning/docs only.

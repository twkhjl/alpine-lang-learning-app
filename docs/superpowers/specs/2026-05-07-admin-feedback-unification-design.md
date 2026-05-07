# Admin Feedback Unification Design

## Goal

Unify write-action feedback across all admin pages by replacing native browser confirmation dialogs with a shared custom modal and adding a shared toast system for save, delete, upload, and purge outcomes.

The existing per-page inline status areas must remain in place and continue to show detailed state and error messages.

## Scope

- Add one shared admin feedback layer for confirm modal, alert modal, and toast notifications.
- Apply the shared feedback layer to every admin page that performs writes.
- Keep existing inline `status` messaging on each page.
- Reuse the current admin visual system instead of introducing a new design language.

## Non-Goals

- Do not redesign the admin layout or page structure.
- Do not replace read-only loading or empty-state messaging with toast.
- Do not move write logic out of current page modules into a new data abstraction.
- Do not change backend API contracts.
- Do not remove page-specific status containers.

## Current State

The admin UI already has:

- shared admin styling in `public/assets/css/admin.css`
- an existing custom edit modal pattern in `admin-tags`
- page-level status text for detailed success and failure reporting

Current write feedback is inconsistent:

- destructive actions still use native `window.confirm()`
- write outcomes are mostly shown only in page-local status text
- success and failure patterns differ between pages

Known native confirm entry points today:

- word image delete
- word audio delete
- asset delete
- asset bucket purge

The tag delete flow currently has no confirmation step and should be brought into the unified confirm pattern.

## Pages In Scope

### `admin-word-edit.html`

- save word
- upload image
- delete image
- upload audio
- delete audio

### `admin-tags.html`

- create tag
- update tag
- delete tag

### `admin-assets.html`

- delete one storage object
- purge the full R2 bucket

### Future Rule

Any new admin page with write behavior must use the same shared feedback utilities instead of direct `confirm()` or page-local toast implementations.

## Decision

Use a single shared front-end feedback module.

Recommended file:

- `public/assets/js/admin-feedback.js`

Recommended responsibilities:

- mount and manage a shared confirm modal
- mount and manage a shared alert modal
- mount and manage a shared toast stack
- expose small promise-based helper APIs for all admin page scripts

This keeps behavioral consistency high and minimizes changes to page business logic.

## Alternatives Considered

### Option 1: Shared feedback module

Use one shared module for modal and toast behavior.

Pros:

- one behavior source for the entire admin
- minimal duplication
- easy to apply to future pages
- simplest path to consistency

Cons:

- requires one new shared runtime dependency for all write pages

### Option 2: Per-page modal and toast logic

Let each page implement its own feedback UI.

Pros:

- low short-term coupling

Cons:

- duplicates markup and behavior
- higher chance of inconsistent UX
- harder maintenance

### Option 3: Toast only, keep native confirm

Add toast but leave browser confirmation dialogs as-is.

Pros:

- lowest implementation effort

Cons:

- does not satisfy the requirement to replace native dialogs
- leaves destructive actions visually inconsistent

### Recommendation

Choose Option 1.

## UX Rules

### Inline Status

Inline status remains the source of detailed information.

Use it for:

- loading state
- validation messages
- backend error detail
- detailed result summaries such as purge counts

### Toast

Toast is the lightweight immediate feedback layer.

Use it for:

- save success
- save failure
- delete success
- delete failure
- upload success
- upload failure
- purge success
- purge failure

Toast should be short. It should not try to replace detailed inline status copy.

### Confirm Modal

Confirm modal is required for destructive or irreversible actions.

Use it for:

- tag delete
- image delete
- audio delete
- asset delete
- bucket purge

### Alert Modal

Alert modal is optional in first implementation.

It should exist in the shared API so the admin has a consistent replacement path if blocking informational dialogs are needed later.

## Interaction Design

### Confirm Modal Behavior

- Promise-based API that resolves `true` or `false`
- open above all page content
- destructive actions use danger styling
- supports title, body, confirm label, cancel label
- clicking backdrop cancels
- pressing `Esc` cancels
- initial focus lands on a safe action
- while the page action is executing, action buttons on the source page remain disabled by existing page logic

### Toast Behavior

- fixed stack position in the top-right area on desktop
- adapts safely on small screens without covering the full viewport
- success uses success tone
- error uses danger tone
- optional info tone for non-error transient notices
- auto-dismiss after a short duration
- manual dismiss is optional but recommended
- multiple toasts stack in order of creation

### Copy Rules

- toast copy should be short and outcome-focused
- inline status may keep longer backend-derived messages
- confirm modal copy should clearly state the target of deletion or purge

## Visual Design

Reuse current admin styling tokens from `admin.css`.

### Modal

- build on top of the existing `.admin-modal-backdrop` and `.admin-modal` pattern
- add tone support for destructive confirmation states if needed
- preserve the current visual language used by the tags modal

### Toast

Add shared CSS primitives such as:

- toast viewport container
- toast card
- success tone
- error tone
- info tone
- enter and exit motion

The toast design should match the admin system:

- white surface
- bordered cards
- subtle shadow
- compact but readable spacing

## Proposed API

`admin-feedback.js` should expose a global similar to existing admin modules.

Recommended surface:

```js
lexiconAdminFeedback.showToast({ message, tone, duration })
lexiconAdminFeedback.showSuccessToast(message, options)
lexiconAdminFeedback.showErrorToast(message, options)
lexiconAdminFeedback.showConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  tone
})
lexiconAdminFeedback.showAlertDialog({
  title,
  message,
  confirmText,
  tone
})
```

Behavior notes:

- `showConfirmDialog()` returns `Promise<boolean>`
- `tone` supports at least `default` and `danger`
- module should lazy-mount its shared DOM once per page

## Integration Strategy

### `admin-word-edit.js`

Replace native confirm calls with shared confirm modal:

- delete image
- delete audio

Add toast on:

- save success and failure
- image upload success and failure
- image delete success and failure
- audio upload success and failure
- audio delete success and failure

Keep existing:

- `setWordEditStatus`
- `setImageStatus`
- `setAudioStatus`

### `admin-tags.js`

Add confirm before tag delete.

Add toast on:

- create success and failure
- update success and failure
- delete success and failure

Keep existing:

- `setTagStatus`
- existing tag edit modal

### `admin-assets.js`

Replace native confirm calls with shared confirm modal:

- delete storage object
- purge bucket

Add toast on:

- single delete success and failure
- purge success and failure

Keep existing:

- `setStatus`

## HTML Integration

All admin pages with write behavior should load `admin-feedback.js` after the existing shared admin base scripts and before their page-specific script if the page module depends on the global during bootstrap.

Likely pages to update:

- `admin-word-edit.html`
- `admin-tags.html`
- `admin-assets.html`

No shared markup needs to be duplicated into each HTML page if the feedback module mounts its own DOM nodes at runtime.

## Accessibility

Minimum required behavior:

- modal uses `role="dialog"` and `aria-modal="true"`
- modal title is programmatically associated
- focus is trapped within the dialog while open
- focus returns to the trigger after close when feasible
- toast should not steal focus
- toast announcements should be exposed through an appropriate live region

## Error Handling

The shared feedback layer must not swallow existing page errors.

Rules:

- page modules still own try/catch and status updates
- feedback module only presents UI
- if feedback UI fails to initialize, page write actions must still function using existing status handling
- optional fallback to native `confirm()` is acceptable if the shared modal cannot mount

## Testing Strategy

### Unit Coverage

Add tests for:

- confirm dialog promise resolution on confirm and cancel
- toast queueing and dismissal behavior
- tag delete path now requiring confirmation
- word media delete path using shared confirm
- assets delete and purge path using shared confirm

### Integration Expectations

Manual verification should cover:

- save success and failure toast on word edit
- tag create, edit, and delete feedback consistency
- asset delete and purge confirmation content
- inline status still updates with detailed messages
- keyboard and backdrop handling for modal
- mobile viewport behavior for toast stack and modal layout

## Risks

### Dual Messaging Noise

Showing both inline status and toast can feel repetitive.

Mitigation:

- keep toast copy short
- keep status detailed
- avoid using toast for low-signal read-only events

### Modal Layer Conflicts

`admin-tags` already uses a modal for tag editing.

Mitigation:

- define clear z-index ordering
- ensure one shared modal implementation can coexist with the tag edit modal

### Over-Coupling to Globals

The admin uses global modules today.

Mitigation:

- follow the existing module pattern for consistency
- keep the shared feedback API small and stable

## Rollout Plan

1. Add shared CSS for toast and any modal refinements.
2. Add `admin-feedback.js` with one-time DOM mounting and helper APIs.
3. Wire `admin-word-edit.js` to shared confirm and toast.
4. Wire `admin-tags.js` to shared confirm and toast.
5. Wire `admin-assets.js` to shared confirm and toast.
6. Add or update tests for the new shared behavior.
7. Verify keyboard, desktop, and mobile behavior manually.

## Success Criteria

- no in-scope admin write page uses native `window.confirm()`
- all in-scope write outcomes show shared toast feedback
- existing inline status remains functional on every page
- tag delete now requires confirmation
- no backend API changes are required
- the UI remains visually consistent with the current admin system

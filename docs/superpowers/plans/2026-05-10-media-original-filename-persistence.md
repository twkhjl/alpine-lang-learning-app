# Media Original Filename Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist original uploaded image and audio filenames in the database without changing current upload keys, routes, or UI behavior.

**Architecture:** Extend the media persistence schema with dedicated metadata columns, update the media RPC helpers to write and clear those columns, then update the worker upload and clear paths to pass the original filename through unchanged. Preserve all current response shapes and storage key rules.

**Tech Stack:** Supabase SQL migrations, Cloudflare Worker JavaScript, Node test runner

---

### Task 1: Add failing worker coverage for original filename persistence

**Files:**
- Modify: `local-tests/admin-worker.test.js`

- [ ] Add failing assertions for image upload RPC payload to include `p_image_original_filename`.
- [ ] Run: `node --test local-tests/admin-worker.test.js --test-name-pattern "worker uploads word image to R2 and syncs image_url through RPC"`
- [ ] Confirm the test fails because the new RPC field is missing.
- [ ] Add failing assertions for audio upload RPC payload to include `p_audio_original_filename`.
- [ ] Run: `node --test local-tests/admin-worker.test.js --test-name-pattern "worker uploads word audio to R2 and syncs audio_filename through RPC"`
- [ ] Confirm the test fails because the new RPC field is missing.
- [ ] Add failing assertions for image delete, audio delete, and purge paths to verify original filename fields are cleared together with existing media fields.

### Task 2: Add schema and RPC support for original filename metadata

**Files:**
- Create: `supabase/migrations/20260510000000_add_media_original_filenames.sql`

- [ ] Add a migration that creates `words.image_original_filename` and `word_translations.audio_original_filename` with `text not null default ''`.
- [ ] Extend `admin_set_word_image` and `admin_clear_word_image` to write and clear `image_original_filename`.
- [ ] Extend `admin_set_word_audio` and `admin_clear_word_audio` to write and clear `audio_original_filename`.
- [ ] Extend `admin_purge_media_references` so purge clears both original filename columns.

### Task 3: Update worker media mutation paths

**Files:**
- Modify: `workers/admin-auth-worker.js`

- [ ] Pass trimmed `file.name` into `admin_set_word_image` as `p_image_original_filename`.
- [ ] Pass trimmed `file.name` into `admin_set_word_audio` as `p_audio_original_filename`.
- [ ] Keep image and audio storage key generation unchanged.
- [ ] Keep upload response payloads unchanged.
- [ ] Ensure existing clear paths continue to call the clear RPC helpers so original filename cleanup follows the RPC changes.

### Task 4: Verify targeted and full admin coverage

**Files:**
- Modify if needed: `local-tests/admin-worker.test.js`

- [ ] Run: `node --test local-tests/admin-worker.test.js --test-name-pattern "worker uploads word image to R2 and syncs image_url through RPC|worker uploads word audio to R2 and syncs audio_filename through RPC|worker deletes a single image object and clears words.image_url through RPC|worker deletes a single audio object and clears audio_filename through RPC|worker purges all storage objects and clears database references through RPC"`
- [ ] Confirm the targeted worker tests pass.
- [ ] Run: `npm run test:admin`
- [ ] Confirm the full admin suite passes with `0` failures.

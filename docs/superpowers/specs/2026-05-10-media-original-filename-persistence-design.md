# Media Original Filename Persistence Design

## Goal

Record the user-uploaded original filename for every image and audio upload in the database, while leaving all existing upload, storage key, and UI behavior unchanged.

## Scope

- Persist original image filenames in the database when a word image is uploaded.
- Persist original audio filenames in the database when a word audio file is uploaded.
- Clear the persisted original filename when the corresponding media reference is deleted or purged.
- Keep the current R2 object key strategy unchanged.
- Keep the current admin upload flow and UI behavior unchanged.

## Non-Goals

- Do not change R2 object key generation.
- Do not preserve the original filename as the actual R2 object key.
- Do not redesign admin media UI.
- Do not add new upload steps, confirmations, or validations.
- Do not change existing upload endpoint routes.
- Do not change current public media URL resolution logic.
- Do not require the UI to display original filenames in this phase.

## Current State

The current system stores normalized media references only:

- `words.image_url` stores the image object key, for example `imgs/28.webp`
- `word_translations.audio_filename` stores the audio basename, for example `28.mp3`

The original browser-uploaded filename is not persisted anywhere.

Upload storage keys are deterministic and based on word identity:

- images: `imgs/<wordId>.<ext>`
- audio: `audios/<languageCode>/<wordId>.<ext>`

This behavior is correct and must remain unchanged.

## Decision

Add dedicated database columns for original filenames instead of overloading the existing media reference columns.

Recommended columns:

- `public.words.image_original_filename text not null default ''`
- `public.word_translations.audio_original_filename text not null default ''`

This keeps the current lookup and URL logic stable while adding metadata needed for auditability and future UI display.

## Why This Shape

### Option 1: Add dedicated metadata columns

Store original filenames alongside the current reference fields.

Pros:

- no change to existing media path semantics
- no ambiguity between storage key and user-facing filename
- minimal risk to current read and delete behavior
- easy future UI exposure

Cons:

- requires schema and RPC updates

### Option 2: Reuse existing reference fields

Store original filenames inside `image_url` or `audio_filename`.

Pros:

- no new columns

Cons:

- breaks current media resolution assumptions
- mixes storage reference with display metadata
- high regression risk

### Recommendation

Choose Option 1.

## Data Model Changes

### `public.words`

Add:

- `image_original_filename text not null default ''`

Semantics:

- stores the browser-provided original image filename from `File.name`
- empty string means no uploaded image filename is currently associated

### `public.word_translations`

Add:

- `audio_original_filename text not null default ''`

Semantics:

- stores the browser-provided original audio filename from `File.name`
- language-specific because audio uploads are language-specific
- empty string means no uploaded audio filename is currently associated for that translation row

## Backend Behavior

### Image Upload

Current behavior to keep:

- validate admin access
- read multipart file
- derive deterministic R2 key from word id and MIME type
- upload object to R2
- write normalized object key into `words.image_url`
- return current success payload

New behavior to add:

- also persist `file.name` into `words.image_original_filename`

Normalization rule:

- use trimmed `File.name`
- if missing or blank, persist `''`

### Audio Upload

Current behavior to keep:

- validate admin access
- read multipart file
- derive deterministic R2 key from word id, language code, and MIME type
- upload object to R2
- write normalized basename into `word_translations.audio_filename`
- return current success payload

New behavior to add:

- also persist `file.name` into `word_translations.audio_original_filename`

Normalization rule:

- use trimmed `File.name`
- if missing or blank, persist `''`

## Delete and Purge Consistency

The new metadata must stay consistent with the existing media reference fields.

### Delete Word Image

When image deletion clears `words.image_url`, it must also clear `words.image_original_filename`.

### Delete Word Audio

When audio deletion clears `word_translations.audio_filename`, it must also clear `word_translations.audio_original_filename`.

### Delete Single Storage Object

When deleting a single asset object through the assets page:

- if it resolves to an image reference, clear both `image_url` and `image_original_filename`
- if it resolves to an audio reference, clear both `audio_filename` and `audio_original_filename`

### Purge Full Bucket

When purging all assets:

- clearing image references must also clear all image original filename values
- clearing audio references must also clear all audio original filename values

## RPC and SQL Design

Current RPC shape must remain behaviorally stable, but it needs extra parameters or write logic for original filenames.

### Image RPC

`admin_set_word_image` should be extended so it can write both:

- `p_image_url`
- `p_image_original_filename`

`admin_clear_word_image` should clear both fields.

### Audio RPC

`admin_set_word_audio` should be extended so it can write both:

- `p_audio_filename`
- `p_audio_original_filename`

`admin_clear_word_audio` should clear both fields.

### Purge RPC/SQL Helpers

Any helper that bulk-clears media references must also bulk-clear the paired original filename columns.

## API Contract

### Upload Endpoints

Routes remain unchanged:

- `POST /api/admin/assets/word-image/:wordId`
- `POST /api/admin/assets/word-audio/:wordId/:languageCode`

Expected response behavior remains unchanged for this phase.

Reason:

- the requirement is persistence, not UI exposure
- avoiding response shape changes keeps the change low-risk

### Read Endpoints

Existing read payloads do not need to expose original filenames in this phase unless a later UI requirement needs them.

This keeps the current admin UI unchanged.

## UI Impact

No required visible UI change in this phase.

The admin word editor can continue to show:

- image preview
- audio filename derived from current stored media reference
- current upload and delete messaging

The assets page can continue to show:

- object key
- type
- language
- upload time
- DB reference status

Original filename display is explicitly out of scope for this spec.

## Migration Strategy

Add one migration that:

1. adds `words.image_original_filename` with `text not null default ''`
2. adds `word_translations.audio_original_filename` with `text not null default ''`
3. updates the relevant media RPC functions to write and clear the new columns

Backfill strategy:

- no backfill required
- existing rows should remain `''` because historical original filenames are not recoverable from the current schema or deterministic storage keys

## Testing Strategy

### Database / RPC Coverage

Add coverage for:

- image RPC writes `image_original_filename`
- audio RPC writes `audio_original_filename`
- clear-image RPC clears both image fields
- clear-audio RPC clears both audio fields
- purge helper clears both original filename columns

### Worker Coverage

Add coverage for:

- image upload sends original filename to the write path while keeping the same storage key
- audio upload sends original filename to the write path while keeping the same storage key
- image delete clears original filename along with image reference
- audio delete clears original filename along with audio reference
- single-object delete clears paired original filename metadata
- purge clears original filename metadata for both image and audio records

### Regression Coverage

Preserve existing assertions that prove:

- image keys remain `imgs/<wordId>.<ext>`
- audio keys remain `audios/<languageCode>/<wordId>.<ext>`
- current response payloads and preview URLs remain stable unless intentionally extended later

## Risks

### Metadata Drift

If original filename columns are not cleared wherever media references are cleared, stale metadata will remain.

Mitigation:

- pair every clear path with both columns
- add targeted tests for delete and purge paths

### Accidental API Contract Drift

It is easy to leak the new metadata into unrelated payloads during refactor.

Mitigation:

- treat API response shape as unchanged for this phase
- limit the change to schema, RPC, and write-path worker logic

### Historical Data Expectations

Users may assume old uploads will suddenly show original filenames.

Mitigation:

- document that only new uploads after migration will populate the new metadata

## Files Expected To Change

- `supabase/migrations/20260510000000_add_media_original_filenames.sql`
- `workers/admin-auth-worker.js`
- `local-tests/admin-worker.test.js`

Potentially also:

- tests that directly validate SQL or RPC behavior if such coverage is added in the current suite

## Success Criteria

- every new image upload stores the original uploaded filename in `words.image_original_filename`
- every new audio upload stores the original uploaded filename in `word_translations.audio_original_filename`
- image delete and purge paths clear `image_original_filename` together with `image_url`
- audio delete and purge paths clear `audio_original_filename` together with `audio_filename`
- R2 object key rules remain unchanged
- upload endpoint routes remain unchanged
- current admin UI behavior remains unchanged

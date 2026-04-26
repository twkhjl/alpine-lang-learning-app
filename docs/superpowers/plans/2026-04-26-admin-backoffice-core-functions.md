# Admin Backoffice Core Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the admin backoffice's basic usable functions on the current multi-page architecture without introducing a router rewrite.

**Architecture:** Keep the existing `admin-*.html` multi-page structure and add page-specific controllers plus one shared admin data layer. Read operations can continue to use the browser Supabase client where current public/admin-safe views already exist; mutating operations should go through a protected admin Worker using the current admin session so the browser never gets elevated database or R2 credentials.

**Tech Stack:** Static HTML, vanilla JavaScript, Supabase browser client, Supabase Postgres schema/views, Cloudflare Worker, Node.js unit tests, existing admin page smoke coverage.

---

## Scope

**In scope**
- Dashboard with live summary metrics and recent content snapshot.
- Words page with live list, search, filtering, paging, and navigation to edit/create.
- Word edit page with load/create/save for word core data, translations, pronunciations, tags, and media references.
- Tags page with live list plus create/update/delete guardrails.
- Assets page with basic browsing of referenced assets and media metadata already present in the system.
- Shared admin data/access layer and tests.

**Out of scope**
- Frontend or admin router refactor.
- Bulk import/export workflows.
- Direct browser upload to R2 using privileged credentials.
- Complex role hierarchy beyond current `admin_users`.
- Realtime sync or collaborative editing.

## Required Decisions Locked In

- **Read path split:** In this phase, browser-side reads for words/tags/languages may call Supabase directly through shared views or tables exposed for safe reads. Protected Worker endpoints are mandatory for writes, and optional for dashboard aggregation only if browser-side aggregation becomes too slow or too complex.
- **Auth transport for protected write APIs:** The browser must send the current Supabase access token in `Authorization: Bearer <access_token>`.
- **Worker-side admin verification:** The Worker must validate the bearer token against Supabase Auth, derive `auth.users.id`, and then verify that user exists in `public.admin_users`.
- **Write endpoint response shape:** Protected write endpoints must return JSON in the shape `{ ok: boolean, data?: ..., error?: { code: string, message: string, details?: unknown } }`.
- **Primary key generation:** Before any create flow ships, add a migration so `public.words.id` and `public.tags.id` are database-generated identity columns.
- **`updated_at` semantics:** Any change to `words`, `word_translations`, or `word_tags` that affects a word must update `public.words.updated_at`. This must be enforced in the database, preferably by trigger.
- **Word save strategy:** Word save operations replace the full editable shape for one word in a single transaction. `word_translations` must be upserted for the fixed language set `zh-TW`, `id`, and `en`. `word_tags` must be replaced by deleting existing mappings for the word and inserting the submitted `tag_ids`.
- **Tag save strategy:** Tag save operations replace the full editable shape for one tag in a single transaction. `tag_translations` must be upserted for the fixed language set `zh-TW`, `id`, and `en`.
- **Dashboard audio completeness rule:** A word counts as "missing audio" when any supported language has non-empty `text` but empty `audio_filename`.
- **Assets normalization rule:** `words.image_url` may be either a relative storage path or a full URL and must be rendered as stored. `word_translations.audio_filename` is treated as a stored reference string and must not be rewritten by the assets page in this phase.
- **Assets page scope:** The assets page is a reference browser over asset paths already stored in the database. It does not prove R2 object existence in this phase.
- **Seed/reset compatibility:** If the identity-column migration changes insert semantics, `supabase/seed.sql` must be updated in the same task so `supabase db reset` continues to succeed without manual fixes.

## Protected Admin API Contract

The plan assumes one deployed Worker surface under the existing admin Worker host.

### Read Path Contract

For this phase, use this split exactly:

- Browser direct reads:
  - languages
  - tags list for filters/select options
  - words list for `admin-words.html`
  - word detail for `admin-word-edit.html`
  - asset references for `admin-assets.html`
- Worker-backed reads:
  - `GET /api/admin/dashboard` only if browser-side aggregation over existing reads is judged too expensive or too awkward
- Worker-backed writes:
  - all create/update/delete operations

Do **not** implement both a browser read path and a Worker read path for the same words/tags/detail flow in this phase. Pick the browser-direct path for those flows and keep it as the only implementation.

### Required Worker Endpoints

These endpoints are the required minimum contract:

- `GET /api/admin/dashboard`
  - returns summary metrics and recent words
- `GET /api/admin/words`
  - optional in this phase
  - only add if you explicitly choose to move words listing behind Worker later
  - otherwise do not implement
- returns paginated word list
- `GET /api/admin/words/:id`
  - optional in this phase
  - only add if you explicitly choose to move word detail behind Worker later
  - otherwise do not implement
- `POST /api/admin/words`
  - creates one word and its translations/tag mappings
- `PATCH /api/admin/words/:id`
  - updates one word and replaces its translations/tag mappings
- `GET /api/admin/tags`
  - optional in this phase
  - only add if you explicitly choose to move tags listing behind Worker later
  - otherwise do not implement
- `POST /api/admin/tags`
  - creates one tag plus translations
- `PATCH /api/admin/tags/:id`
  - updates one tag plus translations
- `DELETE /api/admin/tags/:id`
  - allowed only when usage count is zero

### Request Rules

- Browser must send `Authorization: Bearer <access_token>`.
- Browser must send `Content-Type: application/json` for writes.
- Worker must reject missing or invalid bearer token with `401`.
- Worker must reject authenticated non-admin users with `403`.
- Validation failures must return `400`.
- Missing records must return `404`.
- Unexpected failures must return `500` with a generic message.

### Canonical Response Examples

Successful read:

```json
{
  "ok": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 25,
    "total": 0
  }
}
```

Validation failure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "At least one translation is required."
  }
}
```

Authorization failure:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access is required."
  }
}
```

## Current State Summary

- Auth/login guard exists in [public/assets/js/admin-auth.js](/D:/codes/alpineJsProjects/alpine-lang-learning-app/public/assets/js/admin-auth.js).
- Shared admin route metadata exists in [public/assets/js/admin-shell.js](/D:/codes/alpineJsProjects/alpine-lang-learning-app/public/assets/js/admin-shell.js).
- Admin pages are still mostly static shells:
  - [admin-dashboard.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-dashboard.html)
  - [admin-words.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-words.html)
  - [admin-word-edit.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-word-edit.html)
  - [admin-assets.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-assets.html)
  - [admin-tags.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-tags.html)
- Public read views already exist in Supabase for frontend data:
  - `lexicon_words_api`
  - `lexicon_tags_api`
  - `lexicon_languages_api`
- `lexicon_ui_translations_api`
- The current schema does **not** expose safe browser-side write capability for words/tags/media; admin writes need a protected server path or new admin-only RLS design.
- The current schema uses integer primary keys for `words.id` and `tags.id` without an explicit creation strategy for new rows, so create flows are not implementable safely until that is fixed.
- The current schema does not yet guarantee that edits in `word_translations` or `word_tags` propagate to `words.updated_at`, which makes "recently updated" behavior ambiguous until a DB-level rule is added.
- `supabase/seed.sql` currently inserts explicit ids and must remain compatible with any identity-column migration added in this plan.

## File Map

**Create**
- `public/assets/js/admin-api.js`
- `public/assets/js/admin-dashboard.js`
- `public/assets/js/admin-words.js`
- `public/assets/js/admin-word-edit.js`
- `public/assets/js/admin-tags.js`
- `public/assets/js/admin-assets.js`
- `local-tests/admin-api.test.js`
- `local-tests/admin-dashboard.test.js`
- `local-tests/admin-words.test.js`
- `local-tests/admin-word-edit.test.js`
- `local-tests/admin-tags.test.js`
- `local-tests/admin-assets.test.js`
- `workers/admin-data-worker.js` or equivalent new admin data module if you decide not to extend the existing worker file inline
- `supabase/migrations/20260426xxxxxx_admin_backoffice_write_support.sql`

**Modify**
- `admin-dashboard.html`
- `admin-words.html`
- `admin-word-edit.html`
- `admin-assets.html`
- `admin-tags.html`
- `public/assets/js/admin-auth.js`
- `workers/admin-auth-worker.js` or worker entrypoint routing if the existing Worker remains the single deployed admin endpoint
- `wrangler.jsonc`
- `package.json` only if new targeted test scripts are genuinely needed

## Recommended Delivery Order

1. Shared admin data contract and protected write API.
2. Words list page.
3. Word edit page.
4. Tags management page.
5. Dashboard live metrics.
6. Assets browser page.

This order gets the highest-value CRUD path working first and delays lower-value visualization work.

### Task 1: Establish the shared admin data layer and protected write boundary

**Files:**
- Create: `public/assets/js/admin-api.js`
- Create: `local-tests/admin-api.test.js`
- Create: `supabase/migrations/20260426xxxxxx_admin_backoffice_write_support.sql`
- Modify: `public/assets/js/admin-auth.js`
- Modify: `workers/admin-auth-worker.js` or create `workers/admin-data-worker.js`
- Modify: `wrangler.jsonc`

- [ ] First add a database migration that makes create and recent-update behavior well-defined.
  - Convert `public.words.id` to `generated by default as identity` if it is not already backed by an identity/sequence.
  - Convert `public.tags.id` to `generated by default as identity` if it is not already backed by an identity/sequence.
  - Add a reusable trigger function that updates `public.words.updated_at = now()`.
  - Trigger that function on:
    - direct updates to `public.words`
    - inserts/updates/deletes on `public.word_translations`
    - inserts/deletes on `public.word_tags`
  - Update `supabase/seed.sql` if needed so `supabase db reset` still works unchanged.

- [ ] Define one browser-side admin API module responsible for:
  - creating or reusing the authenticated Supabase client
  - reading dashboard summary data
  - reading words/tags/languages datasets
  - loading one word detail payload for edit mode
  - calling protected worker endpoints for create/update/delete operations

- [ ] Keep browser reads and protected writes separate in the API design.
  - Browser reads must use direct Supabase access for words/tags/languages/detail/assets in this phase.
  - Writes must go through the Worker endpoints defined in `Protected Admin API Contract`.
  - The browser must read the current Supabase session via `getAdminSession()` and pass `session.access_token` as bearer token.
  - The Worker must validate the token against Supabase Auth before checking `admin_users`.

- [ ] Define the browser direct-read responsibilities explicitly inside `admin-api.js`.
  - `loadWordList(filters)` reads from browser-safe sources only.
  - `loadWordDetail(id)` reads from browser-safe sources only.
  - `loadTagList()` reads from browser-safe sources only.
  - `loadAssetReferences()` reads from browser-safe sources only.
  - `createWord`, `updateWord`, `createTag`, `updateTag`, `deleteTag` call the protected Worker only.

- [ ] Add a focused unit test file that covers:
  - request shaping for list/detail methods
  - generic failure mapping for worker write endpoints
  - auth header/session propagation rules
  - invalid payload rejection before network calls
  - missing session token rejection before protected write call

- [ ] Add a migration verification step before JS work continues:

```bash
supabase db reset
```

- [ ] Confirm the schema properties needed by later tasks:

```bash
supabase db query --linked "select column_name, is_identity from information_schema.columns where table_schema = 'public' and table_name in ('words','tags') and column_name = 'id' order by table_name;"
supabase db query --linked "select proname from pg_proc where proname like '%touch_word_updated_at%';"
```

- [ ] Run focused verification:

```bash
node --test local-tests/admin-api.test.js
```

- [ ] Run full regression verification:

```bash
npm test
```

### Task 2: Make `admin-words.html` a real data-backed listing page

**Files:**
- Create: `public/assets/js/admin-words.js`
- Create: `local-tests/admin-words.test.js`
- Modify: `admin-words.html`

- [ ] Replace static table rows with JS-rendered content from `admin-api.js`.
- [ ] Support at least these basic controls:
  - keyword search across zh-TW / id / en text
  - tag filter
  - image presence filter
  - audio presence filter
  - page size and current page state
- [ ] Use browser-direct reads for the words list in this phase.
- [ ] Define filter behavior exactly:
  - `q`: case-insensitive substring match across `lang_zh_tw`, `lang_id`, `lang_en`
  - `tagId`: match words whose `tags` array includes the selected tag id
  - `hasImage=true`: include only words where `image_url` is a non-empty trimmed string
  - `hasImage=false`: include only words where `image_url` is empty after trim
  - `hasAudio=true`: include only words where at least one language has a non-empty `audio_filename`
  - `hasAudio=false`: include only words where all supported languages have empty `audio_filename`
  - `page` is 1-based
  - `pageSize` default is `25`
- [ ] Define sorting behavior exactly:
  - default sort is `updated_at desc`
  - tie-breaker is `id desc`
- [ ] Use this normalized list response shape:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 28,
        "image_url": "imgs/202604120952.jpg",
        "lang_zh_tw": "桌子",
        "lang_id": "meja",
        "lang_en": "table",
        "tags": [1, 3],
        "has_image": true,
        "audio_languages": ["zh-TW", "id"],
        "updated_at": "2026-04-26T02:12:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 25,
    "total": 1
  }
}
```

- [ ] Wire "create word" and "edit word" actions to `admin-word-edit.html` using query parameters such as `?id=28` and `?mode=create`.
- [ ] Show empty, loading, and error states explicitly instead of silent blank tables.
- [ ] Keep the existing multi-page navigation and auth guard behavior intact.

- [ ] Add tests that cover:
  - filter normalization
  - list row rendering from API payload
  - empty state when no rows match
  - correct edit/create URL generation

- [ ] Verify:

```bash
node --test local-tests/admin-words.test.js
npm test
```

### Task 3: Make `admin-word-edit.html` support create/load/save of a word

**Files:**
- Create: `public/assets/js/admin-word-edit.js`
- Create: `local-tests/admin-word-edit.test.js`
- Modify: `admin-word-edit.html`
- Modify: worker write endpoint implementation from Task 1

- [ ] Define one word detail contract that includes:
  - `id`
  - `image_url`
  - translations for `zh-TW`, `id`, `en`
  - pronunciations for `zh-TW`, `id`, `en`
  - audio filenames for `zh-TW`, `id`, `en`
  - assigned tag ids
  - metadata such as `created_at` and `updated_at` when available

- [ ] Use this canonical word detail payload:

```json
{
  "ok": true,
  "data": {
    "id": 28,
    "image_url": "imgs/202604120952.jpg",
    "translations": {
      "zh-TW": { "text": "桌子", "pronunciation": "zhuo zi", "audio_filename": "audios/zh-TW/table.mp3" },
      "id": { "text": "meja", "pronunciation": "me-ja", "audio_filename": "audios/id/meja.mp3" },
      "en": { "text": "table", "pronunciation": "tei-buhl", "audio_filename": "" }
    },
    "tag_ids": [1, 3],
    "created_at": "2026-04-12T09:52:00.000Z",
    "updated_at": "2026-04-26T02:12:00.000Z"
  }
}
```

- [ ] Support two modes:
  - create mode with empty defaults
  - edit mode loading the target word by query param id

- [ ] Implement save behavior with validation:
  - require at least one non-empty translation
  - reject duplicate tag ids
  - normalize trimmed text fields
  - preserve empty audio fields as empty strings, not `null`
- [ ] Use browser-direct read for loading detail in edit mode.
- [ ] Use this exact write strategy:
  - create word:
    - insert into `words` first and let DB assign `id`
    - upsert exactly three `word_translations` rows for `zh-TW`, `id`, `en`
    - delete any existing `word_tags` rows for that word id just in case
    - insert current `tag_ids`
  - update word:
    - update `words.image_url`
    - upsert exactly three `word_translations` rows for `zh-TW`, `id`, `en`
    - delete all existing `word_tags` rows for the word id
    - insert current `tag_ids`
  - perform all word writes in one DB transaction on the server side if the chosen implementation path supports transactions; otherwise fail the request if any step after the first write errors and document the limitation in code comments/tests
- [ ] `tag_ids` must be normalized to unique ascending integers before submission.

- [ ] Use a single protected write endpoint or a small set of write endpoints that update:
  - `words`
  - `word_translations`
  - `word_tags`

- [ ] Canonical create/update request payload:

```json
{
  "image_url": "imgs/202604120952.jpg",
  "translations": {
    "zh-TW": { "text": "桌子", "pronunciation": "zhuo zi", "audio_filename": "audios/zh-TW/table.mp3" },
    "id": { "text": "meja", "pronunciation": "me-ja", "audio_filename": "audios/id/meja.mp3" },
    "en": { "text": "table", "pronunciation": "tei-buhl", "audio_filename": "" }
  },
  "tag_ids": [1, 3]
}
```

- [ ] Do not implement direct R2 upload in this task.
  - Media inputs should store reference paths/filenames only.
  - Upload UX can remain disabled or explicitly marked as future work.

- [ ] Add tests that cover:
  - query param mode parsing
  - payload assembly for save
  - validation failures
  - successful save redirect or success state

- [ ] Verify:

```bash
node --test local-tests/admin-word-edit.test.js
npm test
```

### Task 4: Make `admin-tags.html` a real CRUD page with safety checks

**Files:**
- Create: `public/assets/js/admin-tags.js`
- Create: `local-tests/admin-tags.test.js`
- Modify: `admin-tags.html`
- Modify: worker write endpoint implementation from Task 1

- [ ] Replace static table and fake modal preview with live tag data.
- [ ] Support:
  - list tags with usage count
  - create tag
  - edit tag
  - delete tag only when usage count is zero
- [ ] Use browser-direct read for the tag list in this phase.

- [ ] Define one tag contract that includes:
  - `id`
  - `icon`
  - translated names for `zh-TW`, `id`, `en`
  - `word_count`

- [ ] Canonical tag payload:

```json
{
  "id": 3,
  "icon": "sell",
  "names": {
    "zh-TW": "家具",
    "id": "perabotan",
    "en": "furniture"
  },
  "word_count": 38
}
```

- [ ] Decide and document one stable ID strategy.
  - Locked decision: keep integer `tags.id` as the primary key and use DB-generated identity values for creates.
  - Do not add a slug/code field in this phase.
  - Do not overload display strings as identifiers.
- [ ] Use this exact write strategy:
  - create tag:
    - insert one `tags` row and let DB assign `id`
    - upsert exactly three `tag_translations` rows for `zh-TW`, `id`, `en`
  - update tag:
    - update `tags.icon`
    - upsert exactly three `tag_translations` rows for `zh-TW`, `id`, `en`
  - delete tag:
    - first verify `word_count = 0`
    - then delete `tag_translations`
    - then delete `tags`

- [ ] Add tests that cover:
  - usage count derivation
  - modal state transitions
  - delete disabled when `word_count > 0`
  - save payload shape

- [ ] Canonical tag create/update request payload:

```json
{
  "icon": "sell",
  "names": {
    "zh-TW": "家具",
    "id": "perabotan",
    "en": "furniture"
  }
}
```

- [ ] Verify:

```bash
node --test local-tests/admin-tags.test.js
npm test
```

### Task 5: Make `admin-dashboard.html` reflect live admin data

**Files:**
- Create: `public/assets/js/admin-dashboard.js`
- Create: `local-tests/admin-dashboard.test.js`
- Modify: `admin-dashboard.html`

- [ ] Replace hard-coded metrics with live summary cards.
- [ ] Minimum dashboard metrics:
  - total words
  - total tags
  - words missing image
  - words missing one or more audio files
  - recently updated words list

- [ ] Define "recently updated words" as rows ordered by `public.words.updated_at desc`.
- [ ] Because `updated_at` semantics are locked in Task 1, translation/tag edits must appear in this list after save.
- [ ] Define metrics exactly:
  - `total words`: count of all words
  - `total tags`: count of all tags
  - `words missing image`: count of words where `image_url` is empty after trim
  - `words missing one or more audio files`: count of words where at least one supported language has non-empty translation text and empty `audio_filename`
  - `recently updated words`: top 10 rows ordered by `updated_at desc`, tie-breaker `id desc`
- [ ] Reuse list/detail endpoints already built for words/tags instead of creating a second divergent data shape unless performance forces a dedicated summary endpoint.
- [ ] Keep the page read-only in this phase.

- [ ] Add tests that cover:
  - metric derivation from dataset
  - recent words sorting
  - loading/error state rendering

- [ ] Verify:

```bash
node --test local-tests/admin-dashboard.test.js
npm test
```

### Task 6: Make `admin-assets.html` a basic asset browser, not a full upload console

**Files:**
- Create: `public/assets/js/admin-assets.js`
- Create: `local-tests/admin-assets.test.js`
- Modify: `admin-assets.html`

- [ ] Re-scope the page from "full media manager" to "basic asset browser" for this iteration.
- [ ] Show asset references derived from current data:
  - image URLs from `words.image_url`
  - audio filenames from `word_translations.audio_filename`
- [ ] Support:
  - search by filename/path
  - filter by language for audio
  - filter by asset type
  - view which word currently references the asset

- [ ] Use these normalization rules:
  - ignore empty strings
  - trim whitespace
  - deduplicate exact normalized paths
  - classify entries beginning with `audios/` as audio
  - classify all non-empty `image_url` values as image references
  - expose `referenced_by_words` as an array of `{ id, label }`
- [ ] Use these display rules:
  - if `image_url` is an absolute URL, display it exactly as stored and use it as preview source
  - if `image_url` is a relative path, display it exactly as stored and do not rewrite it in this page
  - if `audio_filename` is a full path such as `audios/id/meja.mp3`, display it exactly as stored
  - if `audio_filename` is only a filename such as `meja.mp3`, display it exactly as stored and do not synthesize a path
  - the page must make no attempt to "correct" or infer storage paths
- [ ] For `referenced_by_words[].label`, use the first non-empty value from `lang_zh_tw`, then `lang_id`, then `lang_en`, then fallback to `#<id>`.

- [ ] Explicitly do **not** call R2 list APIs or HEAD object APIs in this phase.
- [ ] The page is a browser over DB references, not a source-of-truth inventory for the bucket.
- [ ] Do **not** promise direct upload/delete if the protected R2 write path is not implemented in this phase.
- [ ] Any upload button left on the page must either be disabled or explicitly marked "coming next" to avoid fake affordances.

- [ ] Add tests that cover:
  - reference extraction from words/translations
  - deduplication of repeated asset paths
  - type and language filters

- [ ] Verify:

```bash
node --test local-tests/admin-assets.test.js
npm test
```

### Task 7: Clean up page copy, states, and usability blockers

**Files:**
- Modify: all `admin-*.html`
- Modify: any new `public/assets/js/admin-*.js` controllers

- [ ] Replace garbled placeholder copy and mojibake text with readable Traditional Chinese or consistent English admin labels.
- [ ] Ensure every page has visible loading, empty, success, and error states.
- [ ] Ensure every protected page remains hidden until auth + first render state is known.
- [ ] Ensure logout still works from every page after new controller scripts are added.

- [ ] Verify:

```bash
npm run test:admin
npm test
```

## Acceptance Criteria

- Signed-in admin can open `admin-dashboard.html`, `admin-words.html`, `admin-word-edit.html`, `admin-tags.html`, and `admin-assets.html` without seeing hard-coded placeholder tables.
- Signed-out or non-admin users still get redirected to `admin-login.html`.
- Protected write endpoints reject missing token with `401` and non-admin token with `403`.
- Browser-direct reads are used for words/tags/detail/assets in this phase and are not duplicated by parallel Worker read implementations.
- Words page supports filtering and navigating to edit/create flows.
- Word edit page can load an existing word and save updates across base word, translations, and tags.
- Tags page can create and edit tags and blocks unsafe deletion when tags are in use.
- Dashboard shows live counts and recent updates from real data.
- Assets page shows real referenced media rather than fake sample cards.
- New word/tag creation does not require the browser to invent integer ids.
- No router is introduced.

## Risks and Decisions

- **Write path risk:** Current schema grants public/admin-safe reads but not obvious admin-safe browser writes. The plan assumes protected Worker-backed writes.
- **R2 risk:** True upload/delete needs a protected R2-capable API and probably new bindings. That is intentionally not required for this "basic functions" phase.
- **Schema drift risk:** If the frontend and admin mutate different shapes, bugs will appear. Reuse existing read views and define one stable write payload early.
- **UI scope risk:** The current admin pages already contain a lot of visual skeleton. Do not redesign them while wiring functionality unless the design blocks usability.

## Suggested Commit Boundaries

- `feat: add shared admin api layer`
- `feat: wire admin words page to live data`
- `feat: implement admin word edit save flow`
- `feat: add admin tag management`
- `feat: load live admin dashboard metrics`
- `feat: add admin asset browser`
- `fix: clean up admin copy and loading states`

## Execution Notes For Agents

- Prefer one task per branch or one focused commit per task.
- Do not start with router work.
- Use TDD for each controller/helper before wiring the page.
- Re-run `npm test` after each task, not just at the end.
- Preserve the existing `data-admin-nav` navigation contract and `protectAdminPage()` flow.
- Do not introduce alternate payload shapes once the canonical examples in this document are chosen.
- Do not create both Worker-based and browser-direct versions of the same read flow in this phase.

Plan complete and saved to `docs/superpowers/plans/2026-04-26-admin-backoffice-core-functions.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

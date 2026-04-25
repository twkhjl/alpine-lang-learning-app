# Admin Backoffice Skeleton Design

## Goal

Turn the static Stitch admin prototypes in `local/page_example/linguistcms_1` to `local/page_example/linguistcms_6` into a maintainable admin skeleton that can later connect to Supabase Auth, Supabase data writes, Cloudflare R2 uploads, and a protected backend API.

## Decision

Use the `linguistcms_*` set as the base visual source.

Chosen page mapping:

- `linguistcms_5`: admin login
- `linguistcms_3`: dashboard
- `linguistcms_6`: word management list
- `linguistcms_2`: word edit form
- `linguistcms_4`: media library
- `linguistcms_1`: tag management

This set is the strongest base because it already covers the required admin workflow as separate pages with a consistent visual language.

## Scope

- Create a reusable admin shell from the selected static pages.
- Add a client-side auth boundary using Supabase Auth.
- Define a protected write path for word data and media uploads.
- Keep the current public lexicon frontend unchanged except for shared styling or utilities if needed later.

## Non-Goals

- Do not merge admin and public app into one single-page application.
- Do not write directly to Supabase from the browser with elevated credentials.
- Do not upload directly to R2 from the browser with permanent bucket credentials.
- Do not redesign the visual system from scratch unless the selected Stitch pages are structurally insufficient.

## Current Constraints

- The public app already reads data from Supabase through read-only views.
- Supabase database policies currently support public reads only.
- Media assets are stored in Cloudflare R2 and resolved as public URLs.
- The Stitch pages are static prototypes with repeated inline Tailwind config, placeholder links, and no real data or auth flow.

## Architecture

The admin system should be added as a separate multi-page surface under the same project.

Runtime responsibilities:

- Supabase Auth: sign-in, sign-out, session state, admin identity.
- Supabase Database: word metadata, translations, tags, and media references.
- Cloudflare R2: image and audio file storage.
- Protected API layer: validate admin identity, handle writes, and perform uploads.

Recommended protected API choice:

- Prefer a Cloudflare Worker.

Reason:

- R2 integration is native and operationally simpler.
- Worker secrets can hold the Supabase service role key safely.
- The browser can stay on a publishable-key-only model.

## Admin Page Structure

The admin should remain multi-page, not single-page.

Target files:

- `admin-login.html`
- `admin-dashboard.html`
- `admin-words.html`
- `admin-word-edit.html`
- `admin-assets.html`
- `admin-tags.html`

Shared assets:

- `public/assets/css/admin.css`
- `public/assets/js/admin-shell.js`
- `public/assets/js/admin-auth.js`
- `public/assets/js/admin-api.js`
- `public/assets/js/admin-forms.js`
- `public/assets/js/admin-media.js`

## Shared Shell

The first structural step is to extract common layout and interaction patterns from the Stitch pages:

- sidebar navigation
- top bar
- page header
- table styling
- form styling
- modal styling
- toast styling
- loading and empty states

The output should stop duplicating Tailwind CDN configuration in each HTML file. The admin should use one shared stylesheet and small page-specific scripts.

## Auth Design

The admin login page should use Supabase Auth with email/password first.

Required behavior:

- unauthenticated users can access only `admin-login.html`
- authenticated users visiting the login page should be redirected to `admin-dashboard.html`
- authenticated non-admin users should be blocked from admin pages
- authenticated admin users should be allowed into all admin pages

Admin authorization options:

1. Recommended: `admin_users` table keyed by `auth.users.id`
2. Alternate: custom claims or metadata managed outside the app

Recommended first version:

- use an `admin_users` table because it is explicit, queryable, and easy to audit

## Data Write Boundary

The browser should not call privileged database writes directly.

Instead:

- browser authenticates with Supabase Auth
- browser calls protected API endpoints
- protected API verifies the user is an admin
- protected API writes to Supabase using service role credentials

This boundary is required for:

- multi-table word writes
- media replacement flows
- future audit logging
- validation before persistence

## Media Upload Design

Media upload should use a controlled flow:

1. Admin selects a file in the browser
2. Browser sends metadata request to protected API
3. Protected API validates admin access and target path
4. Protected API uploads to R2 or returns a short-lived upload mechanism
5. Protected API stores resulting filename or URL in Supabase

Recommended storage conventions:

- images: `imgs/<generated-name>`
- audio: `audios/<language-code>/<filename>`

The browser should never hold long-lived R2 credentials.

## Data Model Fit

The current Supabase schema is already close to what the admin needs:

- `words`
- `word_translations`
- `tags`
- `tag_translations`
- `word_tags`

Likely additions for admin support:

- `admin_users`
- optional audit fields or audit log table
- optional upload metadata table if media lifecycle tracking is needed

The existing read views can stay for the public app. The admin should use dedicated read endpoints or direct authenticated reads depending on the operation.

## Page Responsibilities

`admin-login.html`

- sign-in form
- auth error display
- redirect if already signed in

`admin-dashboard.html`

- admin session summary
- content counts
- recent changes
- system health indicators for Supabase and R2

`admin-words.html`

- searchable word list
- filters
- pagination
- delete confirmation entry point
- navigation to edit page

`admin-word-edit.html`

- create and edit word records
- translation fields
- pronunciation fields
- tag assignment
- image upload and replace
- audio upload and replace by language
- dirty form handling

`admin-assets.html`

- browse uploaded images and audio
- preview metadata
- replace or detach asset flows

`admin-tags.html`

- tag list
- create and edit tag labels across languages

## Delivery Phases

Phase 1: Skeleton consolidation

- normalize the six Stitch pages into final admin page files
- extract shared styles and shell script
- replace `href="#"` placeholders with real page links

Phase 2: Auth integration

- add Supabase login
- add session guard
- add admin authorization check

Phase 3: Read integration

- load real dashboard metrics
- load words, tags, and asset references
- populate tables and form defaults

Phase 4: Write and upload integration

- add protected API
- add create/update/delete word flows
- add image/audio upload to R2
- add media reference persistence in Supabase

Phase 5: Hardening

- validation
- error handling
- optimistic vs confirmed save states
- auditability and operational safeguards

## Risks

- The Stitch pages are visually coherent but structurally repetitive, so extraction work is required before feature work.
- If admin writes are attempted with only browser-side Supabase calls, secrets and privilege boundaries will be weak.
- Media upload flows can become inconsistent if file naming and overwrite rules are not defined early.
- Public app and admin app can drift visually unless shared tokens are established from the start.

## Verification

- Each admin page should load as a standalone page with correct navigation.
- Auth guards should redirect correctly for signed-out, signed-in non-admin, and admin users.
- A complete word edit should update Supabase rows consistently across `words`, `word_translations`, and `word_tags`.
- Image and audio uploads should produce valid public R2 URLs and persist the expected filenames.
- Public frontend should read newly created content without schema changes.

## Recommended Next Step

Write an implementation plan that starts with Phase 1 only: convert the selected `linguistcms_*` pages into a shared admin shell and final page file layout before attaching any live auth or data behavior.

## Phase 1 Status

- Shared admin shell extracted
- Final page files created
- Static navigation wired
- Ready for Phase 2 auth integration

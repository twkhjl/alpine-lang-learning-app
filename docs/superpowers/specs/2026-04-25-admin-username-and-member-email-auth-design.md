# Admin Username Auth and Member Email Auth Design

## Goal

Adjust the authentication model as follows:

- Frontend members continue to use `email + password`
- Email verification is not implemented in the first version
- The design must preserve a clean upgrade path for future email verification
- Backoffice admins use `username + password`
- Admin password verification still relies on Supabase Auth
- Admin users do not need to know or enter an email address

## Scope

- Keep the frontend member flow on Supabase Auth with email identity
- Add a username mapping table for admin users
- Add a protected admin login API layer
- Change `admin-login.html` from email login to username login
- Adjust `public/assets/js/admin-auth.js` to work with the new admin login flow
- Keep the current admin session guard pattern, but point it at the new login flow

## Non-Goals

- No frontend member UI work in this iteration
- No email verification flow in this iteration
- No admin CRUD in this iteration
- No R2 upload flow in this iteration
- No custom password storage or custom password hashing system
- No service role key in the browser

## Key Constraint

Supabase Auth password sign-in is still based on:

- `email + password`, or
- `phone + password`

Therefore, "admin username login" cannot replace Supabase Auth directly. The correct model is:

1. The admin UI accepts `username + password`
2. A protected API resolves `username` to an internal email
3. That API signs in against Supabase Auth using the resolved email and the submitted password
4. Password verification, sessions, and refresh tokens remain managed by Supabase Auth

This means:

- The admin login identifier is `username`
- The actual password authority is still Supabase Auth
- The internal email is never shown to admins
- The backing `auth.users` row still has an internal email identity

## Recommended Architecture

### Frontend Members

Frontend members remain on:

- Supabase Auth
- `email + password`
- `public.member_profiles`

The first version does not require verified email, but must preserve a future path for:

- enabling Supabase email confirmation
- checking `auth.users.email_confirmed_at`
- adding resend verification / verification required UX

### Admin Backoffice

Admin authentication becomes:

- Login UI: `username + password`
- Login API: Cloudflare Worker
- Password authority: Supabase Auth using internal email
- Authorization source: `public.admin_users`
- Username mapping source: `public.admin_accounts`

## Recommended Platform Choice

Use **Cloudflare Worker** for the admin login API.

Reasons:

- The project already plans to integrate Cloudflare R2
- Admin login, later upload APIs, and later write APIs can live in the same layer
- The Supabase service role key can live in Worker secrets
- The browser does not need direct access to high-privilege credentials

Supabase Edge Functions are still technically possible, but Worker is the better fit for this project shape.

## Data Model

### Existing Tables

#### `auth.users`

Purpose:

- Supabase Auth identity
- Frontend member email identity
- Internal admin email identity

#### `public.admin_users`

Purpose:

- Declares which `auth.users` rows have admin access

#### `public.member_profiles`

Purpose:

- Stores frontend member profile data

### New Table: `public.admin_accounts`

Purpose:

- Maps admin username to `auth.users`

Suggested columns:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `username text not null`
- `display_name text not null default ''`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Required constraints:

- `username` must be unique
- `username` comparison must be case-insensitive

Recommended implementation:

- use `citext` if available, or
- add a unique index on `lower(username)`

Optional columns:

- `last_login_at timestamptz null`
- `notes text not null default ''`

These are optional and not required in the first version.

## Source of Truth

Responsibilities must stay explicit:

- `auth.users`
  - authentication source
  - password source
  - token source
- `public.admin_users`
  - admin authorization source
- `public.admin_accounts`
  - username mapping source
- `public.member_profiles`
  - frontend member profile source

An admin login is valid only if all of the following are true:

1. A matching `auth.users` row exists
2. A matching `public.admin_accounts` row exists
3. `public.admin_accounts.is_active = true`
4. A matching `public.admin_users` row exists

If any of these checks fail, the login must be rejected.

## RLS and Access Boundary

### `public.admin_accounts`

This table must not be readable directly by the browser.

Recommended rule:

- enable RLS
- allow no direct read access for `anon`
- allow no direct read access for general `authenticated`
- query it only from the Worker via service role

This prevents:

- username enumeration
- reverse mapping of username to internal email

### `public.admin_users`

The current policy allowing a signed-in user to read only their own row can remain.

However, the login API must not depend on that policy, because login happens before the browser has a valid session. The Worker should query via service role.

### `public.member_profiles`

Keep the existing model:

- users may read and update only their own row

## Identity Strategy

### Frontend Members

Member strategy:

- one frontend member maps to one `auth.users` row
- the member signs in with email
- `public.member_profiles.user_id = auth.users.id`

### Admin Users

Admin strategy:

- one admin maps to one `auth.users` row
- that row uses an internal email identity
- the admin signs in with `public.admin_accounts.username`
- `public.admin_accounts.user_id = auth.users.id`
- `public.admin_users.user_id = auth.users.id`

This keeps:

- username as the visible login identifier
- Supabase Auth as the password authority
- internal email hidden from the admin user

## Internal Email Strategy

This must be fixed before implementation. Otherwise provisioning will drift.

Rules:

- the internal email is system-generated
- the internal email is not entered by admins
- the internal email does not change when username changes
- the internal email must be globally unique

Recommended format:

- `admin-{user_id}@internal.local`

Reasons:

- naturally unique
- does not depend on username
- username changes do not require email changes

## Admin Provisioning Flow

Provisioning must be explicit and repeatable.

Recommended flow:

1. Create or update the Supabase Auth user
2. Write `public.admin_users`
3. Write `public.admin_accounts`

More concretely:

1. obtain `user_id`
2. derive the internal email from `user_id`
3. create or update `auth.users` with:
   - `email = internal email`
   - `password = chosen password`
   - `email_confirm = true`
4. insert into `public.admin_users (user_id)`
5. insert into `public.admin_accounts (user_id, username, display_name, is_active)`

### Idempotency Requirement

Provisioning must define what happens when:

- the username already exists
- the user already exists
- the password needs to be reset

Recommended rule:

- treat an existing username as an update path, not a second account creation path

## Admin Login Flow

### Request Flow

1. Admin opens `admin-login.html`
2. Admin submits `username + password`
3. Browser calls Worker endpoint:
   - `POST /api/admin/auth/login`
4. Worker queries:
   - `public.admin_accounts`
   - `public.admin_users`
5. If username is missing, inactive, or lacks admin authorization, return a generic failure
6. If valid, resolve the internal email for the mapped `auth.users` row
7. Worker signs in against Supabase Auth with internal email + submitted password
8. On success, Worker returns session payload
9. Browser writes that session into the Supabase client
10. Existing admin guard continues to use the Supabase client session

### Important Security Requirement

The login API must return a generic failure message.

It must not distinguish between:

- unknown username
- inactive username
- wrong password
- missing admin access

Recommended message:

- `Login failed. Please check your username or password.`

## Session Strategy

### Chosen Approach

Use this model:

- Worker resolves `username -> internal email`
- Worker performs Supabase password sign-in
- Worker returns `access_token` and `refresh_token`
- Browser writes the returned session into the Supabase client

This is the best fit for the current front-end session guard.

### Frontend Session Contract

Minimum successful response shape:

```json
{
  "ok": true,
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 3600,
    "expires_at": 1777777777,
    "token_type": "bearer",
    "user": {
      "id": "..."
    }
  }
}
```

Browser responsibilities:

1. receive `session` from the Worker
2. call the Supabase JS session-setting API to persist it into the client
3. keep using the Supabase client session in `getAdminSession()` and `requireAdminPageAccess()`

If writing the session fails:

- treat login as failed
- show the generic failure message
- do not allow the admin UI to proceed

### Refresh Token Responsibility

After the session is written successfully:

- token refresh is handled by the Supabase JS client
- `admin-auth.js` must not implement its own refresh flow

## Worker API Design

### Endpoint

- `POST /api/admin/auth/login`

### Request Body

```json
{
  "username": "admin",
  "password": "abc123"
}
```

### Success Response

```json
{
  "ok": true,
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 3600,
    "expires_at": 1777777777,
    "token_type": "bearer",
    "user": {
      "id": "..."
    }
  }
}
```

### Failure Response

```json
{
  "ok": false,
  "message": "Login failed. Please check your username or password."
}
```

### Optional Future Endpoints

Possible later additions:

- `POST /api/admin/auth/logout`
- `POST /api/admin/auth/provision`
- `POST /api/admin/auth/reset-password`

These are not required in the first version.

## Frontend Changes

### `admin-login.html`

Required changes:

- change the input field from `email` to `username`
- update placeholder and inline copy to username semantics
- stop calling `signInWithPassword(email, password)` directly
- call the Worker login API instead

### `public/assets/js/admin-auth.js`

Required changes:

- keep `getAdminSession`
- keep `requireAdminPageAccess`
- keep `protectAdminPage`
- add `signInAdminWithUsername(...)`
- replace the current admin email/password login path
- add the Worker-session-to-Supabase-client session write logic

### Protected Admin Pages

These can keep the current guard structure:

- `admin-dashboard.html`
- `admin-words.html`
- `admin-word-edit.html`
- `admin-assets.html`
- `admin-tags.html`

That only works if the browser successfully establishes a Supabase session after Worker login.

## Frontend Members and Email Verification Extensibility

Frontend members do not require email verification in the first version, but the design must preserve a future switch.

### Signup Rule

First version:

- members may sign up with email/password
- verified email is not required to sign in

Future version:

- signup may require email confirmation
- some features may depend on `auth.users.email_confirmed_at`

### `member_profiles` Creation Timing

Recommended rule:

- create `member_profiles` immediately after successful signup

Reasons:

- simpler frontend initialization
- profile existence does not have to depend on verification

Important constraint:

- `member_profiles` does not mean the email is verified
- verification decisions must be based on `auth.users`, not `member_profiles`

## Risks

### 1. Username Enumeration

If the login API returns different failure messages for different causes, admin usernames can be enumerated.

### 2. Session Bridging Complexity

If the Worker completes Supabase sign-in but the browser fails to persist session correctly, the system can end up in a half-logged-in state:

- login appears successful
- admin guard still sees the browser as signed out
- refresh flow may fail later

This is the most important integration point to verify.

### 3. Identity Table Drift

If `admin_users` and `admin_accounts` are not maintained consistently, the system can end up with:

- username present but no admin authorization
- admin authorization present but no username mapping

The login API must treat this as invalid and reject access cleanly.

### 4. Static HTML Is Not a Hard Security Boundary

The current admin pages are still static HTML shells.

The frontend guard can only protect:

- redirects
- session gate behavior
- visible UI state

It cannot protect sensitive content already embedded in HTML.

Real admin data must eventually load after login through protected APIs, not be baked into static HTML.

## Recommended Rollout Order

1. Add `public.admin_accounts` migration
2. Build the Worker login endpoint
3. Build the admin provisioning flow
4. Change `admin-login.html` to username/password
5. Update `admin-auth.js` to call the Worker login flow
6. Verify that Supabase session protection still works for current admin pages
7. Only then move on to admin CRUD and R2 upload

## Verification

### Automated

- valid username + password logs in successfully
- unknown username returns the generic failure
- username without admin access returns the generic failure
- `is_active = false` cannot log in
- successful login unlocks admin pages
- logout returns the admin browser session to signed-out state
- frontend member email/password flow still works

### Manual

- create a frontend member account and confirm email/password still works
- create an admin account and confirm the UI only asks for username/password
- confirm the browser UI and network payload do not expose the internal email
- confirm admin page refresh keeps the session alive
- confirm direct navigation to `admin-dashboard.html` still redirects when signed out

## Recommendation

This requirement is feasible and does not require abandoning Supabase Auth.

The correct design is:

- frontend members continue using email identity
- admins use username as the visible login identifier
- Supabase Auth remains the password authority
- `admin_accounts + admin_users + Cloudflare Worker` provide the controlled username login flow

This is the most stable and extensible direction for the current project.

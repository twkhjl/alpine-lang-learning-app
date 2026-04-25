# Admin Auth Phase 2 Design

## Goal

Add a working Supabase-based auth boundary for the admin pages so only signed-in admin users can access the backoffice, while also creating a member profile table for future frontend member login work.

## Scope

- Add Supabase Auth email/password login for the admin backoffice.
- Add admin authorization through a dedicated `admin_users` table.
- Protect all `admin-*.html` pages behind session and admin checks.
- Create a `member_profiles` table for future frontend member login usage.

## Non-Goals

- Do not add backend write APIs yet.
- Do not add word CRUD yet.
- Do not add R2 upload flows yet.
- Do not add frontend member login UI yet.
- Do not require email verification.

## Chosen Direction

Use Supabase Auth for sign-in and a database-backed authorization table for admin access.

This means:

- authentication is handled by Supabase Auth with email/password
- authorization is handled by `public.admin_users`
- future frontend membership data is stored in `public.member_profiles`

This is preferred over custom claims for now because it is explicit, easy to query, and easy to operate from the database.

## Database Design

### `public.admin_users`

Purpose:

- defines which authenticated users are allowed into the admin backoffice

Suggested shape:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `created_at timestamptz not null default now()`

Access rule:

- authenticated users may only check whether their own `user_id` exists

### `public.member_profiles`

Purpose:

- stores future frontend member profile data, separate from admin authorization

Suggested shape:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null default ''`
- `avatar_url text not null default ''`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Access rule:

- authenticated users may read and update only their own profile row when the frontend member flow is added later

Phase 2 only needs the table created. It does not need member UI yet.

## Frontend Design

### Shared auth module

Add `public/assets/js/admin-auth.js`.

Responsibilities:

- create a Supabase client for admin auth usage
- sign in with email/password
- sign out
- get current session
- verify admin access through `admin_users`
- redirect unauthenticated or unauthorized users

The browser must use only the existing publishable Supabase key. No service role key is allowed in the frontend.

### `admin-login.html`

Required behavior:

- submit email/password to Supabase Auth
- show a pending state while signing in
- show an inline error message on failure
- if login succeeds and user is in `admin_users`, redirect to `admin-dashboard.html`
- if login succeeds but user is not in `admin_users`, sign out immediately and show an access denied message
- if an admin session already exists, redirect away from the login page

### Protected admin pages

Pages:

- `admin-dashboard.html`
- `admin-words.html`
- `admin-word-edit.html`
- `admin-assets.html`
- `admin-tags.html`

Required behavior:

- on page load, check current Supabase session
- if no session exists, redirect to `admin-login.html`
- if session exists but user is not in `admin_users`, block access
- if session exists and user is an admin, allow the page to render
- add a working logout action in the shared shell

## Authorization Flow

1. User opens `admin-login.html`
2. User submits email/password
3. Supabase Auth returns session or error
4. Frontend checks `admin_users` for the current `auth.users.id`
5. If found, the user is allowed into admin pages
6. If not found, the session is cleared and access is denied

## UX Requirements

- protected pages should not flash private content before auth completes
- use a simple loading state while auth status is being resolved
- access denied messaging must be explicit
- logout should always return to `admin-login.html`

## Files To Touch

Expected files:

- `supabase/migrations/<timestamp>_admin_auth_phase_2.sql`
- `public/assets/js/admin-auth.js`
- `admin-login.html`
- `admin-dashboard.html`
- `admin-words.html`
- `admin-word-edit.html`
- `admin-assets.html`
- `admin-tags.html`
- tests for auth guard behavior

## Risks

- if page guard code runs after the page is fully visible, protected content may flash briefly
- if admin lookup policy is too broad, authenticated users may infer other admin rows
- if non-admin login is not handled cleanly, users may appear signed in but unusable

## Verification

- valid admin credentials can log in and reach `admin-dashboard.html`
- invalid credentials show an error and remain on `admin-login.html`
- valid non-admin credentials cannot enter admin pages
- direct navigation to any protected `admin-*.html` page redirects correctly when signed out
- logout clears the session and returns to `admin-login.html`
- `admin_users` and `member_profiles` tables exist in Supabase with the intended policies

## Phase 2 Manual Verification

- 建立一個 Supabase Auth 管理員測試帳號。
- 將該使用者的 `user_id` 插入 `public.admin_users`。
- 在 `admin-login.html` 使用管理員帳號登入，確認會導向 `admin-dashboard.html`。
- 使用非管理員帳號登入，確認會被退回 `admin-login.html`。
- 登入後點擊 logout，確認 session 被清除並回到 `admin-login.html`。

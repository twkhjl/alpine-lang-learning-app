# Admin Auth Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add working Supabase login and authorization guards to the admin pages, while creating `admin_users` and `member_profiles` tables for current admin access and future member use.

**Architecture:** Supabase Auth handles email/password sessions in the browser using the publishable key only. Admin authorization is checked against `public.admin_users`, and all protected `admin-*.html` pages defer rendering until auth status is resolved. A separate `public.member_profiles` table is created now but remains unused by UI in this phase.

**Tech Stack:** Supabase Auth, Supabase Postgres migrations, static HTML admin pages, vanilla JavaScript, Node.js tests, Playwright smoke tests.

---

### Task 1: Add failing auth module tests

**Files:**
- Create: `local-tests/admin-auth.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing auth helper test**

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAdminSupabaseClient,
  isAdminUser,
  getAdminRedirectPath,
} = require("../public/assets/js/admin-auth");

test("admin auth helpers expose session and redirect primitives", async () => {
  const fakeClient = { marker: "client" };
  const client = createAdminSupabaseClient({
    LEXICON_SUPABASE_CONFIG: {
      url: "https://example.supabase.co",
      publishableKey: "publishable-key",
    },
    supabase: {
      createClient(url, key, options) {
        assert.equal(url, "https://example.supabase.co");
        assert.equal(key, "publishable-key");
        assert.equal(options.auth.persistSession, true);
        return fakeClient;
      },
    },
  });

  assert.equal(client, fakeClient);
  assert.equal(getAdminRedirectPath(true), "admin-dashboard.html");
  assert.equal(getAdminRedirectPath(false), "admin-login.html");

  const adminResult = await isAdminUser(
    {
      from(table) {
        assert.equal(table, "admin_users");
        return {
          select() {
            return this;
          },
          eq(column, value) {
            assert.equal(column, "user_id");
            assert.equal(value, "user-1");
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: { user_id: "user-1" }, error: null });
          },
        };
      },
    },
    "user-1",
  );

  assert.equal(adminResult, true);
});
```

- [ ] **Step 2: Write the failing unauthorized branch test**

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { isAdminUser } = require("../public/assets/js/admin-auth");

test("isAdminUser returns false for missing or errored rows", async () => {
  const missing = await isAdminUser(
    {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    },
    "user-2",
  );

  const errored = await isAdminUser(
    {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: new Error("boom") });
          },
        };
      },
    },
    "user-3",
  );

  assert.equal(missing, false);
  assert.equal(errored, false);
});
```

- [ ] **Step 3: Run the focused auth tests to verify they fail**

Run:

```bash
node --test local-tests/admin-auth.test.js
```

Expected:

```text
FAIL local-tests/admin-auth.test.js
```

Failure reason:

```text
Cannot find module '../public/assets/js/admin-auth'
```

- [ ] **Step 4: Add auth tests into the standard suite**

Update `package.json` scripts only if needed so existing `npm test` still covers `local-tests/*.test.js` and `npm run test:admin` remains unchanged:

```json
{
  "scripts": {
    "test": "node --test local-tests/*.test.js",
    "test:e2e": "node local-tests/e2e-runner.js",
    "test:admin": "node --test local-tests/admin-*.test.js"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add local-tests/admin-auth.test.js package.json
git commit -m "test: add admin auth helper tests"
```

### Task 2: Add Supabase migration for admin and member tables

**Files:**
- Create: `supabase/migrations/20260425130000_admin_auth_phase_2.sql`

- [ ] **Step 1: Write the failing migration review command**

Run:

```bash
supabase db query --linked "select to_regclass('public.admin_users') as admin_users, to_regclass('public.member_profiles') as member_profiles;"
```

Expected:

```text
admin_users: null
member_profiles: null
```

- [ ] **Step 2: Create the migration**

Add `supabase/migrations/20260425130000_admin_auth_phase_2.sql`:

```sql
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.member_profiles enable row level security;

drop policy if exists "Admin users can read own row" on public.admin_users;
create policy "Admin users can read own row"
  on public.admin_users for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members can read own profile" on public.member_profiles;
create policy "Members can read own profile"
  on public.member_profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members can insert own profile" on public.member_profiles;
create policy "Members can insert own profile"
  on public.member_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members can update own profile" on public.member_profiles;
create policy "Members can update own profile"
  on public.member_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.admin_users to authenticated;
grant select, insert, update on public.member_profiles to authenticated;
```

- [ ] **Step 3: Push the migration**

Run:

```bash
supabase db push
```

Expected:

```text
Finished supabase db push
```

- [ ] **Step 4: Verify the new tables exist**

Run:

```bash
supabase db query --linked "select to_regclass('public.admin_users') as admin_users, to_regclass('public.member_profiles') as member_profiles;"
```

Expected:

```text
admin_users: public.admin_users
member_profiles: public.member_profiles
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260425130000_admin_auth_phase_2.sql
git commit -m "feat: add admin and member auth tables"
```

### Task 3: Implement shared admin auth module

**Files:**
- Create: `public/assets/js/admin-auth.js`
- Test: `local-tests/admin-auth.test.js`

- [ ] **Step 1: Implement the minimal helper surface**

Create `public/assets/js/admin-auth.js`:

```js
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.lexiconAdminAuth = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  function createAdminSupabaseClient(globalObject) {
    const activeRoot = globalObject || root;
    const config = activeRoot.LEXICON_SUPABASE_CONFIG;
    const supabaseFactory = activeRoot.supabase;

    if (!config?.url || !config?.publishableKey) {
      throw new Error("Supabase config is required.");
    }

    if (!supabaseFactory?.createClient) {
      throw new Error("Supabase client library is required.");
    }

    return supabaseFactory.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  async function isAdminUser(client, userId) {
    if (!client || !userId) {
      return false;
    }

    const { data, error } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    return !error && !!data;
  }

  function getAdminRedirectPath(isAuthorized) {
    return isAuthorized ? "admin-dashboard.html" : "admin-login.html";
  }

  return {
    createAdminSupabaseClient,
    isAdminUser,
    getAdminRedirectPath,
  };
});
```

- [ ] **Step 2: Run the auth unit test to verify it passes**

Run:

```bash
node --test local-tests/admin-auth.test.js
```

Expected:

```text
PASS local-tests/admin-auth.test.js
```

- [ ] **Step 3: Extend the auth module with browser workflows**

Extend `public/assets/js/admin-auth.js`:

```js
async function signInAdmin(client, email, password) {
  return client.auth.signInWithPassword({ email, password });
}

async function signOutAdmin(client) {
  return client.auth.signOut();
}

async function getAdminSession(client) {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session || null;
}

async function requireAdminPageAccess(client, options = {}) {
  const session = await getAdminSession(client);
  if (!session?.user) {
    if (options.onUnauthenticated) {
      options.onUnauthenticated();
    }
    return { allowed: false, reason: "unauthenticated", session: null };
  }

  const allowed = await isAdminUser(client, session.user.id);
  if (!allowed) {
    await signOutAdmin(client);
    if (options.onUnauthorized) {
      options.onUnauthorized();
    }
    return { allowed: false, reason: "unauthorized", session };
  }

  return { allowed: true, reason: "ok", session };
}
```

- [ ] **Step 4: Run the full unit suite**

Run:

```bash
npm test
```

Expected:

```text
All existing tests pass, including local-tests/admin-auth.test.js
```

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/admin-auth.js local-tests/admin-auth.test.js
git commit -m "feat: add shared admin auth module"
```

### Task 4: Wire Supabase Auth into admin login page

**Files:**
- Modify: `admin-login.html`

- [ ] **Step 1: Add Supabase scripts and auth message placeholders**

Update `admin-login.html` head and form wiring:

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Login - LingoCMS</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="public/assets/js/supabase-config.js"></script>
  <link rel="stylesheet" href="public/assets/css/admin.css" />
</head>
```

Add below the password field:

```html
<p id="admin-login-message" class="note" role="status" aria-live="polite"></p>
```

- [ ] **Step 2: Add login behavior script**

At the bottom of `admin-login.html`, before `</body>`:

```html
<script src="public/assets/js/admin-shell.js"></script>
<script src="public/assets/js/admin-auth.js"></script>
<script>
  (function () {
    const form = document.querySelector(".login-form");
    const submitButton = form.querySelector("button[type='submit']");
    const message = document.getElementById("admin-login-message");
    const client = window.lexiconAdminAuth.createAdminSupabaseClient(window);

    async function redirectIfAuthenticated() {
      const result = await window.lexiconAdminAuth.requireAdminPageAccess(client);
      if (result.allowed) {
        window.location.href = "admin-dashboard.html";
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      message.textContent = "登入中...";
      submitButton.disabled = true;

      const formData = new FormData(form);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");

      const { error } = await window.lexiconAdminAuth.signInAdmin(client, email, password);

      if (error) {
        message.textContent = "登入失敗，請確認帳號密碼。";
        submitButton.disabled = false;
        return;
      }

      const authResult = await window.lexiconAdminAuth.requireAdminPageAccess(client);
      if (!authResult.allowed) {
        message.textContent = "此帳號沒有後台權限。";
        submitButton.disabled = false;
        return;
      }

      window.location.href = "admin-dashboard.html";
    });

    redirectIfAuthenticated().catch(function () {
      message.textContent = "無法確認登入狀態，請稍後再試。";
    });
  })();
</script>
```

- [ ] **Step 3: Run the admin unit tests**

Run:

```bash
npm run test:admin
```

Expected:

```text
PASS local-tests/admin-shell.test.js
PASS local-tests/admin-pages.test.js
PASS local-tests/admin-auth.test.js
```

- [ ] **Step 4: Commit**

```bash
git add admin-login.html
git commit -m "feat: wire admin login to supabase auth"
```

### Task 5: Protect admin pages and add logout behavior

**Files:**
- Modify: `admin-dashboard.html`
- Modify: `admin-words.html`
- Modify: `admin-word-edit.html`
- Modify: `admin-assets.html`
- Modify: `admin-tags.html`

- [ ] **Step 1: Add hidden-by-default protected page state**

At the `<body>` tag of each protected admin page, add:

```html
<body class="admin-page" data-admin-page="admin-dashboard.html" style="visibility: hidden;">
```

Use the matching page filename in each file.

- [ ] **Step 2: Add shared auth scripts to each protected page**

Before `</body>` in each protected page:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="public/assets/js/supabase-config.js"></script>
<script src="public/assets/js/admin-shell.js"></script>
<script src="public/assets/js/admin-auth.js"></script>
<script>
  (function () {
    const client = window.lexiconAdminAuth.createAdminSupabaseClient(window);
    const logoutLink = document.querySelector("[data-admin-nav='admin-login.html']");

    if (logoutLink) {
      logoutLink.addEventListener("click", async function (event) {
        event.preventDefault();
        await window.lexiconAdminAuth.signOutAdmin(client);
        window.location.href = "admin-login.html";
      });
    }

    window.lexiconAdminAuth
      .requireAdminPageAccess(client, {
        onUnauthenticated: function () {
          window.location.replace("admin-login.html");
        },
        onUnauthorized: function () {
          window.location.replace("admin-login.html");
        },
      })
      .then(function (result) {
        if (result.allowed) {
          document.body.style.visibility = "visible";
        }
      })
      .catch(function () {
        window.location.replace("admin-login.html");
      });
  })();
</script>
```

- [ ] **Step 3: Run the unit suite**

Run:

```bash
npm test
```

Expected:

```text
All unit tests pass
```

- [ ] **Step 4: Commit**

```bash
git add admin-dashboard.html admin-words.html admin-word-edit.html admin-assets.html admin-tags.html
git commit -m "feat: protect admin pages with auth guard"
```

### Task 6: Add auth smoke coverage and verify live flow

**Files:**
- Modify: `local-tests/e2e-runner.js`
- Modify: `docs/superpowers/specs/2026-04-25-admin-auth-phase-2-design.md`

- [ ] **Step 1: Add a signed-out redirect smoke test**

Append to `local-tests/e2e-runner.js`:

```js
await step("admin dashboard redirects signed out users", async () => {
  await page.goto(`${baseUrl}/admin-dashboard.html`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/admin-login\.html/, { timeout: 15000 });
  await expect(
    (await page.locator("body[data-admin-page='admin-login.html']").count()) > 0,
    "signed out users should end on admin login page",
  );
});
```

- [ ] **Step 2: Add a manual verification checklist to the spec**

Append:

```md
## Phase 2 Manual Verification

- Create one Supabase auth user intended to be an admin.
- Insert that user id into `public.admin_users`.
- Confirm the user can sign in at `admin-login.html` and reach `admin-dashboard.html`.
- Confirm a signed-in non-admin account is returned to `admin-login.html`.
- Confirm logout clears the session and returns to `admin-login.html`.
```

- [ ] **Step 3: Run the automated checks**

Run:

```bash
npm run test:admin
npm test
npm run test:e2e
```

Expected:

```text
All automated checks pass
```

- [ ] **Step 4: Perform the manual Supabase verification**

Run these exact steps after creating or identifying a real auth user:

```bash
supabase db query --linked "select user_id from public.admin_users limit 5;"
```

Expected:

```text
At least one admin row exists for a real auth user you will test with
```

Manual browser check:

- open `admin-login.html`
- log in with the admin account
- confirm redirect to `admin-dashboard.html`
- click logout
- confirm return to `admin-login.html`

- [ ] **Step 5: Commit**

```bash
git add local-tests/e2e-runner.js docs/superpowers/specs/2026-04-25-admin-auth-phase-2-design.md
git commit -m "test: add admin auth smoke coverage"
```

## Self-Review

Spec coverage:

- Supabase Auth email/password login is covered by Tasks 3 and 4.
- Admin authorization through `admin_users` is covered by Tasks 2, 3, and 5.
- Protection of all `admin-*.html` pages is covered by Task 5.
- `member_profiles` creation is covered by Task 2.
- Email verification is intentionally absent, matching the spec.

Placeholder scan:

- No placeholder tasks remain.
- All code steps include concrete code or exact migration text.
- All verification steps include explicit commands and expected outcomes.

Type consistency:

- Table names are consistent: `admin_users`, `member_profiles`.
- JS module name is consistent: `lexiconAdminAuth`.
- Redirect targets are consistent: `admin-login.html` and `admin-dashboard.html`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-admin-auth-phase-2.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

# Admin Backoffice Skeleton Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the selected Stitch admin prototypes into a shared multi-page admin skeleton with reusable shell assets and real page-to-page navigation.

**Architecture:** The six `local/page_example/linguistcms_*` prototypes become six standalone admin HTML pages backed by one shared stylesheet and one shared shell script. Phase 1 stays static: no live Supabase auth, no database reads, and no R2 upload logic yet; it only prepares the structure those features will attach to later.

**Tech Stack:** Static HTML, shared CSS, vanilla JavaScript, Node.js test runner, existing local static test server.

---

### Task 1: Add shell and page structure tests

**Files:**
- Create: `local-tests/admin-shell.test.js`
- Create: `local-tests/admin-pages.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing shell manifest test**

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ADMIN_ROUTES,
  getAdminPageTitle,
  isAdminRoute,
} = require("../public/assets/js/admin-shell");

test("admin shell exposes the six expected routes", () => {
  assert.deepEqual(
    ADMIN_ROUTES.map((route) => route.path),
    [
      "admin-dashboard.html",
      "admin-words.html",
      "admin-word-edit.html",
      "admin-assets.html",
      "admin-tags.html",
      "admin-login.html",
    ],
  );
  assert.equal(getAdminPageTitle("admin-assets.html"), "Media Library");
  assert.equal(isAdminRoute("admin-login.html"), true);
});
```

- [ ] **Step 2: Write the failing page contract test**

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adminPages = [
  "admin-login.html",
  "admin-dashboard.html",
  "admin-words.html",
  "admin-word-edit.html",
  "admin-assets.html",
  "admin-tags.html",
];

test("each admin page points at shared admin assets", () => {
  for (const file of adminPages) {
    const html = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(html, /public\/assets\/css\/admin\.css/);
    assert.match(html, /public\/assets\/js\/admin-shell\.js/);
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected:

```text
FAIL local-tests/admin-shell.test.js
FAIL local-tests/admin-pages.test.js
```

- [ ] **Step 4: Add an explicit admin test script**

Update `package.json`:

```json
{
  "name": "alpine-lang-learning-app",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "test": "node --test local-tests/*.test.js",
    "test:e2e": "node local-tests/e2e-runner.js",
    "test:admin": "node --test local-tests/admin-*.test.js"
  },
  "devDependencies": {
    "playwright": "^1.56.0"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json local-tests/admin-shell.test.js local-tests/admin-pages.test.js
git commit -m "test: add admin shell structure tests"
```

### Task 2: Create the shared admin shell module

**Files:**
- Create: `public/assets/js/admin-shell.js`
- Test: `local-tests/admin-shell.test.js`

- [ ] **Step 1: Implement the minimal route manifest to satisfy the first test**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.lexiconAdminShell = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const ADMIN_ROUTES = [
    { path: "admin-dashboard.html", title: "Dashboard", navKey: "dashboard" },
    { path: "admin-words.html", title: "Word Management", navKey: "words" },
    { path: "admin-word-edit.html", title: "Edit Word", navKey: "word-edit" },
    { path: "admin-assets.html", title: "Media Library", navKey: "assets" },
    { path: "admin-tags.html", title: "Tag Management", navKey: "tags" },
    { path: "admin-login.html", title: "Admin Login", navKey: "login" },
  ];

  function getAdminPageTitle(pathname) {
    return ADMIN_ROUTES.find((route) => route.path === pathname)?.title || "";
  }

  function isAdminRoute(pathname) {
    return ADMIN_ROUTES.some((route) => route.path === pathname);
  }

  return {
    ADMIN_ROUTES,
    getAdminPageTitle,
    isAdminRoute,
  };
});
```

- [ ] **Step 2: Run the shell test to verify it passes**

Run:

```bash
npm run test:admin
```

Expected:

```text
PASS local-tests/admin-shell.test.js
FAIL local-tests/admin-pages.test.js
```

- [ ] **Step 3: Add shared shell helpers for navigation and active page state**

Extend `public/assets/js/admin-shell.js`:

```js
function getCurrentAdminPath(locationObject = root.location) {
  const pathname = locationObject?.pathname || "";
  return pathname.split("/").pop() || "admin-dashboard.html";
}

function renderAdminNavLinks(currentPath) {
  return ADMIN_ROUTES.filter((route) => route.navKey !== "login")
    .map((route) => ({
      ...route,
      active: route.path === currentPath,
    }));
}

function applyAdminPageState(doc = root.document) {
  const currentPath = getCurrentAdminPath();
  doc.body.dataset.adminPage = currentPath;
  for (const node of doc.querySelectorAll("[data-admin-nav]")) {
    const target = node.getAttribute("data-admin-nav");
    node.setAttribute("href", target);
    node.setAttribute(
      "aria-current",
      target === currentPath ? "page" : "false",
    );
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => applyAdminPageState());
}
```

- [ ] **Step 4: Re-run the admin tests**

Run:

```bash
npm run test:admin
```

Expected:

```text
PASS local-tests/admin-shell.test.js
FAIL local-tests/admin-pages.test.js
```

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/admin-shell.js
git commit -m "feat: add shared admin shell manifest"
```

### Task 3: Create the shared admin stylesheet

**Files:**
- Create: `public/assets/css/admin.css`
- Modify: `admin-dashboard.html`
- Test: `local-tests/admin-pages.test.js`

- [ ] **Step 1: Write the minimal shared stylesheet**

```css
:root {
  --admin-bg: #f8f9ff;
  --admin-surface: #ffffff;
  --admin-surface-muted: #eff4ff;
  --admin-border: #c2c6d6;
  --admin-text: #0b1c30;
  --admin-text-muted: #424754;
  --admin-sidebar: #172554;
  --admin-sidebar-hover: #1e3a5f;
  --admin-primary: #0058be;
  --admin-primary-strong: #2170e4;
  --admin-danger: #ba1a1a;
  --admin-radius: 8px;
}

* {
  box-sizing: border-box;
}

body.admin-page {
  margin: 0;
  background: var(--admin-bg);
  color: var(--admin-text);
  font-family: Inter, sans-serif;
}

.admin-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
}

.admin-card {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
}
```

- [ ] **Step 2: Convert the dashboard page to shared asset loading**

Create `admin-dashboard.html` using `local/page_example/linguistcms_3/code.html` as source, but replace prototype-local style setup with shared assets:

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard - LingoCMS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="public/assets/css/admin.css" />
  </head>
  <body class="admin-page" data-admin-page="admin-dashboard.html">
    <div class="admin-shell">
      <!-- adapted sidebar and dashboard content from linguistcms_3 -->
    </div>
    <script src="public/assets/js/admin-shell.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Run the page contract test to confirm it still fails only on missing pages**

Run:

```bash
npm run test:admin
```

Expected:

```text
PASS local-tests/admin-shell.test.js
FAIL local-tests/admin-pages.test.js
```

Failure reason:

```text
ENOENT for admin-login.html
```

- [ ] **Step 4: Commit**

```bash
git add public/assets/css/admin.css admin-dashboard.html
git commit -m "feat: add shared admin stylesheet and dashboard shell"
```

### Task 4: Convert the remaining five admin pages

**Files:**
- Create: `admin-login.html`
- Create: `admin-words.html`
- Create: `admin-word-edit.html`
- Create: `admin-assets.html`
- Create: `admin-tags.html`
- Modify: `local-tests/admin-pages.test.js`

- [ ] **Step 1: Convert login page from `linguistcms_5`**

Use this head and asset contract:

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Login - LingoCMS</title>
    <link rel="stylesheet" href="public/assets/css/admin.css" />
  </head>
  <body class="admin-page admin-login-page" data-admin-page="admin-login.html">
    <!-- adapted login form from linguistcms_5 -->
    <script src="public/assets/js/admin-shell.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Convert words list and edit pages from `linguistcms_6` and `linguistcms_2`**

Required page filenames and titles:

```html
<title>Word Management - LingoCMS</title>
```

```html
<title>Edit Word - LingoCMS</title>
```

Required nav attributes inside both pages:

```html
<a data-admin-nav="admin-dashboard.html">Dashboard</a>
<a data-admin-nav="admin-words.html">Words</a>
<a data-admin-nav="admin-word-edit.html">Edit Word</a>
<a data-admin-nav="admin-assets.html">Assets</a>
<a data-admin-nav="admin-tags.html">Tags</a>
```

- [ ] **Step 3: Convert media and tag pages from `linguistcms_4` and `linguistcms_1`**

During conversion:

- remove remote sample photos that do not belong to the product
- keep table, drawer, and filter layout
- replace decorative placeholder assets with neutral empty-state cards

Use this neutral placeholder block:

```html
<div class="admin-card admin-empty-state">
  <p>Preview placeholder for connected R2 assets.</p>
</div>
```

- [ ] **Step 4: Strengthen the page test to verify navigation targets**

Replace `local-tests/admin-pages.test.js` with:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adminPages = [
  "admin-login.html",
  "admin-dashboard.html",
  "admin-words.html",
  "admin-word-edit.html",
  "admin-assets.html",
  "admin-tags.html",
];

test("each admin page points at shared assets and real admin links", () => {
  for (const file of adminPages) {
    const html = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(html, /public\/assets\/css\/admin\.css/);
    assert.match(html, /public\/assets\/js\/admin-shell\.js/);
    if (file !== "admin-login.html") {
      assert.match(html, /data-admin-nav="admin-dashboard\.html"/);
      assert.match(html, /data-admin-nav="admin-words\.html"/);
      assert.match(html, /data-admin-nav="admin-assets\.html"/);
      assert.match(html, /data-admin-nav="admin-tags\.html"/);
    }
  }
});
```

- [ ] **Step 5: Run the admin tests and verify both pass**

Run:

```bash
npm run test:admin
```

Expected:

```text
PASS local-tests/admin-shell.test.js
PASS local-tests/admin-pages.test.js
```

- [ ] **Step 6: Commit**

```bash
git add admin-login.html admin-words.html admin-word-edit.html admin-assets.html admin-tags.html local-tests/admin-pages.test.js
git commit -m "feat: convert stitch admin pages into final page files"
```

### Task 5: Verify standalone page loading and document the handoff

**Files:**
- Modify: `local-tests/e2e-runner.js`
- Modify: `docs/superpowers/specs/2026-04-25-admin-backoffice-skeleton-design.md`

- [ ] **Step 1: Add a lightweight standalone admin page smoke check**

Append this test step pattern to `local-tests/e2e-runner.js`:

```js
await step("admin dashboard shell loads", async () => {
  await page.goto(`${baseUrl}/admin-dashboard.html`, { waitUntil: "domcontentloaded" });
  await expect(await page.locator("body[data-admin-page='admin-dashboard.html']").count(), "admin dashboard body not tagged");
  await expect(await page.locator("[data-admin-nav='admin-words.html']").count(), "admin nav links missing");
});
```

- [ ] **Step 2: Run the full verification suite**

Run:

```bash
npm run test:admin
npm test
npm run test:e2e
```

Expected:

```text
admin tests: PASS
unit tests: PASS
e2e: PASS including admin dashboard shell loads
```

- [ ] **Step 3: Update the spec with Phase 1 completion note**

Append this note to `docs/superpowers/specs/2026-04-25-admin-backoffice-skeleton-design.md` once the work is done:

```md
## Phase 1 Status

- Shared admin shell extracted
- Final page files created
- Static navigation wired
- Ready for Phase 2 auth integration
```

- [ ] **Step 4: Commit**

```bash
git add local-tests/e2e-runner.js docs/superpowers/specs/2026-04-25-admin-backoffice-skeleton-design.md
git commit -m "test: verify admin skeleton standalone pages"
```

## Self-Review

Spec coverage:

- The selected Stitch base pages are mapped directly into final admin pages.
- Shared shell extraction is covered by Tasks 2 to 4.
- Static multi-page navigation is covered by Tasks 2 to 5.
- Auth, API, and upload integration are intentionally deferred; this matches the Phase 1-only scope in the spec.

Placeholder scan:

- No `TODO`, `TBD`, or deferred pseudo-steps are left in the task list.
- All code-changing steps include concrete snippets or exact page contracts.
- All verification steps include commands and expected outcomes.

Type consistency:

- Page filenames are consistent across tasks.
- Shared module name is consistently `lexiconAdminShell`.
- Shared asset paths are consistent across all tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-admin-backoffice-skeleton-phase-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAdminSupabaseClient,
  isAdminUser,
  getAdminRedirectPath,
  signInAdmin,
  signOutAdmin,
  getAdminSession,
  requireAdminPageAccess,
  protectAdminPage,
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

test("browser workflow helpers handle auth state and guard decisions", async () => {
  let signOutCalls = 0;

  const unauthenticatedClient = {
    auth: {
      getSession() {
        return Promise.resolve({ data: { session: null }, error: null });
      },
    },
  };

  assert.equal(await getAdminSession(unauthenticatedClient), null);
  assert.deepEqual(await requireAdminPageAccess(unauthenticatedClient), {
    allowed: false,
    reason: "unauthenticated",
    session: null,
  });

  const unauthorizedClient = {
    auth: {
      getSession() {
        return Promise.resolve({
          data: { session: { user: { id: "user-4" } } },
          error: null,
        });
      },
      signOut() {
        signOutCalls += 1;
        return Promise.resolve({ error: null });
      },
    },
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
  };

  const unauthorizedResult = await requireAdminPageAccess(unauthorizedClient);
  assert.equal(unauthorizedResult.allowed, false);
  assert.equal(unauthorizedResult.reason, "unauthorized");
  assert.equal(signOutCalls, 1);

  const adminClient = {
    auth: {
      signInWithPassword(payload) {
        return Promise.resolve({ data: payload, error: null });
      },
      signOut() {
        return Promise.resolve({ error: null });
      },
      getSession() {
        return Promise.resolve({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        });
      },
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: { user_id: "user-1" }, error: null });
        },
      };
    },
  };

  const signInResult = await signInAdmin(adminClient, "admin@example.com", "secret");
  const signOutResult = await signOutAdmin(adminClient);
  const accessResult = await requireAdminPageAccess(adminClient);

  assert.deepEqual(signInResult, {
    data: { email: "admin@example.com", password: "secret" },
    error: null,
  });
  assert.deepEqual(signOutResult, { error: null });
  assert.deepEqual(accessResult, {
    allowed: true,
    reason: "ok",
    session: { user: { id: "user-1" } },
  });
});

test("getAdminSession rejects when getSession returns an error", async () => {
  await assert.rejects(
    getAdminSession({
      auth: {
        getSession() {
          return Promise.resolve({
            data: { session: null },
            error: new Error("session failed"),
          });
        },
      },
    }),
    /session failed/,
  );
});

test("protectAdminPage reveals allowed pages and wires logout redirect", async () => {
  let signOutCalls = 0;
  let clickHandler;
  const replaceCalls = [];
  const body = { style: { visibility: "hidden" } };
  const logoutNode = {
    addEventListener(eventName, handler) {
      assert.equal(eventName, "click");
      clickHandler = handler;
    },
  };

  const result = await protectAdminPage({
    document: {
      body,
      querySelectorAll(selector) {
        assert.equal(selector, "[data-admin-nav='admin-login.html']");
        return [logoutNode];
      },
    },
    location: {
      replace(path) {
        replaceCalls.push(path);
      },
    },
    lexiconAdminAuth: {
      createAdminSupabaseClient() {
        return { auth: {} };
      },
      requireAdminPageAccess() {
        return Promise.resolve({ allowed: true, reason: "ok", session: {} });
      },
      signOutAdmin() {
        signOutCalls += 1;
        return Promise.resolve({ error: null });
      },
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(body.style.visibility, "visible");
  assert.equal(replaceCalls.length, 0);
  assert.equal(typeof clickHandler, "function");

  await clickHandler({
    preventDefault() {},
  });

  assert.equal(signOutCalls, 1);
  assert.deepEqual(replaceCalls, ["admin-login.html"]);
});

test("protectAdminPage redirects when access is denied or initialization fails", async () => {
  const deniedCalls = [];

  const deniedResult = await protectAdminPage({
    document: {
      body: { style: { visibility: "hidden" } },
      querySelectorAll() {
        return [];
      },
    },
    location: {
      replace(path) {
        deniedCalls.push(path);
      },
    },
    lexiconAdminAuth: {
      createAdminSupabaseClient() {
        return {};
      },
      requireAdminPageAccess() {
        return Promise.resolve({ allowed: false, reason: "unauthorized", session: {} });
      },
      signOutAdmin() {
        return Promise.resolve({ error: null });
      },
    },
  });

  assert.equal(deniedResult.allowed, false);
  assert.deepEqual(deniedCalls, ["admin-login.html"]);

  const initCalls = [];
  const initResult = await protectAdminPage({
    document: {
      body: { style: { visibility: "hidden" } },
      querySelectorAll() {
        return [];
      },
    },
    location: {
      replace(path) {
        initCalls.push(path);
      },
    },
    lexiconAdminAuth: {
      createAdminSupabaseClient() {
        throw new Error("boom");
      },
      requireAdminPageAccess() {
        return Promise.resolve({ allowed: true, reason: "ok", session: {} });
      },
      signOutAdmin() {
        return Promise.resolve({ error: null });
      },
    },
  });

  assert.equal(initResult.allowed, false);
  assert.deepEqual(initCalls, ["admin-login.html"]);
});

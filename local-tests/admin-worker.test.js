const assert = require("node:assert/strict");
const test = require("node:test");

const {
  GENERIC_FAILURE_MESSAGE,
  handleRequest,
} = require("../workers/admin-auth-worker");

function createEnv() {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    ADMIN_AUTH_PATH: "/api/admin/auth/login",
    ADMIN_ALLOWED_ORIGIN: "https://admin.example.com",
  };
}

test("worker allows exact configured origin for preflight and post responses", async () => {
  const env = createEnv();

  const optionsResponse = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "OPTIONS",
      headers: {
        origin: "https://admin.example.com",
      },
    }),
    env,
  );

  assert.equal(optionsResponse.status, 204);
  assert.equal(optionsResponse.headers.get("access-control-allow-origin"), "https://admin.example.com");
  assert.equal(optionsResponse.headers.get("access-control-allow-methods"), "POST, OPTIONS");

  const postResponse = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "",
        password: "",
      }),
    }),
    env,
    {
      fetchImpl() {
        throw new Error("unexpected fetch call");
      },
    },
  );

  assert.equal(postResponse.status, 401);
  assert.equal(postResponse.headers.get("access-control-allow-origin"), "https://admin.example.com");
  assert.equal(postResponse.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

test("worker omits allow-origin for non-matching origins on preflight and post responses", async () => {
  const env = createEnv();

  const optionsResponse = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example.com",
      },
    }),
    env,
  );

  assert.equal(optionsResponse.status, 204);
  assert.equal(optionsResponse.headers.get("access-control-allow-origin"), null);
  assert.equal(optionsResponse.headers.get("access-control-allow-methods"), "POST, OPTIONS");

  const postResponse = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "missing-admin",
        password: "secret",
      }),
    }),
    env,
    {
      fetchImpl(url) {
        if (url.includes("/rest/v1/admin_accounts")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([]);
            },
          });
        }

        throw new Error("unexpected fetch call");
      },
    },
  );

  assert.equal(postResponse.status, 401);
  assert.equal(postResponse.headers.get("access-control-allow-origin"), null);
  assert.equal(postResponse.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

test("worker resolves username and returns session payload", async () => {
  const calls = [];
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "admin",
        password: "secret",
      }),
    }),
    createEnv(),
    {
      fetchImpl(url, options = {}) {
        calls.push({ url, options });

        if (url.includes("/rest/v1/admin_accounts")) {
          assert.doesNotMatch(url, /admin_users!inner/);
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([{ user_id: "user-1", is_active: true }]);
            },
          });
        }

        if (url.includes("/rest/v1/admin_users")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([{ user_id: "user-1" }]);
            },
          });
        }

        if (url.includes("/auth/v1/admin/users/")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ email: "admin-user-1@internal.local" });
            },
          });
        }

        if (url.includes("/auth/v1/token?grant_type=password")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({
                access_token: "access-token",
                refresh_token: "refresh-token",
                expires_in: 3600,
                expires_at: 1777777777,
                token_type: "bearer",
                user: { id: "user-1" },
              });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://admin.example.com");

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.session.access_token, "access-token");
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /username=eq\.admin/);
  assert.match(calls[1].url, /\/rest\/v1\/admin_users/);
  assert.match(calls[1].url, /user_id=eq\.user-1/);
  assert.deepEqual(JSON.parse(calls[3].options.body), {
    email: "admin-user-1@internal.local",
    password: "secret",
  });
});

test("worker rejects username login when admin account exists without admin_users row", async () => {
  const calls = [];
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "admin",
        password: "secret",
      }),
    }),
    createEnv(),
    {
      fetchImpl(url) {
        calls.push(url);

        if (url.includes("/rest/v1/admin_accounts")) {
          assert.doesNotMatch(url, /admin_users!inner/);
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([{ user_id: "user-1", is_active: true }]);
            },
          });
        }

        if (url.includes("/rest/v1/admin_users")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([]);
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    message: GENERIC_FAILURE_MESSAGE,
  });
  assert.equal(calls.length, 2);
});

test("worker returns generic failure for invalid username or password", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "missing-admin",
        password: "secret",
      }),
    }),
    createEnv(),
    {
      fetchImpl(url) {
        if (url.includes("/rest/v1/admin_accounts")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([]);
            },
          });
        }

        throw new Error("unexpected fetch call");
      },
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    message: GENERIC_FAILURE_MESSAGE,
  });
});

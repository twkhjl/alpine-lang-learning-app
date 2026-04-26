(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (
    typeof self !== "undefined" &&
    typeof self.addEventListener === "function" &&
    !self.__LEXICON_ADMIN_AUTH_WORKER_BOUND__
  ) {
    self.__LEXICON_ADMIN_AUTH_WORKER_BOUND__ = true;
    self.addEventListener("fetch", function (event) {
      event.respondWith(api.handleRequest(event.request, root));
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function (root) {
  const GENERIC_FAILURE_MESSAGE = "Login failed. Please check your username or password.";

  function getFetchImplementation(deps = {}) {
    return deps.fetchImpl || root.fetch;
  }

  function normalizeOrigin(value) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    try {
      return new URL(trimmedValue).origin;
    } catch (error) {
      return null;
    }
  }

  function getAllowedOrigin(request, env = {}) {
    const configuredOrigins = env.ADMIN_ALLOWED_ORIGIN ?? "*";

    if (configuredOrigins === "*") {
      return "*";
    }

    const requestOrigin = normalizeOrigin(request.headers.get("origin"));
    const allowedOrigins = (Array.isArray(configuredOrigins)
      ? configuredOrigins
      : [configuredOrigins])
      .map(normalizeOrigin)
      .filter(Boolean);

    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      return requestOrigin;
    }

    return null;
  }

  function createCorsHeaders(request, env) {
    const allowedOrigin = getAllowedOrigin(request, env);
    const headers = {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      vary: "origin",
    };

    if (allowedOrigin) {
      headers["access-control-allow-origin"] = allowedOrigin;
    }

    return headers;
  }

  function jsonResponse(request, env, body, status) {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...createCorsHeaders(request, env),
      },
    });
  }

  function buildGenericFailure() {
    return {
      ok: false,
      message: GENERIC_FAILURE_MESSAGE,
    };
  }

  function getRequiredConfig(env = {}) {
    const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !publishableKey) {
      throw new Error("Missing Supabase worker configuration.");
    }

    return {
      url: env.SUPABASE_URL.replace(/\/$/, ""),
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      publishableKey,
      path: env.ADMIN_AUTH_PATH || "/api/admin/auth/login",
    };
  }

  async function readJsonBody(request) {
    try {
      return await request.json();
    } catch (error) {
      return null;
    }
  }

  async function resolveAdminAccount(fetchImpl, config, username) {
    const url = new URL(config.url + "/rest/v1/admin_accounts");
    url.searchParams.set("select", "user_id,is_active");
    url.searchParams.set("username", "eq." + username);
    url.searchParams.set("is_active", "eq.true");
    url.searchParams.set("limit", "1");

    const response = await fetchImpl(url.toString(), {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: "Bearer " + config.serviceRoleKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const rows = await response.json().catch(function () {
      return [];
    });

    if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.user_id) {
      return null;
    }

    return rows[0];
  }

  async function resolveAdminUser(fetchImpl, config, userId) {
    const url = new URL(config.url + "/rest/v1/admin_users");
    url.searchParams.set("select", "user_id");
    url.searchParams.set("user_id", "eq." + userId);
    url.searchParams.set("limit", "1");

    const response = await fetchImpl(url.toString(), {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: "Bearer " + config.serviceRoleKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const rows = await response.json().catch(function () {
      return [];
    });

    if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.user_id) {
      return null;
    }

    return rows[0];
  }

  async function resolveAuthEmail(fetchImpl, config, userId) {
    const response = await fetchImpl(config.url + "/auth/v1/admin/users/" + userId, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: "Bearer " + config.serviceRoleKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(function () {
      return null;
    });

    return payload?.user?.email || payload?.email || null;
  }

  async function signInWithEmail(fetchImpl, config, email, password) {
    const response = await fetchImpl(config.url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(function () {
      return null;
    });

    if (!payload?.access_token || !payload?.refresh_token) {
      return null;
    }

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in,
      expires_at: payload.expires_at,
      token_type: payload.token_type,
      user: payload.user,
    };
  }

  async function handleLogin(request, env, deps = {}) {
    const fetchImpl = getFetchImplementation(deps);
    const config = getRequiredConfig(env);
    const body = await readJsonBody(request);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!fetchImpl || !username || !password) {
      return jsonResponse(request, env, buildGenericFailure(), 401);
    }

    const adminAccount = await resolveAdminAccount(fetchImpl, config, username);

    if (!adminAccount?.user_id) {
      return jsonResponse(request, env, buildGenericFailure(), 401);
    }

    const adminUser = await resolveAdminUser(fetchImpl, config, adminAccount.user_id);

    if (!adminUser?.user_id) {
      return jsonResponse(request, env, buildGenericFailure(), 401);
    }

    const internalEmail = await resolveAuthEmail(fetchImpl, config, adminAccount.user_id);

    if (!internalEmail) {
      return jsonResponse(request, env, buildGenericFailure(), 401);
    }

    const session = await signInWithEmail(fetchImpl, config, internalEmail, password);

    if (!session) {
      return jsonResponse(request, env, buildGenericFailure(), 401);
    }

    return jsonResponse(request, env, { ok: true, session }, 200);
  }

  async function handleRequest(request, env, deps = {}) {
    const config = getRequiredConfig(env);
    const requestUrl = new URL(request.url);

    if (requestUrl.pathname !== config.path) {
      return jsonResponse(request, env, { ok: false, message: "Not found." }, 404);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: createCorsHeaders(request, env),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(request, env, { ok: false, message: "Method not allowed." }, 405);
    }

    try {
      return await handleLogin(request, env, deps);
    } catch (error) {
      return jsonResponse(request, env, buildGenericFailure(), 500);
    }
  }

  return {
    GENERIC_FAILURE_MESSAGE,
    buildGenericFailure,
    createCorsHeaders,
    getRequiredConfig,
    handleLogin,
    handleRequest,
    resolveAdminAccount,
    resolveAdminUser,
    resolveAuthEmail,
    signInWithEmail,
  };
});

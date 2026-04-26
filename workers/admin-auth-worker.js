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
  const SUPPORTED_LANGUAGE_CODES = ["zh-TW", "id", "en"];

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

  function createCorsHeaders(request, env, allowedMethods = "POST, OPTIONS") {
    const allowedOrigin = getAllowedOrigin(request, env);
    const headers = {
      "access-control-allow-methods": allowedMethods,
      "access-control-allow-headers": "authorization, content-type",
      vary: "origin",
    };

    if (allowedOrigin) {
      headers["access-control-allow-origin"] = allowedOrigin;
    }

    return headers;
  }

  function jsonResponse(request, env, body, status, allowedMethods = "POST, OPTIONS") {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...createCorsHeaders(request, env, allowedMethods),
      },
    });
  }

  function buildApiError(code, message, details) {
    const error = { code, message };

    if (typeof details !== "undefined") {
      error.details = details;
    }

    return { ok: false, error };
  }

  function jsonApiError(request, env, status, code, message, details, allowedMethods) {
    return jsonResponse(
      request,
      env,
      buildApiError(code, message, details),
      status,
      allowedMethods || "GET, POST, PATCH, DELETE, OPTIONS",
    );
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
      adminApiBasePath: env.ADMIN_API_BASE_PATH || "/api/admin",
    };
  }

  function getBearerToken(request) {
    const headerValue = request.headers.get("authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(headerValue);

    return match ? match[1].trim() : "";
  }

  function normalizeTextValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeWordPayload(body) {
    const translations = {};
    let hasTranslationText = false;

    for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
      const entry = body?.translations?.[languageCode] || {};
      const text = normalizeTextValue(entry.text);
      const pronunciation = normalizeTextValue(entry.pronunciation);
      const audioFilename = normalizeTextValue(entry.audio_filename);

      if (text) {
        hasTranslationText = true;
      }

      translations[languageCode] = {
        text,
        pronunciation,
        audio_filename: audioFilename,
      };
    }

    if (!hasTranslationText) {
      throw new Error("At least one translation is required.");
    }

    const rawTagIds = Array.isArray(body?.tag_ids) ? body.tag_ids : [];
    const tagIds = rawTagIds.map(function (value) {
      return Number(value);
    });

    if (tagIds.some(function (value) {
      return !Number.isInteger(value) || value <= 0;
    })) {
      throw new Error("Tag ids must be positive integers.");
    }

    if (new Set(tagIds).size !== tagIds.length) {
      throw new Error("Duplicate tag ids are not allowed.");
    }

    return {
      image_url: normalizeTextValue(body?.image_url),
      translations,
      tag_ids: tagIds,
    };
  }

  function normalizeTagPayload(body) {
    const translations = {};
    let hasTranslationName = false;

    for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
      const entry = body?.translations?.[languageCode] || {};
      const name = normalizeTextValue(entry.name);

      if (name) {
        hasTranslationName = true;
      }

      translations[languageCode] = { name };
    }

    if (!hasTranslationName) {
      throw new Error("At least one tag translation is required.");
    }

    return {
      icon: normalizeTextValue(body?.icon) || "sell",
      translations,
    };
  }

  function createServiceRoleHeaders(config) {
    return {
      apikey: config.serviceRoleKey,
      authorization: "Bearer " + config.serviceRoleKey,
      "content-type": "application/json",
    };
  }

  async function callAdminRpc(fetchImpl, config, functionName, payload) {
    const response = await fetchImpl(config.url + "/rest/v1/rpc/" + functionName, {
      method: "POST",
      headers: createServiceRoleHeaders(config),
      body: JSON.stringify(payload),
    });

    const rpcPayload = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      const error = new Error(rpcPayload?.message || "Database request failed.");
      error.code = rpcPayload?.code || "DATABASE_ERROR";
      error.details = rpcPayload?.details;
      throw error;
    }

    return rpcPayload;
  }

  function toWordResponseData(wordRow) {
    if (!wordRow?.id) {
      return null;
    }

    return {
      id: wordRow.id,
      image_url: wordRow.image_url || "",
      created_at: wordRow.created_at || null,
      updated_at: wordRow.updated_at || null,
    };
  }

  function toTagResponseData(tagRow) {
    if (!tagRow?.id) {
      return null;
    }

    return {
      id: tagRow.id,
      icon: tagRow.icon || "sell",
    };
  }

  async function fetchServiceRows(fetchImpl, config, tableName, query = {}) {
    const url = new URL(config.url + "/rest/v1/" + tableName);
    const selectValue = query.select || "*";

    url.searchParams.set("select", selectValue);

    if (query.order) {
      const orderParts = Array.isArray(query.order) ? query.order : [query.order];
      url.searchParams.set("order", orderParts.join(","));
    }

    if (query.limit) {
      url.searchParams.set("limit", String(query.limit));
    }

    const response = await fetchImpl(url.toString(), {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: "Bearer " + config.serviceRoleKey,
      },
    });

    if (!response.ok) {
      throw new Error("Database request failed.");
    }

    const payload = await response.json().catch(function () {
      return [];
    });

    return Array.isArray(payload) ? payload : [];
  }

  function normalizeDashboardWordItem(wordRow, wordMeta) {
    const imageUrl = normalizeTextValue(wordMeta?.image_url || wordRow?.image_url || wordRow?.img);
    const audioMap = wordRow?.audio || {};

    return {
      id: Number(wordRow?.id || wordMeta?.id),
      image_url: imageUrl,
      lang_zh_tw: normalizeTextValue(wordRow?.["lang_zh-TW"]),
      lang_id: normalizeTextValue(wordRow?.lang_id),
      lang_en: normalizeTextValue(wordRow?.lang_en),
      tags: Array.isArray(wordRow?.tags) ? wordRow.tags.slice() : [],
      audio_languages: SUPPORTED_LANGUAGE_CODES.filter(function (languageCode) {
        return normalizeTextValue(audioMap[languageCode]) !== "";
      }),
      updated_at: wordMeta?.updated_at || null,
      created_at: wordMeta?.created_at || null,
    };
  }

  function wordHasMissingAudio(wordItem, sourceRow) {
    const audioMap = sourceRow?.audio || {};

    return SUPPORTED_LANGUAGE_CODES.some(function (languageCode) {
      const text = languageCode === "zh-TW"
        ? wordItem.lang_zh_tw
        : languageCode === "id"
          ? wordItem.lang_id
          : wordItem.lang_en;

      return normalizeTextValue(text) !== "" && normalizeTextValue(audioMap[languageCode]) === "";
    });
  }

  async function handleAdminDashboardRead(request, env, deps = {}) {
    const access = await requireAdminApiAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    try {
      const [wordRows, wordMetaRows, tagRows] = await Promise.all([
        fetchServiceRows(access.fetchImpl, access.config, "lexicon_words_api", {
          order: "id.asc",
        }),
        fetchServiceRows(access.fetchImpl, access.config, "words", {
          select: "id,image_url,created_at,updated_at",
          order: ["updated_at.desc", "id.desc"],
        }),
        fetchServiceRows(access.fetchImpl, access.config, "lexicon_tags_api", {
          order: "id.asc",
        }),
      ]);

      const wordRowMap = new Map(wordRows.map(function (row) {
        return [Number(row.id), row];
      }));
      const mergedWords = wordMetaRows
        .map(function (metaRow) {
          return normalizeDashboardWordItem(wordRowMap.get(Number(metaRow.id)) || {}, metaRow);
        })
        .filter(function (item) {
          return Number.isInteger(item.id) && item.id > 0;
        });

      const wordsMissingImage = mergedWords.filter(function (item) {
        return item.image_url === "";
      }).length;
      const missingAudioWords = mergedWords.filter(function (item) {
        return wordHasMissingAudio(item, wordRowMap.get(item.id) || {});
      }).length;

      return jsonResponse(request, env, {
        ok: true,
        data: {
          metrics: {
            total_words: mergedWords.length,
            total_tags: tagRows.length,
            words_missing_image: wordsMissingImage,
            missing_audio_words: missingAudioWords,
          },
          recent_words: mergedWords.slice(0, 10),
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return jsonApiError(request, env, 500, "SERVER_ERROR", "An unexpected error occurred.");
    }
  }

  function mapWriteErrorToResponse(request, env, error) {
    if (error?.message === "At least one translation is required."
      || error?.message === "Tag ids must be positive integers."
      || error?.message === "Duplicate tag ids are not allowed."
      || error?.message === "One or more tags do not exist."
      || error?.message === "At least one tag translation is required."
      || error?.message === "Tag is still in use.") {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message, error.details);
    }

    return jsonApiError(
      request,
      env,
      500,
      "SERVER_ERROR",
      error?.message || "An unexpected error occurred.",
      error?.details,
    );
  }

  async function resolveAuthenticatedUser(fetchImpl, config, accessToken) {
    const response = await fetchImpl(config.url + "/auth/v1/user", {
      headers: {
        apikey: config.publishableKey,
        authorization: "Bearer " + accessToken,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(function () {
      return null;
    });

    if (!payload?.id) {
      return null;
    }

    return payload;
  }

  async function requireAdminApiAccess(request, env, deps = {}) {
    const fetchImpl = getFetchImplementation(deps);
    const config = getRequiredConfig(env);
    const accessToken = getBearerToken(request);

    if (!fetchImpl) {
      return {
        ok: false,
        response: jsonApiError(request, env, 500, "SERVER_ERROR", "Fetch implementation is required."),
      };
    }

    if (!accessToken) {
      return {
        ok: false,
        response: jsonApiError(request, env, 401, "UNAUTHORIZED", "A bearer token is required."),
      };
    }

    const authUser = await resolveAuthenticatedUser(fetchImpl, config, accessToken);

    if (!authUser?.id) {
      return {
        ok: false,
        response: jsonApiError(request, env, 401, "UNAUTHORIZED", "The bearer token is invalid."),
      };
    }

    const adminUser = await resolveAdminUser(fetchImpl, config, authUser.id);

    if (!adminUser?.user_id) {
      return {
        ok: false,
        response: jsonApiError(request, env, 403, "FORBIDDEN", "Admin access is required."),
      };
    }

    return {
      ok: true,
      fetchImpl,
      config,
      authUser,
    };
  }

  async function handleAdminWordCreate(request, env, deps = {}) {
    const access = await requireAdminApiAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const body = await readJsonBody(request);

    let normalizedBody;

    try {
      normalizedBody = normalizeWordPayload(body);
    } catch (error) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message);
    }

    try {
      const wordRow = await callAdminRpc(access.fetchImpl, access.config, "admin_create_word", {
        p_image_url: normalizedBody.image_url,
        p_translations: normalizedBody.translations,
        p_tag_ids: normalizedBody.tag_ids,
      });

      return jsonResponse(request, env, {
        ok: true,
        data: toWordResponseData(wordRow),
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapWriteErrorToResponse(request, env, error);
    }
  }

  async function handleAdminWordUpdate(request, env, deps = {}) {
    const access = await requireAdminApiAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const requestUrl = new URL(request.url);
    const updateWordMatch = new RegExp("^" + access.config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/words/(\\d+)$").exec(requestUrl.pathname);
    const wordId = Number(updateWordMatch?.[1]);
    const body = await readJsonBody(request);
    let normalizedBody;

    if (!Number.isInteger(wordId) || wordId <= 0) {
      return jsonApiError(request, env, 404, "NOT_FOUND", "Word not found.");
    }

    try {
      normalizedBody = normalizeWordPayload(body);
    } catch (error) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message);
    }

    try {
      const wordRow = await callAdminRpc(access.fetchImpl, access.config, "admin_update_word", {
        p_word_id: wordId,
        p_image_url: normalizedBody.image_url,
        p_translations: normalizedBody.translations,
        p_tag_ids: normalizedBody.tag_ids,
      });

      if (!wordRow?.id) {
        return jsonApiError(request, env, 404, "NOT_FOUND", "Word not found.");
      }

      return jsonResponse(request, env, {
        ok: true,
        data: toWordResponseData(wordRow),
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapWriteErrorToResponse(request, env, error);
    }
  }

  async function handleAdminTagCreate(request, env, deps = {}) {
    const access = await requireAdminApiAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const body = await readJsonBody(request);
    let normalizedBody;

    try {
      normalizedBody = normalizeTagPayload(body);
    } catch (error) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message);
    }

    try {
      const tagRow = await callAdminRpc(access.fetchImpl, access.config, "admin_create_tag", {
        p_icon: normalizedBody.icon,
        p_translations: normalizedBody.translations,
      });

      return jsonResponse(request, env, {
        ok: true,
        data: toTagResponseData(tagRow),
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapWriteErrorToResponse(request, env, error);
    }
  }

  async function handleAdminTagUpdate(request, env, deps = {}) {
    const access = await requireAdminApiAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const requestUrl = new URL(request.url);
    const updateTagMatch = new RegExp("^" + access.config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/tags/(\\d+)$").exec(requestUrl.pathname);
    const tagId = Number(updateTagMatch?.[1]);
    const body = await readJsonBody(request);
    let normalizedBody;

    if (!Number.isInteger(tagId) || tagId <= 0) {
      return jsonApiError(request, env, 404, "NOT_FOUND", "Tag not found.");
    }

    try {
      normalizedBody = normalizeTagPayload(body);
    } catch (error) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message);
    }

    try {
      const tagRow = await callAdminRpc(access.fetchImpl, access.config, "admin_update_tag", {
        p_tag_id: tagId,
        p_icon: normalizedBody.icon,
        p_translations: normalizedBody.translations,
      });

      if (!tagRow?.id) {
        return jsonApiError(request, env, 404, "NOT_FOUND", "Tag not found.");
      }

      return jsonResponse(request, env, {
        ok: true,
        data: toTagResponseData(tagRow),
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapWriteErrorToResponse(request, env, error);
    }
  }

  async function handleAdminTagDelete(request, env, deps = {}) {
    const access = await requireAdminApiAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const requestUrl = new URL(request.url);
    const updateTagMatch = new RegExp("^" + access.config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/tags/(\\d+)$").exec(requestUrl.pathname);
    const tagId = Number(updateTagMatch?.[1]);

    if (!Number.isInteger(tagId) || tagId <= 0) {
      return jsonApiError(request, env, 404, "NOT_FOUND", "Tag not found.");
    }

    try {
      const deleted = await callAdminRpc(access.fetchImpl, access.config, "admin_delete_tag", {
        p_tag_id: tagId,
      });

      if (!deleted) {
        return jsonApiError(request, env, 404, "NOT_FOUND", "Tag not found.");
      }

      return jsonResponse(request, env, {
        ok: true,
        data: {
          id: tagId,
          deleted: true,
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapWriteErrorToResponse(request, env, error);
    }
  }

  async function handleAdminApiRequest(request, env, deps = {}) {
    const config = getRequiredConfig(env);
    const requestUrl = new URL(request.url);
    const adminMethods = "GET, POST, PATCH, DELETE, OPTIONS";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: createCorsHeaders(request, env, adminMethods),
      });
    }

    if (request.method === "GET" && requestUrl.pathname === config.adminApiBasePath + "/dashboard") {
      return handleAdminDashboardRead(request, env, deps);
    }

    if (request.method === "POST" && requestUrl.pathname === config.adminApiBasePath + "/words") {
      return handleAdminWordCreate(request, env, deps);
    }

    const updateWordMatch = new RegExp("^" + config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/words/(\\d+)$").exec(requestUrl.pathname);

    if (request.method === "PATCH" && updateWordMatch) {
      return handleAdminWordUpdate(request, env, deps);
    }

    if (request.method === "POST" && requestUrl.pathname === config.adminApiBasePath + "/tags") {
      return handleAdminTagCreate(request, env, deps);
    }

    const updateTagMatch = new RegExp("^" + config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/tags/(\\d+)$").exec(requestUrl.pathname);

    if (request.method === "PATCH" && updateTagMatch) {
      return handleAdminTagUpdate(request, env, deps);
    }

    if (request.method === "DELETE" && updateTagMatch) {
      return handleAdminTagDelete(request, env, deps);
    }

    return jsonApiError(request, env, 404, "NOT_FOUND", "Not found.", undefined, adminMethods);
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

    if (requestUrl.pathname.startsWith(config.adminApiBasePath) && requestUrl.pathname !== config.path) {
      try {
        return await handleAdminApiRequest(request, env, deps);
      } catch (error) {
        return jsonApiError(request, env, 500, "SERVER_ERROR", "An unexpected error occurred.");
      }
    }

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
    handleAdminApiRequest,
    handleAdminDashboardRead,
    handleAdminTagCreate,
    handleAdminTagDelete,
    handleAdminTagUpdate,
    handleRequest,
    normalizeTagPayload,
    normalizeWordPayload,
    requireAdminApiAccess,
    resolveAuthenticatedUser,
    resolveAdminAccount,
    resolveAdminUser,
    resolveAuthEmail,
    signInWithEmail,
  };
});

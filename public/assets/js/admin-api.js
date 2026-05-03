(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminApi = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const SUPPORTED_LANGUAGE_CODES = ["zh-TW", "id", "en"];

  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function createValidationError(message, details) {
    const error = new Error(message);
    error.code = "VALIDATION_ERROR";
    error.details = details;
    return error;
  }

  function createAuthorizationError(message) {
    const error = new Error(message);
    error.code = "UNAUTHORIZED";
    return error;
  }

  function createNotFoundError(message) {
    const error = new Error(message);
    error.code = "NOT_FOUND";
    return error;
  }

  function normalizeTextValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isFormDataBody(value) {
    return Boolean(value)
      && typeof value === "object"
      && typeof value.append === "function"
      && typeof value.get === "function";
  }

  function toPositiveInteger(value, fallbackValue) {
    const normalized = Number(value);

    if (!Number.isInteger(normalized) || normalized <= 0) {
      return fallbackValue;
    }

    return normalized;
  }

  function normalizeBooleanFilter(value) {
    if (value === true || value === "true") {
      return true;
    }

    if (value === false || value === "false") {
      return false;
    }

    return null;
  }

  function normalizeWordListFilters(filters = {}) {
    const tagId = filters.tagId === null || typeof filters.tagId === "undefined"
      ? null
      : Number(filters.tagId);

    return {
      q: normalizeTextValue(filters.q).toLowerCase(),
      tagId: Number.isInteger(tagId) && tagId > 0 ? tagId : null,
      hasImage: normalizeBooleanFilter(filters.hasImage),
      hasAudio: normalizeBooleanFilter(filters.hasAudio),
      page: toPositiveInteger(filters.page, 1),
      pageSize: toPositiveInteger(filters.pageSize, 25),
    };
  }

  function getAudioLanguages(audioMap = {}, translations = {}) {
    return SUPPORTED_LANGUAGE_CODES.filter(function (languageCode) {
      const audioFilename = normalizeTextValue(audioMap[languageCode]);
      const text = normalizeTextValue(translations[languageCode]?.text);
      return Boolean(audioFilename || text && audioFilename);
    }).filter(function (languageCode) {
      return normalizeTextValue(audioMap[languageCode]) !== "";
    });
  }

  function hasMissingAudio(translations = {}) {
    return SUPPORTED_LANGUAGE_CODES.some(function (languageCode) {
      const text = normalizeTextValue(translations[languageCode]?.text);
      const audioFilename = normalizeTextValue(translations[languageCode]?.audio_filename);
      return Boolean(text) && !audioFilename;
    });
  }

  function normalizeWordListItem(wordRow, wordMeta = {}) {
    const translations = {
      "zh-TW": normalizeTextValue(wordRow["lang_zh-TW"]),
      id: normalizeTextValue(wordRow.lang_id),
      en: normalizeTextValue(wordRow.lang_en),
    };
    const imageUrl = normalizeTextValue(wordRow.image_url || wordRow.img || wordMeta.image_url);
    const audioMap = wordRow.audio || {};
    const audioLanguages = getAudioLanguages(audioMap, {
      "zh-TW": { text: translations["zh-TW"] },
      id: { text: translations.id },
      en: { text: translations.en },
    });

    return {
      id: Number(wordRow.id),
      image_url: imageUrl,
      lang_zh_tw: translations["zh-TW"],
      lang_id: translations.id,
      lang_en: translations.en,
      tags: Array.isArray(wordRow.tags) ? wordRow.tags.slice() : [],
      has_image: imageUrl !== "",
      audio_languages: audioLanguages,
      updated_at: wordMeta.updated_at || null,
      created_at: wordMeta.created_at || null,
    };
  }

  function normalizeTagListItem(tagRow, usageCount = 0) {
    return {
      id: Number(tagRow.id),
      icon: normalizeTextValue(tagRow.icon) || "sell",
      translations: {
        "zh-TW": { name: normalizeTextValue(tagRow.name_zh_tw) },
        id: { name: normalizeTextValue(tagRow.name_id) },
        en: { name: normalizeTextValue(tagRow.name_en) },
      },
      usage_count: usageCount,
    };
  }

  function getPreferredWordLabel(wordRow) {
    return normalizeTextValue(wordRow["lang_zh-TW"])
      || normalizeTextValue(wordRow.lang_id)
      || normalizeTextValue(wordRow.lang_en)
      || `#${Number(wordRow.id)}`;
  }

  function upsertAssetReference(referenceMap, nextReference) {
    const normalizedPath = normalizeTextValue(nextReference.path);

    if (!normalizedPath) {
      return;
    }

    const key = [nextReference.type, nextReference.language_code || "", normalizedPath].join("::");
    const existingReference = referenceMap.get(key);

    if (!existingReference) {
      referenceMap.set(key, {
        type: nextReference.type,
        language_code: nextReference.language_code || null,
        path: normalizedPath,
        referenced_by_words: [nextReference.referencedWord],
      });
      return;
    }

    if (!existingReference.referenced_by_words.some(function (word) {
      return word.id === nextReference.referencedWord.id;
    })) {
      existingReference.referenced_by_words.push(nextReference.referencedWord);
    }
  }

  function normalizeAssetFilters(filters = {}) {
    const type = normalizeTextValue(filters.type).toLowerCase();
    return {
      q: normalizeTextValue(filters.q).toLowerCase(),
      type: type === "image" || type === "audio" ? type : "",
      languageCode: normalizeTextValue(filters.languageCode),
    };
  }

  function filterAssetReferences(items, filters = {}) {
    const normalizedFilters = normalizeAssetFilters(filters);

    return (Array.isArray(items) ? items : []).filter(function (item) {
      if (normalizedFilters.type && item.type !== normalizedFilters.type) {
        return false;
      }

      if (normalizedFilters.languageCode && item.type === "audio" && item.language_code !== normalizedFilters.languageCode) {
        return false;
      }

      if (normalizedFilters.languageCode && item.type === "image") {
        return false;
      }

      if (normalizedFilters.q) {
        const haystack = [
          item.path,
          item.language_code || "",
          ...(item.referenced_by_words || []).map(function (word) {
            return word.label;
          }),
        ].join("\n").toLowerCase();

        if (!haystack.includes(normalizedFilters.q)) {
          return false;
        }
      }

      return true;
    });
  }

  async function selectAll(client, table, options = {}) {
    if (!client?.from) {
      throw new Error("Supabase client is required.");
    }

    let query = client.from(table).select(options.select || "*");

    if (options.order && typeof query.order === "function") {
      query = query.order(options.order.column, { ascending: options.order.ascending !== false });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  function createFallbackSupabaseClient(activeRoot) {
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

  function getAdminSupabaseClient(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);

    if (activeRoot.__LEXICON_ADMIN_SUPABASE_CLIENT__) {
      return activeRoot.__LEXICON_ADMIN_SUPABASE_CLIENT__;
    }

    const client = typeof activeRoot.lexiconAdminAuth?.createAdminSupabaseClient === "function"
      ? activeRoot.lexiconAdminAuth.createAdminSupabaseClient(activeRoot)
      : createFallbackSupabaseClient(activeRoot);

    activeRoot.__LEXICON_ADMIN_SUPABASE_CLIENT__ = client;
    return client;
  }

  function normalizeWordPayload(payload = {}) {
    const translations = {};
    let hasTranslationText = false;

    SUPPORTED_LANGUAGE_CODES.forEach(function (languageCode) {
      const entry = payload.translations?.[languageCode] || {};
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
    });

    if (!hasTranslationText) {
      throw createValidationError("At least one translation is required.");
    }

    const rawTagIds = Array.isArray(payload.tag_ids) ? payload.tag_ids : [];
    const tagIds = rawTagIds.map(function (value) {
      return Number(value);
    });

    if (tagIds.some(function (value) {
      return !Number.isInteger(value) || value <= 0;
    })) {
      throw createValidationError("Tag ids must be positive integers.");
    }

    if (new Set(tagIds).size !== tagIds.length) {
      throw createValidationError("Duplicate tag ids are not allowed.");
    }

    return {
      image_url: normalizeTextValue(payload.image_url),
      translations,
      tag_ids: tagIds,
    };
  }

  function normalizeTagPayload(payload = {}) {
    const translations = {};
    let hasName = false;

    SUPPORTED_LANGUAGE_CODES.forEach(function (languageCode) {
      const entry = payload.translations?.[languageCode] || {};
      const name = normalizeTextValue(entry.name);

      if (name) {
        hasName = true;
      }

      translations[languageCode] = { name };
    });

    if (!hasName) {
      throw createValidationError("At least one tag translation is required.");
    }

    return {
      icon: normalizeTextValue(payload.icon) || "sell",
      translations,
    };
  }

  function getAdminDataApiBaseUrl(globalObject, options = {}) {
    const activeRoot = resolveGlobalObject(globalObject);
    const configuredUrl = options.apiBaseUrl
      || activeRoot.LEXICON_ADMIN_DATA_API_URL
      || activeRoot.LEXICON_SUPABASE_CONFIG?.adminAuthApiUrl
      || "/api/admin";

    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(configuredUrl)) {
      return configuredUrl.replace(/\/api\/admin\/auth\/login\/?$/, "/api/admin");
    }

    if (activeRoot.location?.origin && activeRoot.location.origin !== "null") {
      return new URL(configuredUrl, activeRoot.location.origin)
        .toString()
        .replace(/\/api\/admin\/auth\/login\/?$/, "/api/admin");
    }

    return configuredUrl.replace(/\/api\/admin\/auth\/login\/?$/, "/api/admin");
  }

  async function getProtectedAccessToken(client, globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const sessionResolver = activeRoot.lexiconAdminAuth?.getAdminSession;

    if (typeof sessionResolver !== "function") {
      throw createAuthorizationError("Admin session helper is unavailable.");
    }

    const session = await sessionResolver(client);
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw createAuthorizationError("An active admin session is required.");
    }

    return accessToken;
  }

  function buildProtectedRequest(path, token, options = {}) {
    const method = options.method || (typeof options.body === "undefined" ? "GET" : "POST");
    const headers = new Headers(options.headers || {});
    const requestUrl = String(path).startsWith("http")
      ? path
      : `http://localhost${path.startsWith("/") ? path : `/${path}`}`;
    const body = options.body;
    let requestBody;

    if (typeof body !== "undefined") {
      if (isFormDataBody(body)) {
        requestBody = body;
      } else {
        headers.set("content-type", "application/json");
        requestBody = JSON.stringify(body);
      }
    }

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    return new Request(requestUrl, {
      method,
      headers,
      body: requestBody,
    });
  }

  async function callProtectedEndpoint(client, path, options = {}) {
    const activeRoot = resolveGlobalObject(options.globalObject);
    const fetchImpl = options.fetch || activeRoot.fetch;

    if (typeof fetchImpl !== "function") {
      throw new Error("Fetch API is required.");
    }

    const accessToken = await getProtectedAccessToken(client, activeRoot);
    const baseUrl = getAdminDataApiBaseUrl(activeRoot, options);
    const request = buildProtectedRequest(`${baseUrl}${path}`, accessToken, {
      method: options.method,
      body: options.body,
    });
    const response = await fetchImpl(request);
    const payload = await response.json().catch(function () {
      return null;
    });

    if (!response.ok || !payload?.ok) {
      const message = payload?.error?.message || payload?.message || "Request failed.";
      const error = new Error(message);
      error.code = payload?.error?.code || "REQUEST_FAILED";
      error.details = payload?.error?.details;
      throw error;
    }

    return payload.data;
  }

  async function createWord(client, payload, options = {}) {
    return callProtectedEndpoint(client, "/words", {
      ...options,
      method: "POST",
      body: normalizeWordPayload(payload),
    });
  }

  async function updateWord(client, wordId, payload, options = {}) {
    if (!Number.isInteger(Number(wordId)) || Number(wordId) <= 0) {
      throw createValidationError("A valid word id is required.");
    }

    return callProtectedEndpoint(client, `/words/${Number(wordId)}`, {
      ...options,
      method: "PATCH",
      body: normalizeWordPayload(payload),
    });
  }

  async function listStorageObjects(client, filters = {}, options = {}) {
    const query = new URLSearchParams();
    const prefix = normalizeTextValue(filters.prefix);
    const cursor = normalizeTextValue(filters.cursor);

    if (prefix) {
      query.set("prefix", prefix);
    }

    if (cursor) {
      query.set("cursor", cursor);
    }

    const path = "/assets/objects" + (query.toString() ? "?" + query.toString() : "");
    return callProtectedEndpoint(client, path, {
      ...options,
      method: "GET",
    });
  }

  async function deleteStorageObject(client, key, options = {}) {
    const normalizedKey = normalizeTextValue(key);

    if (!normalizedKey) {
      throw createValidationError("A storage object key is required.");
    }

    return callProtectedEndpoint(client, "/assets/object", {
      ...options,
      method: "DELETE",
      body: {
        key: normalizedKey,
      },
    });
  }

  async function purgeStorageObjects(client, confirmText, options = {}) {
    const normalizedConfirmText = normalizeTextValue(confirmText);

    if (!normalizedConfirmText) {
      throw createValidationError("Confirmation text is required.");
    }

    return callProtectedEndpoint(client, "/assets/purge", {
      ...options,
      method: "POST",
      body: {
        confirmText: normalizedConfirmText,
      },
    });
  }

  async function uploadWordImage(client, wordId, file, options = {}) {
    const normalizedWordId = Number(wordId);

    if (!Number.isInteger(normalizedWordId) || normalizedWordId <= 0) {
      throw createValidationError("A valid word id is required.");
    }

    if (!file || typeof file !== "object") {
      throw createValidationError("An image file is required.");
    }

    const formData = new FormData();
    formData.set("file", file);

    return callProtectedEndpoint(client, `/assets/word-image/${normalizedWordId}`, {
      ...options,
      method: "POST",
      body: formData,
    });
  }

  async function deleteWordImage(client, wordId, options = {}) {
    const normalizedWordId = Number(wordId);

    if (!Number.isInteger(normalizedWordId) || normalizedWordId <= 0) {
      throw createValidationError("A valid word id is required.");
    }

    return callProtectedEndpoint(client, `/assets/word-image/${normalizedWordId}`, {
      ...options,
      method: "DELETE",
    });
  }

  async function uploadWordAudio(client, wordId, languageCode, file, options = {}) {
    const normalizedWordId = Number(wordId);
    const normalizedLanguageCode = normalizeTextValue(languageCode);

    if (!Number.isInteger(normalizedWordId) || normalizedWordId <= 0) {
      throw createValidationError("A valid word id is required.");
    }

    if (!SUPPORTED_LANGUAGE_CODES.includes(normalizedLanguageCode)) {
      throw createValidationError("A supported language code is required.");
    }

    if (!file || typeof file !== "object") {
      throw createValidationError("An audio file is required.");
    }

    const formData = new FormData();
    formData.set("file", file);

    return callProtectedEndpoint(client, `/assets/word-audio/${normalizedWordId}/${normalizedLanguageCode}`, {
      ...options,
      method: "POST",
      body: formData,
    });
  }

  async function deleteWordAudio(client, wordId, languageCode, options = {}) {
    const normalizedWordId = Number(wordId);
    const normalizedLanguageCode = normalizeTextValue(languageCode);

    if (!Number.isInteger(normalizedWordId) || normalizedWordId <= 0) {
      throw createValidationError("A valid word id is required.");
    }

    if (!SUPPORTED_LANGUAGE_CODES.includes(normalizedLanguageCode)) {
      throw createValidationError("A supported language code is required.");
    }

    return callProtectedEndpoint(client, `/assets/word-audio/${normalizedWordId}/${normalizedLanguageCode}`, {
      ...options,
      method: "DELETE",
    });
  }

  async function createTag(client, payload, options = {}) {
    return callProtectedEndpoint(client, "/tags", {
      ...options,
      method: "POST",
      body: normalizeTagPayload(payload),
    });
  }

  async function updateTag(client, tagId, payload, options = {}) {
    if (!Number.isInteger(Number(tagId)) || Number(tagId) <= 0) {
      throw createValidationError("A valid tag id is required.");
    }

    return callProtectedEndpoint(client, `/tags/${Number(tagId)}`, {
      ...options,
      method: "PATCH",
      body: normalizeTagPayload(payload),
    });
  }

  async function deleteTag(client, tagId, options = {}) {
    if (!Number.isInteger(Number(tagId)) || Number(tagId) <= 0) {
      throw createValidationError("A valid tag id is required.");
    }

    return callProtectedEndpoint(client, `/tags/${Number(tagId)}`, {
      ...options,
      method: "DELETE",
    });
  }

  async function loadWordList(client, filters = {}) {
    const normalizedFilters = normalizeWordListFilters(filters);
    const [wordRows, wordMetaRows] = await Promise.all([
      selectAll(client, "lexicon_words_api", { order: { column: "id", ascending: true } }),
      selectAll(client, "words", { select: "id,image_url,created_at,updated_at", order: { column: "id", ascending: true } }),
    ]);
    const wordMetaMap = new Map(wordMetaRows.map(function (row) {
      return [Number(row.id), row];
    }));

    const filteredItems = wordRows
      .map(function (row) {
        return normalizeWordListItem(row, wordMetaMap.get(Number(row.id)) || {});
      })
      .filter(function (item) {
        if (normalizedFilters.q) {
          const haystack = [item.lang_zh_tw, item.lang_id, item.lang_en]
            .join("\n")
            .toLowerCase();

          if (!haystack.includes(normalizedFilters.q)) {
            return false;
          }
        }

        if (normalizedFilters.tagId !== null && !item.tags.includes(normalizedFilters.tagId)) {
          return false;
        }

        if (normalizedFilters.hasImage !== null && item.has_image !== normalizedFilters.hasImage) {
          return false;
        }

        if (normalizedFilters.hasAudio !== null) {
          const hasAudio = item.audio_languages.length > 0;

          if (hasAudio !== normalizedFilters.hasAudio) {
            return false;
          }
        }

        return true;
      })
      .sort(function (left, right) {
        const leftTime = left.updated_at ? Date.parse(left.updated_at) : 0;
        const rightTime = right.updated_at ? Date.parse(right.updated_at) : 0;

        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }

        return right.id - left.id;
      });

    const total = filteredItems.length;
    const startIndex = (normalizedFilters.page - 1) * normalizedFilters.pageSize;
    const items = filteredItems.slice(startIndex, startIndex + normalizedFilters.pageSize);

    return {
      ok: true,
      data: {
        items,
        page: normalizedFilters.page,
        pageSize: normalizedFilters.pageSize,
        total,
      },
    };
  }

  async function loadWordDetail(client, wordId) {
    const normalizedWordId = Number(wordId);

    if (!Number.isInteger(normalizedWordId) || normalizedWordId <= 0) {
      throw createValidationError("A valid word id is required.");
    }

    const [wordRows, translationRows, wordTagRows] = await Promise.all([
      selectAll(client, "words", { select: "id,image_url,created_at,updated_at", order: { column: "id", ascending: true } }),
      selectAll(client, "word_translations", { select: "word_id,language_code,text,pronunciation,audio_filename" }),
      selectAll(client, "word_tags", { select: "word_id,tag_id" }),
    ]);
    const wordRow = wordRows.find(function (row) {
      return Number(row.id) === normalizedWordId;
    });

    if (!wordRow) {
      throw createNotFoundError("Word not found.");
    }

    const translations = {};
    SUPPORTED_LANGUAGE_CODES.forEach(function (languageCode) {
      const translationRow = translationRows.find(function (row) {
        return Number(row.word_id) === normalizedWordId && row.language_code === languageCode;
      }) || {};

      translations[languageCode] = {
        text: normalizeTextValue(translationRow.text),
        pronunciation: normalizeTextValue(translationRow.pronunciation),
        audio_filename: normalizeTextValue(translationRow.audio_filename),
      };
    });

    return {
      ok: true,
      data: {
        id: normalizedWordId,
        image_url: normalizeTextValue(wordRow.image_url),
        translations,
        tag_ids: wordTagRows
          .filter(function (row) {
            return Number(row.word_id) === normalizedWordId;
          })
          .map(function (row) {
            return Number(row.tag_id);
          })
          .sort(function (left, right) {
            return left - right;
          }),
        created_at: wordRow.created_at || null,
        updated_at: wordRow.updated_at || null,
      },
    };
  }

  async function loadTagList(client) {
    const [tagRows, wordTagRows] = await Promise.all([
      selectAll(client, "lexicon_tags_api", { order: { column: "id", ascending: true } }),
      selectAll(client, "word_tags", { select: "word_id,tag_id" }),
    ]);

    return {
      ok: true,
      data: tagRows.map(function (tagRow) {
        const usageCount = wordTagRows.filter(function (row) {
          return Number(row.tag_id) === Number(tagRow.id);
        }).length;

        return normalizeTagListItem(tagRow, usageCount);
      }),
    };
  }

  async function loadAssetReferences(client, filters = {}) {
    const wordRows = await selectAll(client, "lexicon_words_api", { order: { column: "id", ascending: true } });
    const referenceMap = new Map();

    wordRows.forEach(function (wordRow) {
      const wordId = Number(wordRow.id);
      const imageUrl = normalizeTextValue(wordRow.img || wordRow.image_url);
      const audioMap = wordRow.audio || {};
      const referencedWord = {
        id: wordId,
        label: getPreferredWordLabel(wordRow),
      };

      if (imageUrl) {
        upsertAssetReference(referenceMap, {
          type: "image",
          path: imageUrl,
          referencedWord,
        });
      }

      SUPPORTED_LANGUAGE_CODES.forEach(function (languageCode) {
        const audioFilename = normalizeTextValue(audioMap[languageCode]);

        if (audioFilename) {
          upsertAssetReference(referenceMap, {
            type: "audio",
            language_code: languageCode,
            path: audioFilename,
            referencedWord,
          });
        }
      });
    });

    const items = Array.from(referenceMap.values()).sort(function (left, right) {
      return left.path.localeCompare(right.path);
    });
    const filteredItems = filterAssetReferences(items, filters);

    return {
      ok: true,
      data: {
        items: filteredItems,
      },
    };
  }

  async function loadDashboardSummary(client) {
    const [wordListResult, tagListResult, wordDetailRows] = await Promise.all([
      loadWordList(client, { page: 1, pageSize: 10000 }),
      loadTagList(client),
      selectAll(client, "lexicon_words_api", { order: { column: "id", ascending: true } }),
    ]);

    const words = wordListResult.data.items;
    const tags = tagListResult.data;
    const detailMap = new Map(wordDetailRows.map(function (row) {
      return [Number(row.id), row];
    }));

    const missingAudioCount = words.filter(function (item) {
      const row = detailMap.get(item.id) || {};
      const audioMap = row.audio || {};
      return hasMissingAudio({
        "zh-TW": {
          text: item.lang_zh_tw,
          audio_filename: audioMap["zh-TW"],
        },
        id: {
          text: item.lang_id,
          audio_filename: audioMap.id,
        },
        en: {
          text: item.lang_en,
          audio_filename: audioMap.en,
        },
      });
    }).length;

    return {
      ok: true,
      data: {
        metrics: {
          total_words: words.length,
          total_tags: tags.length,
          words_missing_image: words.filter(function (item) {
            return !item.has_image;
          }).length,
          missing_audio_words: missingAudioCount,
        },
        recent_words: words.slice(0, 10),
      },
    };
  }

  return {
    buildProtectedRequest,
    callProtectedEndpoint,
    createAuthorizationError,
    createTag,
    createNotFoundError,
    createValidationError,
    createWord,
    deleteStorageObject,
    deleteTag,
    deleteWordAudio,
    deleteWordImage,
    getAdminSupabaseClient,
    getAdminDataApiBaseUrl,
    getProtectedAccessToken,
    loadAssetReferences,
    loadDashboardSummary,
    loadTagList,
    loadWordDetail,
    loadWordList,
    listStorageObjects,
    filterAssetReferences,
    normalizeWordListFilters,
    normalizeWordListItem,
    normalizeAssetFilters,
    normalizeTagPayload,
    normalizeTagListItem,
    normalizeWordPayload,
    purgeStorageObjects,
    selectAll,
    uploadWordAudio,
    uploadWordImage,
    updateTag,
    updateWord,
  };
});

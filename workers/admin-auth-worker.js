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
  const IMAGE_OBJECT_PREFIX = "imgs";
  const AUDIO_OBJECT_PREFIX = "audios";
  const IMAGE_MIME_TYPE_TO_EXTENSION = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const AUDIO_MIME_TYPE_TO_EXTENSION = {
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
  };
  const IMAGE_EXTENSIONS = new Set(Object.values(IMAGE_MIME_TYPE_TO_EXTENSION));
  const AUDIO_EXTENSIONS = new Set(Object.values(AUDIO_MIME_TYPE_TO_EXTENSION));
  const MEDIA_BUCKET_PLACEHOLDERS = new Set(["lexicon-media-placeholder"]);
  const MEDIA_PUBLIC_BASE_URL_PLACEHOLDERS = new Set(["https://media.example.com"]);
  const PURGE_CONFIRMATION_TEXT = "DELETE ALL R2 OBJECTS";
  const STORAGE_DELETE_BATCH_SIZE = 25;

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

  function buildInconsistentStateDetails(baseDetails, extraDetails) {
    return {
      ...(baseDetails && typeof baseDetails === "object" ? baseDetails : {}),
      ...(extraDetails && typeof extraDetails === "object" ? extraDetails : {}),
    };
  }

  function createInconsistentStateError(message, details) {
    const error = new Error(message);
    error.code = "INCONSISTENT_STATE";
    error.details = details;
    return error;
  }

  function mapMediaMutationErrorToResponse(request, env, error) {
    if (error?.code === "MEDIA_SYNC_FAILED") {
      return jsonApiError(request, env, 502, error.code, error.message, error.details);
    }

    if (error?.code === "INCONSISTENT_STATE") {
      return jsonApiError(request, env, 409, error.code, error.message, error.details);
    }

    if (error?.message === "A supported storage object key is required."
      || error?.message === "Confirmation text does not match."
      || error?.message === "A file upload is required."
      || error?.message === "Unsupported media MIME type."
      || error?.message === "Word id must be a positive integer."
      || error?.message === "Unsupported language code.") {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message, error.details);
    }

    return jsonApiError(request, env, 500, "SERVER_ERROR", error?.message || "An unexpected error occurred.", error?.details);
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

  function getRequiredMediaConfig(env = {}) {
    const baseConfig = getRequiredConfig(env);
    const mediaBucket = typeof env.LEXICON_MEDIA_BUCKET === "string"
      ? env.LEXICON_MEDIA_BUCKET.trim()
      : env.LEXICON_MEDIA_BUCKET;
    const mediaPublicBaseUrl = typeof env.LEXICON_MEDIA_PUBLIC_BASE_URL === "string"
      ? env.LEXICON_MEDIA_PUBLIC_BASE_URL.trim()
      : "";

    if (!mediaBucket || !mediaPublicBaseUrl) {
      throw new Error("Missing media storage worker configuration.");
    }

    let normalizedMediaPublicBaseUrl;

    try {
      const parsedPublicBaseUrl = new URL(mediaPublicBaseUrl);

      if (!/^https?:$/i.test(parsedPublicBaseUrl.protocol)) {
        throw new Error("invalid protocol");
      }

      normalizedMediaPublicBaseUrl = parsedPublicBaseUrl.toString().replace(/\/$/, "");
    } catch (error) {
      throw new Error("Invalid media storage worker configuration.");
    }

    if (MEDIA_PUBLIC_BASE_URL_PLACEHOLDERS.has(normalizedMediaPublicBaseUrl)) {
      throw new Error("Invalid media storage worker configuration.");
    }

    if (typeof mediaBucket === "string" && MEDIA_BUCKET_PLACEHOLDERS.has(mediaBucket)) {
      throw new Error("Invalid media storage worker configuration.");
    }

    return {
      ...baseConfig,
      mediaBucket,
      mediaPublicBaseUrl: normalizedMediaPublicBaseUrl,
    };
  }

  function normalizeMimeType(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .split(";")[0]
      .trim()
      .toLowerCase();
  }

  function getMediaExtensionForMimeType(mimeType, mimeTypeMap) {
    const normalizedMimeType = normalizeMimeType(mimeType);
    const extension = mimeTypeMap[normalizedMimeType];

    if (!extension) {
      throw new Error("Unsupported media MIME type.");
    }

    return extension;
  }

  function normalizeWordId(wordId) {
    const numericWordId = Number(wordId);

    if (!Number.isInteger(numericWordId) || numericWordId <= 0) {
      throw new Error("Word id must be a positive integer.");
    }

    return numericWordId;
  }

  function normalizeLanguageCode(languageCode) {
    const normalizedLanguageCode = typeof languageCode === "string" ? languageCode.trim() : "";

    if (!SUPPORTED_LANGUAGE_CODES.includes(normalizedLanguageCode)) {
      throw new Error("Unsupported language code.");
    }

    return normalizedLanguageCode;
  }

  function buildWordImageKey(wordId, mimeType) {
    const normalizedWordId = normalizeWordId(wordId);
    const extension = getMediaExtensionForMimeType(mimeType, IMAGE_MIME_TYPE_TO_EXTENSION);

    return IMAGE_OBJECT_PREFIX + "/" + normalizedWordId + "." + extension;
  }

  function buildWordAudioKey(wordId, languageCode, mimeType) {
    const normalizedWordId = normalizeWordId(wordId);
    const normalizedLanguageCode = normalizeLanguageCode(languageCode);
    const extension = getMediaExtensionForMimeType(mimeType, AUDIO_MIME_TYPE_TO_EXTENSION);

    return AUDIO_OBJECT_PREFIX + "/" + normalizedLanguageCode + "/" + normalizedWordId + "." + extension;
  }

  function parseStorageObjectKey(key) {
    const normalizedKey = typeof key === "string" ? key.trim() : "";
    const imageMatch = /^imgs\/(\d+)\.([a-z0-9]+)$/i.exec(normalizedKey);

    if (imageMatch) {
      if (!IMAGE_EXTENSIONS.has(imageMatch[2].toLowerCase())) {
        return null;
      }

      return {
        mediaType: "image",
        wordId: Number(imageMatch[1]),
        languageCode: null,
        extension: imageMatch[2].toLowerCase(),
      };
    }

    const audioMatch = /^audios\/([^/]+)\/(\d+)\.([a-z0-9]+)$/i.exec(normalizedKey);

    if (!audioMatch) {
      return null;
    }

    if (!SUPPORTED_LANGUAGE_CODES.includes(audioMatch[1]) || !AUDIO_EXTENSIONS.has(audioMatch[3].toLowerCase())) {
      return null;
    }

    return {
      mediaType: "audio",
      wordId: Number(audioMatch[2]),
      languageCode: audioMatch[1],
      extension: audioMatch[3].toLowerCase(),
    };
  }

  function buildMediaPublicUrl(config, key) {
    return config.mediaPublicBaseUrl + "/" + key;
  }

  function normalizeStoredMediaKey(value, config) {
    const normalizedValue = normalizeTextValue(value);

    if (!normalizedValue) {
      return "";
    }

    if (normalizedValue.startsWith(config.mediaPublicBaseUrl + "/")) {
      return normalizedValue.slice(config.mediaPublicBaseUrl.length + 1);
    }

    return normalizedValue;
  }

  function getStorageObjectBasename(key) {
    const normalizedKey = normalizeTextValue(key);

    if (!normalizedKey) {
      return "";
    }

    const segments = normalizedKey.split("/");
    return segments[segments.length - 1] || "";
  }

  function getComparableStoredMediaKeys(value, config, mediaType) {
    const normalizedKey = normalizeStoredMediaKey(value, config);

    if (!normalizedKey) {
      return [];
    }

    if (mediaType === "audio") {
      const basename = getStorageObjectBasename(normalizedKey);
      return Array.from(new Set([normalizedKey, basename].filter(Boolean)));
    }

    return [normalizedKey];
  }

  function getMediaBucket(env = {}) {
    const mediaBucket = env.LEXICON_MEDIA_BUCKET;

    if (!mediaBucket
      || typeof mediaBucket.list !== "function"
      || typeof mediaBucket.delete !== "function"
      || typeof mediaBucket.put !== "function") {
      throw new Error("Missing media storage worker configuration.");
    }

    return mediaBucket;
  }

  async function listStorageObjects(mediaBucket, options = {}) {
    const listOptions = {};

    if (typeof options.prefix === "string" && options.prefix.trim()) {
      listOptions.prefix = options.prefix.trim();
    }

    if (typeof options.cursor === "string" && options.cursor.trim()) {
      listOptions.cursor = options.cursor.trim();
    }

    return mediaBucket.list(listOptions);
  }

  async function listAllStorageObjects(mediaBucket, options = {}) {
    const objects = [];
    let cursor = typeof options.cursor === "string" ? options.cursor : undefined;

    do {
      const page = await listStorageObjects(mediaBucket, {
        ...options,
        cursor,
      });
      const pageObjects = Array.isArray(page?.objects) ? page.objects : [];

      objects.push(...pageObjects);
      cursor = page?.truncated ? page?.cursor : undefined;
    } while (cursor);

    return objects;
  }

  async function deleteStorageObjects(mediaBucket, keys, options = {}) {
    const uniqueKeys = Array.from(new Set((Array.isArray(keys) ? keys : []).filter(Boolean)));
    const batchSize = Number.isInteger(options.batchSize) && options.batchSize > 0
      ? options.batchSize
      : STORAGE_DELETE_BATCH_SIZE;
    const deletedKeys = [];

    for (let index = 0; index < uniqueKeys.length; index += batchSize) {
      const batchKeys = uniqueKeys.slice(index, index + batchSize);
      const batchResults = await Promise.allSettled(batchKeys.map(function (key) {
        return mediaBucket.delete(key);
      }));
      const failedKeys = [];

      batchResults.forEach(function (result, batchIndex) {
        if (result.status === "fulfilled") {
          deletedKeys.push(batchKeys[batchIndex]);
          return;
        }

        failedKeys.push({
          key: batchKeys[batchIndex],
          message: result.reason?.message || "Storage delete failed.",
        });
      });

      if (failedKeys.length > 0) {
        const error = new Error("Storage object deletion failed.");
        error.code = "STORAGE_DELETE_FAILED";
        error.details = {
          deletedKeys,
          failedKeys,
        };
        throw error;
      }
    }

    return deletedKeys;
  }

  async function deleteStorageObjectsByPrefix(mediaBucket, prefix) {
    const objects = await listAllStorageObjects(mediaBucket, { prefix });
    return deleteStorageObjects(mediaBucket, objects.map(function (object) {
      return object?.key;
    }));
  }

  async function listStorageKeysByPrefix(mediaBucket, prefix) {
    const objects = await listAllStorageObjects(mediaBucket, { prefix });
    return objects.map(function (object) {
      return object?.key;
    }).filter(Boolean);
  }

  function createMediaSummary(items, totalObjectCount) {
    const imageCount = items.filter(function (item) {
      return item.type === "image";
    }).length;
    const audioCount = items.filter(function (item) {
      return item.type === "audio";
    }).length;
    const referencedCount = items.filter(function (item) {
      return item.dbReferenced;
    }).length;

    return {
      objectCount: Number.isInteger(totalObjectCount) && totalObjectCount >= 0 ? totalObjectCount : items.length,
      imageCount,
      audioCount,
      referencedCount,
      orphanedCount: (Number.isInteger(totalObjectCount) && totalObjectCount >= 0 ? totalObjectCount : items.length) - referencedCount,
    };
  }

  async function loadMediaReferenceState(fetchImpl, config, wordIds) {
    const normalizedWordIds = Array.from(new Set((Array.isArray(wordIds) ? wordIds : []).filter(function (wordId) {
      return Number.isInteger(wordId) && wordId > 0;
    })));

    if (normalizedWordIds.length === 0) {
      return {
        imageKeys: new Set(),
        audioKeysByLanguage: new Map(),
      };
    }

    const wordIdFilter = "in.(" + normalizedWordIds.join(",") + ")";
    const [wordRows, translationRows] = await Promise.all([
      fetchServiceRows(fetchImpl, config, "words", {
        select: "id,image_url",
        filters: {
          id: wordIdFilter,
        },
      }),
      fetchServiceRows(fetchImpl, config, "word_translations", {
        select: "word_id,language_code,audio_filename",
        filters: {
          word_id: wordIdFilter,
        },
      }),
    ]);

    const imageKeys = new Set(wordRows.flatMap(function (row) {
      return getComparableStoredMediaKeys(row?.image_url, config, "image");
    }).filter(Boolean));
    const audioKeysByLanguage = new Map();

    translationRows.forEach(function (row) {
      const languageCode = normalizeLanguageCode(row?.language_code);
      const comparableKeys = getComparableStoredMediaKeys(row?.audio_filename, config, "audio");

      if (!audioKeysByLanguage.has(languageCode)) {
        audioKeysByLanguage.set(languageCode, new Set());
      }

      comparableKeys.forEach(function (key) {
        if (key) {
          audioKeysByLanguage.get(languageCode).add(key);
        }
      });
    });

    return {
      imageKeys,
      audioKeysByLanguage,
    };
  }

  function toStorageObjectItem(storageObject, config, referenceState) {
    const parsedKey = parseStorageObjectKey(storageObject?.key);

    if (!parsedKey) {
      return null;
    }

    const objectComparableKeys = getComparableStoredMediaKeys(storageObject.key, config, parsedKey.mediaType);
    const dbReferenced = objectComparableKeys.some(function (candidateKey) {
      return parsedKey.mediaType === "image"
        ? referenceState.imageKeys.has(candidateKey)
        : referenceState.audioKeysByLanguage.get(parsedKey.languageCode)?.has(candidateKey);
    });

    return {
      key: storageObject.key,
      type: parsedKey.mediaType,
      languageCode: parsedKey.languageCode,
      wordId: parsedKey.wordId,
      size: Number(storageObject?.size || 0),
      uploadedAt: storageObject?.uploaded instanceof Date
        ? storageObject.uploaded.toISOString()
        : storageObject?.uploaded
          ? new Date(storageObject.uploaded).toISOString()
          : null,
      dbReferenced,
      previewUrl: buildMediaPublicUrl(config, storageObject.key),
    };
  }

  async function readFormData(request) {
    try {
      return await request.formData();
    } catch (error) {
      return null;
    }
  }

  async function loadMediaReferenceRow(fetchImpl, config, parsedKey) {
    if (!parsedKey) {
      return null;
    }

    if (parsedKey.mediaType === "image") {
      const rows = await fetchServiceRows(fetchImpl, config, "words", {
        select: "id,image_url",
        filters: {
          id: "eq." + parsedKey.wordId,
        },
        limit: 1,
      });

      return rows[0] || null;
    }

    const rows = await fetchServiceRows(fetchImpl, config, "word_translations", {
      select: "word_id,language_code,audio_filename",
      filters: {
        word_id: "eq." + parsedKey.wordId,
        language_code: "eq." + parsedKey.languageCode,
      },
      limit: 1,
    });

    return rows[0] || null;
  }

  function doesParsedKeyMatchReferenceRow(parsedKey, referenceRow, config) {
    if (!parsedKey || !referenceRow) {
      return false;
    }

    const storageKey = parsedKey.mediaType === "image"
      ? IMAGE_OBJECT_PREFIX + "/" + parsedKey.wordId + "." + parsedKey.extension
      : AUDIO_OBJECT_PREFIX + "/" + parsedKey.languageCode + "/" + parsedKey.wordId + "." + parsedKey.extension;
    const comparableKeys = getComparableStoredMediaKeys(
      parsedKey.mediaType === "image" ? referenceRow?.image_url : referenceRow?.audio_filename,
      config,
      parsedKey.mediaType,
    );

    return getComparableStoredMediaKeys(storageKey, config, parsedKey.mediaType).some(function (candidateKey) {
      return comparableKeys.includes(candidateKey);
    });
  }

  function getUploadedFile(formData) {
    const file = formData?.get("file");

    if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
      throw new Error("A file upload is required.");
    }

    return file;
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

    if (query.filters && typeof query.filters === "object") {
      Object.entries(query.filters).forEach(function ([key, value]) {
        if (typeof value === "string" && value) {
          url.searchParams.set(key, value);
        }
      });
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

  async function requireAdminMediaAccess(request, env, deps = {}) {
    let mediaConfig;
    let mediaBucket;

    try {
      mediaConfig = getRequiredMediaConfig(env);
      mediaBucket = getMediaBucket(env);
    } catch (error) {
      return {
        ok: false,
        response: jsonApiError(request, env, 500, "SERVER_ERROR", error.message || "An unexpected error occurred."),
      };
    }

    const access = await requireAdminApiAccess(request, env, deps);

    if (!access.ok) {
      return access;
    }

    return {
      ...access,
      config: mediaConfig,
      mediaBucket,
    };
  }

  async function handleAdminAssetsObjectsList(request, env, deps = {}) {
    const access = await requireAdminMediaAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    try {
      const requestUrl = new URL(request.url);
      const prefix = normalizeTextValue(requestUrl.searchParams.get("prefix"));
      const cursor = normalizeTextValue(requestUrl.searchParams.get("cursor"));
      const storagePage = await listStorageObjects(access.mediaBucket, {
        prefix,
        cursor,
      });
      const pageObjects = Array.isArray(storagePage?.objects) ? storagePage.objects : [];
      const parsedPageObjects = pageObjects.map(function (storageObject) {
        return {
          storageObject,
          parsedKey: parseStorageObjectKey(storageObject?.key),
        };
      }).filter(function (item) {
        return Boolean(item.parsedKey);
      });
      const referenceState = await loadMediaReferenceState(
        access.fetchImpl,
        access.config,
        parsedPageObjects.map(function (item) {
          return item.parsedKey.wordId;
        }),
      );
      const items = pageObjects
        .map(function (storageObject) {
          return toStorageObjectItem(storageObject, access.config, referenceState);
        })
        .filter(Boolean);

      return jsonResponse(request, env, {
        ok: true,
        data: {
          items,
          summary: createMediaSummary(items, pageObjects.length),
          cursor: storagePage?.cursor || null,
          truncated: Boolean(storagePage?.truncated),
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapMediaMutationErrorToResponse(request, env, error);
    }
  }

  async function clearMediaReference(fetchImpl, config, parsedKey) {
    if (parsedKey.mediaType === "image") {
      await callAdminRpc(fetchImpl, config, "admin_clear_word_image", {
        p_word_id: parsedKey.wordId,
      });
      return;
    }

    await callAdminRpc(fetchImpl, config, "admin_clear_word_audio", {
      p_word_id: parsedKey.wordId,
      p_language_code: parsedKey.languageCode,
    });
  }

  async function handleAdminAssetsObjectDelete(request, env, deps = {}) {
    const access = await requireAdminMediaAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const body = await readJsonBody(request);
    const key = normalizeTextValue(body?.key);
    const parsedKey = parseStorageObjectKey(key);

    if (!parsedKey) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", "A supported storage object key is required.");
    }

    try {
      const referenceRow = await loadMediaReferenceRow(access.fetchImpl, access.config, parsedKey);
      const dbCleared = doesParsedKeyMatchReferenceRow(parsedKey, referenceRow, access.config);

      if (dbCleared) {
        await clearMediaReference(access.fetchImpl, access.config, parsedKey);
      }

      await deleteStorageObjects(access.mediaBucket, [key]);

      return jsonResponse(request, env, {
        ok: true,
        data: {
          deletedKey: key,
          affectedWordId: parsedKey.wordId,
          affectedLanguageCode: parsedKey.languageCode,
          dbCleared,
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      if (error?.code === "STORAGE_DELETE_FAILED") {
        return mapMediaMutationErrorToResponse(request, env, createInconsistentStateError(
          "Database references were cleared, but storage deletion did not complete.",
          buildInconsistentStateDetails(error.details, {
            deletedKey: key,
            affectedWordId: parsedKey.wordId,
            affectedLanguageCode: parsedKey.languageCode,
          }),
        ));
      }

      return mapMediaMutationErrorToResponse(request, env, error);
    }
  }

  async function handleAdminAssetsPurge(request, env, deps = {}) {
    const access = await requireAdminMediaAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const body = await readJsonBody(request);

    if (normalizeTextValue(body?.confirmText) !== PURGE_CONFIRMATION_TEXT) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", "Confirmation text does not match.");
    }

    try {
      const objects = await listAllStorageObjects(access.mediaBucket);
      const rpcResult = await callAdminRpc(access.fetchImpl, access.config, "admin_purge_media_references", {});
      const deletedKeys = await deleteStorageObjects(access.mediaBucket, objects.map(function (object) {
        return object?.key;
      }));

      return jsonResponse(request, env, {
        ok: true,
        data: {
          deletedObjectCount: deletedKeys.length,
          clearedImageCount: Number(rpcResult?.cleared_image_count || 0),
          clearedAudioCount: Number(rpcResult?.cleared_audio_count || 0),
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      if (error?.code === "STORAGE_DELETE_FAILED") {
        return mapMediaMutationErrorToResponse(request, env, createInconsistentStateError(
          "Database references were cleared, but purge could not delete every storage object.",
          error.details,
        ));
      }

      return mapMediaMutationErrorToResponse(request, env, error);
    }
  }

  async function handleAdminWordImageUpload(request, env, deps = {}) {
    const access = await requireAdminMediaAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const requestUrl = new URL(request.url);
    const match = new RegExp("^" + access.config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/assets/word-image/(\\d+)$").exec(requestUrl.pathname);
    const formData = await readFormData(request);
    let wordId;
    let file;
    let objectKey;

    try {
      wordId = normalizeWordId(match?.[1]);
      file = getUploadedFile(formData);
      objectKey = buildWordImageKey(wordId, file.type);
    } catch (error) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message);
    }

    try {
      const existingObjects = await listAllStorageObjects(access.mediaBucket, { prefix: IMAGE_OBJECT_PREFIX + "/" + wordId + "." });
      const existingKeys = existingObjects.map(function (object) {
        return object?.key;
      }).filter(Boolean);
      await access.mediaBucket.put(objectKey, file, {
        httpMetadata: {
          contentType: file.type,
        },
      });
      try {
        await callAdminRpc(access.fetchImpl, access.config, "admin_set_word_image", {
          p_word_id: wordId,
          p_image_url: objectKey,
        });
      } catch (error) {
        let rollbackSucceeded = false;

        try {
          await deleteStorageObjects(access.mediaBucket, [objectKey], { batchSize: 1 });
          rollbackSucceeded = true;
        } catch (rollbackError) {
          throw createInconsistentStateError(
            "Database synchronization failed after upload and the new storage object could not be rolled back.",
            {
              objectKey,
              rollbackSucceeded: false,
              rollbackFailure: rollbackError.details || rollbackError.message,
            },
          );
        }

        const syncError = new Error("Database synchronization failed after upload. The new object was rolled back.");
        syncError.code = "MEDIA_SYNC_FAILED";
        syncError.details = {
          objectKey,
          rollbackSucceeded,
        };
        throw syncError;
      }

      const staleKeys = existingKeys.filter(function (existingKey) {
        return existingKey !== objectKey;
      });

      if (staleKeys.length > 0) {
        await deleteStorageObjects(access.mediaBucket, staleKeys);
      }

      return jsonResponse(request, env, {
        ok: true,
        data: {
          wordId,
          imageUrl: objectKey,
          previewUrl: buildMediaPublicUrl(access.config, objectKey),
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      if (error?.code === "STORAGE_DELETE_FAILED") {
        return mapMediaMutationErrorToResponse(request, env, createInconsistentStateError(
          "Upload succeeded, but stale storage objects could not be fully cleaned up.",
          buildInconsistentStateDetails(error.details, {
            wordId,
            objectKey,
          }),
        ));
      }

      return mapMediaMutationErrorToResponse(request, env, error);
    }
  }

  async function handleAdminWordImageDelete(request, env, deps = {}) {
    const access = await requireAdminMediaAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const requestUrl = new URL(request.url);
    const match = new RegExp("^" + access.config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/assets/word-image/(\\d+)$").exec(requestUrl.pathname);
    let wordId;

    try {
      wordId = normalizeWordId(match?.[1]);
      const deletedKeys = await listStorageKeysByPrefix(access.mediaBucket, IMAGE_OBJECT_PREFIX + "/" + wordId + ".");
      await callAdminRpc(access.fetchImpl, access.config, "admin_clear_word_image", {
        p_word_id: wordId,
      });

      try {
        await deleteStorageObjects(access.mediaBucket, deletedKeys);
      } catch (storageError) {
        throw createInconsistentStateError(
          "Database references were cleared, but image storage deletion did not complete.",
          {
            wordId,
          },
        );
      }

      return jsonResponse(request, env, {
        ok: true,
        data: {
          wordId,
          imageUrl: "",
          deletedKey: deletedKeys[0] || null,
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapMediaMutationErrorToResponse(request, env, error);
    }
  }

  async function handleAdminWordAudioUpload(request, env, deps = {}) {
    const access = await requireAdminMediaAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const requestUrl = new URL(request.url);
    const match = new RegExp("^" + access.config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/assets/word-audio/(\\d+)/([^/]+)$").exec(requestUrl.pathname);
    const formData = await readFormData(request);
    let wordId;
    let languageCode;
    let file;
    let objectKey;

    try {
      wordId = normalizeWordId(match?.[1]);
      languageCode = normalizeLanguageCode(match?.[2]);
      file = getUploadedFile(formData);
      objectKey = buildWordAudioKey(wordId, languageCode, file.type);
    } catch (error) {
      return jsonApiError(request, env, 400, "VALIDATION_ERROR", error.message);
    }

    try {
      const existingObjects = await listAllStorageObjects(access.mediaBucket, {
        prefix: AUDIO_OBJECT_PREFIX + "/" + languageCode + "/" + wordId + ".",
      });
      const existingKeys = existingObjects.map(function (object) {
        return object?.key;
      }).filter(Boolean);
      await access.mediaBucket.put(objectKey, file, {
        httpMetadata: {
          contentType: file.type,
        },
      });
      try {
        await callAdminRpc(access.fetchImpl, access.config, "admin_set_word_audio", {
          p_word_id: wordId,
          p_language_code: languageCode,
          p_audio_filename: getStorageObjectBasename(objectKey),
        });
      } catch (error) {
        try {
          await deleteStorageObjects(access.mediaBucket, [objectKey], { batchSize: 1 });
        } catch (rollbackError) {
          throw createInconsistentStateError(
            "Database synchronization failed after upload and the new storage object could not be rolled back.",
            {
              objectKey,
              rollbackSucceeded: false,
              rollbackFailure: rollbackError.details || rollbackError.message,
            },
          );
        }

        const syncError = new Error("Database synchronization failed after upload. The new object was rolled back.");
        syncError.code = "MEDIA_SYNC_FAILED";
        syncError.details = {
          objectKey,
          rollbackSucceeded: true,
        };
        throw syncError;
      }

      const staleKeys = existingKeys.filter(function (existingKey) {
        return existingKey !== objectKey;
      });

      if (staleKeys.length > 0) {
        await deleteStorageObjects(access.mediaBucket, staleKeys);
      }

      return jsonResponse(request, env, {
        ok: true,
        data: {
          wordId,
          languageCode,
          audioFilename: getStorageObjectBasename(objectKey),
          previewUrl: buildMediaPublicUrl(access.config, objectKey),
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      if (error?.code === "STORAGE_DELETE_FAILED") {
        return mapMediaMutationErrorToResponse(request, env, createInconsistentStateError(
          "Upload succeeded, but stale storage objects could not be fully cleaned up.",
          buildInconsistentStateDetails(error.details, {
            wordId,
            languageCode,
            objectKey,
          }),
        ));
      }

      return mapMediaMutationErrorToResponse(request, env, error);
    }
  }

  async function handleAdminWordAudioDelete(request, env, deps = {}) {
    const access = await requireAdminMediaAccess(request, env, deps);

    if (!access.ok) {
      return access.response;
    }

    const requestUrl = new URL(request.url);
    const match = new RegExp("^" + access.config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "/assets/word-audio/(\\d+)/([^/]+)$").exec(requestUrl.pathname);
    let wordId;
    let languageCode;

    try {
      wordId = normalizeWordId(match?.[1]);
      languageCode = normalizeLanguageCode(match?.[2]);
      const deletedKeys = await listStorageKeysByPrefix(access.mediaBucket, AUDIO_OBJECT_PREFIX + "/" + languageCode + "/" + wordId + ".");
      await callAdminRpc(access.fetchImpl, access.config, "admin_clear_word_audio", {
        p_word_id: wordId,
        p_language_code: languageCode,
      });

      try {
        await deleteStorageObjects(access.mediaBucket, deletedKeys);
      } catch (storageError) {
        throw createInconsistentStateError(
          "Database references were cleared, but audio storage deletion did not complete.",
          {
            wordId,
            languageCode,
          },
        );
      }

      return jsonResponse(request, env, {
        ok: true,
        data: {
          wordId,
          languageCode,
          audioFilename: "",
          deletedKey: deletedKeys[0] || null,
        },
      }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
    } catch (error) {
      return mapMediaMutationErrorToResponse(request, env, error);
    }
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
    const escapedAdminBasePath = config.adminApiBasePath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: createCorsHeaders(request, env, adminMethods),
      });
    }

    if (request.method === "GET" && requestUrl.pathname === config.adminApiBasePath + "/dashboard") {
      return handleAdminDashboardRead(request, env, deps);
    }

    if (request.method === "GET" && requestUrl.pathname === config.adminApiBasePath + "/assets/objects") {
      return handleAdminAssetsObjectsList(request, env, deps);
    }

    if (request.method === "DELETE" && requestUrl.pathname === config.adminApiBasePath + "/assets/object") {
      return handleAdminAssetsObjectDelete(request, env, deps);
    }

    if (request.method === "POST" && requestUrl.pathname === config.adminApiBasePath + "/assets/purge") {
      return handleAdminAssetsPurge(request, env, deps);
    }

    const uploadWordImageMatch = new RegExp("^" + escapedAdminBasePath + "/assets/word-image/(\\d+)$").exec(requestUrl.pathname);

    if (request.method === "POST" && uploadWordImageMatch) {
      return handleAdminWordImageUpload(request, env, deps);
    }

    if (request.method === "DELETE" && uploadWordImageMatch) {
      return handleAdminWordImageDelete(request, env, deps);
    }

    const uploadWordAudioMatch = new RegExp("^" + escapedAdminBasePath + "/assets/word-audio/(\\d+)/([^/]+)$").exec(requestUrl.pathname);

    if (request.method === "POST" && uploadWordAudioMatch) {
      return handleAdminWordAudioUpload(request, env, deps);
    }

    if (request.method === "DELETE" && uploadWordAudioMatch) {
      return handleAdminWordAudioDelete(request, env, deps);
    }

    if (request.method === "POST" && requestUrl.pathname === config.adminApiBasePath + "/words") {
      return handleAdminWordCreate(request, env, deps);
    }

    const updateWordMatch = new RegExp("^" + escapedAdminBasePath + "/words/(\\d+)$").exec(requestUrl.pathname);

    if (request.method === "PATCH" && updateWordMatch) {
      return handleAdminWordUpdate(request, env, deps);
    }

    if (request.method === "POST" && requestUrl.pathname === config.adminApiBasePath + "/tags") {
      return handleAdminTagCreate(request, env, deps);
    }

    const updateTagMatch = new RegExp("^" + escapedAdminBasePath + "/tags/(\\d+)$").exec(requestUrl.pathname);

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
    AUDIO_MIME_TYPE_TO_EXTENSION,
    GENERIC_FAILURE_MESSAGE,
    IMAGE_MIME_TYPE_TO_EXTENSION,
    buildGenericFailure,
    buildWordAudioKey,
    buildWordImageKey,
    createCorsHeaders,
    getRequiredConfig,
    getRequiredMediaConfig,
    handleLogin,
    handleAdminApiRequest,
    handleAdminDashboardRead,
    handleAdminTagCreate,
    handleAdminTagDelete,
    handleAdminTagUpdate,
    handleRequest,
    normalizeTagPayload,
    normalizeWordPayload,
    parseStorageObjectKey,
    requireAdminApiAccess,
    resolveAuthenticatedUser,
    resolveAdminAccount,
    resolveAdminUser,
    resolveAuthEmail,
    signInWithEmail,
  };
});

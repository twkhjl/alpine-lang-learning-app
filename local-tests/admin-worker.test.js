const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildWordAudioKey,
  buildWordImageKey,
  GENERIC_FAILURE_MESSAGE,
  getRequiredConfig,
  getRequiredMediaConfig,
  handleRequest,
  parseStorageObjectKey,
} = require("../workers/admin-auth-worker");

function createEnv() {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    ADMIN_AUTH_PATH: "/api/admin/auth/login",
    ADMIN_ALLOWED_ORIGIN: "https://admin.example.com",
    LEXICON_MEDIA_PUBLIC_BASE_URL: "https://media.example.com",
    LEXICON_MEDIA_BUCKET: {},
  };
}

function createMediaEnv(bucketOverrides = {}) {
  return {
    ...createEnv(),
    LEXICON_MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com/media",
    LEXICON_MEDIA_BUCKET: {
      list() {
        return Promise.resolve({ objects: [], truncated: false, cursor: undefined });
      },
      delete() {
        return Promise.resolve();
      },
      put() {
        return Promise.resolve();
      },
      ...bucketOverrides,
    },
  };
}

function createAdminDeps(overrides = {}) {
  return {
    fetchImpl(url) {
      if (url.includes("/auth/v1/user")) {
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({ id: "user-1" });
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

      throw new Error("unexpected fetch call: " + url);
    },
    ...overrides,
  };
}

test("buildWordImageKey maps supported image MIME types to storage keys", () => {
  assert.equal(buildWordImageKey(28, "image/jpeg"), "imgs/28.jpg");
  assert.equal(buildWordImageKey(28, "image/png"), "imgs/28.png");
  assert.equal(buildWordImageKey(28, "image/webp"), "imgs/28.webp");
  assert.equal(buildWordImageKey(28, "image/jpeg; charset=binary"), "imgs/28.jpg");
});

test("buildWordAudioKey maps supported audio MIME types to storage keys", () => {
  assert.equal(buildWordAudioKey(28, "zh-TW", "audio/mpeg"), "audios/zh-TW/28.mp3");
  assert.equal(buildWordAudioKey(28, "id", "audio/wav"), "audios/id/28.wav");
  assert.equal(buildWordAudioKey(28, "en", "audio/ogg"), "audios/en/28.ogg");
  assert.equal(buildWordAudioKey(28, "en", "audio/ogg; codecs=opus"), "audios/en/28.ogg");
});

test("storage key helpers reject unsupported MIME types", () => {
  assert.throws(() => buildWordImageKey(28, "image/gif"), /Unsupported media MIME type/);
  assert.throws(() => buildWordAudioKey(28, "zh-TW", "audio/aac"), /Unsupported media MIME type/);
});

test("parseStorageObjectKey parses supported image and audio keys", () => {
  assert.deepEqual(parseStorageObjectKey("imgs/28.jpg"), {
    mediaType: "image",
    wordId: 28,
    languageCode: null,
    extension: "jpg",
  });

  assert.deepEqual(parseStorageObjectKey("audios/zh-TW/28.mp3"), {
    mediaType: "audio",
    wordId: 28,
    languageCode: "zh-TW",
    extension: "mp3",
  });
});

test("parseStorageObjectKey returns null for unsupported object keys", () => {
  assert.equal(parseStorageObjectKey("imgs/not-a-number.jpg"), null);
  assert.equal(parseStorageObjectKey("audios/fr/28.mp3"), null);
  assert.equal(parseStorageObjectKey("misc/28.txt"), null);
});

test("getRequiredConfig does not require media storage config for non-media routes", () => {
  const config = getRequiredConfig({
    ...createEnv(),
    LEXICON_MEDIA_BUCKET: undefined,
    LEXICON_MEDIA_PUBLIC_BASE_URL: " ",
  });

  assert.equal(config.url, "https://example.supabase.co");
  assert.equal(config.path, "/api/admin/auth/login");
  assert.equal(config.adminApiBasePath, "/api/admin");
});

test("getRequiredMediaConfig fails when media storage config is missing", () => {
  assert.throws(
    () => getRequiredMediaConfig({
      ...createEnv(),
      LEXICON_MEDIA_BUCKET: undefined,
    }),
    /Missing media storage worker configuration/,
  );

  assert.throws(
    () => getRequiredMediaConfig({
      ...createEnv(),
      LEXICON_MEDIA_PUBLIC_BASE_URL: " ",
    }),
    /Missing media storage worker configuration/,
  );
});

test("getRequiredMediaConfig rejects placeholder and invalid media config values", () => {
  assert.throws(
    () => getRequiredMediaConfig({
      ...createEnv(),
      LEXICON_MEDIA_PUBLIC_BASE_URL: "https://media.example.com",
    }),
    /Invalid media storage worker configuration/,
  );

  assert.throws(
    () => getRequiredMediaConfig({
      ...createEnv(),
      LEXICON_MEDIA_PUBLIC_BASE_URL: "ftp://media.example.com/assets",
    }),
    /Invalid media storage worker configuration/,
  );

  assert.throws(
    () => getRequiredMediaConfig({
      ...createEnv(),
      LEXICON_MEDIA_BUCKET: "lexicon-media-placeholder",
      LEXICON_MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com/media",
    }),
    /Invalid media storage worker configuration/,
  );
});

test("worker login route still works when media storage config is absent", async () => {
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
    {
      ...createEnv(),
      LEXICON_MEDIA_BUCKET: undefined,
      LEXICON_MEDIA_PUBLIC_BASE_URL: "",
    },
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

test("worker rejects protected admin write without bearer token", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/words", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        translations: {
          "zh-TW": { text: "桌子", pronunciation: "", audio_filename: "" },
          id: { text: "meja", pronunciation: "", audio_filename: "" },
          en: { text: "table", pronunciation: "", audio_filename: "" },
        },
        tag_ids: [],
      }),
    }),
    createEnv(),
    createAdminDeps(),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "A bearer token is required.",
    },
  });
});

test("worker rejects protected admin write for authenticated non-admin users", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/words", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        translations: {
          "zh-TW": { text: "桌子", pronunciation: "", audio_filename: "" },
          id: { text: "meja", pronunciation: "", audio_filename: "" },
          en: { text: "table", pronunciation: "", audio_filename: "" },
        },
        tag_ids: [],
      }),
    }),
    createEnv(),
    createAdminDeps({
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-2" });
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
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "Admin access is required.",
    },
  });
});

test("worker validates protected word payload before reaching write implementation", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/words", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        translations: {
          "zh-TW": { text: "", pronunciation: "", audio_filename: "" },
          id: { text: "", pronunciation: "", audio_filename: "" },
          en: { text: "", pronunciation: "", audio_filename: "" },
        },
        tag_ids: [1, 1],
      }),
    }),
    createEnv(),
    createAdminDeps(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "At least one translation is required.",
    },
  });
});

test("worker creates a word through admin_create_word RPC", async () => {
  const calls = [];
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/words", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        image_url: " image.jpg ",
        translations: {
          "zh-TW": { text: " 桌子 ", pronunciation: " zhuo zi ", audio_filename: " zh.mp3 " },
          id: { text: " meja ", pronunciation: " me-ja ", audio_filename: " id.mp3 " },
          en: { text: " table ", pronunciation: " tay-buhl ", audio_filename: " en.mp3 " },
        },
        tag_ids: [1, 2],
      }),
    }),
    createEnv(),
    {
      fetchImpl(url, options = {}) {
        calls.push({ url, options });

        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_create_word")) {
          assert.equal(options.method, "POST");
          assert.deepEqual(JSON.parse(options.body), {
            p_image_url: "image.jpg",
            p_translations: {
              "zh-TW": { text: "桌子", pronunciation: "zhuo zi", audio_filename: "zh.mp3" },
              id: { text: "meja", pronunciation: "me-ja", audio_filename: "id.mp3" },
              en: { text: "table", pronunciation: "tay-buhl", audio_filename: "en.mp3" },
            },
            p_tag_ids: [1, 2],
          });

          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({
                id: 28,
                image_url: "image.jpg",
                created_at: "2026-04-26T10:00:00.000Z",
                updated_at: "2026-04-26T10:00:00.000Z",
              });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      id: 28,
      image_url: "image.jpg",
      created_at: "2026-04-26T10:00:00.000Z",
      updated_at: "2026-04-26T10:00:00.000Z",
    },
  });
  assert.equal(calls.length, 3);
});

test("worker returns 404 when updating a missing word", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/words/999", {
      method: "PATCH",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        image_url: "image.jpg",
        translations: {
          "zh-TW": { text: "桌子", pronunciation: "", audio_filename: "" },
          id: { text: "meja", pronunciation: "", audio_filename: "" },
          en: { text: "table", pronunciation: "", audio_filename: "" },
        },
        tag_ids: [],
      }),
    }),
    createEnv(),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_update_word")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve(null);
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "Word not found.",
    },
  });
});

test("worker creates a tag through admin_create_tag RPC", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/tags", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        icon: " sell ",
        translations: {
          "zh-TW": { name: " 家具 " },
          id: { name: " furnitur " },
          en: { name: " furniture " },
        },
      }),
    }),
    createEnv(),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_create_tag")) {
          assert.deepEqual(JSON.parse(options.body), {
            p_icon: "sell",
            p_translations: {
              "zh-TW": { name: "家具" },
              id: { name: "furnitur" },
              en: { name: "furniture" },
            },
          });

          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: 9, icon: "sell" });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      id: 9,
      icon: "sell",
    },
  });
});

test("worker rejects deleting a tag that is still in use", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/tags/4", {
      method: "DELETE",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
    }),
    createEnv(),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_delete_tag")) {
          return Promise.resolve({
            ok: false,
            json() {
              return Promise.resolve({
                code: "P0001",
                message: "Tag is still in use.",
              });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Tag is still in use.",
    },
  });
});

test("worker returns protected dashboard summary data", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/dashboard", {
      method: "GET",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
    }),
    createEnv(),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/lexicon_words_api")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([
                {
                  id: 28,
                  "lang_zh-TW": "桌子",
                  lang_id: "meja",
                  lang_en: "table",
                  tags: [1, 3],
                  audio: { "zh-TW": "zh.mp3", id: "", en: "" },
                },
                {
                  id: 27,
                  "lang_zh-TW": "椅子",
                  lang_id: "kursi",
                  lang_en: "chair",
                  tags: [2],
                  audio: { "zh-TW": "", id: "id.mp3", en: "en.mp3" },
                },
              ]);
            },
          });
        }

        if (url.includes("/rest/v1/words")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([
                {
                  id: 28,
                  image_url: "imgs/table.jpg",
                  created_at: "2026-04-12T09:52:00.000Z",
                  updated_at: "2026-04-26T02:12:00.000Z",
                },
                {
                  id: 27,
                  image_url: "",
                  created_at: "2026-04-10T09:52:00.000Z",
                  updated_at: "2026-04-26T01:12:00.000Z",
                },
              ]);
            },
          });
        }

        if (url.includes("/rest/v1/lexicon_tags_api")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([
                { id: 1 },
                { id: 2 },
                { id: 3 },
              ]);
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      metrics: {
        total_words: 2,
        total_tags: 3,
        words_missing_image: 1,
        missing_audio_words: 2,
      },
      recent_words: [
        {
          id: 28,
          image_url: "imgs/table.jpg",
          lang_zh_tw: "桌子",
          lang_id: "meja",
          lang_en: "table",
          tags: [1, 3],
          audio_languages: ["zh-TW"],
          updated_at: "2026-04-26T02:12:00.000Z",
          created_at: "2026-04-12T09:52:00.000Z",
        },
        {
          id: 27,
          image_url: "",
          lang_zh_tw: "椅子",
          lang_id: "kursi",
          lang_en: "chair",
          tags: [2],
          audio_languages: ["id", "en"],
          updated_at: "2026-04-26T01:12:00.000Z",
          created_at: "2026-04-10T09:52:00.000Z",
        },
      ],
    },
  });
});

test("worker allows origins configured as an array", async () => {
  const env = {
    ...createEnv(),
    ADMIN_ALLOWED_ORIGIN: [
      "https://admin.example.com",
      "https://staging-admin.example.com",
    ],
  };

  const optionsResponse = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "OPTIONS",
      headers: {
        origin: "https://staging-admin.example.com",
      },
    }),
    env,
  );

  assert.equal(optionsResponse.status, 204);
  assert.equal(
    optionsResponse.headers.get("access-control-allow-origin"),
    "https://staging-admin.example.com",
  );

  const postResponse = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "POST",
      headers: {
        origin: "https://staging-admin.example.com",
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
  assert.equal(
    postResponse.headers.get("access-control-allow-origin"),
    "https://staging-admin.example.com",
  );
});

test("worker normalizes configured origins before matching request origin", async () => {
  const env = {
    ...createEnv(),
    ADMIN_ALLOWED_ORIGIN: [
      " https://admin.example.com/portal ",
      "https://staging-admin.example.com:443/login?mode=preview#top",
    ],
  };

  const optionsResponse = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "OPTIONS",
      headers: {
        origin: "https://staging-admin.example.com",
      },
    }),
    env,
  );

  assert.equal(optionsResponse.status, 204);
  assert.equal(
    optionsResponse.headers.get("access-control-allow-origin"),
    "https://staging-admin.example.com",
  );

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
  assert.equal(
    postResponse.headers.get("access-control-allow-origin"),
    "https://admin.example.com",
  );
});

test("worker ignores invalid configured origins instead of matching them loosely", async () => {
  const env = {
    ...createEnv(),
    ADMIN_ALLOWED_ORIGIN: [
      "not-a-url",
      "https://admin.example.com/path",
    ],
  };

  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/auth/login", {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example.com",
      },
    }),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

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

test("worker lists storage objects with db reference summary", async () => {
  const listCalls = [];
  const fetchUrls = [];
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/objects?prefix=imgs/&cursor=cursor-1", {
      method: "GET",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
    }),
    createMediaEnv({
      list(options) {
        listCalls.push(options);
        return Promise.resolve({
          objects: [
            {
              key: "imgs/28.jpg",
              size: 1234,
              uploaded: new Date("2026-05-01T10:00:00.000Z"),
            },
            {
              key: "audios/zh-TW/28.mp3",
              size: 4567,
              uploaded: new Date("2026-05-01T11:00:00.000Z"),
            },
          ],
          truncated: true,
          cursor: "cursor-2",
        });
      },
    }),
    {
      fetchImpl(url) {
        fetchUrls.push(url);
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/words")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([
                { id: 28, image_url: "imgs/28.jpg" },
              ]);
            },
          });
        }

        if (url.includes("/rest/v1/word_translations")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([
                { word_id: 28, language_code: "zh-TW", audio_filename: "audios/zh-TW/28.mp3" },
              ]);
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(listCalls, [{ prefix: "imgs/", cursor: "cursor-1" }]);
  const decodedFetchUrls = fetchUrls.map((url) => decodeURIComponent(url));
  assert.ok(decodedFetchUrls.some((url) => url.includes("/rest/v1/words") && url.includes("id=in.(28)")));
  assert.ok(decodedFetchUrls.some((url) => url.includes("/rest/v1/word_translations") && url.includes("word_id=in.(28)")));
  assert.ok(decodedFetchUrls.every((url) => !url.includes("id=in.(999)")));
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      items: [
        {
          key: "imgs/28.jpg",
          type: "image",
          languageCode: null,
          wordId: 28,
          size: 1234,
          uploadedAt: "2026-05-01T10:00:00.000Z",
          dbReferenced: true,
          previewUrl: "https://cdn.example.com/media/imgs/28.jpg",
        },
        {
          key: "audios/zh-TW/28.mp3",
          type: "audio",
          languageCode: "zh-TW",
          wordId: 28,
          size: 4567,
          uploadedAt: "2026-05-01T11:00:00.000Z",
          dbReferenced: true,
          previewUrl: "https://cdn.example.com/media/audios/zh-TW/28.mp3",
        },
      ],
      summary: {
        objectCount: 2,
        imageCount: 1,
        audioCount: 1,
        referencedCount: 2,
        orphanedCount: 0,
      },
      cursor: "cursor-2",
      truncated: true,
    },
  });
});

test("worker deletes a single image object and clears words.image_url through RPC", async () => {
  const deletedKeys = [];
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/object", {
      method: "DELETE",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ key: "imgs/28.jpg" }),
    }),
    createMediaEnv({
      delete(key) {
        deletedKeys.push(key);
        return Promise.resolve();
      },
    }),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/words")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([{ id: 28, image_url: "imgs/28.jpg" }]);
            },
          });
        }

        if (url.includes("/rest/v1/rpc/admin_clear_word_image")) {
          assert.deepEqual(JSON.parse(options.body), {
            p_word_id: 28,
          });

          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ word_id: 28, image_url: "" });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(deletedKeys, ["imgs/28.jpg"]);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      deletedKey: "imgs/28.jpg",
      affectedWordId: 28,
      affectedLanguageCode: null,
      dbCleared: true,
    },
  });
});

test("worker deletes a single audio object and clears audio_filename through RPC", async () => {
  const deletedKeys = [];
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/object", {
      method: "DELETE",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ key: "audios/id/31.ogg" }),
    }),
    createMediaEnv({
      delete(key) {
        deletedKeys.push(key);
        return Promise.resolve();
      },
    }),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/word_translations")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([{ word_id: 31, language_code: "id", audio_filename: "audios/id/31.ogg" }]);
            },
          });
        }

        if (url.includes("/rest/v1/rpc/admin_clear_word_audio")) {
          assert.deepEqual(JSON.parse(options.body), {
            p_word_id: 31,
            p_language_code: "id",
          });

          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ word_id: 31, language_code: "id", audio_filename: "" });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(deletedKeys, ["audios/id/31.ogg"]);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      deletedKey: "audios/id/31.ogg",
      affectedWordId: 31,
      affectedLanguageCode: "id",
      dbCleared: true,
    },
  });
});

test("worker deletes stale image object without clearing words.image_url", async () => {
  const deletedKeys = [];
  let rpcCalled = false;
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/object", {
      method: "DELETE",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ key: "imgs/28.jpg" }),
    }),
    createMediaEnv({
      delete(key) {
        deletedKeys.push(key);
        return Promise.resolve();
      },
    }),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/words")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([{ id: 28, image_url: "imgs/999.jpg" }]);
            },
          });
        }

        if (url.includes("/rest/v1/rpc/")) {
          rpcCalled = true;
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(rpcCalled, false);
  assert.deepEqual(deletedKeys, ["imgs/28.jpg"]);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      deletedKey: "imgs/28.jpg",
      affectedWordId: 28,
      affectedLanguageCode: null,
      dbCleared: false,
    },
  });
});

test("worker deletes stale audio object without clearing audio_filename", async () => {
  const deletedKeys = [];
  let rpcCalled = false;
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/object", {
      method: "DELETE",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ key: "audios/id/31.ogg" }),
    }),
    createMediaEnv({
      delete(key) {
        deletedKeys.push(key);
        return Promise.resolve();
      },
    }),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/word_translations")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([{ word_id: 31, language_code: "id", audio_filename: "31.mp3" }]);
            },
          });
        }

        if (url.includes("/rest/v1/rpc/")) {
          rpcCalled = true;
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(rpcCalled, false);
  assert.deepEqual(deletedKeys, ["audios/id/31.ogg"]);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      deletedKey: "audios/id/31.ogg",
      affectedWordId: 31,
      affectedLanguageCode: "id",
      dbCleared: false,
    },
  });
});

test("worker rejects purge when confirmText is incorrect", async () => {
  let rpcCalled = false;
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/purge", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmText: "delete all r2 objects" }),
    }),
    createMediaEnv({
      list() {
        throw new Error("list should not be called");
      },
      delete() {
        throw new Error("delete should not be called");
      },
    }),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/")) {
          rpcCalled = true;
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(rpcCalled, false);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Confirmation text does not match.",
    },
  });
});

test("worker purges all storage objects and clears database references through RPC", async () => {
  const deletedKeys = [];
  const listCalls = [];
  let inFlightDeletes = 0;
  let maxInFlightDeletes = 0;
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/purge", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmText: "DELETE ALL R2 OBJECTS" }),
    }),
    createMediaEnv({
      list(options = {}) {
        listCalls.push(options);

        if (!options.cursor) {
          return Promise.resolve({
            objects: Array.from({ length: 20 }, function (_, index) {
              return { key: "imgs/" + (index + 1) + ".jpg" };
            }),
            truncated: true,
            cursor: "page-2",
          });
        }

        assert.equal(options.cursor, "page-2");
        return Promise.resolve({
          objects: Array.from({ length: 17 }, function (_, index) {
            return { key: "audios/en/" + (index + 21) + ".mp3" };
          }),
          truncated: false,
          cursor: undefined,
        });
      },
      delete(key) {
        inFlightDeletes += 1;
        maxInFlightDeletes = Math.max(maxInFlightDeletes, inFlightDeletes);

        return new Promise((resolve) => {
          setTimeout(function () {
            deletedKeys.push(key);
            inFlightDeletes -= 1;
            resolve();
          }, 5);
        });
      },
    }),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_purge_media_references")) {
          assert.deepEqual(JSON.parse(options.body), {});
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({
                cleared_image_count: 1,
                cleared_audio_count: 1,
              });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(listCalls, [
    {},
    { cursor: "page-2" },
  ]);
  assert.equal(deletedKeys.length, 37);
  assert.ok(maxInFlightDeletes <= 25);
  assert.ok(maxInFlightDeletes > 1);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      deletedObjectCount: 37,
      clearedImageCount: 1,
      clearedAudioCount: 1,
    },
  });
});

test("worker rejects protected assets routes without bearer token", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/objects", {
      method: "GET",
      headers: {
        origin: "https://admin.example.com",
      },
    }),
    createMediaEnv(),
    createAdminDeps(),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "A bearer token is required.",
    },
  });
});

test("worker uploads a word image to R2 and syncs image_url through RPC", async () => {
  const putCalls = [];
  const formData = new FormData();
  formData.set("file", new File(["image-binary"], "word.webp", { type: "image/webp" }));

  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/word-image/28", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
      body: formData,
    }),
    createMediaEnv({
      put(key, value, options) {
        putCalls.push({
          key,
          type: value.type,
          httpMetadata: options.httpMetadata,
        });
        return Promise.resolve();
      },
      list() {
        return Promise.resolve({ objects: [], truncated: false, cursor: undefined });
      },
    }),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_set_word_image")) {
          assert.deepEqual(JSON.parse(options.body), {
            p_word_id: 28,
            p_image_url: "imgs/28.webp",
          });

          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ word_id: 28, image_url: "imgs/28.webp" });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(putCalls, [
    {
      key: "imgs/28.webp",
      type: "image/webp",
      httpMetadata: {
        contentType: "image/webp",
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      wordId: 28,
      imageUrl: "imgs/28.webp",
      previewUrl: "https://cdn.example.com/media/imgs/28.webp",
    },
  });
});

test("worker uploads word audio to R2 and syncs audio_filename through RPC", async () => {
  const putCalls = [];
  const formData = new FormData();
  formData.set("file", new File(["audio-binary"], "word.mp3", { type: "audio/mpeg" }));

  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/word-audio/28/en", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
      body: formData,
    }),
    createMediaEnv({
      put(key, value, options) {
        putCalls.push({
          key,
          type: value.type,
          httpMetadata: options.httpMetadata,
        });
        return Promise.resolve();
      },
      list() {
        return Promise.resolve({ objects: [], truncated: false, cursor: undefined });
      },
    }),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_set_word_audio")) {
          assert.deepEqual(JSON.parse(options.body), {
            p_word_id: 28,
            p_language_code: "en",
            p_audio_filename: "28.mp3",
          });

          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({
                word_id: 28,
                language_code: "en",
                audio_filename: "28.mp3",
              });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(putCalls, [
    {
      key: "audios/en/28.mp3",
      type: "audio/mpeg",
      httpMetadata: {
        contentType: "audio/mpeg",
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      wordId: 28,
      languageCode: "en",
      audioFilename: "28.mp3",
      previewUrl: "https://cdn.example.com/media/audios/en/28.mp3",
    },
  });
});

test("worker marks image delete as inconsistent when storage delete fails after db clear", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/word-image/28", {
      method: "DELETE",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
    }),
    createMediaEnv({
      list() {
        return Promise.resolve({
          objects: [{ key: "imgs/28.jpg" }],
          truncated: false,
          cursor: undefined,
        });
      },
      delete() {
        return Promise.reject(new Error("bucket delete failed"));
      },
    }),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_clear_word_image")) {
          assert.deepEqual(JSON.parse(options.body), { p_word_id: 28 });
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ word_id: 28, image_url: "" });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "INCONSISTENT_STATE",
      message: "Database references were cleared, but image storage deletion did not complete.",
      details: {
        wordId: 28,
      },
    },
  });
});

test("worker marks audio delete as inconsistent when storage delete fails after db clear", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/word-audio/28/en", {
      method: "DELETE",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
    }),
    createMediaEnv({
      list() {
        return Promise.resolve({
          objects: [{ key: "audios/en/28.mp3" }],
          truncated: false,
          cursor: undefined,
        });
      },
      delete() {
        return Promise.reject(new Error("bucket delete failed"));
      },
    }),
    {
      fetchImpl(url, options = {}) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_clear_word_audio")) {
          assert.deepEqual(JSON.parse(options.body), {
            p_word_id: 28,
            p_language_code: "en",
          });
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ word_id: 28, language_code: "en", audio_filename: "" });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "INCONSISTENT_STATE",
      message: "Database references were cleared, but audio storage deletion did not complete.",
      details: {
        wordId: 28,
        languageCode: "en",
      },
    },
  });
});

test("worker lists storage objects with legacy reference formats, language-safe audio matching, and unknown objects counted in summary", async () => {
  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/objects", {
      method: "GET",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
    }),
    createMediaEnv({
      list() {
        return Promise.resolve({
          objects: [
            {
              key: "imgs/28.jpg",
              size: 111,
              uploaded: new Date("2026-05-01T10:00:00.000Z"),
            },
            {
              key: "audios/en/28.mp3",
              size: 222,
              uploaded: new Date("2026-05-01T11:00:00.000Z"),
            },
            {
              key: "audios/id/28.mp3",
              size: 223,
              uploaded: new Date("2026-05-01T11:30:00.000Z"),
            },
            {
              key: "misc/unknown.bin",
              size: 333,
              uploaded: new Date("2026-05-01T12:00:00.000Z"),
            },
          ],
          truncated: false,
          cursor: undefined,
        });
      },
    }),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/words")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([
                { id: 28, image_url: "https://cdn.example.com/media/imgs/28.jpg" },
              ]);
            },
          });
        }

        if (url.includes("/rest/v1/word_translations")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve([
                { word_id: 28, language_code: "en", audio_filename: "28.mp3" },
                { word_id: 28, language_code: "id", audio_filename: "28.wav" },
              ]);
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      items: [
        {
          key: "imgs/28.jpg",
          type: "image",
          languageCode: null,
          wordId: 28,
          size: 111,
          uploadedAt: "2026-05-01T10:00:00.000Z",
          dbReferenced: true,
          previewUrl: "https://cdn.example.com/media/imgs/28.jpg",
        },
        {
          key: "audios/en/28.mp3",
          type: "audio",
          languageCode: "en",
          wordId: 28,
          size: 222,
          uploadedAt: "2026-05-01T11:00:00.000Z",
          dbReferenced: true,
          previewUrl: "https://cdn.example.com/media/audios/en/28.mp3",
        },
        {
          key: "audios/id/28.mp3",
          type: "audio",
          languageCode: "id",
          wordId: 28,
          size: 223,
          uploadedAt: "2026-05-01T11:30:00.000Z",
          dbReferenced: false,
          previewUrl: "https://cdn.example.com/media/audios/id/28.mp3",
        },
      ],
      summary: {
        objectCount: 4,
        imageCount: 1,
        audioCount: 2,
        referencedCount: 2,
        orphanedCount: 2,
      },
      cursor: null,
      truncated: false,
    },
  });
});

test("worker rolls back uploaded image object when RPC sync fails", async () => {
  const bucketEvents = [];
  const formData = new FormData();
  formData.set("file", new File(["image-binary"], "word.webp", { type: "image/webp" }));

  const response = await handleRequest(
    new Request("https://worker.example.com/api/admin/assets/word-image/28", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        authorization: "Bearer access-token",
      },
      body: formData,
    }),
    createMediaEnv({
      list(options = {}) {
        bucketEvents.push({ type: "list", options });
        return Promise.resolve({
          objects: [{ key: "imgs/28.jpg" }],
          truncated: false,
          cursor: undefined,
        });
      },
      put(key) {
        bucketEvents.push({ type: "put", key });
        return Promise.resolve();
      },
      delete(key) {
        bucketEvents.push({ type: "delete", key });
        return Promise.resolve();
      },
    }),
    {
      fetchImpl(url) {
        if (url.includes("/auth/v1/user")) {
          return Promise.resolve({
            ok: true,
            json() {
              return Promise.resolve({ id: "user-1" });
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

        if (url.includes("/rest/v1/rpc/admin_set_word_image")) {
          return Promise.resolve({
            ok: false,
            json() {
              return Promise.resolve({
                code: "P0001",
                message: "sync failed",
              });
            },
          });
        }

        throw new Error("unexpected fetch call: " + url);
      },
    },
  );

  assert.equal(response.status, 502);
  assert.deepEqual(bucketEvents, [
    { type: "list", options: { prefix: "imgs/28." } },
    { type: "put", key: "imgs/28.webp" },
    { type: "delete", key: "imgs/28.webp" },
  ]);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "MEDIA_SYNC_FAILED",
      message: "Database synchronization failed after upload. The new object was rolled back.",
      details: {
        objectKey: "imgs/28.webp",
        rollbackSucceeded: true,
      },
    },
  });
});

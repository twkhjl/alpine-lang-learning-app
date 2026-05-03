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

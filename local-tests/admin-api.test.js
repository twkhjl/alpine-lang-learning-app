const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildProtectedRequest,
  callProtectedEndpoint,
  createWord,
  deleteStorageObject,
  deleteWordAudio,
  deleteWordImage,
  filterAssetReferences,
  getProtectedAccessToken,
  loadAssetReferences,
  loadDashboardSummary,
  loadWordDetail,
  loadWordList,
  listStorageObjects,
  normalizeWordPayload,
  purgeStorageObjects,
  uploadWordAudio,
  uploadWordImage,
} = require("../public/assets/js/admin-api");

function createQueryResult(rows) {
  return {
    order() {
      return this;
    },
    then(resolve) {
      return resolve({ data: rows, error: null });
    },
  };
}

function createClient(tableMap) {
  return {
    from(tableName) {
      return {
        select() {
          return createQueryResult(tableMap[tableName] || []);
        },
      };
    },
  };
}

test("buildProtectedRequest attaches authorization header when token provided", () => {
  const req = buildProtectedRequest("/api/admin/words", "tok-123", {
    method: "POST",
    body: { foo: "bar" },
  });
  assert.equal(req.headers.get("authorization"), "Bearer tok-123");
  assert.equal(req.headers.get("content-type"), "application/json");
  assert.equal(req.method, "POST");
});

test("buildProtectedRequest omits authorization header when no token", () => {
  const req = buildProtectedRequest("/api/admin/words", null, {
    method: "POST",
    body: { foo: "bar" },
  });
  assert.equal(req.headers.get("authorization"), null);
});

test("buildProtectedRequest preserves FormData bodies without forcing json content-type", async () => {
  const formData = new FormData();
  formData.set("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  const req = buildProtectedRequest("/api/admin/assets/word-audio/28/en", "tok-123", {
    method: "POST",
    body: formData,
  });

  assert.equal(req.headers.get("authorization"), "Bearer tok-123");
  assert.match(req.headers.get("content-type") || "", /^multipart\/form-data;\s*boundary=/);
  assert.equal(req.method, "POST");
  const parsedFormData = await req.formData();
  assert.equal(parsedFormData.get("file").name, "sample.mp3");
});

test("getProtectedAccessToken rejects when admin session token is missing", async () => {
  await assert.rejects(
    getProtectedAccessToken(
      {},
      {
        lexiconAdminAuth: {
          getAdminSession() {
            return Promise.resolve(null);
          },
        },
      },
    ),
    function (error) {
      assert.equal(error.code, "UNAUTHORIZED");
      assert.equal(error.message, "An active admin session is required.");
      return true;
    },
  );
});

test("normalizeWordPayload rejects invalid payload before network calls", () => {
  assert.throws(
    function () {
      normalizeWordPayload({
        translations: {
          "zh-TW": { text: "", pronunciation: "", audio_filename: "" },
          id: { text: "", pronunciation: "", audio_filename: "" },
          en: { text: "", pronunciation: "", audio_filename: "" },
        },
        tag_ids: [1, 1],
      });
    },
    function (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.message, "At least one translation is required.");
      return true;
    },
  );
});

test("createWord rejects invalid payload before fetch", async () => {
  let fetchCalls = 0;

  await assert.rejects(
    createWord(
      {},
      {
        translations: {
          "zh-TW": { text: "", pronunciation: "", audio_filename: "" },
          id: { text: "", pronunciation: "", audio_filename: "" },
          en: { text: "", pronunciation: "", audio_filename: "" },
        },
        tag_ids: [],
      },
      {
        globalObject: {
          lexiconAdminAuth: {
            getAdminSession() {
              return Promise.resolve({ access_token: "token" });
            },
          },
        },
        fetch() {
          fetchCalls += 1;
          throw new Error("fetch should not be called");
        },
      },
    ),
    function (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );

  assert.equal(fetchCalls, 0);
});

test("callProtectedEndpoint maps worker error payloads to thrown errors", async () => {
  await assert.rejects(
    callProtectedEndpoint(
      {},
      "/words",
      {
        method: "POST",
        body: { sample: true },
        globalObject: {
          lexiconAdminAuth: {
            getAdminSession() {
              return Promise.resolve({ access_token: "token" });
            },
          },
          fetch() {
            return Promise.resolve({
              ok: false,
              json() {
                return Promise.resolve({
                  ok: false,
                  error: {
                    code: "VALIDATION_ERROR",
                    message: "At least one translation is required.",
                  },
                });
              },
            });
          },
        },
      },
    ),
    function (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.message, "At least one translation is required.");
      return true;
    },
  );
});

test("createWord propagates bearer token to protected worker calls", async () => {
  let capturedRequest = null;

  const result = await createWord(
    {},
    {
      image_url: " image.jpg ",
      translations: {
        "zh-TW": { text: " 桌子 ", pronunciation: " zhuo zi ", audio_filename: " zh.mp3 " },
        id: { text: " meja ", pronunciation: " me-ja ", audio_filename: " id.mp3 " },
        en: { text: " table ", pronunciation: " tay-buhl ", audio_filename: " en.mp3 " },
      },
      tag_ids: [1, 2],
    },
    {
      globalObject: {
        lexiconAdminAuth: {
          getAdminSession() {
            return Promise.resolve({ access_token: "access-token" });
          },
        },
      },
      apiBaseUrl: "https://worker.example.com/api/admin",
      fetch(request) {
        capturedRequest = request;
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({ ok: true, data: { id: 28 } });
          },
        });
      },
    },
  );

  assert.deepEqual(result, { id: 28 });
  assert.equal(capturedRequest.headers.get("authorization"), "Bearer access-token");
  assert.equal(capturedRequest.url, "https://worker.example.com/api/admin/words");
});

test("listStorageObjects forwards prefix and cursor to the protected assets endpoint", async () => {
  let capturedRequest = null;

  const result = await listStorageObjects(
    {},
    {
      prefix: "imgs/",
      cursor: "cursor-2",
    },
    {
      globalObject: {
        lexiconAdminAuth: {
          getAdminSession() {
            return Promise.resolve({ access_token: "access-token" });
          },
        },
      },
      apiBaseUrl: "https://worker.example.com/api/admin",
      fetch(request) {
        capturedRequest = request;
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({ ok: true, data: { items: [], cursor: null, truncated: false } });
          },
        });
      },
    },
  );

  assert.deepEqual(result, { items: [], cursor: null, truncated: false });
  assert.equal(capturedRequest.url, "https://worker.example.com/api/admin/assets/objects?prefix=imgs%2F&cursor=cursor-2");
  assert.equal(capturedRequest.method, "GET");
});

test("deleteStorageObject posts a delete request with the target key", async () => {
  let capturedRequest = null;

  const result = await deleteStorageObject(
    {},
    "imgs/28.webp",
    {
      globalObject: {
        lexiconAdminAuth: {
          getAdminSession() {
            return Promise.resolve({ access_token: "access-token" });
          },
        },
      },
      apiBaseUrl: "https://worker.example.com/api/admin",
      fetch(request) {
        capturedRequest = request;
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({ ok: true, data: { deletedKey: "imgs/28.webp" } });
          },
        });
      },
    },
  );

  assert.deepEqual(result, { deletedKey: "imgs/28.webp" });
  assert.equal(capturedRequest.method, "DELETE");
});

test("purgeStorageObjects validates and sends confirm text", async () => {
  await assert.rejects(
    purgeStorageObjects({}, "   ", {}),
    function (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );

  let capturedRequest = null;
  const result = await purgeStorageObjects(
    {},
    "DELETE ALL R2 OBJECTS",
    {
      globalObject: {
        lexiconAdminAuth: {
          getAdminSession() {
            return Promise.resolve({ access_token: "access-token" });
          },
        },
      },
      apiBaseUrl: "https://worker.example.com/api/admin",
      fetch(request) {
        capturedRequest = request;
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({ ok: true, data: { deletedObjectCount: 4 } });
          },
        });
      },
    },
  );

  assert.deepEqual(result, { deletedObjectCount: 4 });
  assert.equal(capturedRequest.method, "POST");
});

test("uploadWordImage sends multipart form data to the protected endpoint", async () => {
  let capturedRequest = null;

  const result = await uploadWordImage(
    {},
    28,
    new File(["img"], "cover.webp", { type: "image/webp" }),
    {
      globalObject: {
        lexiconAdminAuth: {
          getAdminSession() {
            return Promise.resolve({ access_token: "access-token" });
          },
        },
      },
      apiBaseUrl: "https://worker.example.com/api/admin",
      fetch(request) {
        capturedRequest = request;
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({ ok: true, data: { imageUrl: "imgs/28.webp" } });
          },
        });
      },
    },
  );

  assert.deepEqual(result, { imageUrl: "imgs/28.webp" });
  assert.equal(capturedRequest.method, "POST");
  assert.match(capturedRequest.headers.get("content-type") || "", /^multipart\/form-data;\s*boundary=/);
  const parsedFormData = await capturedRequest.formData();
  assert.equal(parsedFormData.get("file").name, "cover.webp");
});

test("uploadWordAudio and deleteWordMedia validate ids and languages", async () => {
  await assert.rejects(
    uploadWordAudio({}, 0, "en", new File(["audio"], "voice.mp3", { type: "audio/mpeg" }), {}),
    function (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );

  await assert.rejects(
    deleteWordAudio({}, 28, "jp", {}),
    function (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );

  await assert.rejects(
    deleteWordImage({}, "abc", {}),
    function (error) {
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );
});

test("loadWordList filters, sorts, and paginates browser-direct word reads", async () => {
  const client = createClient({
    lexicon_words_api: [
      {
        id: 1,
        "lang_zh-TW": "桌子",
        lang_id: "meja",
        lang_en: "table",
        img: "image-1.jpg",
        audio: { "zh-TW": "zh-1.mp3", id: "", en: "" },
        tags: [1, 3],
      },
      {
        id: 2,
        "lang_zh-TW": "椅子",
        lang_id: "kursi",
        lang_en: "chair",
        img: "",
        audio: { "zh-TW": "", id: "", en: "" },
        tags: [2],
      },
    ],
    words: [
      { id: 1, image_url: "image-1.jpg", created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-26T10:00:00.000Z" },
      { id: 2, image_url: "", created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-25T10:00:00.000Z" },
    ],
  });

  const result = await loadWordList(client, {
    q: "桌",
    tagId: 1,
    hasImage: true,
    hasAudio: true,
    page: 1,
    pageSize: 25,
  });

  assert.deepEqual(result, {
    ok: true,
    data: {
      items: [
        {
          id: 1,
          image_url: "image-1.jpg",
          lang_zh_tw: "桌子",
          lang_id: "meja",
          lang_en: "table",
          tags: [1, 3],
          has_image: true,
          audio_languages: ["zh-TW"],
          updated_at: "2026-04-26T10:00:00.000Z",
          created_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    },
  });
});

test("loadWordDetail returns canonical edit payload", async () => {
  const client = createClient({
    words: [
      { id: 28, image_url: "imgs/202604120952.jpg", created_at: "2026-04-12T09:52:00.000Z", updated_at: "2026-04-26T02:12:00.000Z" },
    ],
    word_translations: [
      { word_id: 28, language_code: "zh-TW", text: "桌子", pronunciation: "zhuo zi", audio_filename: "audios/zh-TW/table.mp3" },
      { word_id: 28, language_code: "id", text: "meja", pronunciation: "me-ja", audio_filename: "audios/id/meja.mp3" },
      { word_id: 28, language_code: "en", text: "table", pronunciation: "tei-buhl", audio_filename: "" },
    ],
    word_tags: [
      { word_id: 28, tag_id: 1 },
      { word_id: 28, tag_id: 3 },
    ],
  });

  const result = await loadWordDetail(client, 28);

  assert.deepEqual(result, {
    ok: true,
    data: {
      id: 28,
      image_url: "imgs/202604120952.jpg",
      translations: {
        "zh-TW": { text: "桌子", pronunciation: "zhuo zi", audio_filename: "audios/zh-TW/table.mp3" },
        id: { text: "meja", pronunciation: "me-ja", audio_filename: "audios/id/meja.mp3" },
        en: { text: "table", pronunciation: "tei-buhl", audio_filename: "" },
      },
      tag_ids: [1, 3],
      created_at: "2026-04-12T09:52:00.000Z",
      updated_at: "2026-04-26T02:12:00.000Z",
    },
  });
});

test("loadDashboardSummary computes metrics and recent words from browser reads", async () => {
  const client = createClient({
    lexicon_words_api: [
      {
        id: 1,
        "lang_zh-TW": "桌子",
        lang_id: "meja",
        lang_en: "table",
        img: "image-1.jpg",
        audio: { "zh-TW": "zh-1.mp3", id: "", en: "" },
        tags: [1],
      },
      {
        id: 2,
        "lang_zh-TW": "椅子",
        lang_id: "kursi",
        lang_en: "chair",
        img: "",
        audio: { "zh-TW": "", id: "", en: "" },
        tags: [2],
      },
    ],
    words: [
      { id: 1, image_url: "image-1.jpg", created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-26T10:00:00.000Z" },
      { id: 2, image_url: "", created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-25T10:00:00.000Z" },
    ],
    lexicon_tags_api: [
      { id: 1, icon: "sell", name_zh_tw: "家具", name_id: "furnitur", name_en: "furniture" },
      { id: 2, icon: "sell", name_zh_tw: "日常", name_id: "harian", name_en: "daily" },
    ],
    word_tags: [
      { word_id: 1, tag_id: 1 },
      { word_id: 2, tag_id: 2 },
    ],
  });

  const result = await loadDashboardSummary(client);

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.metrics, {
    total_words: 2,
    total_tags: 2,
    words_missing_image: 1,
    missing_audio_words: 2,
  });
  assert.equal(result.data.recent_words.length, 2);
  assert.equal(result.data.recent_words[0].id, 1);
});

test("loadAssetReferences deduplicates references and keeps word labels", async () => {
  const client = createClient({
    lexicon_words_api: [
      {
        id: 1,
        "lang_zh-TW": "桌子",
        lang_id: "meja",
        lang_en: "table",
        img: "imgs/table.jpg",
        audio: { "zh-TW": "audios/zh-TW/table.mp3", id: "", en: "" },
      },
      {
        id: 2,
        "lang_zh-TW": "書桌",
        lang_id: "meja belajar",
        lang_en: "desk",
        img: "imgs/table.jpg",
        audio: { "zh-TW": "audios/zh-TW/table.mp3", id: "audios/id/meja.mp3", en: "" },
      },
    ],
  });

  const result = await loadAssetReferences(client);

  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 3);
  assert.deepEqual(result.data.items[0], {
    type: "audio",
    language_code: "id",
    path: "audios/id/meja.mp3",
    referenced_by_words: [{ id: 2, label: "書桌" }],
  });
  assert.deepEqual(result.data.items[1], {
    type: "audio",
    language_code: "zh-TW",
    path: "audios/zh-TW/table.mp3",
    referenced_by_words: [
      { id: 1, label: "桌子" },
      { id: 2, label: "書桌" },
    ],
  });
});

test("filterAssetReferences supports search type and language filters", () => {
  const items = [
    {
      type: "image",
      language_code: null,
      path: "imgs/table.jpg",
      referenced_by_words: [{ id: 1, label: "桌子" }],
    },
    {
      type: "audio",
      language_code: "id",
      path: "audios/id/meja.mp3",
      referenced_by_words: [{ id: 1, label: "桌子" }],
    },
  ];

  assert.deepEqual(filterAssetReferences(items, { type: "image" }), [items[0]]);
  assert.deepEqual(filterAssetReferences(items, { type: "audio", languageCode: "id" }), [items[1]]);
  assert.deepEqual(filterAssetReferences(items, { q: "meja" }), [items[1]]);
});

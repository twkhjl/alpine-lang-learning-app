# Admin Media R2 Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓後台支援 Cloudflare R2 媒體 CRUD、整桶清空與 DB 同步清空，並把單字編輯頁從手填媒體欄位改成可直接操作圖片與音檔。

**Architecture:** 以既有 `workers/admin-auth-worker.js` 為唯一受保護後端入口，新增 R2 list/put/delete/purge API，前端透過 `public/assets/js/admin-api.js` 封裝請求，再分別接到 `admin-assets` 與 `admin-word-edit`。資料模型維持 `words.image_url` 與 `word_translations.audio_filename`，只改寫入流程與 UI 呈現。

**Tech Stack:** Alpine-less vanilla JS、Cloudflare Workers、Cloudflare R2、Supabase REST/RPC、Node built-in test runner

---

### Task 1: 建立 R2 binding 與 Worker 媒體核心 helper

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `workers/admin-auth-worker.js`
- Test: `local-tests/admin-worker.test.js`

- [ ] **Step 1: 先寫 Worker helper 的失敗測試**

```js
test("buildWordImageKey returns normalized image key", () => {
  assert.equal(workerApi.buildWordImageKey(28, "image/jpeg"), "imgs/28.jpg");
  assert.equal(workerApi.buildWordImageKey(7, "image/webp"), "imgs/7.webp");
});

test("buildWordAudioKey returns normalized audio key", () => {
  assert.equal(workerApi.buildWordAudioKey(28, "zh-TW", "audio/mpeg"), "audios/zh-TW/28.mp3");
  assert.equal(workerApi.buildWordAudioKey(28, "id", "audio/ogg"), "audios/id/28.ogg");
});

test("parseStorageObjectKey identifies image and audio keys", () => {
  assert.deepEqual(workerApi.parseStorageObjectKey("imgs/28.jpg"), {
    type: "image",
    wordId: 28,
    languageCode: null,
  });

  assert.deepEqual(workerApi.parseStorageObjectKey("audios/en/28.mp3"), {
    type: "audio",
    wordId: 28,
    languageCode: "en",
  });
});
```

- [ ] **Step 2: 執行測試確認目前失敗**

Run: `node --test local-tests/admin-worker.test.js`
Expected: FAIL with missing exports such as `buildWordImageKey`, `buildWordAudioKey`, or `parseStorageObjectKey`

- [ ] **Step 3: 在 Worker 實作媒體命名、驗證與 key 解析 helper**

```js
const IMAGE_MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const AUDIO_MIME_TO_EXT = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

function buildWordImageKey(wordId, mimeType) {
  const ext = IMAGE_MIME_TO_EXT[mimeType];
  if (!ext) {
    throw new Error("Unsupported image type.");
  }
  return `imgs/${Number(wordId)}.${ext}`;
}

function buildWordAudioKey(wordId, languageCode, mimeType) {
  const ext = AUDIO_MIME_TO_EXT[mimeType];
  if (!ext || !SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
    throw new Error("Unsupported audio type.");
  }
  return `audios/${languageCode}/${Number(wordId)}.${ext}`;
}

function parseStorageObjectKey(key) {
  const imageMatch = /^imgs\/(\d+)\.(jpg|png|webp)$/i.exec(key);
  if (imageMatch) {
    return { type: "image", wordId: Number(imageMatch[1]), languageCode: null };
  }

  const audioMatch = /^audios\/(zh-TW|id|en)\/(\d+)\.(mp3|wav|ogg)$/i.exec(key);
  if (audioMatch) {
    return { type: "audio", wordId: Number(audioMatch[2]), languageCode: audioMatch[1] };
  }

  return null;
}
```

- [ ] **Step 4: 加入 R2 binding 與環境驗證**

```jsonc
{
  "r2_buckets": [
    {
      "binding": "LEXICON_MEDIA_BUCKET",
      "bucket_name": "YOUR_BUCKET_NAME"
    }
  ]
}
```

```js
function getRequiredConfig(env = {}) {
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !publishableKey || !env.LEXICON_MEDIA_PUBLIC_BASE_URL) {
    throw new Error("Missing Supabase worker configuration.");
  }

  if (!env.LEXICON_MEDIA_BUCKET) {
    throw new Error("Missing R2 bucket binding.");
  }

  return {
    // existing fields...
    mediaPublicBaseUrl: env.LEXICON_MEDIA_PUBLIC_BASE_URL.replace(/\/$/, ""),
  };
}
```

- [ ] **Step 5: 匯出 helper 並補測試**

Run: `node --test local-tests/admin-worker.test.js`
Expected: PASS for helper tests

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc workers/admin-auth-worker.js local-tests/admin-worker.test.js
git commit -m "feat: add R2 media key helpers and worker binding"
```

### Task 2: 實作 Worker 媒體 API 與 DB 同步清空流程

**Files:**
- Modify: `workers/admin-auth-worker.js`
- Test: `local-tests/admin-worker.test.js`

- [ ] **Step 1: 先寫 API 行為測試**

```js
test("handleAdminAssetObjectDelete clears image_url when deleting image object", async () => {
  const response = await workerApi.handleRequest(
    new Request("https://example.com/api/admin/assets/object", {
      method: "DELETE",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ key: "imgs/28.jpg" }),
    }),
    mockEnvWithR2AndSupabase(),
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.dbCleared, true);
});

test("handleAdminAssetsPurge deletes all objects and clears DB media fields", async () => {
  const response = await workerApi.handleRequest(
    new Request("https://example.com/api/admin/assets/purge", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ confirmText: "DELETE ALL R2 OBJECTS" }),
    }),
    mockEnvWithR2AndSupabase(),
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.deletedObjectCount, 3);
});
```

- [ ] **Step 2: 執行測試確認目前失敗**

Run: `node --test local-tests/admin-worker.test.js`
Expected: FAIL with 404 responses or missing handler logic for `/api/admin/assets/*`

- [ ] **Step 3: 實作媒體 list / upload / delete / purge handler**

```js
async function handleAdminAssetObjectDelete(request, env, deps = {}) {
  const access = await requireAdminApiAccess(request, env, deps);
  if (!access.ok) {
    return access.response;
  }

  const body = await readJsonBody(request);
  const key = normalizeTextValue(body?.key);
  const parsed = parseStorageObjectKey(key);

  if (!parsed || !key) {
    return jsonApiError(request, env, 400, "VALIDATION_ERROR", "A valid storage key is required.");
  }

  await env.LEXICON_MEDIA_BUCKET.delete(key);
  await clearMediaReference(access.fetchImpl, access.config, parsed);

  return jsonResponse(request, env, {
    ok: true,
    data: {
      deletedKey: key,
      affectedWordId: parsed.wordId,
      affectedLanguageCode: parsed.languageCode,
      dbCleared: true,
    },
  }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
}

async function handleAdminAssetsPurge(request, env, deps = {}) {
  const access = await requireAdminApiAccess(request, env, deps);
  if (!access.ok) {
    return access.response;
  }

  const body = await readJsonBody(request);
  if (normalizeTextValue(body?.confirmText) !== "DELETE ALL R2 OBJECTS") {
    return jsonApiError(request, env, 400, "VALIDATION_ERROR", "Confirmation text does not match.");
  }

  let cursor;
  let deletedObjectCount = 0;
  do {
    const page = await env.LEXICON_MEDIA_BUCKET.list({ cursor });
    await Promise.all(page.objects.map((object) => env.LEXICON_MEDIA_BUCKET.delete(object.key)));
    deletedObjectCount += page.objects.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const cleared = await clearAllMediaReferences(access.fetchImpl, access.config);

  return jsonResponse(request, env, {
    ok: true,
    data: {
      deletedObjectCount,
      clearedImageCount: cleared.clearedImageCount,
      clearedAudioCount: cleared.clearedAudioCount,
    },
  }, 200, "GET, POST, PATCH, DELETE, OPTIONS");
}
```

- [ ] **Step 4: 實作 DB helper 與路由掛載**

```js
async function clearMediaReference(fetchImpl, config, parsed) {
  if (parsed.type === "image") {
    await callAdminRpc(fetchImpl, config, "admin_clear_word_image", {
      p_word_id: parsed.wordId,
    });
    return;
  }

  await callAdminRpc(fetchImpl, config, "admin_clear_word_audio", {
    p_word_id: parsed.wordId,
    p_language_code: parsed.languageCode,
  });
}

async function clearAllMediaReferences(fetchImpl, config) {
  return callAdminRpc(fetchImpl, config, "admin_purge_all_media_references", {});
}
```

```js
if (request.method === "GET" && requestUrl.pathname === config.adminApiBasePath + "/assets/objects") {
  return handleAdminStorageObjectList(request, env, deps);
}

if (request.method === "DELETE" && requestUrl.pathname === config.adminApiBasePath + "/assets/object") {
  return handleAdminAssetObjectDelete(request, env, deps);
}

if (request.method === "POST" && requestUrl.pathname === config.adminApiBasePath + "/assets/purge") {
  return handleAdminAssetsPurge(request, env, deps);
}
```

- [ ] **Step 5: 補上單字媒體 upload/delete endpoint**

```js
if (request.method === "POST" && uploadImageMatch) {
  return handleAdminWordImageUpload(request, env, deps);
}

if (request.method === "DELETE" && deleteImageMatch) {
  return handleAdminWordImageDelete(request, env, deps);
}

if (request.method === "POST" && uploadAudioMatch) {
  return handleAdminWordAudioUpload(request, env, deps);
}

if (request.method === "DELETE" && deleteAudioMatch) {
  return handleAdminWordAudioDelete(request, env, deps);
}
```

- [ ] **Step 6: 跑 Worker 測試**

Run: `node --test local-tests/admin-worker.test.js`
Expected: PASS for list/delete/purge/media endpoint scenarios

- [ ] **Step 7: Commit**

```bash
git add workers/admin-auth-worker.js local-tests/admin-worker.test.js
git commit -m "feat: add protected R2 media management endpoints"
```

### Task 3: 擴充前端 API 與資產頁實體 R2 管理

**Files:**
- Modify: `public/assets/js/admin-api.js`
- Modify: `public/assets/js/admin-assets.js`
- Modify: `admin-assets.html`
- Modify: `public/assets/js/admin-i18n.js`
- Test: `local-tests/admin-api.test.js`
- Test: `local-tests/admin-assets.test.js`

- [ ] **Step 1: 先寫 client API 與資產頁測試**

```js
test("loadStorageObjects calls protected assets object endpoint", async () => {
  const client = {};
  const fetchCalls = [];
  const result = await adminApi.loadStorageObjects(client, { type: "image" }, {
    globalObject: mockRootWithFetch(fetchCalls, { ok: true, data: { items: [] } }),
  });

  assert.equal(result.ok, true);
  assert.match(fetchCalls[0].url, /\/api\/admin\/assets\/objects/);
});

test("renderAssetTableRows renders actual storage object metadata", () => {
  const markup = renderAssetTableRows([
    {
      key: "imgs/28.jpg",
      type: "image",
      language_code: null,
      dbReferenced: true,
      referenced_by_words: [{ id: 28, label: "桌子" }],
    },
  ]);

  assert.match(markup, /imgs\/28\.jpg/);
  assert.match(markup, /image/);
});
```

- [ ] **Step 2: 執行測試確認目前失敗**

Run: `node --test local-tests/admin-api.test.js local-tests/admin-assets.test.js`
Expected: FAIL with missing API methods or mismatched asset table rendering

- [ ] **Step 3: 在 `admin-api.js` 新增媒體管理 client**

```js
async function loadStorageObjects(client, filters = {}, options = {}) {
  const query = new URLSearchParams();
  if (filters.prefix) query.set("prefix", filters.prefix);
  if (filters.type) query.set("type", filters.type);
  if (filters.languageCode) query.set("languageCode", filters.languageCode);
  if (filters.q) query.set("q", filters.q);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return callProtectedEndpoint(client, `/assets/objects${suffix}`, options);
}

async function deleteStorageObject(client, objectKey, options = {}) {
  return callProtectedEndpoint(client, "/assets/object", {
    ...options,
    method: "DELETE",
    body: { key: objectKey },
  });
}

async function purgeAllStorageObjects(client, confirmText, options = {}) {
  return callProtectedEndpoint(client, "/assets/purge", {
    ...options,
    method: "POST",
    body: { confirmText },
  });
}
```

- [ ] **Step 4: 改 `admin-assets.html` 加入危險區塊與真實物件欄位**

```html
<section class="admin-card admin-danger-zone">
  <h2 data-i18n="assets.danger.title">Danger Zone</h2>
  <p data-i18n="assets.danger.body">Delete all objects from the R2 bucket and clear matching DB fields.</p>
  <label for="assets-purge-confirm" data-i18n="assets.danger.confirmLabel">Type confirmation text</label>
  <input id="assets-purge-confirm" placeholder="DELETE ALL R2 OBJECTS" />
  <button type="button" class="admin-button danger" data-assets-purge>
    Clear R2 Bucket
  </button>
</section>
```

- [ ] **Step 5: 改 `admin-assets.js` 用 R2 實體物件取代 DB 反推資料**

```js
async function reloadStorageObjects() {
  const result = await activeRoot.lexiconAdminApi.loadStorageObjects(client, getCurrentFilters());
  allItems = result.data.items || [];
  renderFilteredItems();
}

purgeButton?.addEventListener("click", async function () {
  const confirmText = confirmInput?.value || "";
  statusNode.textContent = t("assets.status.purging");
  await activeRoot.lexiconAdminApi.purgeAllStorageObjects(client, confirmText);
  await reloadStorageObjects();
});
```

- [ ] **Step 6: 補 i18n 文案與測試**

Run: `node --test local-tests/admin-api.test.js local-tests/admin-assets.test.js`
Expected: PASS for storage object API and asset page rendering

- [ ] **Step 7: Commit**

```bash
git add public/assets/js/admin-api.js public/assets/js/admin-assets.js admin-assets.html public/assets/js/admin-i18n.js local-tests/admin-api.test.js local-tests/admin-assets.test.js
git commit -m "feat: add R2-backed asset management page"
```

### Task 4: 改造單字編輯頁為圖片與音檔 CRUD 介面

**Files:**
- Modify: `admin-word-edit.html`
- Modify: `public/assets/js/admin-word-edit.js`
- Modify: `public/assets/js/admin-api.js`
- Modify: `public/assets/js/admin-i18n.js`
- Test: `local-tests/admin-word-edit.test.js`

- [ ] **Step 1: 先寫單字編輯頁媒體狀態測試**

```js
test("getMediaPanelState disables uploads in create mode before word id exists", () => {
  assert.deepEqual(wordEdit.getMediaPanelState({ mode: "create", wordId: null }), {
    enabled: false,
    reason: "save-first",
  });
});

test("buildWordMediaViewModel resolves image and audio preview URLs", () => {
  const model = wordEdit.buildWordMediaViewModel({
    id: 28,
    image_url: "imgs/28.jpg",
    translations: {
      "zh-TW": { audio_filename: "28.mp3" },
      id: { audio_filename: "" },
      en: { audio_filename: "28.ogg" },
    },
  });

  assert.match(model.image.previewUrl, /imgs\/28\.jpg/);
  assert.match(model.audio["zh-TW"].previewUrl, /audios\/zh-TW\/28\.mp3/);
  assert.equal(model.audio.id.previewUrl, "");
});
```

- [ ] **Step 2: 執行測試確認目前失敗**

Run: `node --test local-tests/admin-word-edit.test.js`
Expected: FAIL with missing functions such as `getMediaPanelState` or `buildWordMediaViewModel`

- [ ] **Step 3: 改 `admin-word-edit.html` 加入媒體操作區**

```html
<article class="admin-card admin-form-card" data-word-media-panel>
  <h3 data-i18n="wordEdit.media.title">Media</h3>
  <p class="admin-status-text" data-word-media-hint></p>
  <section class="admin-media-block" data-word-image-panel></section>
  <section class="admin-media-block" data-word-audio-panel="zh-TW"></section>
  <section class="admin-media-block" data-word-audio-panel="id"></section>
  <section class="admin-media-block" data-word-audio-panel="en"></section>
</article>
```

- [ ] **Step 4: 在 `admin-api.js` 新增 multipart 上傳 helper**

```js
async function uploadWordImage(client, wordId, file, options = {}) {
  const form = new FormData();
  form.set("file", file);
  return callProtectedFormEndpoint(client, `/assets/word-image/${Number(wordId)}`, form, options);
}

async function uploadWordAudio(client, wordId, languageCode, file, options = {}) {
  const form = new FormData();
  form.set("file", file);
  return callProtectedFormEndpoint(client, `/assets/word-audio/${Number(wordId)}/${languageCode}`, form, options);
}
```

- [ ] **Step 5: 在 `admin-word-edit.js` 實作媒體 view model、上傳與刪除事件**

```js
function getMediaPanelState(params) {
  if (params.mode === "edit" && Number.isInteger(params.wordId) && params.wordId > 0) {
    return { enabled: true, reason: "" };
  }
  return { enabled: false, reason: "save-first" };
}

async function handleImageUpload(file) {
  const result = await activeRoot.lexiconAdminApi.uploadWordImage(client, currentWordId, file);
  currentDetail.image_url = result.data.imageUrl;
  renderWordMedia(activeDocument, currentDetail, { t, root: activeRoot });
}

async function handleAudioDelete(languageCode) {
  const result = await activeRoot.lexiconAdminApi.deleteWordAudio(client, currentWordId, languageCode);
  currentDetail.translations[languageCode].audio_filename = result.data.audioFilename;
  renderWordMedia(activeDocument, currentDetail, { t, root: activeRoot });
}
```

- [ ] **Step 6: 把舊的手填媒體欄位降級為唯讀資訊或移除**

```js
activeDocument.getElementById("image-url").readOnly = true;
activeDocument.getElementById("audio-zh").readOnly = true;
activeDocument.getElementById("audio-id").readOnly = true;
activeDocument.getElementById("audio-en").readOnly = true;
```

- [ ] **Step 7: 補測試並驗證**

Run: `node --test local-tests/admin-word-edit.test.js`
Expected: PASS for media panel state, preview URL generation, and media event behavior

- [ ] **Step 8: Commit**

```bash
git add admin-word-edit.html public/assets/js/admin-word-edit.js public/assets/js/admin-api.js public/assets/js/admin-i18n.js local-tests/admin-word-edit.test.js
git commit -m "feat: add inline media CRUD to admin word editor"
```

### Task 5: 補齊 DB helper、整體驗證與收尾

**Files:**
- Modify: `supabase/migrations/20260503_admin_media_r2_management.sql`
- Modify: `local-tests/admin-worker.test.js`
- Modify: `local-tests/admin-api.test.js`
- Modify: `local-tests/admin-assets.test.js`
- Modify: `local-tests/admin-word-edit.test.js`

- [ ] **Step 1: 新增 migration，補媒體清空 RPC**

```sql
create or replace function public.admin_clear_word_image(p_word_id integer)
returns public.words
language plpgsql
security definer
as $$
declare
  updated_word public.words;
begin
  update public.words
  set image_url = ''
  where id = p_word_id
  returning * into updated_word;

  return updated_word;
end;
$$;

create or replace function public.admin_clear_word_audio(p_word_id integer, p_language_code text)
returns public.word_translations
language plpgsql
security definer
as $$
declare
  updated_translation public.word_translations;
begin
  update public.word_translations
  set audio_filename = ''
  where word_id = p_word_id and language_code = p_language_code
  returning * into updated_translation;

  return updated_translation;
end;
$$;
```

- [ ] **Step 2: 補整桶清空 RPC**

```sql
create or replace function public.admin_purge_all_media_references()
returns jsonb
language plpgsql
security definer
as $$
declare
  cleared_image_count integer;
  cleared_audio_count integer;
begin
  update public.words
  set image_url = ''
  where image_url <> '';
  get diagnostics cleared_image_count = row_count;

  update public.word_translations
  set audio_filename = ''
  where audio_filename <> '';
  get diagnostics cleared_audio_count = row_count;

  return jsonb_build_object(
    'clearedImageCount', cleared_image_count,
    'clearedAudioCount', cleared_audio_count
  );
end;
$$;
```

- [ ] **Step 3: 跑後台完整測試**

Run: `node --test local-tests/admin-*.test.js`
Expected: PASS across `admin-api`, `admin-assets`, `admin-word-edit`, `admin-worker`, `admin-pages`

- [ ] **Step 4: 跑全專案測試**

Run: `npm test`
Expected: PASS with all local tests green

- [ ] **Step 5: 做手動 smoke checklist**

Run:

```bash
npm test
```

Manual checklist:
- `admin-assets.html` 可列出 R2 實體物件
- 單筆刪除後對應 DB 欄位被清空
- 清空 bucket 後列表為空
- `admin-word-edit.html?id=<id>` 可上傳圖片
- `admin-word-edit.html?id=<id>` 可上傳 `zh-TW` / `id` / `en` 音檔
- 刪除媒體後預覽與欄位同步清空

Expected: 所有自動測試通過，手動檢查項目完成

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260503_admin_media_r2_management.sql local-tests/admin-worker.test.js local-tests/admin-api.test.js local-tests/admin-assets.test.js local-tests/admin-word-edit.test.js
git commit -m "feat: add media cleanup RPCs and verification coverage"
```

const assert = require("node:assert/strict");
const test = require("node:test");
const adminApi = require("../public/assets/js/admin-api");

const {
  buildDeleteWordErrorMessage,
  buildDeleteWordSuccessMessage,
  collectFormValues,
  buildAudioObjectKey,
  buildMediaUrl,
  buildTagOptionMarkup,
  createEmptyWordDetail,
  getAudioStatusMessage,
  getImageStatusMessage,
  hasPersistentWordId,
  normalizeWordEditorPayload,
  parseWordEditParams,
} = require("../public/assets/js/admin-word-edit");

test("parseWordEditParams supports create and edit modes from query params", () => {
  assert.deepEqual(parseWordEditParams("?mode=create"), {
    mode: "create",
    wordId: null,
  });

  assert.deepEqual(parseWordEditParams("?id=28"), {
    mode: "edit",
    wordId: 28,
  });

  assert.deepEqual(parseWordEditParams("?id=abc"), {
    mode: "invalid",
    wordId: null,
  });

  assert.deepEqual(parseWordEditParams("?id=-1"), {
    mode: "invalid",
    wordId: null,
  });
});

test("createEmptyWordDetail returns the canonical empty editor shape", () => {
  const detail = createEmptyWordDetail();
  assert.equal(detail.image_url, "");
  assert.deepEqual(detail.tag_ids, []);
  assert.equal(detail.translations["zh-TW"].audio_filename, "");
  assert.equal(detail.translations.id.text, "");
  assert.equal(detail.translations.en.pronunciation, "");
});

test("normalizeWordEditorPayload trims strings and deduplicates valid tag ids", () => {
  const payload = normalizeWordEditorPayload({
    image_url: " imgs/table.jpg ",
    translations: {
      "zh-TW": { text: " 桌子 ", pronunciation: " zhuo zi ", audio_filename: " zh.mp3 " },
      id: { text: " meja ", pronunciation: " me-ja ", audio_filename: " id.mp3 " },
      en: { text: " table ", pronunciation: " tay-buhl ", audio_filename: "  " },
    },
    tag_ids: [1, "2", 2, -1, "x"],
  });

  assert.deepEqual(payload, {
    id: null,
    image_url: "imgs/table.jpg",
    translations: {
      "zh-TW": { text: "桌子", pronunciation: "zhuo zi", audio_filename: "zh.mp3" },
      id: { text: "meja", pronunciation: "me-ja", audio_filename: "id.mp3" },
      en: { text: "table", pronunciation: "tay-buhl", audio_filename: "" },
    },
    tag_ids: [1, 2],
    created_at: null,
    updated_at: null,
  });
});

test("buildTagOptionMarkup marks selected tags", () => {
  const markup = buildTagOptionMarkup([
    { id: 1, translations: { "zh-TW": { name: "家具" } } },
    { id: 2, translations: { en: { name: "daily" } } },
  ], [2]);

  assert.match(markup, /家具/);
  assert.match(markup, /daily/);
  assert.match(markup, /value="2" checked/);
});

test("media helper utilities derive persistent ids and media paths", () => {
  assert.equal(hasPersistentWordId(28), true);
  assert.equal(hasPersistentWordId("28"), true);
  assert.equal(hasPersistentWordId("abc"), false);
  assert.equal(buildAudioObjectKey("id", "28.mp3"), "audios/id/28.mp3");
  assert.equal(buildAudioObjectKey("id", ""), "");
  assert.equal(
    buildMediaUrl({ LEXICON_MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com/media/" }, "imgs/28.webp"),
    "https://cdn.example.com/media/imgs/28.webp",
  );
});

test("buildMediaUrl appends admin cache-bust token for refreshed media previews", () => {
  assert.equal(
    buildMediaUrl(
      {
        LEXICON_MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com/media/",
        __LEXICON_ADMIN_MEDIA_CACHE_BUST__: "1712345678901",
      },
      "imgs/28.webp",
    ),
    "https://cdn.example.com/media/imgs/28.webp?v=1712345678901",
  );
});

test("status message helpers return readable traditional chinese copy", () => {
  assert.equal(getImageStatusMessage("missingWord"), "請先儲存單字後再上傳圖片。");
  assert.equal(getImageStatusMessage("missingFile"), "請先選擇要上傳的圖片。");
  assert.equal(getImageStatusMessage("uploading"), "圖片上傳中...");
  assert.equal(getImageStatusMessage("uploadSuccess"), "圖片上傳完成。");
  assert.equal(getImageStatusMessage("deleteMissing"), "目前沒有可刪除的圖片。");
  assert.equal(getImageStatusMessage("deleteSuccess"), "圖片已刪除。");
  assert.equal(getImageStatusMessage("fallbackError"), "圖片操作失敗。");

  assert.equal(getAudioStatusMessage("missingWord"), "請先儲存單字後再上傳音檔。");
  assert.equal(getAudioStatusMessage("missingFile"), "請先選擇要上傳的音檔。");
  assert.equal(getAudioStatusMessage("uploading", "zh-TW"), "zh-TW 音檔上傳中...");
  assert.equal(getAudioStatusMessage("uploadSuccess", "zh-TW"), "zh-TW 音檔上傳完成。");
  assert.equal(getAudioStatusMessage("deleteMissing", "en"), "目前沒有可刪除的 en 音檔。");
  assert.equal(getAudioStatusMessage("deleteSuccess", "en"), "en 音檔已刪除。");
  assert.equal(getAudioStatusMessage("fallbackError"), "音檔操作失敗。");
});

test("collectFormValues preserves existing media values when read-only inputs are removed", () => {
  const fields = {
    "zh-word": { value: "桌子" },
    "pron-zh": { value: "zhuo zi" },
    "id-word": { value: "meja" },
    "pron-id": { value: "me-ja" },
    "en-word": { value: "table" },
    "pron-en": { value: "tay-buhl" },
  };
  const doc = {
    getElementById(id) {
      return fields[id] || null;
    },
    querySelectorAll() {
      return [];
    },
  };

  const formValues = collectFormValues(doc, {
    image_url: "imgs/28.webp",
    translations: {
      "zh-TW": { audio_filename: "28-zh.mp3" },
      id: { audio_filename: "28-id.mp3" },
      en: { audio_filename: "28-en.mp3" },
    },
  });

  assert.equal(formValues.image_url, "imgs/28.webp");
  assert.equal(formValues.translations["zh-TW"].audio_filename, "28-zh.mp3");
  assert.equal(formValues.translations.id.audio_filename, "28-id.mp3");
  assert.equal(formValues.translations.en.audio_filename, "28-en.mp3");
});

test("word edit delete feedback builders surface media cleanup details", () => {
  const t = function (key, replacements = {}) {
    const table = {
      "wordEdit.toast.deleteSuccessWithMedia": "單字已刪除，並清除 {objectCount} 個媒體檔案。",
      "wordEdit.toast.deletePartialError": "單字已刪除，但 {objectCount} 個媒體檔案尚未刪除乾淨，請檢查資產。",
      "words.toast.deleteOneSuccess": "單字已刪除。",
      "words.toast.deleteOneError": "刪除單字失敗。",
    };

    return Object.entries(replacements).reduce(function (message, [token, value]) {
      return message.replace(`{${token}}`, value);
    }, table[key] || key);
  };

  assert.equal(
    buildDeleteWordSuccessMessage(
      {
        id: 28,
        deleted: true,
        deletedObjectCount: 2,
      },
      { t, api: adminApi },
    ),
    "單字已刪除，並清除 2 個媒體檔案。",
  );

  assert.equal(
    buildDeleteWordErrorMessage(
      {
        code: "INCONSISTENT_STATE",
        details: {
          wordId: 28,
          deletedObjectCount: 2,
        },
      },
      { t, api: adminApi, wordId: 28 },
    ),
    "單字已刪除，但 2 個媒體檔案尚未刪除乾淨，請檢查資產。",
  );
});

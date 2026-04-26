const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTagOptionMarkup,
  createEmptyWordDetail,
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

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createEmptyTagDetail,
  normalizeTagEditorPayload,
  renderTagRow,
  renderTagRows,
} = require("../public/assets/js/admin-tags");

const zhTranslator = function (key) {
  const table = {
    "tags.actions.delete": "刪除",
    "tags.actions.edit": "編輯",
    "tags.empty": "目前沒有標籤資料。",
  };

  return table[key] || key;
};

test("createEmptyTagDetail returns canonical empty tag shape", () => {
  const detail = createEmptyTagDetail();
  assert.equal(detail.id, null);
  assert.equal(detail.icon, "sell");
  assert.equal(detail.translations["zh-TW"].name, "");
  assert.equal(detail.usage_count, 0);
});

test("normalizeTagEditorPayload trims names and applies default icon", () => {
  assert.deepEqual(
    normalizeTagEditorPayload({
      icon: "  ",
      translations: {
        "zh-TW": { name: " 家具 " },
        id: { name: " furnitur " },
        en: { name: " furniture " },
      },
    }),
    {
      icon: "sell",
      translations: {
        "zh-TW": { name: "家具" },
        id: { name: "furnitur" },
        en: { name: "furniture" },
      },
    },
  );
});

test("renderTagRow renders usage-aware actions", () => {
  const markup = renderTagRow(
    {
      id: 4,
      icon: "sell",
      translations: {
        "zh-TW": { name: "形容詞" },
        id: { name: "kata sifat" },
        en: { name: "adjective" },
      },
      usage_count: 27,
    },
    { t: zhTranslator },
  );

  assert.match(markup, /形容詞/);
  assert.match(markup, /data-tag-edit="4"/);
  assert.match(markup, /data-tag-delete="4"/);
  assert.match(markup, /disabled/);
});

test("renderTagRows returns explicit empty state when no tags exist", () => {
  const markup = renderTagRows([], { t: zhTranslator });
  assert.match(markup, /目前沒有標籤資料。/);
  assert.match(markup, /colspan="7"/);
});

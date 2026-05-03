const assert = require("node:assert/strict");
const test = require("node:test");

const {
  filterStorageItems,
  renderAssetCards,
  renderAssetTableRows,
} = require("../public/assets/js/admin-assets");

const zhTranslator = function (key) {
  const table = {
    "assets.empty": "沒有符合條件的媒體資產。",
  };

  return table[key] || key;
};

test("renderAssetCards renders image cards with delete actions", () => {
  const markup = renderAssetCards(
    [
      {
        type: "image",
        key: "imgs/202604120952.jpg",
        previewUrl: "https://cdn.example.com/imgs/202604120952.jpg",
        dbReferenced: true,
        size: 1024,
        uploadedAt: "2026-05-03T10:00:00.000Z",
        referenced_by_words: [{ id: 28, label: "桌子" }],
      },
    ],
    { t: zhTranslator },
  );

  assert.match(markup, /202604120952\.jpg/);
  assert.match(markup, /imgs\/202604120952\.jpg/);
  assert.match(markup, /桌子/);
  assert.match(markup, /data-delete-storage-key="imgs\/202604120952\.jpg"/);
});

test("renderAssetTableRows renders object metadata and empty state", () => {
  const rowMarkup = renderAssetTableRows(
    [
      {
        type: "audio",
        languageCode: "zh-TW",
        key: "audios/zh-TW/table.mp3",
        size: 2048,
        uploadedAt: "2026-05-03T11:00:00.000Z",
        dbReferenced: false,
      },
    ],
    { t: zhTranslator },
  );
  const emptyMarkup = renderAssetTableRows([], { t: zhTranslator });

  assert.match(rowMarkup, /table\.mp3/);
  assert.match(rowMarkup, /audios\/zh-TW\/table\.mp3/);
  assert.match(rowMarkup, /zh-TW/);
  assert.match(rowMarkup, /未綁定/);
  assert.match(emptyMarkup, /沒有符合條件的媒體資產/);
});

test("filterStorageItems supports keyword type and language filters", () => {
  const items = [
    { key: "imgs/28.webp", type: "image", languageCode: null, wordId: 28 },
    { key: "audios/id/28.mp3", type: "audio", languageCode: "id", wordId: 28 },
    { key: "audios/en/31.mp3", type: "audio", languageCode: "en", wordId: 31 },
  ];

  assert.deepEqual(filterStorageItems(items, { type: "image" }), [items[0]]);
  assert.deepEqual(filterStorageItems(items, { type: "audio", languageCode: "id" }), [items[1]]);
  assert.deepEqual(filterStorageItems(items, { q: "31" }), [items[2]]);
});

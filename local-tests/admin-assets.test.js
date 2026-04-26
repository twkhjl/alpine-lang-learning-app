const assert = require("node:assert/strict");
const test = require("node:test");

const {
  renderAssetCards,
  renderAssetTableRows,
} = require("../public/assets/js/admin-assets");

const zhTranslator = function (key) {
  const table = {
    "assets.empty": "目前沒有符合條件的素材參考。",
  };

  return table[key] || key;
};

test("renderAssetCards renders asset reference cards with stored paths", () => {
  const markup = renderAssetCards(
    [
      {
        type: "image",
        path: "imgs/202604120952.jpg",
        referenced_by_words: [{ id: 28, label: "桌子" }],
      },
    ],
    { t: zhTranslator },
  );

  assert.match(markup, /202604120952\.jpg/);
  assert.match(markup, /imgs\/202604120952\.jpg/);
  assert.match(markup, /桌子/);
});

test("renderAssetTableRows renders full stored path and explicit empty state", () => {
  const rowMarkup = renderAssetTableRows(
    [
      {
        type: "audio",
        language_code: "zh-TW",
        path: "audios/zh-TW/table.mp3",
        referenced_by_words: [{ id: 28, label: "桌子" }],
      },
    ],
    { t: zhTranslator },
  );
  const emptyMarkup = renderAssetTableRows([], { t: zhTranslator });

  assert.match(rowMarkup, /table\.mp3/);
  assert.match(rowMarkup, /audios\/zh-TW\/table\.mp3/);
  assert.match(rowMarkup, /zh-TW/);
  assert.match(rowMarkup, /桌子/);
  assert.match(emptyMarkup, /目前沒有符合條件的素材參考。/);
});

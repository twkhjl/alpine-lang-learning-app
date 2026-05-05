const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCreateWordUrl,
  buildEditWordUrl,
  normalizeWordsPageState,
  renderWordRow,
  renderWordRows,
} = require("../public/assets/js/admin-words");

const zhTranslator = function (key, replacements = {}) {
  const table = {
    "words.table.tagFallback": "未分類",
    "words.table.imageReady": "有圖片",
    "words.table.imageMissing": "缺少圖片",
    "words.table.audioReady": "音檔：{languages}",
    "words.table.audioMissing": "缺少音檔",
    "words.table.edit": "編輯",
    "words.table.empty": "目前沒有符合條件的字詞。",
  };

  return Object.entries(replacements).reduce(function (message, [token, value]) {
    return message.replace(`{${token}}`, value);
  }, table[key] || key);
};

const enTranslator = function (key, replacements = {}) {
  const table = {
    "words.table.tagFallback": "Uncategorized",
    "words.table.imageReady": "Image ready",
    "words.table.imageMissing": "Missing image",
    "words.table.audioReady": "Audio: {languages}",
    "words.table.audioMissing": "Missing audio",
    "words.table.edit": "Edit",
    "words.table.empty": "No matching words found.",
  };

  return Object.entries(replacements).reduce(function (message, [token, value]) {
    return message.replace(`{${token}}`, value);
  }, table[key] || key);
};

test("normalizeWordsPageState normalizes filters and pagination", () => {
  assert.deepEqual(
    normalizeWordsPageState({
      q: " meja ",
      tagId: "4",
      hasImage: true,
      hasAudio: false,
      page: "2",
      pageSize: "50",
    }),
    {
      q: "meja",
      tagId: 4,
      hasImage: true,
      hasAudio: false,
      page: 2,
      pageSize: 50,
    },
  );
});

test("renderWordRow renders serial number, thumbnail, and tag names", () => {
  const markup = renderWordRow(
    {
      id: 28,
      image_url: "imgs/202604120952.jpg",
      lang_zh_tw: "桌子",
      lang_id: "meja",
      lang_en: "table",
      tags: [1, 3],
      has_image: true,
      audio_languages: ["zh-TW", "id"],
      updated_at: "2026-04-26T02:12:00.000Z",
    },
    {
      t: enTranslator,
      locale: "en",
      serialNumber: 26,
      tagNameResolver: function (tagId) {
        return {
          1: "Furniture",
          3: "Home",
        }[tagId] || "";
      },
    },
  );

  assert.match(markup, />26</);
  assert.match(markup, /<img[^>]+src="imgs\/202604120952\.jpg"/);
  assert.match(markup, /Furniture/);
  assert.match(markup, /Home/);
  assert.doesNotMatch(markup, /Tag #1/);
  assert.doesNotMatch(markup, /Audio:/);
  assert.match(markup, />Edit</);
  assert.match(markup, /admin-word-edit\.html\?id=28/);
});

test("renderWordRows returns explicit localized empty state markup", () => {
  const markup = renderWordRows([], { t: zhTranslator });

  assert.match(markup, /目前沒有符合條件的字詞。/);
  assert.match(markup, /colspan="8"/);
});

test("renderWordRows calculates cross-page serial numbers", () => {
  const markup = renderWordRows(
    [
      {
        id: 28,
        image_url: "",
        lang_zh_tw: "桌子",
        lang_id: "meja",
        lang_en: "table",
        tags: [],
        has_image: false,
        audio_languages: [],
        updated_at: "2026-04-26T02:12:00.000Z",
      },
      {
        id: 27,
        image_url: "",
        lang_zh_tw: "椅子",
        lang_id: "kursi",
        lang_en: "chair",
        tags: [],
        has_image: false,
        audio_languages: [],
        updated_at: "2026-04-26T02:10:00.000Z",
      },
    ],
    {
      t: enTranslator,
      locale: "en",
      page: 2,
      pageSize: 25,
      tagNameResolver: function () {
        return "";
      },
    },
  );

  assert.match(markup, />26</);
  assert.match(markup, />27</);
});

test("word page URL helpers generate edit and create links", () => {
  assert.equal(buildEditWordUrl(28), "admin-word-edit.html?id=28");
  assert.equal(buildCreateWordUrl(), "admin-word-edit.html?mode=create");
});

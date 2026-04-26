const assert = require("node:assert/strict");
const test = require("node:test");

const { renderRecentWordsRows } = require("../public/assets/js/admin-dashboard");

const zhTranslator = function (key) {
  const table = {
    "dashboard.recentWords.audio.available": "有音檔",
    "dashboard.recentWords.audio.missing": "缺少音檔",
    "dashboard.recentWords.empty": "目前沒有最近更新的單字。",
    "dashboard.recentWords.languages": "支援語言",
    "dashboard.recentWords.noTags": "未分類",
  };

  return table[key] || key;
};

const enTranslator = function (key) {
  const table = {
    "dashboard.recentWords.audio.available": "Audio ready",
    "dashboard.recentWords.audio.missing": "Missing audio",
    "dashboard.recentWords.empty": "No recently updated words yet.",
    "dashboard.recentWords.languages": "Languages",
    "dashboard.recentWords.noTags": "Uncategorized",
  };

  return table[key] || key;
};

test("renderRecentWordsRows uses translator for localized row labels", () => {
  const markup = renderRecentWordsRows(
    [
      {
        id: 28,
        lang_zh_tw: "桌子",
        lang_id: "meja",
        tags: [1, 3],
        audio_languages: ["zh-TW"],
        updated_at: "2026-04-26T02:12:00.000Z",
      },
    ],
    { t: enTranslator },
  );

  assert.match(markup, /桌子/);
  assert.match(markup, /Languages/);
  assert.match(markup, /Audio ready/);
});

test("renderRecentWordsRows returns localized empty state", () => {
  const markup = renderRecentWordsRows([], { t: zhTranslator });
  assert.match(markup, /目前沒有最近更新的單字。/);
});

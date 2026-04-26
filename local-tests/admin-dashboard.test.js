const assert = require("node:assert/strict");
const test = require("node:test");

const { renderRecentWordsRows } = require("../public/assets/js/admin-dashboard");

test("renderRecentWordsRows renders recent word table markup", () => {
  const markup = renderRecentWordsRows([
    {
      id: 28,
      lang_zh_tw: "桌子",
      lang_id: "meja",
      tags: [1, 3],
      audio_languages: ["zh-TW"],
      updated_at: "2026-04-26T02:12:00.000Z",
    },
  ]);

  assert.match(markup, /桌子/);
  assert.match(markup, /meja/);
  assert.match(markup, /1, 3/);
});

test("renderRecentWordsRows returns explicit empty state", () => {
  const markup = renderRecentWordsRows([]);
  assert.match(markup, /目前沒有最近更新的字詞。/);
});

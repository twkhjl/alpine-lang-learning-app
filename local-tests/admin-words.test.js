const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCreateWordUrl,
  buildEditWordUrl,
  normalizeWordsPageState,
  renderWordRow,
  renderWordRows,
} = require("../public/assets/js/admin-words");

test("normalizeWordsPageState normalizes filters and pagination", () => {
  assert.deepEqual(
    normalizeWordsPageState({
      q: " 桌子 ",
      tagId: "4",
      hasImage: true,
      hasAudio: false,
      page: "2",
      pageSize: "50",
    }),
    {
      q: "桌子",
      tagId: 4,
      hasImage: true,
      hasAudio: false,
      page: 2,
      pageSize: 50,
    },
  );
});

test("renderWordRow renders list row markup from API payload", () => {
  const markup = renderWordRow({
    id: 28,
    image_url: "imgs/202604120952.jpg",
    lang_zh_tw: "桌子",
    lang_id: "meja",
    lang_en: "table",
    tags: [1, 3],
    has_image: true,
    audio_languages: ["zh-TW", "id"],
    updated_at: "2026-04-26T02:12:00.000Z",
  });

  assert.match(markup, /桌子/);
  assert.match(markup, /meja/);
  assert.match(markup, /table/);
  assert.match(markup, /Tag #1/);
  assert.match(markup, /admin-word-edit\.html\?id=28/);
});

test("renderWordRows returns explicit empty state markup when there are no rows", () => {
  const markup = renderWordRows([]);
  assert.match(markup, /目前沒有符合條件的字詞。/);
  assert.match(markup, /colspan="9"/);
});

test("word page URL helpers generate edit and create links", () => {
  assert.equal(buildEditWordUrl(28), "admin-word-edit.html?id=28");
  assert.equal(buildCreateWordUrl(), "admin-word-edit.html?mode=create");
});

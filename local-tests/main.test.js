const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadMainScript() {
  const scriptPath = path.join(__dirname, "..", "public", "assets", "js", "main.js");
  const code = fs.readFileSync(scriptPath, "utf8");
  const storage = new Map();
  const context = {
    window: {},
    tailwind: {},
    console,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

test("visibleCardWords keeps ignored words when status filter is all", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = [
    { id: 1, tags: [] },
    { id: 2, tags: [] },
  ];
  app.selectedTagIds = [];
  app.statusFilters = ["all"];
  app.ignoredWordIds = [2];
  app.favoriteWordIds = [];

  assert.deepEqual(
    app.visibleCardWords.map((word) => word.id),
    [1, 2],
  );
});

test("normalizePreferences falls back when saved activeView still points to removed grid view", () => {
  const { lexiconTestUtils } = loadMainScript().window;
  const normalized = lexiconTestUtils.normalizePreferences({
    activeView: "grid",
    lastContentView: "grid",
  });

  assert.equal(normalized.activeView, "card");
  assert.equal(normalized.lastContentView, "card");
});

test("selected loop words survive search changes and cap by loop group count", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = Array.from({ length: 20 }, (_, index) => ({
    id: 20 - index,
    tags: [],
    "lang_zh-TW": `詞-${20 - index}`,
    lang_id: `kata-${20 - index}`,
    pronunciation: { "zh-TW": `p-${20 - index}`, id: "" },
    audioPaths: { "zh-TW": `audio-${20 - index}.mp3`, id: "" },
  }));
  app.selectedLoopWordIds = [20, 18, 16, 14, 12, 10, 8];
  app.statusFilters = ["all"];
  app.selectedTagIds = [];
  app.searchQuery = "詞-20";
  app.listLoopGroupCount = 1;

  assert.equal(app.filteredListWords.length, 1);
  assert.deepEqual(
    app.selectedLoopWords.map((word) => word.id),
    [20, 18, 16, 14, 12, 10, 8],
  );
  assert.deepEqual(
    app.cappedLoopWords.map((word) => word.id),
    [20, 18, 16, 14, 12, 10],
  );
});

test("changing active list language stops list loop and updates active language", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.displayLanguage1 = "zh-TW";
  app.displayLanguage2 = "id";
  app.listQuickLanguageSlot = 1;
  app.listLoopPlaying = true;
  app.listLoopActiveWordId = 9;
  app.listLoopCurrentAudio = {
    pauseCalled: false,
    pause() {
      this.pauseCalled = true;
    },
  };

  app.toggleListQuickLanguage();

  assert.equal(app.activeListLanguage, "id");
  assert.equal(app.listLoopPlaying, false);
  assert.equal(app.listLoopActiveWordId, null);
  assert.equal(app.listLoopCurrentAudio, null);
});

test("toggleListLoop starts from first playable selected word and second toggle stops", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = [
    { id: 4, tags: [], audioPaths: { "zh-TW": "four.mp3" } },
    { id: 3, tags: [], audioPaths: {} },
    { id: 2, tags: [], audioPaths: { "zh-TW": "two.mp3" } },
  ];
  app.selectedLoopWordIds = [4, 3, 2];
  app.listLoopGroupCount = 1;
  app.playSelectedLoopWord = (word) => {
    app.listLoopPlaying = true;
    app.listLoopActiveWordId = word.id;
  };

  app.toggleListLoop();
  assert.equal(app.listLoopPlaying, true);
  assert.equal(app.listLoopActiveWordId, 4);

  app.toggleListLoop();
  assert.equal(app.listLoopPlaying, false);
  assert.equal(app.listLoopActiveWordId, null);
});

test("selected loop panel opens, closes, and can remove one selected word", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = [
    {
      id: 3,
      tags: [],
      "lang_zh-TW": "三",
      pronunciation: { "zh-TW": "san" },
      audioPaths: { "zh-TW": "three.mp3" },
    },
    {
      id: 2,
      tags: [],
      "lang_zh-TW": "二",
      pronunciation: { "zh-TW": "er" },
      audioPaths: { "zh-TW": "two.mp3" },
    },
  ];
  app.selectedLoopWordIds = [3, 2];

  app.toggleSelectedLoopPanel();
  assert.equal(app.selectedLoopPanelOpen, true);
  assert.deepEqual(
    app.selectedLoopPanelWords.map((word) => word.id),
    [3, 2],
  );

  app.removeSelectedLoopWord(3);
  assert.deepEqual(app.selectedLoopWordIds, [2]);

  app.closeSelectedLoopPanel();
  assert.equal(app.selectedLoopPanelOpen, false);
});

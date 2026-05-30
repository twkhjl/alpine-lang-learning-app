const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadMainScript() {
  const scriptPath = path.join(__dirname, "..", "public", "assets", "js", "main.js");
  const code = fs.readFileSync(scriptPath, "utf8");
  const context = {
    window: {},
    tailwind: {},
    console,
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

test("grid page helpers pad final page to six slots and clamp invalid page indexes", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    tags: [],
    audioPaths: { "zh-TW": `audio-${index + 1}.mp3` },
  }));
  app.selectedTagIds = [];
  app.statusFilters = ["all"];
  app.gridPageIndex = 1;

  assert.equal(app.gridTotalPages, 2);
  assert.deepEqual(
    app.gridPageWords.map((word) => word.id),
    [7, 8],
  );
  assert.equal(app.gridSlots.length, 6);
  assert.equal(
    JSON.stringify(app.gridSlots.map((slot) => slot.word?.id || null)),
    JSON.stringify([7, 8, null, null, null, null]),
  );

  app.gridPageIndex = 99;
  app.clampGridPageIndex();
  assert.equal(app.gridPageIndex, 1);
});

test("toggleGridLoop starts on first playable slot and second toggle stops", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = [
    { id: 1, tags: [], audioPaths: { "zh-TW": "one.mp3" } },
    { id: 2, tags: [], audioPaths: {} },
  ];
  app.selectedTagIds = [];
  app.statusFilters = ["all"];
  app.playGridSlotAudio = (index) => {
    app.gridLoopPlaying = true;
    app.gridLoopActiveIndex = index;
  };

  assert.equal(JSON.stringify(app.gridPlayableIndexes), JSON.stringify([0]));

  app.toggleGridLoop();
  assert.equal(app.gridLoopPlaying, true);
  assert.equal(app.gridLoopActiveIndex, 0);

  app.toggleGridLoop();
  assert.equal(app.gridLoopPlaying, false);
  assert.equal(app.gridLoopActiveIndex, -1);
});

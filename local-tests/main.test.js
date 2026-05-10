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

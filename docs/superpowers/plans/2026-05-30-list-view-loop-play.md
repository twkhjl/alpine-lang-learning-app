# List View Multi-Select Loop Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the frontend list page into the primary multi-select loop-play workflow with single-column cards, language toggling, images, and capped selected-word playback.

**Architecture:** Extend the existing Alpine `lexiconApp()` state in `public/assets/js/main.js` with list-page selection and loop-play state, then reshape the existing `list` section in `index.html` into a single-column card layout with a control bar. Verify core queue logic with `local-tests/main.test.js` and user flows with `local-tests/e2e-runner.js`.

**Tech Stack:** Alpine.js, Tailwind utility classes in HTML, browser `Audio`, Node test runner, Playwright-based local e2e script

---

### Task 1: Add list-loop state and queue helpers

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\main.test.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`

- [ ] **Step 1: Write the failing test**

```js
test("selected loop words survive search changes and cap by loop group count", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = Array.from({ length: 20 }, (_, index) => ({
    id: 20 - index,
    tags: [],
    "lang_zh-TW": `詞-${20 - index}`,
    lang_id: `kata-${20 - index}`,
    pronunciation: { "zh-TW": `p-${20 - index}` },
    audioPaths: { "zh-TW": `audio-${20 - index}.mp3` },
  }));
  app.selectedLoopWordIds = [20, 18, 16, 14, 12, 10, 8];
  app.statusFilters = ["all"];
  app.selectedTagIds = [];
  app.searchQuery = "詞-20";
  app.listLoopGroupCount = 1;

  assert.equal(app.filteredListWords.length, 1);
  assert.deepEqual(app.selectedLoopWords.map((word) => word.id), [20, 18, 16, 14, 12, 10, 8]);
  assert.deepEqual(app.cappedLoopWords.map((word) => word.id), [20, 18, 16, 14, 12, 10]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test local-tests/main.test.js`
Expected: FAIL because `selectedLoopWords`, `cappedLoopWords`, or `listLoopGroupCount` do not exist.

- [ ] **Step 3: Write minimal implementation**

```js
// inside lexiconApp()
selectedLoopWordIds: [],
listLoopGroupCount: 1,

get selectedLoopWords() {
  const ids = new Set(this.selectedLoopWordIds);
  return this.words.filter((word) => ids.has(word.id));
},

get listLoopWordCap() {
  return this.listLoopGroupCount * 6;
},

get cappedLoopWords() {
  return this.selectedLoopWords.slice(0, this.listLoopWordCap);
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test local-tests/main.test.js`
Expected: PASS for the new selected-loop queue test.

- [ ] **Step 5: Commit**

```bash
git add local-tests/main.test.js public/assets/js/main.js
git commit -m "test: add list loop queue helpers"
```

### Task 2: Add loop-play language slot and stop conditions

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\main.test.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`

- [ ] **Step 1: Write the failing test**

```js
test("changing active list language stops list loop and updates active language", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.displayLanguage1 = "zh-TW";
  app.displayLanguage2 = "id";
  app.listQuickLanguageSlot = 1;
  app.listLoopPlaying = true;
  app.listLoopActiveWordId = 9;
  app.listLoopCurrentAudio = { pauseCalled: false, pause() { this.pauseCalled = true; } };

  app.toggleListQuickLanguage();

  assert.equal(app.activeListLanguage, "id");
  assert.equal(app.listLoopPlaying, false);
  assert.equal(app.listLoopActiveWordId, null);
  assert.equal(app.listLoopCurrentAudio, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test local-tests/main.test.js`
Expected: FAIL because `activeListLanguage`, `toggleListQuickLanguage`, or list loop stop behavior are missing.

- [ ] **Step 3: Write minimal implementation**

```js
listQuickLanguageSlot: 1,
listLoopPlaying: false,
listLoopActiveWordId: null,
listLoopGeneration: 0,
listLoopCurrentAudio: null,

get activeListLanguage() {
  return this.listQuickLanguageSlot === 2 ? this.displayLanguage2 : this.displayLanguage1;
},

stopListLoop() {
  this.listLoopGeneration += 1;
  this.listLoopPlaying = false;
  this.listLoopActiveWordId = null;
  if (this.listLoopCurrentAudio?.pause) {
    this.listLoopCurrentAudio.pause();
  }
  this.listLoopCurrentAudio = null;
},

toggleListQuickLanguage() {
  this.stopListLoop();
  this.listQuickLanguageSlot = this.listQuickLanguageSlot === 2 ? 1 : 2;
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test local-tests/main.test.js`
Expected: PASS for the language-slot stop-condition test.

- [ ] **Step 5: Commit**

```bash
git add local-tests/main.test.js public/assets/js/main.js
git commit -m "feat: add list loop language state"
```

### Task 3: Render list control bar and single-column cards

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\index.html`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\e2e-runner.js`

- [ ] **Step 1: Write the failing test**

```js
await step("list view renders loop controls and single-column cards", async () => {
  await page.getByTestId("nav-list").click();
  await expect(await page.getByTestId("list-loop-toggle").isVisible(), "list loop toggle should exist");
  await expect(await page.getByTestId("list-loop-size").isVisible(), "list loop size selector should exist");
  await expect(await page.getByTestId("list-language-toggle").isVisible(), "list language toggle should exist");
  await expect(await page.getByTestId("list-select-toggle").first().isVisible(), "list selection toggle should exist");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node local-tests/e2e-runner.js`
Expected: FAIL because list loop controls and selection toggles do not exist.

- [ ] **Step 3: Write minimal implementation**

```html
<div class="mb-4 space-y-3">
  <button type="button" data-testid="list-language-toggle" @click="toggleListQuickLanguage()">...</button>
  <select data-testid="list-loop-size" x-model.number="listLoopGroupCount">...</select>
  <button type="button" data-testid="list-loop-toggle" @click="toggleListLoop()">...</button>
</div>

<article class="rounded-2xl ...">
  <button type="button" data-testid="list-select-toggle" @click="toggleLoopWordSelection(word.id)">...</button>
</article>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node local-tests/e2e-runner.js`
Expected: PASS for the list-loop control render step.

- [ ] **Step 5: Commit**

```bash
git add index.html local-tests/e2e-runner.js
git commit -m "feat: reshape list page for loop play"
```

### Task 4: Implement selection-driven loop play and active highlight

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\main.test.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\e2e-runner.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\index.html`

- [ ] **Step 1: Write the failing test**

```js
test("toggleListLoop starts from capped selected words and second toggle stops", () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test local-tests/main.test.js`
Expected: FAIL because list loop toggle and playback sequencing are missing.

- [ ] **Step 3: Write minimal implementation**

```js
toggleLoopWordSelection(wordId) {
  this.stopListLoop();
  this.selectedLoopWordIds = this.selectedLoopWordIds.includes(wordId)
    ? this.selectedLoopWordIds.filter((id) => id !== wordId)
    : [...this.selectedLoopWordIds, wordId];
},

toggleListLoop() {
  if (this.listLoopPlaying) {
    this.stopListLoop();
    return;
  }

  const firstWord = this.playableLoopWords[0];
  if (!firstWord) {
    return;
  }

  this.listLoopGeneration += 1;
  this.listLoopPlaying = true;
  this.playSelectedLoopWord(firstWord, this.listLoopGeneration);
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test local-tests/main.test.js`
Run: `node local-tests/e2e-runner.js`
Expected: PASS for list multi-select loop behavior and active highlight.

- [ ] **Step 5: Commit**

```bash
git add local-tests/main.test.js local-tests/e2e-runner.js public/assets/js/main.js index.html
git commit -m "feat: add list multi-select loop playback"
```

### Task 5: Final verification and publish

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\docs\superpowers\specs\2026-05-30-list-view-loop-play-design.md`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\docs\superpowers\plans\2026-05-30-list-view-loop-play.md`

- [ ] **Step 1: Run focused unit tests**

Run: `node --test local-tests/main.test.js`
Expected: PASS

- [ ] **Step 2: Run full local test suite**

Run: `npm test`
Expected: PASS with `0` failures

- [ ] **Step 3: Run frontend e2e verification**

Run: `node local-tests/e2e-runner.js`
Expected: PASS

- [ ] **Step 4: Commit final integrated work**

```bash
git add index.html public/assets/js/main.js local-tests/main.test.js local-tests/e2e-runner.js docs/superpowers/specs/2026-05-30-list-view-loop-play-design.md docs/superpowers/plans/2026-05-30-list-view-loop-play.md
git commit -m "feat: 新增字庫分頁多選循環播放模式"
```

- [ ] **Step 5: Push main**

```bash
git push origin main
```

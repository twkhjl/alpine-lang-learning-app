# Frontend Grid View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontend six-slot grid view with contiguous paging, manual audio loop toggle, and active-card highlighting.

**Architecture:** Extend the existing `activeView`-based Alpine app instead of creating a parallel UI model. Keep grid paging and loop-play logic in `public/assets/js/main.js`, expose new derived state for the grid section in `index.html`, and verify behavior through unit tests plus the existing frontend e2e runner.

**Tech Stack:** Alpine.js, Tailwind CDN classes, plain browser `Audio`, Node test runner, Playwright-based local e2e script

---

### Task 1: Add grid state and paging helpers

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\main.test.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`

- [ ] **Step 1: Write the failing test**

```js
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
  assert.deepEqual(app.gridPageWords.map((word) => word.id), [7, 8]);
  assert.equal(app.gridSlots.length, 6);
  assert.deepEqual(
    app.gridSlots.map((slot) => slot.word?.id || null),
    [7, 8, null, null, null, null],
  );

  app.gridPageIndex = 99;
  app.clampGridPageIndex();
  assert.equal(app.gridPageIndex, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test local-tests/main.test.js`
Expected: FAIL because `gridTotalPages`, `gridPageWords`, `gridSlots`, or `clampGridPageIndex` are undefined.

- [ ] **Step 3: Write minimal implementation**

```js
const VALID_VIEWS = ["card", "grid", "list", "favorites", "settings"];

// inside lexiconApp()
gridPageIndex: 0,
gridPageSize: 6,

get gridSourceWords() {
  return this.visibleCardWords;
},

get gridTotalPages() {
  return this.gridSourceWords.length
    ? Math.ceil(this.gridSourceWords.length / this.gridPageSize)
    : 0;
},

get gridPageWords() {
  const start = this.gridPageIndex * this.gridPageSize;
  return this.gridSourceWords.slice(start, start + this.gridPageSize);
},

get gridSlots() {
  return Array.from({ length: this.gridPageSize }, (_, index) => ({
    index,
    word: this.gridPageWords[index] || null,
  }));
},

clampGridPageIndex() {
  if (!this.gridTotalPages) {
    this.gridPageIndex = 0;
    return;
  }

  if (this.gridPageIndex >= this.gridTotalPages) {
    this.gridPageIndex = this.gridTotalPages - 1;
  }

  if (this.gridPageIndex < 0) {
    this.gridPageIndex = 0;
  }
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test local-tests/main.test.js`
Expected: PASS for the new grid helper test.

- [ ] **Step 5: Commit**

```bash
git add local-tests/main.test.js public/assets/js/main.js
git commit -m "test: add grid paging helpers"
```

### Task 2: Add loop-play controller and cleanup behavior

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\main.test.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`

- [ ] **Step 1: Write the failing test**

```js
test("grid loop stops on page change and skips empty or silent slots", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = [
    { id: 1, tags: [], audioPaths: { "zh-TW": "one.mp3" } },
    { id: 2, tags: [], audioPaths: {} },
    { id: 3, tags: [], audioPaths: { "zh-TW": "three.mp3" } },
  ];
  app.selectedTagIds = [];
  app.statusFilters = ["all"];

  assert.deepEqual(app.gridPlayableIndexes, [0, 2]);

  app.gridLoopPlaying = true;
  app.gridLoopActiveIndex = 2;
  app.gridCurrentAudio = { pauseCalled: false, pause() { this.pauseCalled = true; } };
  app.goToNextGridPage();

  assert.equal(app.gridLoopPlaying, false);
  assert.equal(app.gridLoopActiveIndex, -1);
  assert.equal(app.gridCurrentAudio, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test local-tests/main.test.js`
Expected: FAIL because grid loop state, playable index helpers, or cleanup methods are missing.

- [ ] **Step 3: Write minimal implementation**

```js
// inside lexiconApp()
gridLoopPlaying: false,
gridLoopActiveIndex: -1,
gridLoopGeneration: 0,
gridCurrentAudio: null,

get gridPlayableIndexes() {
  return this.gridSlots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.word && this.hasAudio(slot.word))
    .map(({ index }) => index);
},

stopGridLoop() {
  this.gridLoopGeneration += 1;
  this.gridLoopPlaying = false;
  this.gridLoopActiveIndex = -1;
  if (this.gridCurrentAudio?.pause) {
    this.gridCurrentAudio.pause();
  }
  this.gridCurrentAudio = null;
},

goToNextGridPage() {
  this.stopGridLoop();
  if (this.gridPageIndex < this.gridTotalPages - 1) {
    this.gridPageIndex += 1;
  }
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test local-tests/main.test.js`
Expected: PASS for grid loop cleanup test.

- [ ] **Step 5: Commit**

```bash
git add local-tests/main.test.js public/assets/js/main.js
git commit -m "feat: add grid loop state control"
```

### Task 3: Render grid view in frontend UI

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\index.html`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`
- Test: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\e2e-runner.js`

- [ ] **Step 1: Write the failing test**

```js
await step("grid view renders six slots and paging controls", async () => {
  await page.getByTestId("nav-grid").click();
  await expect(await page.getByTestId("view-grid").isVisible(), "grid view should open");
  await expect(await page.getByTestId("grid-slot").count() === 6, "grid view should render six slots");
  await expect(await page.getByTestId("grid-next-page").isVisible(), "grid next button should exist");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node local-tests/e2e-runner.js`
Expected: FAIL because `nav-grid`, `view-grid`, or grid controls do not exist.

- [ ] **Step 3: Write minimal implementation**

```html
<section x-show="activeView === 'grid'" data-testid="view-grid">
  <div class="mb-4 flex items-center justify-between gap-3">
    <button type="button" data-testid="grid-prev-page" @click="goToPreviousGridPage()">...</button>
    <p x-text="gridProgressLabel()"></p>
    <button type="button" data-testid="grid-next-page" @click="goToNextGridPage()">...</button>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <template x-for="slot in gridSlots" :key="`grid-slot-${slot.index}-${slot.word ? slot.word.id : 'empty'}`">
      <article data-testid="grid-slot">...</article>
    </template>
  </div>
</section>

<button type="button" data-testid="nav-grid" @click="switchView('grid')">...</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node local-tests/e2e-runner.js`
Expected: PASS for the grid render step.

- [ ] **Step 5: Commit**

```bash
git add index.html public/assets/js/main.js local-tests/e2e-runner.js
git commit -m "feat: add frontend grid view"
```

### Task 4: Wire loop-play toggle and active highlight

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\index.html`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\main.test.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\e2e-runner.js`

- [ ] **Step 1: Write the failing test**

```js
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

  app.toggleGridLoop();
  assert.equal(app.gridLoopPlaying, true);
  assert.equal(app.gridLoopActiveIndex, 0);

  app.toggleGridLoop();
  assert.equal(app.gridLoopPlaying, false);
  assert.equal(app.gridLoopActiveIndex, -1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test local-tests/main.test.js`
Expected: FAIL because `toggleGridLoop` or `playGridSlotAudio` path is missing.

- [ ] **Step 3: Write minimal implementation**

```js
toggleGridLoop() {
  if (this.gridLoopPlaying) {
    this.stopGridLoop();
    return;
  }

  const firstPlayableIndex = this.gridPlayableIndexes[0];
  if (typeof firstPlayableIndex !== "number") {
    return;
  }

  this.gridLoopPlaying = true;
  this.playGridSlotAudio(firstPlayableIndex);
},
```

```html
<button type="button" data-testid="grid-loop-toggle" @click="toggleGridLoop()">...</button>
<article
  data-testid="grid-slot"
  :class="gridSlotClasses(slot)"
>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test local-tests/main.test.js`
Run: `node local-tests/e2e-runner.js`
Expected: PASS for loop-toggle behavior and active-card highlight checks.

- [ ] **Step 5: Commit**

```bash
git add index.html public/assets/js/main.js local-tests/main.test.js local-tests/e2e-runner.js
git commit -m "feat: add grid loop playback"
```

### Task 5: Final verification, docs, and publish

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\docs\superpowers\specs\2026-05-30-frontend-grid-view-design.md`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\docs\superpowers\plans\2026-05-30-frontend-grid-view.md`

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
git add index.html public/assets/js/main.js local-tests/main.test.js local-tests/e2e-runner.js docs/superpowers/specs/2026-05-30-frontend-grid-view-design.md docs/superpowers/plans/2026-05-30-frontend-grid-view.md
git commit -m "feat: 新增前台六宮格檢視模式"
```

- [ ] **Step 5: Push main**

```bash
git push origin main
```

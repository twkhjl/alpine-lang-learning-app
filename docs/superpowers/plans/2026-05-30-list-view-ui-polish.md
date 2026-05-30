# List View UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a selected-word panel and compact icon-first list controls while improving the visual hierarchy of selected and playing cards.

**Architecture:** Extend the current list loop-play UI in `index.html` and add lightweight panel state plus selected-item helpers in `public/assets/js/main.js`. Keep playback rules unchanged and verify behavior with focused unit tests and list-page e2e checks.

**Tech Stack:** Alpine.js, Tailwind utility classes, browser DOM events, Node test runner, Playwright-based local e2e script

---

### Task 1: Add selected panel state and helpers

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\main.test.js`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\public\assets\js\main.js`

- [ ] **Step 1: Write the failing test**

```js
test("selected panel opens, closes, and can remove one selected word", () => {
  const { lexiconApp } = loadMainScript();
  const app = lexiconApp();

  app.words = [
    { id: 3, tags: [], "lang_zh-TW": "三", audioPaths: { "zh-TW": "three.mp3" } },
    { id: 2, tags: [], "lang_zh-TW": "二", audioPaths: { "zh-TW": "two.mp3" } },
  ];
  app.selectedLoopWordIds = [3, 2];

  app.toggleSelectedLoopPanel();
  assert.equal(app.selectedLoopPanelOpen, true);
  assert.deepEqual(app.selectedLoopPanelWords.map((word) => word.id), [3, 2]);

  app.removeSelectedLoopWord(3);
  assert.deepEqual(app.selectedLoopWordIds, [2]);

  app.closeSelectedLoopPanel();
  assert.equal(app.selectedLoopPanelOpen, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test local-tests/main.test.js`
Expected: FAIL because selected panel state or helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```js
selectedLoopPanelOpen: false,

get selectedLoopPanelWords() {
  return this.selectedLoopWords;
},

toggleSelectedLoopPanel() {
  this.selectedLoopPanelOpen = !this.selectedLoopPanelOpen;
},

closeSelectedLoopPanel() {
  this.selectedLoopPanelOpen = false;
},

removeSelectedLoopWord(wordId) {
  this.stopListLoop();
  this.selectedLoopWordIds = this.selectedLoopWordIds.filter((id) => id !== wordId);
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test local-tests/main.test.js`
Expected: PASS for the selected panel helper test.

- [ ] **Step 5: Commit**

```bash
git add local-tests/main.test.js public/assets/js/main.js
git commit -m "feat: add selected panel helpers"
```

### Task 2: Add selected panel UI and icon-first control bar

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\index.html`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\e2e-runner.js`

- [ ] **Step 1: Write the failing test**

```js
await step("selected summary opens panel and remove action updates count", async () => {
  await page.getByTestId("nav-list").click();
  await page.getByTestId("list-select-toggle").nth(0).click();
  await page.getByTestId("list-selected-summary").click();
  await expect(await page.getByTestId("selected-loop-panel").isVisible(), "selected panel should open");
  await page.getByTestId("selected-loop-remove").first().click();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node local-tests/e2e-runner.js`
Expected: FAIL because the selected summary is not clickable or panel markup does not exist.

- [ ] **Step 3: Write minimal implementation**

```html
<button type="button" data-testid="list-selected-summary" @click="toggleSelectedLoopPanel()">...</button>

<div x-show="selectedLoopPanelOpen" data-testid="selected-loop-panel">
  <template x-for="word in selectedLoopPanelWords" :key="word.id">
    <button type="button" data-testid="selected-loop-remove" @click="removeSelectedLoopWord(word.id)">...</button>
  </template>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node local-tests/e2e-runner.js`
Expected: PASS for the selected panel interaction step.

- [ ] **Step 5: Commit**

```bash
git add index.html local-tests/e2e-runner.js
git commit -m "feat: add selected word panel UI"
```

### Task 3: Polish card selected and playing states

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\index.html`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\local-tests\e2e-runner.js`

- [ ] **Step 1: Write the failing test**

```js
await step("selected and playing cards use distinct visual states", async () => {
  await page.getByTestId("nav-list").click();
  await page.getByTestId("list-select-toggle").nth(0).click();
  await page.getByTestId("list-select-toggle").nth(1).click();
  await page.getByTestId("list-loop-toggle").click();
  await expect(await page.locator("[data-list-selected='true']").count() >= 2, "selected cards should expose selected state");
  await expect(await page.locator("[data-list-playing='true']").count() === 1, "only one card should expose playing state");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node local-tests/e2e-runner.js`
Expected: FAIL because selected and playing data attributes are not exposed.

- [ ] **Step 3: Write minimal implementation**

```html
<article
  :data-list-selected="isLoopWordSelected(word.id) ? 'true' : 'false'"
  :data-list-playing="isListLoopWordActive(word.id) ? 'true' : 'false'"
>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node local-tests/e2e-runner.js`
Expected: PASS for the visual-state distinction step.

- [ ] **Step 5: Commit**

```bash
git add index.html local-tests/e2e-runner.js
git commit -m "style: polish list card visual states"
```

### Task 4: Final verification

**Files:**
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\docs\superpowers\specs\2026-05-30-list-view-ui-polish-design.md`
- Modify: `D:\codes\alpineJsProjects\alpine-lang-learning-app\docs\superpowers\plans\2026-05-30-list-view-ui-polish.md`

- [ ] **Step 1: Run focused unit tests**

Run: `node --test local-tests/main.test.js`
Expected: PASS

- [ ] **Step 2: Run full local test suite**

Run: `npm test`
Expected: PASS with `0` failures

- [ ] **Step 3: Run frontend e2e verification**

Run: `node local-tests/e2e-runner.js`
Expected: PASS

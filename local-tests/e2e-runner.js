const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(__dirname, "output");
const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function createStaticServer() {
  return http.createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const safePath = requestPath === "/" ? "/index.html" : requestPath;
    const filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });
}

async function waitForAppReady(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("body[x-data]", { timeout: 15000 });
  await page.waitForFunction(() => !!window.Alpine, { timeout: 15000 });
  await page.waitForFunction(() => {
    const state = (() => {
      const body = document.body;
      if (!body || !body._x_dataStack || !body._x_dataStack.length) {
        return null;
      }
      return body._x_dataStack[0];
    })();
    return state && !state.loading && !state.error;
  }, { timeout: 30000 });
}

async function resetAppState(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
}

async function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  ensureOutputDir();
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const failures = [];

  page.on("console", (msg) => console.log(`BROWSER ${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (error) => console.log(`PAGEERROR ${error.message}`));

  async function step(name, fn) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      const screenshotPath = path.join(
        outputDir,
        `${name.replace(/\s+/g, "-").toLowerCase()}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      failures.push({ name, error: error.message, screenshotPath });
      console.log(`FAIL ${name}: ${error.message}`);
    }
  }

  try {
    await resetAppState(page);

    await step("admin login shell loads", async () => {
      await page.goto(`${baseUrl}/admin-login.html`, { waitUntil: "domcontentloaded" });
      await expect(
        (await page.locator("body[data-admin-page='admin-login.html']").count()) > 0,
        "admin login body not tagged",
      );
      await expect(
        (await page.locator(".login-form").count()) > 0,
        "admin login form missing",
      );
    });

    await step("signed-out admin dashboard redirects to login", async () => {
      await page.goto(`${baseUrl}/admin-dashboard.html`, { waitUntil: "domcontentloaded" });
      await page.waitForURL("**/admin-login.html", { timeout: 15000 });
      await expect(
        page.url().endsWith("/admin-login.html"),
        "signed-out admin dashboard should redirect to admin-login.html",
      );
      await expect(
        (await page.locator("body[data-admin-page='admin-login.html']").count()) > 0,
        "admin login body not tagged after redirect",
      );
    });

    await step("load app", async () => {
      await waitForAppReady(page);
      await expect(await page.locator("text=The Lexicon").count(), "app header not visible");
      const state = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return {
          activeView: current?.activeView,
          wordCount: current?.words?.length || 0,
          tagCount: current?.tags?.length || 0,
        };
      });
      await expect(state.activeView === "card", "default activeView should be card");
      await expect(state.wordCount > 0, "words were not loaded");
      await expect(state.tagCount > 0, "tags were not loaded");
      const filterButtonBox = await page.getByTestId("header-filter-toggle").boundingBox();
      const languageButtonBox = await page.getByTestId("quick-lang-toggle").boundingBox();
      await expect(
        !!filterButtonBox &&
          !!languageButtonBox &&
          filterButtonBox.x + filterButtonBox.width <= languageButtonBox.x,
        "header filter button should sit to the left of the language button",
      );
      await page.getByTestId("header-filter-toggle").click();
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.filterPanelOpen === true;
      });
      await page.keyboard.press("Escape");
    });

    await step("card and list should use descending id order", async () => {
      await waitForAppReady(page);
      const cardOrderState = await page.evaluate(() => {
        const body = document.body;
        const state =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        const wordIds = (state?.words || []).map((word) => word.id);
        return {
          maxWordId: wordIds.length ? Math.max(...wordIds) : null,
          currentCardWordId: state?.currentCardWord?.id || null,
        };
      });

      await expect(
        cardOrderState.currentCardWordId === cardOrderState.maxWordId,
        "card view should start from the highest word id",
      );

      await page.getByTestId("nav-list").click();
      await page.waitForFunction(() => {
        const body = document.body;
        const state =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return state?.activeView === "list";
      });

      const listOrderState = await page.evaluate(() => {
        const body = document.body;
        const state =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        const wordIds = (state?.words || []).map((word) => word.id);
        return {
          maxWordId: wordIds.length ? Math.max(...wordIds) : null,
          firstFilteredListWordId: state?.filteredListWords?.[0]?.id || null,
        };
      });

      await expect(
        listOrderState.firstFilteredListWordId === listOrderState.maxWordId,
        "list view should start from the highest word id",
      );
    });

    await step("card flow", async () => {
      await page.getByTestId("nav-card").click();
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.activeView === "card";
      });
      const beforeToggle = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;

        return {
          headlineText: current?.cardHeadlineText?.() || "",
          headlineLanguage: current?.cardHeadlineLanguage?.() || "",
          descriptor: current?.cardDescriptor?.(current?.currentCardWord) || "",
          audioLanguage: current?.audioLanguageForWord?.(current?.currentCardWord) || "",
          toggleLabel: current?.translationToggleLabel?.() || "",
          nextLanguageLabel:
            current?.getLocalizedLanguageLabel?.(current?.displayLanguage2) || "",
          displayLanguage1: current?.displayLanguage1 || "",
          displayLanguage2: current?.displayLanguage2 || "",
          pronunciation:
            current?.currentCardWord?.pronunciation?.[current?.displayLanguage1] || "",
          translatedText:
            current?.currentCardWord && window.lexiconTestUtils
              ? window.lexiconTestUtils.resolveWordText(
                  current.currentCardWord,
                  current.displayLanguage2,
                )
              : "",
        };
      });
      const headline = page.locator("article h2").first();
      const cardPronunciation = page.getByTestId("card-pronunciation");
      const cardArticle = page.locator("article").first();
      const cardBox = await cardArticle.boundingBox();
      const prevButtonBox = await cardArticle.getByRole("button", { name: /previous|上一|sebelumnya/i }).boundingBox();
      const nextButtonBox = await cardArticle.getByRole("button", { name: /next|下一|berikutnya/i }).boundingBox();
      const cardAudioButton = page.getByTestId("card-audio-button");
      const toggleButton = page.getByTestId("card-translation-toggle");
      const beforeHeadlineText = (await headline.textContent())?.trim() || "";
      const cardText = (await cardArticle.textContent()) || "";
      const headlineOverflowY = await headline.evaluate(
        (element) => window.getComputedStyle(element).overflowY,
      );
      const headlineMaxHeight = await headline.evaluate((element) => {
        const value = window.getComputedStyle(element).maxHeight;
        return Number.parseFloat(value);
      });
      const beforeToggleIcon = (await toggleButton.textContent())?.trim() || "";
      const audioButtonBox = await cardAudioButton.boundingBox();
      const toggleButtonBox = await toggleButton.boundingBox();

      await expect(
        beforeToggle.headlineLanguage === beforeToggle.displayLanguage1,
        "card headline should default to displayLanguage1",
      );
      await expect(
        beforeToggle.audioLanguage === beforeToggle.displayLanguage1,
        "card audio should default to displayLanguage1",
      );
      await expect(
        beforeHeadlineText === beforeToggle.headlineText,
        "headline DOM text should match displayLanguage1 text before toggle",
      );
      const cardPronunciationText = (await cardPronunciation.textContent())?.trim() || "";
      await expect(
        cardPronunciationText === beforeToggle.pronunciation,
        "card should show the current card pronunciation under the headline",
      );
      await expect(
        headlineOverflowY === "auto" && headlineMaxHeight > 0,
        "card headline should constrain height and allow vertical scrolling",
      );
      await expect(
        beforeToggle.descriptor && !cardText.includes(beforeToggle.descriptor),
        "card should not render the category descriptor in the learning view",
      );
      await expect(
        !!cardBox &&
          !!prevButtonBox &&
          !!nextButtonBox &&
          prevButtonBox.x - cardBox.x <= 8 &&
          cardBox.x + cardBox.width - (nextButtonBox.x + nextButtonBox.width) <= 8,
        "card navigation buttons should sit close to the card edges",
      );
      await expect(
        await cardAudioButton.isVisible(),
        "card audio button should stay visible near the word content",
      );
      await expect(beforeToggleIcon === "translate", "translation toggle should use translate icon only");
      await expect(
        !!audioButtonBox &&
          !!toggleButtonBox &&
          Math.round(audioButtonBox.width) === Math.round(toggleButtonBox.width) &&
          Math.round(audioButtonBox.height) === Math.round(toggleButtonBox.height),
        "translation toggle should match the audio button size",
      );
      await expect(
        !!audioButtonBox &&
          !!toggleButtonBox &&
          Math.abs(
            audioButtonBox.y +
              audioButtonBox.height / 2 -
              (toggleButtonBox.y + toggleButtonBox.height / 2),
          ) <= 1,
        "card audio and translation buttons should be horizontally aligned",
      );

      await toggleButton.click();
      const afterToggle = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;

        return {
          translationOpen: current?.showCardTranslation,
          headlineText: current?.cardHeadlineText?.() || "",
          headlineLanguage: current?.cardHeadlineLanguage?.() || "",
          audioLanguage: current?.audioLanguageForWord?.(current?.currentCardWord) || "",
          toggleLabel: current?.translationToggleLabel?.() || "",
          nextLanguageLabel:
            current?.getLocalizedLanguageLabel?.(current?.displayLanguage1) || "",
        };
      });
      const afterHeadlineText = (await headline.textContent())?.trim() || "";
      const afterToggleIcon = (await toggleButton.textContent())?.trim() || "";

      await expect(afterToggle.translationOpen === true, "showCardTranslation did not toggle on");
      await expect(
        afterToggle.headlineLanguage === beforeToggle.displayLanguage2,
        "card headline should switch to displayLanguage2 after toggle",
      );
      await expect(
        afterToggle.audioLanguage === beforeToggle.displayLanguage2,
        "card audio should switch to displayLanguage2 after toggle",
      );
      await expect(
        afterToggle.headlineText === beforeToggle.translatedText,
        "card headline text did not switch to translated text",
      );
      await expect(
        afterHeadlineText === beforeToggle.translatedText,
        "headline DOM text did not replace the original word with the translation",
      );
      await expect(afterToggleIcon === "translate", "translation toggle should keep translate icon after toggle");
      await expect(
        !(await cardPronunciation.isVisible()),
        "card pronunciation should hide when the active language has no pronunciation",
      );

      await toggleButton.click();
      const afterToggleBack = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;

        return {
          translationOpen: current?.showCardTranslation,
          headlineText: current?.cardHeadlineText?.() || "",
          headlineLanguage: current?.cardHeadlineLanguage?.() || "",
          audioLanguage: current?.audioLanguageForWord?.(current?.currentCardWord) || "",
        };
      });
      const restoredHeadlineText = (await headline.textContent())?.trim() || "";

      await expect(
        afterToggleBack.translationOpen === false,
        "showCardTranslation did not toggle off",
      );
      await expect(
        afterToggleBack.headlineLanguage === beforeToggle.displayLanguage1,
        "card headline should switch back to displayLanguage1 after second toggle",
      );
      await expect(
        afterToggleBack.audioLanguage === beforeToggle.displayLanguage1,
        "card audio should switch back to displayLanguage1 after second toggle",
      );
      await expect(
        afterToggleBack.headlineText === beforeToggle.headlineText,
        "card headline text did not restore the original word after second toggle",
      );
      await expect(
        restoredHeadlineText === beforeToggle.headlineText,
        "headline DOM text did not restore the original word after second toggle",
      );

      await page.getByTestId("card-status-favorite").click();
      const cardStatus = await page.evaluate(() => {
        const body = document.body;
        const state =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return {
          favorites: [...(state?.favoriteWordIds || [])],
          ignored: [...(state?.ignoredWordIds || [])],
        };
      });
      await expect(cardStatus.favorites.length === 1, "card favorite action did not persist");
      await expect(cardStatus.ignored.length === 0, "card favorite should clear ignored state");
    });

    await step("card view should use reduced bottom padding", async () => {
      await page.getByTestId("nav-card").click();
      await page.waitForFunction(() => {
        const body = document.body;
        const state =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return state?.activeView === "card";
      });

      const mainPaddingBottom = await page.evaluate(() => {
        const main = document.querySelector("main");
        return main ? window.getComputedStyle(main).paddingBottom : "";
      });

      await expect(
        mainPaddingBottom === "80px",
        "card view main bottom padding should be reduced for card view",
      );
    });

    await step("mobile card controls stay visible in short viewport", async () => {
      await page.setViewportSize({ width: 390, height: 720 });
      await waitForAppReady(page);

      const buttonBoxes = await Promise.all([
        page.getByTestId("card-status-normal").boundingBox(),
        page.getByTestId("card-status-favorite").boundingBox(),
        page.getByTestId("card-status-ignored").boundingBox(),
      ]);

      const viewportHeight = 720;
      for (let index = 0; index < buttonBoxes.length; index += 1) {
        const buttonBox = buttonBoxes[index];
        await expect(
          !!buttonBox && buttonBox.y + buttonBox.height <= viewportHeight,
          `card status button ${index + 1} should fit within viewport`,
        );
      }
    });

    await step("card ignore should not leave next ignore button focused", async () => {
      await waitForAppReady(page);
      await page.getByTestId("nav-card").click();
      await page.waitForFunction(() => {
        const body = document.body;
        const state =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return state?.activeView === "card";
      });
      const initialState = await page.evaluate(() => {
        const body = document.body;
        const state =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return {
          currentWordId: state?.currentCardWord?.id || null,
          currentCardIndex: state?.currentCardIndex || 0,
          favoriteWordIds: [...(state?.favoriteWordIds || [])],
          ignoredWordIds: [...(state?.ignoredWordIds || [])],
        };
      });

      try {
        await page.getByTestId("card-status-ignored").click();

        const nextState = await page.evaluate(() => {
          const body = document.body;
          const state =
            body && body._x_dataStack && body._x_dataStack.length
              ? body._x_dataStack[0]
              : null;
          const activeElement = document.activeElement;
          return {
            currentWordId: state?.currentCardWord?.id || null,
            ignoredWordIds: [...(state?.ignoredWordIds || [])],
            activeTestId:
              activeElement && activeElement.getAttribute
                ? activeElement.getAttribute("data-testid")
                : null,
          };
        });

        await expect(
          nextState.currentWordId !== initialState.currentWordId,
          "ignoring the current card should advance to the next visible word",
        );
        await expect(
          nextState.ignoredWordIds.includes(initialState.currentWordId),
          "ignored card should be stored in ignoredWordIds",
        );
        await expect(
          nextState.activeTestId !== "card-status-ignored",
          "ignore button focus should not carry over to the next card",
        );
      } finally {
        await page.evaluate((stateSnapshot) => {
          const body = document.body;
          const state =
            body && body._x_dataStack && body._x_dataStack.length
              ? body._x_dataStack[0]
              : null;
          if (!state) {
            return;
          }

          state.favoriteWordIds = [...stateSnapshot.favoriteWordIds];
          state.ignoredWordIds = [...stateSnapshot.ignoredWordIds];
          state.currentCardIndex = stateSnapshot.currentCardIndex;
          state.persistPreferences();
          document.activeElement?.blur?.();
        }, initialState);
      }
    });

    await step("list flow and modal", async () => {
      await page.getByTestId("nav-list").click();
      await page.getByTestId("list-search").fill("bagus");
      const visibleArticles = await page.locator("article").count();
      await expect(visibleArticles >= 1, "list search returned no results");

      await page.getByTestId("list-item-open").first().click();
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.detailModalOpen === true;
      });
      const modalOpen = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.detailModalOpen;
      });
      await expect(modalOpen === true, "detail modal did not open");
      const modalCard = page.getByTestId("modal-card");
      const modalCardBox = await modalCard.boundingBox();
      await expect(
        !!modalCardBox && Math.round(modalCardBox.height) === 480,
        "detail modal card should match the word card height",
      );
      await expect(
        (await modalCard.locator("button").filter({ hasText: /chevron/i }).count()) === 0,
        "detail modal should not render card navigation arrows",
      );
      await expect(await page.getByTestId("modal-close").isVisible(), "modal close button should remain visible");
      await expect(await page.getByTestId("modal-audio-button").isVisible(), "modal should use the card-style audio button");
      const modalAudioButtonBox = await page.getByTestId("modal-audio-button").boundingBox();
      const modalToggleButtonBox = await page.getByTestId("modal-translation-toggle").boundingBox();
      await expect(
        !!modalAudioButtonBox &&
          !!modalToggleButtonBox &&
          Math.abs(
            modalAudioButtonBox.y +
              modalAudioButtonBox.height / 2 -
              (modalToggleButtonBox.y + modalToggleButtonBox.height / 2),
          ) <= 1,
        "modal audio and translation buttons should be horizontally aligned",
      );
      const modalHeadline = page.locator(
        "xpath=//div[contains(@x-show, 'detailModalOpen') and contains(@x-show, 'activeWord')]//h2",
      );
      const modalHeadlineOverflowY = await modalHeadline.evaluate(
        (element) => window.getComputedStyle(element).overflowY,
      );
      const modalHeadlineMaxHeight = await modalHeadline.evaluate((element) => {
        const value = window.getComputedStyle(element).maxHeight;
        return Number.parseFloat(value);
      });
      await expect(
        modalHeadlineOverflowY === "auto" && modalHeadlineMaxHeight > 0,
        "detail modal headline should constrain height and allow vertical scrolling",
      );
      const originalModalWord = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        if (!current?.activeWord) {
          return null;
        }
        const original = {
          zhTW: current.activeWord["lang_zh-TW"],
          id: current.activeWord.lang_id,
          en: current.activeWord.lang_en,
        };
        const longWord = Array.from({ length: 8 }, () => "supercalifragilisticexpialidocious").join(" ");
        current.activeWord["lang_zh-TW"] = longWord;
        current.activeWord.lang_id = longWord;
        current.activeWord.lang_en = longWord;
        return original;
      });
      await page.waitForTimeout(100);
      for (const testId of [
        "modal-status-normal",
        "modal-status-favorite",
        "modal-status-ignored",
      ]) {
        const button = page.getByTestId(testId);
        const box = await button.boundingBox();
        await expect(await button.isVisible(), `${testId} should remain visible with a long word`);
        await expect(
          !!box && Math.round(box.width) === 44 && Math.round(box.height) === 44,
          `${testId} should match the card status control size`,
        );
      }
      await page.evaluate((original) => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        if (!current?.activeWord || !original) {
          return;
        }
        current.activeWord["lang_zh-TW"] = original.zhTW;
        current.activeWord.lang_id = original.id;
        current.activeWord.lang_en = original.en;
      }, originalModalWord);

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.detailModalOpen === false;
      });
      const modalClosed = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.detailModalOpen;
      });
      await expect(modalClosed === false, "detail modal did not close on Escape");
    });

    await step("favorites flow", async () => {
      await page.getByTestId("nav-favorites").click();
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.activeView === "favorites";
      });
      const activeView = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.activeView;
      });
      await expect(activeView === "favorites", "favorites nav did not switch view");

      const favoritesView = page.getByTestId("view-favorites");
      const favoriteCards = await favoritesView.getByTestId("favorites-item").count();
      await expect(favoriteCards >= 1, "favorites page should contain at least one item");

      const favoriteSearchTerm = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        const favoriteWord = current?.filteredFavoriteWords?.[0];
        return (
          favoriteWord?.lang_id ||
          favoriteWord?.["lang_zh-TW"] ||
          favoriteWord?.lang_en ||
          ""
        );
      });
      await page.getByTestId("favorites-search").fill(favoriteSearchTerm);
      const filteredCards = await favoritesView.getByTestId("favorites-item").count();
      await expect(filteredCards >= 1, "favorites search returned no results");

      await favoritesView.getByTestId("favorites-status-favorite").first().click();
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.favoritesSnackbar?.type === "removed";
      });
      const removedState = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return {
          favoriteCount: current?.favoriteWordIds?.length || 0,
          snackbarType: current?.favoritesSnackbar?.type || "",
        };
      });
      await expect(removedState.favoriteCount === 0, "favorite removal did not update state");
      await expect(removedState.snackbarType === "removed", "favorite removal snackbar did not appear");

      await page.getByRole("button", { name: /undo|復原|urungkan/i }).click();
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.favoritesSnackbar?.type === "restored";
      });
      const restoredState = await page.evaluate(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return {
          favoriteCount: current?.favoriteWordIds?.length || 0,
          snackbarMessage: current?.favoritesSnackbar?.message || "",
        };
      });
      await expect(restoredState.favoriteCount === 1, "favorite restore did not update state");
      await expect(!!restoredState.snackbarMessage, "favorite restore snackbar did not update");
    });

    await step("settings and language flow", async () => {
      await page.getByTestId("nav-settings").click();
      await page.waitForFunction(() => {
        const body = document.body;
        const current =
          body && body._x_dataStack && body._x_dataStack.length
            ? body._x_dataStack[0]
            : null;
        return current?.activeView === "settings";
      });

      await page.getByTestId("settings-display2-trigger").click();
      await page.getByTestId("settings-display2-option-en").click();
      await page.getByTestId("settings-save").click();

      const preferences = await page.evaluate(() => JSON.parse(localStorage.getItem("lexicon-preferences")));
      await expect(preferences.displayLanguage2 === "en", "settings did not persist displayLanguage2=en");
    });

    await step("quick language menu labels", async () => {
      await page.getByTestId("quick-lang-toggle").click();
      const iconText = (await page.getByTestId("quick-lang-toggle").textContent())?.trim() || "";
      await expect(iconText === "language", "quick language toggle should use the globe language icon");

      const labels = await page.locator("[data-testid^='quick-lang-option-label-']").evaluateAll((nodes) =>
        nodes.map((node) => node.textContent?.trim() || ""),
      );
      await expect(
        JSON.stringify(labels) === JSON.stringify(["繁體中文", "Bahasa Indonesia", "English"]),
        `quick language labels should use native names, got ${JSON.stringify(labels)}`,
      );
    });
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures.length) {
    const summaryPath = path.join(outputDir, "summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(failures, null, 2), "utf8");
    process.exitCode = 1;
    return;
  }

  console.log("All Playwright interaction checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

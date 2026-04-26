const assert = require("node:assert/strict");
const test = require("node:test");

const adminI18n = require("../public/assets/js/admin-i18n");

test("translate falls back to traditional chinese when locale is missing", () => {
  const globalObject = {
    document: {
      documentElement: {
        lang: "fr",
      },
    },
    localStorage: {
      getItem() {
        return null;
      },
    },
  };

  assert.equal(adminI18n.translate(globalObject, "shell.nav.words"), "字詞");
});

test("setLocale persists locale selection", () => {
  let storedValue = null;
  let dispatchedEvent = null;
  const document = {
    documentElement: { lang: "zh-TW" },
    dispatchEvent(event) {
      dispatchedEvent = event;
    },
    querySelectorAll() {
      return [];
    },
  };
  const globalObject = {
    document,
    localStorage: {
      getItem() {
        return null;
      },
      setItem(_key, value) {
        storedValue = value;
      },
    },
  };

  const locale = adminI18n.setLocale(globalObject, "en");

  assert.equal(locale, "en");
  assert.match(storedValue, /"locale":"en"/);
  assert.equal(document.documentElement.lang, "en");
  assert.equal(dispatchedEvent.type, "lexicon-admin-localechange");
});

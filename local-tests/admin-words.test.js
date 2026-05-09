const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adminI18n = require("../public/assets/js/admin-i18n");
const adminApi = require("../public/assets/js/admin-api");
const {
  bootstrap,
  buildBatchDeleteErrorMessage,
  buildBatchDeleteConfirmationMessage,
  buildBatchDeleteSuccessMessage,
  buildCreateWordUrl,
  buildSingleDeleteErrorMessage,
  buildSingleDeleteSuccessMessage,
  buildEditWordUrl,
  buildWordImagePreviewUrl,
  normalizeWordsPageState,
  renderWordRow,
  renderWordRows,
} = require("../public/assets/js/admin-words");

const zhTranslator = function (key, replacements = {}) {
  const table = {
    "words.table.tagFallback": "未分類",
    "words.table.edit": "編輯",
    "words.actions.delete": "刪除",
    "words.table.empty": "目前沒有符合條件的字詞。",
    "words.confirm.batchDeleteCount": "確定刪除 {count} 筆單字？",
    "words.confirm.batchDeleteIncludes": "包含：{labels}",
    "words.confirm.batchDeleteCascade": "圖片與音檔也會一併刪除。",
  };

  return Object.entries(replacements).reduce(function (message, [token, value]) {
    return message.replace(`{${token}}`, value);
  }, table[key] || key);
};

const enTranslator = function (key, replacements = {}) {
  const table = {
    "words.table.tagFallback": "Uncategorized",
    "words.table.edit": "Edit",
    "words.actions.delete": "Delete",
    "words.table.empty": "No matching words found.",
    "words.confirm.batchDeleteCount": "Delete {count} words?",
    "words.confirm.batchDeleteIncludes": "Includes: {labels}",
    "words.confirm.batchDeleteCascade": "Images and audio files will also be deleted.",
    "words.toast.deleteOneSuccess": "Word deleted.",
    "words.toast.deleteOneSuccessWithMedia": "Word deleted and {objectCount} media files removed.",
    "words.toast.deleteOneError": "Failed to delete word.",
    "words.toast.deleteBatchSuccess": "Deleted {count} words.",
    "words.toast.deleteBatchSuccessWithMedia": "Deleted {count} words and removed {objectCount} media files.",
    "words.toast.deleteBatchError": "Failed to delete selected words.",
    "words.toast.deleteOnePartialError": "Word deleted, but {objectCount} media files still need cleanup.",
    "words.toast.deleteBatchPartialError": "Deleted {count} words, but {objectCount} media files still need cleanup.",
  };

  return Object.entries(replacements).reduce(function (message, [token, value]) {
    return message.replace(`{${token}}`, value);
  }, table[key] || key);
};

function createFakeClassList() {
  const values = new Set();

  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    toggle(value, force) {
      if (force === undefined) {
        if (values.has(value)) {
          values.delete(value);
          return false;
        }
        values.add(value);
        return true;
      }

      if (force) {
        values.add(value);
        return true;
      }

      values.delete(value);
      return false;
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function createEventNode(initial = {}) {
  const listeners = new Map();

  return {
    textContent: initial.textContent || "",
    value: initial.value || "",
    checked: Boolean(initial.checked),
    disabled: Boolean(initial.disabled),
    attributes: { ...(initial.attributes || {}) },
    classList: createFakeClassList(),
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler);
    },
    async dispatch(eventName, event = {}) {
      const handler = listeners.get(eventName);
      if (!handler) {
        return undefined;
      }
      return handler(event);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    querySelectorAll() {
      return [];
    },
  };
}

function createWordsAdminTestContext(options = {}) {
  const confirmCalls = [];
  const successToasts = [];
  const errorToasts = [];
  const deleteWordCalls = [];
  const deleteWordsCalls = [];
  const wordItems = options.wordItems || [
    {
      id: 28,
      image_url: "",
      lang_zh_tw: "桌子",
      lang_id: "meja",
      lang_en: "table",
      tags: [],
      has_image: false,
      updated_at: "2026-04-26T02:12:00.000Z",
    },
    {
      id: 31,
      image_url: "",
      lang_zh_tw: "椅子",
      lang_id: "kursi",
      lang_en: "chair",
      tags: [],
      has_image: false,
      updated_at: "2026-04-26T02:10:00.000Z",
    },
  ];

  const searchInput = createEventNode();
  const tagFilter = createEventNode();
  const imageFilter = createEventNode();
  const audioFilter = createEventNode();
  const pageSizeFilter = createEventNode({ value: "25" });
  const statusNode = createEventNode();
  const summaryNode = createEventNode();
  const previousButton = createEventNode();
  const nextButton = createEventNode();
  const pageNode = createEventNode();
  const createLink = createEventNode();
  const selectAllCheckbox = createEventNode();
  const deleteSelectedButton = createEventNode({ disabled: true });
  const tableBody = createEventNode();
  const wordCheckboxes = [];
  const rowNodes = [];

  Object.defineProperty(tableBody, "innerHTML", {
    get() {
      return this._innerHTML || "";
    },
    set(value) {
      this._innerHTML = value;
      wordCheckboxes.length = 0;
      rowNodes.length = 0;

      const checkboxMatches = value.matchAll(/data-word-select-id="(\d+)"/g);
      for (const match of checkboxMatches) {
        wordCheckboxes.push(createEventNode({
          attributes: {
            "data-word-select-id": match[1],
          },
        }));
      }

      const rowCount = (value.match(/<tr>/g) || []).length;
      for (let index = 0; index < rowCount; index += 1) {
        rowNodes.push({});
      }
    },
  });

  tableBody.querySelectorAll = function (selector) {
    if (selector === "[data-word-select-id]") {
      return wordCheckboxes;
    }
    if (selector === "tr") {
      return rowNodes;
    }
    return [];
  };

  const document = {
    documentElement: { lang: "en" },
    body: { style: { visibility: "visible" } },
    getElementById(id) {
      return {
        "word-search": searchInput,
        "tag-filter": tagFilter,
        "image-filter": imageFilter,
        "audio-filter": audioFilter,
        "page-size-filter": pageSizeFilter,
      }[id] || null;
    },
    querySelector(selector) {
      return {
        "[data-words-status]": statusNode,
        "[data-words-table-body]": tableBody,
        "[data-words-summary]": summaryNode,
        "[data-words-prev]": previousButton,
        "[data-words-next]": nextButton,
        "[data-words-page]": pageNode,
        "[data-create-word-link]": createLink,
        "[data-words-select-all]": selectAllCheckbox,
        "[data-words-delete-selected]": deleteSelectedButton,
      }[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-word-select-id]") {
        return wordCheckboxes;
      }
      return [];
    },
  };

  const root = {
    document,
    localStorage: {
      getItem() {
        return JSON.stringify({ locale: "en" });
      },
    },
    location: {
      href: "admin-words.html",
    },
    setTimeout(handler) {
      handler();
      return 1;
    },
    clearTimeout() {},
    lexiconAdminAuth: {
      protectAdminPage() {
        return Promise.resolve({ allowed: true, client: { role: "admin-client" } });
      },
    },
    lexiconAdminI18n: adminI18n,
    lexiconAdminFeedback: {
      showConfirmDialog(options) {
        confirmCalls.push(options);
        return Promise.resolve(true);
      },
      showSuccessToast(message) {
        successToasts.push(message);
      },
      showErrorToast(message) {
        errorToasts.push(message);
      },
    },
    lexiconAdminApi: {
      getAdminSupabaseClient() {
        return { role: "fallback-client" };
      },
      loadTagList() {
        return Promise.resolve({ data: [] });
      },
      loadWordList() {
        return Promise.resolve({
          data: {
            total: wordItems.length,
            items: wordItems,
          },
        });
      },
      deleteWord(_client, wordId) {
        deleteWordCalls.push(wordId);
        if (options.deleteWordError) {
          if (typeof options.deleteWordError === "string") {
            return Promise.reject(new Error(options.deleteWordError));
          }
          return Promise.reject(options.deleteWordError);
        }
        return Promise.resolve(options.deleteWordResult || { deleted: true });
      },
      deleteWords(_client, wordIds) {
        deleteWordsCalls.push(wordIds);
        if (options.deleteWordsError) {
          if (typeof options.deleteWordsError === "string") {
            return Promise.reject(new Error(options.deleteWordsError));
          }
          return Promise.reject(options.deleteWordsError);
        }
        return Promise.resolve(options.deleteWordsResult || { deletedWordIds: wordIds });
      },
    },
  };

  return {
    confirmCalls,
    createLink,
    deleteSelectedButton,
    deleteWordCalls,
    deleteWordsCalls,
    errorToasts,
    root,
    statusNode,
    successToasts,
    tableBody,
    wordCheckboxes,
  };
}

test("normalizeWordsPageState normalizes filters and pagination", () => {
  assert.deepEqual(
    normalizeWordsPageState({
      q: " meja ",
      tagId: "4",
      hasImage: true,
      hasAudio: false,
      page: "2",
      pageSize: "50",
    }),
    {
      q: "meja",
      tagId: 4,
      hasImage: true,
      hasAudio: false,
      page: 2,
      pageSize: 50,
    },
  );
});

test("renderWordRow renders english delete button copy from translator", () => {
  const markup = renderWordRow(
    {
      id: 28,
      image_url: "imgs/202604120952.jpg",
      lang_zh_tw: "桌子",
      lang_id: "meja",
      lang_en: "table",
      tags: [1, 3],
      has_image: true,
      updated_at: "2026-04-26T02:12:00.000Z",
    },
    {
      t: enTranslator,
      locale: "en",
      imagePreviewUrl: "https://cdn.example.com/media/imgs/202604120952.jpg",
      serialNumber: 26,
      tagNameResolver: function (tagId) {
        return {
          1: "Furniture",
          3: "Home",
        }[tagId] || "";
      },
    },
  );

  assert.match(markup, />26</);
  assert.match(markup, /data-word-select-id="28"/);
  assert.match(markup, /Furniture/);
  assert.match(markup, /Home/);
  assert.match(markup, />Edit</);
  assert.match(markup, />Delete</);
  assert.doesNotMatch(markup, />刪除</);
});

test("buildBatchDeleteConfirmationMessage uses english copy", () => {
  assert.equal(
    buildBatchDeleteConfirmationMessage([
      { id: 28, label: "table" },
      { id: 31, label: "chair" },
      { id: 35, label: "book" },
      { id: 40, label: "lamp" },
    ], enTranslator),
    "Delete 4 words?\nIncludes: table, chair, book\nImages and audio files will also be deleted.",
  );
});

test("delete feedback builders surface media cleanup details", () => {
  assert.equal(
    buildSingleDeleteSuccessMessage(
      {
        id: 28,
        deleted: true,
        deletedObjectCount: 3,
      },
      {
        t: enTranslator,
        api: adminApi,
      },
    ),
    "Word deleted and 3 media files removed.",
  );

  assert.equal(
    buildBatchDeleteSuccessMessage(
      {
        deletedWordIds: [28, 31],
        deletedObjectCount: 5,
      },
      {
        requestedWordIds: [28, 31],
        t: enTranslator,
        api: adminApi,
      },
    ),
    "Deleted 2 words and removed 5 media files.",
  );

  assert.equal(
    buildSingleDeleteErrorMessage(
      {
        code: "INCONSISTENT_STATE",
        details: {
          wordId: 28,
          deletedObjectCount: 3,
        },
      },
      {
        requestedWordIds: [28],
        t: enTranslator,
        api: adminApi,
      },
    ),
    "Word deleted, but 3 media files still need cleanup.",
  );

  assert.equal(
    buildBatchDeleteErrorMessage(
      {
        code: "INCONSISTENT_STATE",
        details: {
          deletedWordIds: [28, 31],
          deletedObjectCount: 5,
        },
      },
      {
        requestedWordIds: [28, 31],
        t: enTranslator,
        api: adminApi,
      },
    ),
    "Deleted 2 words, but 5 media files still need cleanup.",
  );
});

test("renderWordRows returns localized empty state markup", () => {
  const markup = renderWordRows([], { t: zhTranslator });

  assert.match(markup, /目前沒有符合條件的字詞。/);
  assert.match(markup, /colspan="9"/);
});

test("renderWordRows calculates cross-page serial numbers", () => {
  const markup = renderWordRows(
    [
      {
        id: 28,
        image_url: "",
        lang_zh_tw: "桌子",
        lang_id: "meja",
        lang_en: "table",
        tags: [],
        has_image: false,
        updated_at: "2026-04-26T02:12:00.000Z",
      },
      {
        id: 27,
        image_url: "",
        lang_zh_tw: "椅子",
        lang_id: "kursi",
        lang_en: "chair",
        tags: [],
        has_image: false,
        updated_at: "2026-04-26T02:10:00.000Z",
      },
    ],
    {
      t: enTranslator,
      locale: "en",
      page: 2,
      pageSize: 25,
      tagNameResolver: function () {
        return "";
      },
    },
  );

  assert.match(markup, />26</);
  assert.match(markup, />27</);
});

test("buildWordImagePreviewUrl resolves storage key against media base url", () => {
  assert.equal(
    buildWordImagePreviewUrl(
      { LEXICON_MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com/media/" },
      "imgs/28.webp",
    ),
    "https://cdn.example.com/media/imgs/28.webp",
  );

  assert.equal(
    buildWordImagePreviewUrl(
      { LEXICON_MEDIA_PUBLIC_BASE_URL: "https://cdn.example.com/media/" },
      "https://assets.example.com/words/28.webp",
    ),
    "https://assets.example.com/words/28.webp",
  );
});

test("word page URL helpers generate edit and create links", () => {
  assert.equal(buildEditWordUrl(28), "admin-word-edit.html?id=28");
  assert.equal(buildCreateWordUrl(), "admin-word-edit.html?mode=create");
});

test("admin words page batch delete button uses i18n key", () => {
  const html = fs.readFileSync(path.join(process.cwd(), "admin-words.html"), "utf8");

  assert.match(html, /data-words-delete-selected/);
  assert.match(html, /data-i18n="words\.actions\.deleteSelected"/);
});

test("bootstrap localizes single delete confirm and success toast in english", async () => {
  const context = createWordsAdminTestContext({
    deleteWordResult: {
      id: 28,
      deleted: true,
      deletedObjectCount: 3,
    },
  });

  await bootstrap(context.root);

  const deleteButton = createEventNode({
    attributes: { "data-word-delete-id": "28" },
  });

  await context.tableBody.dispatch("click", {
    target: {
      closest(selector) {
        return selector === "[data-word-delete-id]" ? deleteButton : null;
      },
    },
  });

  assert.deepEqual(context.deleteWordCalls, [28]);
  assert.deepEqual(context.confirmCalls, [
    {
      title: "Confirm Deletion",
      message: "Delete this word? Its image and audio files will also be deleted.",
      confirmText: "Confirm",
      cancelText: "Cancel",
      tone: "danger",
    },
  ]);
  assert.deepEqual(context.successToasts, ["Word deleted and 3 media files removed."]);
});

test("bootstrap localizes batch delete confirm and success toast in english", async () => {
  const context = createWordsAdminTestContext({
    deleteWordsResult: {
      deletedWordIds: [28, 31],
      deletedObjectCount: 5,
    },
  });

  await bootstrap(context.root);

  context.wordCheckboxes[0].checked = true;
  await context.tableBody.dispatch("change", {
    target: {
      closest(selector) {
        return selector === "[data-word-select-id]" ? context.wordCheckboxes[0] : null;
      },
    },
  });

  context.wordCheckboxes[1].checked = true;
  await context.tableBody.dispatch("change", {
    target: {
      closest(selector) {
        return selector === "[data-word-select-id]" ? context.wordCheckboxes[1] : null;
      },
    },
  });

  await context.deleteSelectedButton.dispatch("click");

  assert.deepEqual(context.deleteWordsCalls, [[28, 31]]);
  assert.deepEqual(context.confirmCalls, [
    {
      title: "Confirm Deletion",
      message: "Delete 2 words?\nIncludes: 桌子, 椅子\nImages and audio files will also be deleted.",
      confirmText: "Confirm",
      cancelText: "Cancel",
      tone: "danger",
    },
  ]);
  assert.deepEqual(context.successToasts, ["Deleted 2 words and removed 5 media files."]);
});

test("bootstrap localizes single and batch delete error toasts in english", async () => {
  const singleContext = createWordsAdminTestContext({ deleteWordError: "Delete failed." });

  await bootstrap(singleContext.root);

  const deleteButton = createEventNode({
    attributes: { "data-word-delete-id": "28" },
  });

  await singleContext.tableBody.dispatch("click", {
    target: {
      closest(selector) {
        return selector === "[data-word-delete-id]" ? deleteButton : null;
      },
    },
  });

  assert.deepEqual(singleContext.errorToasts, ["Failed to delete word."]);
  assert.equal(singleContext.statusNode.textContent, "Delete failed.");

  const batchContext = createWordsAdminTestContext({ deleteWordsError: "Batch delete failed." });

  await bootstrap(batchContext.root);

  batchContext.wordCheckboxes[0].checked = true;
  await batchContext.tableBody.dispatch("change", {
    target: {
      closest(selector) {
        return selector === "[data-word-select-id]" ? batchContext.wordCheckboxes[0] : null;
      },
    },
  });

  await batchContext.deleteSelectedButton.dispatch("click");

  assert.deepEqual(batchContext.errorToasts, ["Failed to delete selected words."]);
  assert.equal(batchContext.statusNode.textContent, "Batch delete failed.");
});

test("bootstrap surfaces inconsistent-state delete details in english toasts", async () => {
  const singleContext = createWordsAdminTestContext({
    deleteWordError: Object.assign(
      new Error("Word was deleted, but media storage deletion did not complete."),
      {
        code: "INCONSISTENT_STATE",
        details: {
          wordId: 28,
          deletedObjectCount: 3,
        },
      },
    ),
  });

  await bootstrap(singleContext.root);

  const deleteButton = createEventNode({
    attributes: { "data-word-delete-id": "28" },
  });

  await singleContext.tableBody.dispatch("click", {
    target: {
      closest(selector) {
        return selector === "[data-word-delete-id]" ? deleteButton : null;
      },
    },
  });

  assert.deepEqual(singleContext.errorToasts, ["Word deleted, but 3 media files still need cleanup."]);
  assert.equal(singleContext.statusNode.textContent, "Word deleted, but 3 media files still need cleanup.");

  const batchContext = createWordsAdminTestContext({
    deleteWordsError: Object.assign(
      new Error("Words were deleted, but media storage deletion did not complete."),
      {
        code: "INCONSISTENT_STATE",
        details: {
          deletedWordIds: [28, 31],
          deletedObjectCount: 5,
        },
      },
    ),
  });

  await bootstrap(batchContext.root);

  batchContext.wordCheckboxes[0].checked = true;
  await batchContext.tableBody.dispatch("change", {
    target: {
      closest(selector) {
        return selector === "[data-word-select-id]" ? batchContext.wordCheckboxes[0] : null;
      },
    },
  });

  batchContext.wordCheckboxes[1].checked = true;
  await batchContext.tableBody.dispatch("change", {
    target: {
      closest(selector) {
        return selector === "[data-word-select-id]" ? batchContext.wordCheckboxes[1] : null;
      },
    },
  });

  await batchContext.deleteSelectedButton.dispatch("click");

  assert.deepEqual(batchContext.errorToasts, ["Deleted 2 words, but 5 media files still need cleanup."]);
  assert.equal(batchContext.statusNode.textContent, "Deleted 2 words, but 5 media files still need cleanup.");
});

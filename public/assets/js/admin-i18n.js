(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminI18n = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const STORAGE_KEY = "lexicon-admin-preferences";
  const DEFAULT_LOCALE = "zh-TW";
  const DICTIONARY = {
    "zh-TW": {
      "admin.pageTitle.assets": "素材參考",
      "admin.pageTitle.dashboard": "後台總覽",
      "admin.pageTitle.login": "管理員登入",
      "admin.pageTitle.tags": "標籤管理",
      "admin.pageTitle.wordEdit": "編輯字詞",
      "admin.pageTitle.words": "字詞管理",
      "assets.drawer.body1": "目前顯示的是資料庫中的 stored path。",
      "assets.drawer.body2": "你可以確認哪些字詞正在引用這個素材。",
      "assets.drawer.body3": "這個頁面暫時不提供 R2 實體檔案管理。",
      "assets.drawer.title": "使用說明",
      "assets.empty": "目前沒有符合條件的素材參考。",
      "assets.header.description": "瀏覽圖片與音檔引用關係，並確認資料庫中的 stored path。",
      "assets.header.title": "素材參考",
      "assets.language.all": "全部語言",
      "assets.language.label": "語言",
      "assets.search.label": "搜尋 stored path",
      "assets.search.placeholder": "例如 audios/id/meja.mp3",
      "assets.status.error": "載入素材參考失敗。",
      "assets.status.loaded": "共 {total} 筆，圖片 {images} 筆，音檔 {audios} 筆。",
      "assets.status.loading": "載入素材參考中...",
      "assets.table.language": "語言",
      "assets.table.path": "Stored Path",
      "assets.table.references": "引用字詞",
      "assets.table.type": "類型",
      "assets.tabs.all": "全部",
      "assets.tabs.audio": "音檔",
      "assets.tabs.image": "圖片",
      "assets.uploadSoon": "上傳功能即將推出",
      "common.loading": "載入中...",
      "dashboard.header.description": "查看字詞、標籤與媒體覆蓋情況，快速掌握後台狀態。",
      "dashboard.header.primaryAction": "建立字詞",
      "dashboard.header.title": "後台總覽",
      "dashboard.metrics.missingAudio": "缺少音檔",
      "dashboard.metrics.missingImage": "缺少圖片",
      "dashboard.metrics.totalTags": "標籤總數",
      "dashboard.metrics.totalWords": "字詞總數",
      "dashboard.recentWords.audio.available": "有音檔",
      "dashboard.recentWords.audio.missing": "缺少音檔",
      "dashboard.recentWords.empty": "目前沒有最近更新的單字。",
      "dashboard.recentWords.languages": "支援語言",
      "dashboard.recentWords.noTags": "未分類",
      "dashboard.recentWords.title": "最近更新的字詞",
      "dashboard.recentWords.viewAll": "查看全部",
      "dashboard.status.active": "運作中",
      "dashboard.status.description.api": "受保護的寫入 API",
      "dashboard.status.description.auth": "管理員登入與 session 驗證",
      "dashboard.status.description.database": "Lexicon 讀取模型",
      "dashboard.status.footer.error": "載入 dashboard 失敗。",
      "dashboard.status.footer.ready": "Dashboard 已更新。",
      "dashboard.status.loading": "載入 dashboard 中...",
      "dashboard.status.title": "系統狀態",
      "dashboard.table.audio": "音檔",
      "dashboard.table.tags": "標籤",
      "dashboard.table.updatedAt": "更新時間",
      "dashboard.table.word": "字詞",
      "login.actions.autoRedirect": "登入後會自動前往後台首頁",
      "login.actions.noDirectOpen": "請勿直接開啟受保護頁面",
      "login.brand.body": "使用管理員帳密登入後，系統會透過受保護的 API 寫入 Supabase session，並驗證是否具有 admin 權限。",
      "login.brand.heading": "管理員工作區",
      "login.brand.status": "登入成功後會自動導向後台頁面",
      "login.brand.title": "管理員登入",
      "login.button.busy": "登入中...",
      "login.button.submit": "登入管理員",
      "login.defaultMessage": "請輸入管理員帳號密碼以存取後台。",
      "login.error": "登入失敗，請確認使用者名稱或密碼是否正確。",
      "login.form.password": "密碼",
      "login.form.username": "使用者名稱",
      "login.success": "登入成功，正在前往後台...",
      "shell.brand.tagline": "Lexicon admin workspace",
      "shell.language.label": "語言",
      "shell.nav.ariaLabel": "後台主選單",
      "shell.nav.assets": "素材",
      "shell.nav.dashboard": "總覽",
      "shell.nav.logout": "登出",
      "shell.nav.tags": "標籤",
      "shell.nav.words": "字詞",
      "shell.userLabel": "管理員",
      "tags.actions.create": "新增標籤",
      "tags.actions.delete": "刪除",
      "tags.actions.edit": "編輯",
      "tags.empty": "目前沒有可顯示的標籤。",
      "tags.form.en": "英文名稱",
      "tags.form.icon": "圖示",
      "tags.form.id": "印尼文名稱",
      "tags.form.idReadonly": "標籤 ID",
      "tags.form.zhTw": "繁中名稱",
      "tags.header.description": "維護 taxonomy 標籤與多語名稱。",
      "tags.header.title": "標籤管理",
      "tags.modal.create": "新增標籤",
      "tags.modal.edit": "編輯標籤",
      "tags.modal.save": "儲存",
      "tags.modal.cancel": "取消",
      "tags.status.createSuccess": "標籤已建立。",
      "tags.status.deleteBlocked": "仍有字詞使用中的標籤無法刪除。",
      "tags.status.deleteSuccess": "標籤已刪除。",
      "tags.status.error": "標籤操作失敗。",
      "tags.status.loading": "載入標籤中...",
      "tags.status.saveSuccess": "標籤已更新。",
      "tags.summary": "共 {count} 個標籤",
      "tags.table.actions": "操作",
      "tags.table.en": "英文",
      "tags.table.icon": "圖示",
      "tags.table.id": "ID",
      "tags.table.idName": "印尼文",
      "tags.table.usage": "使用數",
      "tags.table.zhTw": "繁中",
      "wordEdit.actions.cancel": "回到列表",
      "wordEdit.actions.create": "建立字詞",
      "wordEdit.actions.save": "儲存變更",
      "wordEdit.fields.audioEn": "英文音檔",
      "wordEdit.fields.audioId": "印尼文音檔",
      "wordEdit.fields.audioZhTw": "繁中音檔",
      "wordEdit.fields.en": "英文",
      "wordEdit.fields.id": "印尼文",
      "wordEdit.fields.imageUrl": "圖片路徑或 URL",
      "wordEdit.fields.pronunciationEn": "英文發音",
      "wordEdit.fields.pronunciationId": "印尼文發音",
      "wordEdit.fields.pronunciationZhTw": "繁中發音",
      "wordEdit.fields.tags": "標籤",
      "wordEdit.fields.wordId": "字詞 ID",
      "wordEdit.fields.zhTw": "繁中",
      "wordEdit.header.createDescription": "建立新字詞並補齊多語內容與素材路徑。",
      "wordEdit.header.createTitle": "建立字詞",
      "wordEdit.header.editDescription": "編輯字詞內容、發音、音檔與標籤。",
      "wordEdit.header.editTitle": "編輯字詞",
      "wordEdit.invalid.description": "提供的字詞 ID 無效，已停用儲存功能。",
      "wordEdit.invalid.title": "無法載入字詞",
      "wordEdit.status.error": "字詞儲存失敗。",
      "wordEdit.status.invalidId": "無效的字詞 ID，請從字詞列表重新進入。",
      "wordEdit.status.loading": "載入字詞中...",
      "wordEdit.status.ready": "資料已載入，可以開始編輯。",
      "wordEdit.status.saved": "字詞已儲存。",
      "wordEdit.tags.empty": "目前沒有可選標籤。",
      "words.create": "建立字詞",
      "words.csvSoon": "CSV 功能即將推出",
      "words.empty": "目前沒有符合條件的字詞。",
      "words.filters.audio": "音檔",
      "words.filters.hasAudio": "有音檔",
      "words.filters.hasImage": "有圖片",
      "words.filters.image": "圖片",
      "words.filters.label": "篩選",
      "words.filters.pageSize": "每頁筆數",
      "words.filters.search": "搜尋字詞或標籤",
      "words.filters.searchPlaceholder": "例如 meja、food、桌子",
      "words.filters.tag": "標籤",
      "words.filters.unset": "全部",
      "words.header.description": "搜尋、篩選並管理字詞資料。",
      "words.header.title": "字詞管理",
      "words.pagination.label": "{page} / {totalPages}",
      "words.status.error": "載入字詞失敗。",
      "words.status.loading": "載入字詞中...",
      "words.summary": "顯示 {start}-{end} / 共 {total} 筆",
      "words.table.audioMissing": "缺少音檔",
      "words.table.audioReady": "音檔：{languages}",
      "words.table.edit": "編輯",
      "words.table.empty": "目前沒有符合條件的字詞。",
      "words.table.en": "英文",
      "words.table.id": "ID",
      "words.table.idText": "印尼文",
      "words.table.image": "圖片",
      "words.table.imageMissing": "缺少圖片",
      "words.table.imageReady": "有圖片",
      "words.table.media": "媒體",
      "words.table.tagFallback": "未分類",
      "words.table.tags": "標籤",
      "words.table.updatedAt": "更新時間",
      "words.table.wordZhTw": "繁中",
    },
    en: {
      "admin.pageTitle.assets": "Asset References",
      "admin.pageTitle.dashboard": "Dashboard",
      "admin.pageTitle.login": "Admin Login",
      "admin.pageTitle.tags": "Tag Management",
      "admin.pageTitle.wordEdit": "Edit Word",
      "admin.pageTitle.words": "Words",
      "assets.drawer.body1": "This page shows the exact stored paths kept in the database.",
      "assets.drawer.body2": "Use it to verify which words reference each asset.",
      "assets.drawer.body3": "R2 object management is not included yet.",
      "assets.drawer.title": "How To Use",
      "assets.empty": "No matching asset references found.",
      "assets.header.description": "Review image and audio references and confirm the stored paths saved in the database.",
      "assets.header.title": "Asset References",
      "assets.language.all": "All languages",
      "assets.language.label": "Language",
      "assets.search.label": "Search stored path",
      "assets.search.placeholder": "Example: audios/id/meja.mp3",
      "assets.status.error": "Failed to load asset references.",
      "assets.status.loaded": "{total} total, {images} images, {audios} audio files.",
      "assets.status.loading": "Loading asset references...",
      "assets.table.language": "Language",
      "assets.table.path": "Stored Path",
      "assets.table.references": "Referenced Words",
      "assets.table.type": "Type",
      "assets.tabs.all": "All",
      "assets.tabs.audio": "Audio",
      "assets.tabs.image": "Images",
      "assets.uploadSoon": "Upload is coming next",
      "common.loading": "Loading...",
      "dashboard.header.description": "Track word, tag, and media coverage from one place.",
      "dashboard.header.primaryAction": "Create Word",
      "dashboard.header.title": "Dashboard",
      "dashboard.metrics.missingAudio": "Missing Audio",
      "dashboard.metrics.missingImage": "Missing Images",
      "dashboard.metrics.totalTags": "Total Tags",
      "dashboard.metrics.totalWords": "Total Words",
      "dashboard.recentWords.audio.available": "Audio ready",
      "dashboard.recentWords.audio.missing": "Missing audio",
      "dashboard.recentWords.empty": "No recently updated words yet.",
      "dashboard.recentWords.languages": "Languages",
      "dashboard.recentWords.noTags": "Uncategorized",
      "dashboard.recentWords.title": "Recently Updated Words",
      "dashboard.recentWords.viewAll": "View all",
      "dashboard.status.active": "Operational",
      "dashboard.status.description.api": "Protected write API",
      "dashboard.status.description.auth": "Admin login and session checks",
      "dashboard.status.description.database": "Lexicon read model",
      "dashboard.status.footer.error": "Failed to load the dashboard.",
      "dashboard.status.footer.ready": "Dashboard updated.",
      "dashboard.status.loading": "Loading dashboard...",
      "dashboard.status.title": "System Status",
      "dashboard.table.audio": "Audio",
      "dashboard.table.tags": "Tags",
      "dashboard.table.updatedAt": "Updated At",
      "dashboard.table.word": "Word",
      "login.actions.autoRedirect": "You will be redirected to the dashboard after sign in.",
      "login.actions.noDirectOpen": "Do not open protected pages directly.",
      "login.brand.body": "After you sign in, the app stores a protected Supabase session and verifies that the account is allowed to access admin tools.",
      "login.brand.heading": "Admin Workspace",
      "login.brand.status": "Successful sign-in redirects you to the back office automatically.",
      "login.brand.title": "Admin Sign In",
      "login.button.busy": "Signing in...",
      "login.button.submit": "Sign In",
      "login.defaultMessage": "Enter your admin credentials to access the back office.",
      "login.error": "Login failed. Please check your username or password.",
      "login.form.password": "Password",
      "login.form.username": "Username",
      "login.success": "Signed in. Redirecting...",
      "shell.brand.tagline": "Lexicon admin workspace",
      "shell.language.label": "Language",
      "shell.nav.ariaLabel": "Admin navigation",
      "shell.nav.assets": "Assets",
      "shell.nav.dashboard": "Dashboard",
      "shell.nav.logout": "Logout",
      "shell.nav.tags": "Tags",
      "shell.nav.words": "Words",
      "shell.userLabel": "Admin",
      "tags.actions.create": "Create Tag",
      "tags.actions.delete": "Delete",
      "tags.actions.edit": "Edit",
      "tags.empty": "No tags to display yet.",
      "tags.form.en": "English Name",
      "tags.form.icon": "Icon",
      "tags.form.id": "Indonesian Name",
      "tags.form.idReadonly": "Tag ID",
      "tags.form.zhTw": "Traditional Chinese Name",
      "tags.header.description": "Maintain taxonomy tags and their localized names.",
      "tags.header.title": "Tag Management",
      "tags.modal.create": "Create Tag",
      "tags.modal.edit": "Edit Tag",
      "tags.modal.save": "Save",
      "tags.modal.cancel": "Cancel",
      "tags.status.createSuccess": "Tag created.",
      "tags.status.deleteBlocked": "Tags still in use cannot be deleted.",
      "tags.status.deleteSuccess": "Tag deleted.",
      "tags.status.error": "Tag request failed.",
      "tags.status.loading": "Loading tags...",
      "tags.status.saveSuccess": "Tag updated.",
      "tags.summary": "{count} tags",
      "tags.table.actions": "Actions",
      "tags.table.en": "English",
      "tags.table.icon": "Icon",
      "tags.table.id": "ID",
      "tags.table.idName": "Indonesian",
      "tags.table.usage": "Usage",
      "tags.table.zhTw": "Traditional Chinese",
      "wordEdit.actions.cancel": "Back To List",
      "wordEdit.actions.create": "Create Word",
      "wordEdit.actions.save": "Save Changes",
      "wordEdit.fields.audioEn": "English Audio",
      "wordEdit.fields.audioId": "Indonesian Audio",
      "wordEdit.fields.audioZhTw": "Traditional Chinese Audio",
      "wordEdit.fields.en": "English",
      "wordEdit.fields.id": "Indonesian",
      "wordEdit.fields.imageUrl": "Image Path Or URL",
      "wordEdit.fields.pronunciationEn": "English Pronunciation",
      "wordEdit.fields.pronunciationId": "Indonesian Pronunciation",
      "wordEdit.fields.pronunciationZhTw": "Traditional Chinese Pronunciation",
      "wordEdit.fields.tags": "Tags",
      "wordEdit.fields.wordId": "Word ID",
      "wordEdit.fields.zhTw": "Traditional Chinese",
      "wordEdit.header.createDescription": "Create a new word and fill in translations, audio, and media paths.",
      "wordEdit.header.createTitle": "Create Word",
      "wordEdit.header.editDescription": "Update translations, pronunciation, audio, and tags.",
      "wordEdit.header.editTitle": "Edit Word",
      "wordEdit.invalid.description": "The provided word ID is invalid and saving has been disabled.",
      "wordEdit.invalid.title": "Unable To Load Word",
      "wordEdit.status.error": "Failed to save the word.",
      "wordEdit.status.invalidId": "Invalid word ID. Re-open this page from the word list.",
      "wordEdit.status.loading": "Loading word...",
      "wordEdit.status.ready": "Word data loaded and ready to edit.",
      "wordEdit.status.saved": "Word saved.",
      "wordEdit.tags.empty": "No tags available yet.",
      "words.create": "Create Word",
      "words.csvSoon": "CSV tools are coming next",
      "words.empty": "No matching words found.",
      "words.filters.audio": "Audio",
      "words.filters.hasAudio": "Has audio",
      "words.filters.hasImage": "Has image",
      "words.filters.image": "Image",
      "words.filters.label": "Filters",
      "words.filters.pageSize": "Page Size",
      "words.filters.search": "Search words or tags",
      "words.filters.searchPlaceholder": "Example: meja, food, table",
      "words.filters.tag": "Tag",
      "words.filters.unset": "All",
      "words.header.description": "Search, filter, and maintain lexicon entries.",
      "words.header.title": "Words",
      "words.pagination.label": "{page} / {totalPages}",
      "words.status.error": "Failed to load words.",
      "words.status.loading": "Loading words...",
      "words.summary": "Showing {start}-{end} of {total}",
      "words.table.audioMissing": "Missing audio",
      "words.table.audioReady": "Audio: {languages}",
      "words.table.edit": "Edit",
      "words.table.empty": "No matching words found.",
      "words.table.en": "English",
      "words.table.id": "ID",
      "words.table.idText": "Indonesian",
      "words.table.image": "Image",
      "words.table.imageMissing": "Missing image",
      "words.table.imageReady": "Image ready",
      "words.table.media": "Media",
      "words.table.tagFallback": "Uncategorized",
      "words.table.tags": "Tags",
      "words.table.updatedAt": "Updated At",
      "words.table.wordZhTw": "Traditional Chinese",
    },
  };

  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function normalizeLocale(locale) {
    return locale === "en" ? "en" : DEFAULT_LOCALE;
  }

  function readStoredPreferences(activeRoot) {
    try {
      const raw = activeRoot.localStorage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeStoredPreferences(activeRoot, preferences) {
    try {
      activeRoot.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      return;
    }
  }

  function getLocale(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    return normalizeLocale(readStoredPreferences(activeRoot).locale || activeRoot.document?.documentElement?.lang);
  }

  function interpolate(message, replacements) {
    return Object.entries(replacements || {}).reduce(function (result, entry) {
      return result.replace(new RegExp("\\{" + entry[0] + "\\}", "g"), String(entry[1]));
    }, message);
  }

  function translate(globalObject, key, replacements) {
    const locale = getLocale(globalObject);
    const table = DICTIONARY[locale] || DICTIONARY[DEFAULT_LOCALE];
    const fallbackTable = DICTIONARY[DEFAULT_LOCALE];
    const template = table[key] || fallbackTable[key] || key;
    return interpolate(template, replacements || {});
  }

  function createTranslator(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    return {
      locale: getLocale(activeRoot),
      t: function (key, replacements) {
        return translate(activeRoot, key, replacements);
      },
    };
  }

  function applyTranslations(doc, globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = doc || activeRoot.document;
    const translator = createTranslator(activeRoot).t;

    if (!activeDocument?.querySelectorAll) {
      return;
    }

    activeDocument.querySelectorAll("[data-i18n], [data-i18n-placeholder], [data-i18n-aria-label], [data-i18n-title], [data-i18n-value]").forEach(function (node) {
      if (node.hasAttribute("data-i18n")) {
        node.textContent = translator(node.getAttribute("data-i18n"));
      }
      if (node.hasAttribute("data-i18n-placeholder")) {
        node.setAttribute("placeholder", translator(node.getAttribute("data-i18n-placeholder")));
      }
      if (node.hasAttribute("data-i18n-aria-label")) {
        node.setAttribute("aria-label", translator(node.getAttribute("data-i18n-aria-label")));
      }
      if (node.hasAttribute("data-i18n-title")) {
        node.setAttribute("title", translator(node.getAttribute("data-i18n-title")));
      }
      if (node.hasAttribute("data-i18n-value")) {
        node.setAttribute("value", translator(node.getAttribute("data-i18n-value")));
      }
    });

    activeDocument.querySelectorAll("[data-admin-locale]").forEach(function (node) {
      node.classList.toggle("active", node.getAttribute("data-admin-locale") === getLocale(activeRoot));
    });
  }

  function setLocale(globalObject, locale) {
    const activeRoot = resolveGlobalObject(globalObject);
    const nextLocale = normalizeLocale(locale);
    const preferences = readStoredPreferences(activeRoot);
    const LocaleEvent = typeof activeRoot.CustomEvent === "function"
      ? activeRoot.CustomEvent
      : function (type, init) {
          return {
            detail: init?.detail,
            type: type,
          };
        };

    writeStoredPreferences(activeRoot, Object.assign({}, preferences, {
      locale: nextLocale,
    }));

    if (activeRoot.document?.documentElement) {
      activeRoot.document.documentElement.lang = nextLocale;
    }

    activeRoot.document?.dispatchEvent(new LocaleEvent("lexicon-admin-localechange", {
      detail: { locale: nextLocale },
    }));
    applyTranslations(activeRoot.document, activeRoot);

    return nextLocale;
  }

  function bootstrap(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);

    if (activeRoot.document?.documentElement) {
      activeRoot.document.documentElement.lang = getLocale(activeRoot);
    }

    applyTranslations(activeRoot.document, activeRoot);

    activeRoot.document?.addEventListener("click", function (event) {
      const button = event.target.closest("[data-admin-locale]");
      if (!button) {
        return;
      }

      event.preventDefault();
      setLocale(activeRoot, button.getAttribute("data-admin-locale"));
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    DICTIONARY: DICTIONARY,
    STORAGE_KEY: STORAGE_KEY,
    applyTranslations: applyTranslations,
    bootstrap: bootstrap,
    createTranslator: createTranslator,
    getLocale: getLocale,
    setLocale: setLocale,
    translate: translate,
  };
});

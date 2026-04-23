tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-error-container": "#ffdad6",
        "surface-container": "#1f1f27",
        "on-primary-container": "#f4f1ff",
        "on-tertiary": "#502400",
        "on-surface": "#e4e1ed",
        outline: "#918fa0",
        "secondary-fixed": "#e2dfff",
        "inverse-on-surface": "#302f38",
        "on-secondary-fixed-variant": "#414177",
        "on-tertiary-container": "#ffefe7",
        "on-primary-fixed-variant": "#332dbc",
        "secondary-fixed-dim": "#c2c1ff",
        "surface-bright": "#393841",
        "surface-dim": "#13131b",
        surface: "#13131b",
        "on-primary-fixed": "#0c006b",
        "surface-container-low": "#1b1b23",
        "surface-container-highest": "#34343d",
        "inverse-primary": "#4d4ad5",
        "tertiary-fixed": "#ffdcc6",
        "error-container": "#93000a",
        "surface-container-high": "#2a2932",
        "on-tertiary-fixed": "#311300",
        "on-secondary": "#2a2a5f",
        "primary-container": "#5e5ce6",
        "primary-fixed-dim": "#c2c1ff",
        "on-tertiary-fixed-variant": "#723600",
        tertiary: "#ffb786",
        secondary: "#c2c1ff",
        "on-background": "#e4e1ed",
        "on-secondary-fixed": "#151449",
        primary: "#c2c1ff",
        "on-error": "#690005",
        "tertiary-fixed-dim": "#ffb786",
        "on-surface-variant": "#c7c4d7",
        error: "#ffb4ab",
        "surface-container-lowest": "#0e0d15",
        "inverse-surface": "#e4e1ed",
        "secondary-container": "#43437a",
        "tertiary-container": "#ae5600",
        background: "#13131b",
        "surface-tint": "#c2c1ff",
        "on-primary": "#1800a7",
        "surface-variant": "#34343d",
        "outline-variant": "#464554",
        "on-secondary-container": "#b3b3f1",
        "primary-fixed": "#e2dfff",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
      boxShadow: {
        ambient: "0 8px 32px rgba(94, 92, 230, 0.25)",
      },
    },
  },
};

const STATUS = {
  NORMAL: "normal",
  FAVORITE: "favorite",
  IGNORED: "ignored",
};

const DEFAULT_PREFERENCES = {
  version: 3,
  nativeLanguage: "zh-TW",
  displayLanguage1: "zh-TW",
  displayLanguage2: "id",
  activeView: "card",
  lastContentView: "card",
  selectedTagIds: [],
  cardLanguageSlot: 1,
  favoriteWordIds: [],
  ignoredWordIds: [],
  statusFilters: ["all"],
};

const VALID_VIEWS = ["card", "list", "favorites", "settings"];
const VALID_STATUS_FILTERS = ["all", "favorite", "ignored", "normal"];

function uniqueNumberArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => Number.isInteger(item)))];
}

function uniqueStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => typeof item === "string"))];
}

function normalizeStatusCollections(favoriteIds, ignoredIds) {
  const favorites = uniqueNumberArray(favoriteIds);
  const ignored = uniqueNumberArray(ignoredIds).filter(
    (id) => !favorites.includes(id),
  );

  return {
    favoriteWordIds: favorites,
    ignoredWordIds: ignored,
  };
}

function resolvePreferredValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

function getWordValue(word, languageCode) {
  const map = {
    "zh-TW": "lang_zh-TW",
    id: "lang_id",
    en: "lang_en",
  };
  const key = map[languageCode];
  return key ? word[key] || "" : "";
}

function resolveWordText(word, languageCode, fallbacks = ["zh-TW", "id", "en"]) {
  if (!word) {
    return "";
  }

  const candidateLanguages = [languageCode, ...fallbacks].filter(Boolean);
  for (const candidate of candidateLanguages) {
    const value = getWordValue(word, candidate);
    if (value) {
      return value;
    }
  }

  return "";
}

function getPronunciationValue(word, languageCode) {
  const value = word?.pronunciation?.[languageCode];
  return typeof value === "string" ? value : "";
}

function resolveWordPronunciation(word, languageCode) {
  if (!word) {
    return "";
  }

  return getPronunciationValue(word, languageCode);
}

function wordMatchesQuery(word, query) {
  const normalized = (query || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return ["zh-TW", "id", "en"].some((languageCode) =>
    resolveWordText(word, languageCode).toLowerCase().includes(normalized),
  );
}

function normalizePreferences(saved, languages = []) {
  const languageCodes = languages.map((language) => language.code);
  const preferred = {
    ...DEFAULT_PREFERENCES,
    ...(saved && typeof saved === "object" ? saved : {}),
  };
  const normalizedStatus = normalizeStatusCollections(
    preferred.favoriteWordIds,
    preferred.ignoredWordIds,
  );

  const nativeLanguage = languageCodes.includes(preferred.nativeLanguage)
    ? preferred.nativeLanguage
    : DEFAULT_PREFERENCES.nativeLanguage;

  let displayLanguage1 = languageCodes.includes(preferred.displayLanguage1)
    ? preferred.displayLanguage1
    : DEFAULT_PREFERENCES.displayLanguage1;

  let displayLanguage2 = languageCodes.includes(preferred.displayLanguage2)
    ? preferred.displayLanguage2
    : DEFAULT_PREFERENCES.displayLanguage2;

  if (displayLanguage1 === displayLanguage2) {
    displayLanguage2 =
      languageCodes.find((code) => code !== displayLanguage1) ||
      DEFAULT_PREFERENCES.displayLanguage2;
  }

  const rawStatusFilters = Array.isArray(preferred.statusFilters)
    ? preferred.statusFilters
    : preferred.statusFilter
      ? [preferred.statusFilter]
      : DEFAULT_PREFERENCES.statusFilters;
  const normalizedFilters = uniqueStringArray(rawStatusFilters).filter((value) =>
    VALID_STATUS_FILTERS.includes(value),
  );
  const statusFilters = normalizedFilters.length
    ? normalizedFilters.includes("all")
      ? ["all"]
      : normalizedFilters
    : DEFAULT_PREFERENCES.statusFilters;

  return {
    version: 3,
    nativeLanguage,
    displayLanguage1,
    displayLanguage2,
    activeView: VALID_VIEWS.includes(preferred.activeView)
      ? preferred.activeView
      : preferred.activeView === "tags" &&
          ["card", "list", "favorites"].includes(preferred.lastContentView)
        ? preferred.lastContentView
        : DEFAULT_PREFERENCES.activeView,
    lastContentView: ["card", "list", "favorites"].includes(
      preferred.lastContentView,
    )
      ? preferred.lastContentView
      : DEFAULT_PREFERENCES.lastContentView,
    selectedTagIds: uniqueNumberArray(preferred.selectedTagIds),
    cardLanguageSlot: preferred.cardLanguageSlot === 2 ? 2 : 1,
    favoriteWordIds: normalizedStatus.favoriteWordIds,
    ignoredWordIds: normalizedStatus.ignoredWordIds,
    statusFilters,
  };
}

function getWordStatus(wordId, favoriteWordIds, ignoredWordIds) {
  if (favoriteWordIds.includes(wordId)) {
    return STATUS.FAVORITE;
  }
  if (ignoredWordIds.includes(wordId)) {
    return STATUS.IGNORED;
  }
  return STATUS.NORMAL;
}

function applyExclusiveStatus(wordId, nextStatus, favoriteWordIds, ignoredWordIds) {
  const cleanedFavorites = uniqueNumberArray(favoriteWordIds).filter(
    (id) => id !== wordId,
  );
  const cleanedIgnored = uniqueNumberArray(ignoredWordIds).filter(
    (id) => id !== wordId,
  );

  if (nextStatus === STATUS.FAVORITE) {
    cleanedFavorites.push(wordId);
  } else if (nextStatus === STATUS.IGNORED) {
    cleanedIgnored.push(wordId);
  }

  return normalizeStatusCollections(cleanedFavorites, cleanedIgnored);
}

function sortWordsByDescendingId(words) {
  return [...words].sort((left, right) => right.id - left.id);
}

window.lexiconTestUtils = {
  STATUS,
  DEFAULT_PREFERENCES,
  uniqueNumberArray,
  uniqueStringArray,
  normalizeStatusCollections,
  resolveWordText,
  resolveWordPronunciation,
  wordMatchesQuery,
  normalizePreferences,
  getWordStatus,
  applyExclusiveStatus,
  sortWordsByDescendingId,
};

function lexiconApp() {
  return {
    loading: true,
    error: "",
    words: [],
    tags: [],
    translations: {},
    languages: [],
    activeView: "card",
    lastContentView: "card",
    currentCardIndex: 0,
    cardLanguageSlot: 1,
    nativeLanguage: "zh-TW",
    displayLanguage1: "zh-TW",
    displayLanguage2: "id",
    searchQuery: "",
    favoritesQuery: "",
    selectedTagIds: [],
    draftTagIds: [],
    draftStatusFilters: ["all"],
    quickLangOpen: false,
    openSettingSelect: null,
    filterPanelOpen: false,
    settingsSaved: false,
    settingsError: "",
    detailModalOpen: false,
    activeWordId: null,
    showCardTranslation: false,
    statusFilters: ["all"],
    favoriteWordIds: [],
    ignoredWordIds: [],
    touchStartX: 0,
    touchOffsetX: 0,
    touchActive: false,
    cardMotionClass: "",
    motionTimer: null,
    saveTimer: null,
    favoritesSnackbar: null,
    favoritesSnackbarTimer: null,
    keydownHandler: null,

    get activeWord() {
      return this.words.find((word) => word.id === this.activeWordId) || null;
    },

    get filteredWordsByTags() {
      return this.words.filter((word) => this.wordMatchesSelectedTags(word));
    },

    get visibleCardWords() {
      return this.filteredWordsByTags.filter((word) => {
        if (this.wordStatus(word) === STATUS.IGNORED) {
          return false;
        }

        return this.wordMatchesStatusFilter(word);
      });
    },

    get filteredListWords() {
      return this.filteredWordsByTags
        .filter((word) => this.wordMatchesStatusFilter(word))
        .filter((word) => wordMatchesQuery(word, this.searchQuery));
    },

    get filteredFavoriteWords() {
      return this.filteredWordsByTags
        .filter((word) => this.wordStatus(word) === STATUS.FAVORITE)
        .filter((word) => this.wordMatchesStatusFilter(word))
        .filter((word) => wordMatchesQuery(word, this.favoritesQuery));
    },

    get currentCardWord() {
      return this.visibleCardWords[this.currentCardIndex] || null;
    },

    get cardStyle() {
      const backgroundImage = this.currentCardWord?.img
        ? `url(${this.currentCardWord.img})`
        : "linear-gradient(135deg, rgba(94, 92, 230, 0.26), rgba(14, 13, 21, 0.88))";

      return {
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transform: this.touchOffsetX ? `translateX(${this.touchOffsetX}px)` : "",
      };
    },

    activeWordCardStyle() {
      const backgroundImage = this.activeWord?.img
        ? `url(${this.activeWord.img})`
        : "linear-gradient(135deg, rgba(94, 92, 230, 0.26), rgba(14, 13, 21, 0.88))";

      return {
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    },

    get activeTagSummary() {
      if (!this.selectedTagIds.length) {
        return this.t("allTerms");
      }

      if (this.selectedTagIds.length === 1) {
        const tag = this.tags.find((item) => item.id === this.selectedTagIds[0]);
        return tag ? this.getTagName(tag) : this.t("allTerms");
      }

      return this.t("selectedTagCount", { count: this.selectedTagIds.length });
    },

    get progressLabel() {
      return this.t("cardOf", {
        current: this.visibleCardWords.length ? this.currentCardIndex + 1 : 0,
        total: this.visibleCardWords.length,
      });
    },

    get activeStatusFilters() {
      if (!Array.isArray(this.statusFilters) || !this.statusFilters.length) {
        return ["all"];
      }

      return this.statusFilters.includes("all") ? ["all"] : this.statusFilters;
    },

    get currentStatusFilterSummary() {
      const active = this.activeStatusFilters;
      if (active.includes("all")) {
        return this.t("statusFilterAll");
      }
      if (active.length === 1) {
        const option = this.statusFilterOptions.find((item) => item.value === active[0]);
        return option ? option.label : this.t("statusFilterAll");
      }
      return this.t("selectedStatusCount", { count: active.length });
    },

    get activeFilterCount() {
      const statusCount = this.activeStatusFilters.includes("all")
        ? 0
        : this.activeStatusFilters.length;
      return this.selectedTagIds.length + statusCount;
    },

    get activeFilterSummary() {
      if (!this.activeFilterCount) {
        return this.t("allTerms");
      }
      return this.t("activeFilterCount", { count: this.activeFilterCount });
    },

    get statusFilterOptions() {
      return [
        {
          value: "all",
          label: this.t("statusFilterAll"),
          icon: "apps",
        },
        {
          value: "favorite",
          label: this.t("statusFilterFavorite"),
          icon: "favorite",
        },
        {
          value: "ignored",
          label: this.t("statusFilterIgnored"),
          icon: "do_not_disturb_on",
        },
        {
          value: "normal",
          label: this.t("statusFilterNormal"),
          icon: "auto_stories",
        },
      ];
    },

    get activeDraftStatusFilters() {
      if (!Array.isArray(this.draftStatusFilters) || !this.draftStatusFilters.length) {
        return ["all"];
      }

      return this.draftStatusFilters.includes("all") ? ["all"] : this.draftStatusFilters;
    },

    async init() {
      this.loading = true;
      this.error = "";

      try {
        const [wordsResponse, tagsResponse, langIndexResponse] = await Promise.all([
          fetch("./data/lang.json"),
          fetch("./data/tags.json"),
          fetch("./data/lang/index.json"),
        ]);

        if (!wordsResponse.ok || !tagsResponse.ok || !langIndexResponse.ok) {
          throw new Error(
            "Unable to load JSON data. Please use a local HTTP server to open this page.",
          );
        }

        const [words, tags, langIndex] = await Promise.all([
          wordsResponse.json(),
          tagsResponse.json(),
          langIndexResponse.json(),
        ]);

        this.languages = Array.isArray(langIndex.languages) ? langIndex.languages : [];
        await this.loadTranslations(this.languages);

        this.tags = tags.map((tag) => this.normalizeTag(tag));
        this.words = sortWordsByDescendingId(
          words.map((word) => this.normalizeWord(word)),
        );

        this.loadPreferences();
        this.ensureLanguagesAreValid();
        this.applyDocumentLanguage();
        this.clampCardIndex();
      } catch (error) {
        this.error = error.message || "Unknown error";
      } finally {
        this.loading = false;
      }

      this.keydownHandler = this.handleKeydown.bind(this);
      window.addEventListener("keydown", this.keydownHandler);
    },

    normalizeTag(tag) {
      return {
        ...tag,
        icon: tag.icon || "sell",
        name_en: tag.name_en || "",
        name_id: tag.name_id || "",
        name_zh_tw: tag.name_zh_tw || "",
      };
    },

    normalizeWord(word) {
      return {
        ...word,
        lang_en: word.lang_en || "",
        img: typeof word.img === "string" ? word.img : "",
        pronunciation: {
          "zh-TW": word.pronunciation?.["zh-TW"] || "",
          id: word.pronunciation?.id || "",
          en: word.pronunciation?.en || "",
        },
        audioPaths: {
          "zh-TW":
            word.audio && word.audio["zh-TW"]
              ? `public/assets/audios/zh-TW/${word.audio["zh-TW"]}`
              : "",
          id:
            word.audio && word.audio.id
              ? `public/assets/audios/id/${word.audio.id}`
              : "",
          en:
            word.audio && word.audio.en
              ? `public/assets/audios/en/${word.audio.en}`
              : "",
        },
      };
    },

    async loadTranslations(languages) {
      const loaded = {};
      await Promise.all(
        languages.map(async (language) => {
          const response = await fetch(`./data/lang/${language.code}.json`);
          if (!response.ok) {
            throw new Error(`Unable to load translations for ${language.code}.`);
          }
          loaded[language.code] = await response.json();
        }),
      );

      this.translations = loaded;
    },

    loadPreferences() {
      try {
        const raw = localStorage.getItem("lexicon-preferences");
        const parsed = raw ? JSON.parse(raw) : {};
        const normalized = normalizePreferences(parsed, this.languages);

        this.nativeLanguage = normalized.nativeLanguage;
        this.displayLanguage1 = normalized.displayLanguage1;
        this.displayLanguage2 = normalized.displayLanguage2;
        this.activeView = normalized.activeView;
        this.lastContentView = normalized.lastContentView;
        this.selectedTagIds = normalized.selectedTagIds;
        this.cardLanguageSlot = normalized.cardLanguageSlot;
        this.favoriteWordIds = normalized.favoriteWordIds;
        this.ignoredWordIds = normalized.ignoredWordIds;
        this.statusFilters = normalized.statusFilters;
      } catch (_error) {
        localStorage.removeItem("lexicon-preferences");
      }
    },

    persistPreferences() {
      const payload = {
        version: 3,
        nativeLanguage: this.nativeLanguage,
        displayLanguage1: this.displayLanguage1,
        displayLanguage2: this.displayLanguage2,
        activeView: this.activeView,
        lastContentView: this.lastContentView,
        selectedTagIds: this.selectedTagIds,
        cardLanguageSlot: this.cardLanguageSlot,
        favoriteWordIds: this.favoriteWordIds,
        ignoredWordIds: this.ignoredWordIds,
        statusFilters: this.activeStatusFilters,
      };

      localStorage.setItem("lexicon-preferences", JSON.stringify(payload));
    },

    savePreferences() {
      this.settingsError = "";
      if (this.displayLanguage1 === this.displayLanguage2) {
        this.settingsError = this.t("languageMismatchError");
        return;
      }

      this.ensureLanguagesAreValid();
      this.applyDocumentLanguage();
      this.persistPreferences();
      this.openSettingSelect = null;
      this.settingsSaved = true;
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.settingsSaved = false;
      }, 1600);
    },

    ensureLanguagesAreValid() {
      const codes = this.languages.map((language) => language.code);
      if (!codes.includes(this.nativeLanguage)) {
        this.nativeLanguage = DEFAULT_PREFERENCES.nativeLanguage;
      }
      if (!codes.includes(this.displayLanguage1)) {
        this.displayLanguage1 = DEFAULT_PREFERENCES.displayLanguage1;
      }
      if (!codes.includes(this.displayLanguage2)) {
        this.displayLanguage2 =
          codes.find((code) => code !== this.displayLanguage1) ||
          DEFAULT_PREFERENCES.displayLanguage2;
      }
      if (this.displayLanguage1 === this.displayLanguage2) {
        this.displayLanguage2 =
          codes.find((code) => code !== this.displayLanguage1) ||
          DEFAULT_PREFERENCES.displayLanguage2;
      }
    },

    applyDocumentLanguage() {
      document.documentElement.lang = this.nativeLanguage;
    },

    toggleSettingSelect(field) {
      this.openSettingSelect = this.openSettingSelect === field ? null : field;
    },

    selectLanguage(field, code) {
      this[field] = code;
      this.ensureLanguagesAreValid();
      this.applyDocumentLanguage();
      this.persistPreferences();
      this.openSettingSelect = null;
      this.settingsSaved = true;
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.settingsSaved = false;
      }, 1600);
    },

    switchView(view) {
      if (this.activeView !== view) {
        this.dismissFavoritesSnackbar();
      }

      this.activeView = view;
      if (["card", "list", "favorites"].includes(view)) {
        this.lastContentView = view;
      }

      if (view === "card") {
        this.clampCardIndex();
      }

      this.detailModalOpen = false;
      this.quickLangOpen = false;
      this.openSettingSelect = null;
      this.filterPanelOpen = false;
      this.persistPreferences();
    },

    favoriteWordLabel(wordId) {
      const word = this.words.find((item) => item.id === wordId);
      return resolveWordText(word, this.nativeLanguage) || "";
    },

    showFavoritesSnackbar(payload, durationMs = 3000) {
      clearTimeout(this.favoritesSnackbarTimer);
      this.favoritesSnackbar = payload;
      this.favoritesSnackbarTimer = setTimeout(() => {
        this.favoritesSnackbar = null;
        this.favoritesSnackbarTimer = null;
      }, durationMs);
    },

    dismissFavoritesSnackbar() {
      clearTimeout(this.favoritesSnackbarTimer);
      this.favoritesSnackbar = null;
      this.favoritesSnackbarTimer = null;
    },

    removeFavoriteFromFavoritesPage(wordId) {
      const label = this.favoriteWordLabel(wordId);
      this.setWordStatus(wordId, STATUS.NORMAL);
      this.showFavoritesSnackbar(
        {
          type: "removed",
          wordId,
          label,
          message: this.t("favoriteRemovedMessage", { word: label }),
          actionLabel: this.t("undo"),
        },
        3000,
      );
    },

    undoRemovedFavorite() {
      if (!this.favoritesSnackbar || this.favoritesSnackbar.type !== "removed") {
        return;
      }

      const { wordId } = this.favoritesSnackbar;
      this.setWordStatus(wordId, STATUS.FAVORITE);
      this.showFavoritesSnackbar(
        {
          type: "restored",
          wordId,
          message: this.t("favoriteRestoredMessage"),
          actionLabel: "",
        },
        2000,
      );
    },

    toggleStatusFilter(value) {
      if (!VALID_STATUS_FILTERS.includes(value)) {
        return;
      }

      if (value === "all") {
        this.statusFilters = ["all"];
        this.persistPreferences();
        return;
      }

      const next = this.activeStatusFilters.includes("all")
        ? []
        : [...this.activeStatusFilters];

      if (next.includes(value)) {
        this.statusFilters = next.filter((item) => item !== value);
      } else {
        this.statusFilters = [...next, value];
      }

      if (!this.statusFilters.length) {
        this.statusFilters = ["all"];
      }

      this.persistPreferences();
    },

    openTagSelection(fromView) {
      this.openFilterPanel(fromView);
    },

    openFilterPanel(fromView) {
      this.lastContentView = fromView;
      this.draftTagIds = [...this.selectedTagIds];
      this.draftStatusFilters = [...this.activeStatusFilters];
      this.filterPanelOpen = true;
      this.quickLangOpen = false;
      this.openSettingSelect = null;
    },

    toggleDraftTag(tagId) {
      if (this.draftTagIds.includes(tagId)) {
        this.draftTagIds = this.draftTagIds.filter((id) => id !== tagId);
        return;
      }

      this.draftTagIds = [...this.draftTagIds, tagId];
    },

    applyDraftTags() {
      this.applyDraftFilters();
    },

    applyDraftFilters() {
      this.selectedTagIds = [...this.draftTagIds];
      this.statusFilters = [...this.activeDraftStatusFilters];
      this.filterPanelOpen = false;
      this.clampCardIndex();
      this.persistPreferences();
    },

    resetDraftTags() {
      this.resetDraftFilters();
    },

    resetDraftFilters() {
      this.draftTagIds = [];
      this.draftStatusFilters = ["all"];
    },

    clearAppliedTags() {
      this.clearAppliedFilters();
    },

    clearAppliedFilters() {
      this.selectedTagIds = [];
      this.draftTagIds = [];
      this.statusFilters = ["all"];
      this.draftStatusFilters = ["all"];
      this.clampCardIndex();
      this.persistPreferences();
    },

    closeFilterPanel() {
      this.filterPanelOpen = false;
      this.draftTagIds = [...this.selectedTagIds];
      this.draftStatusFilters = [...this.activeStatusFilters];
    },

    toggleDraftStatusFilter(value) {
      if (!VALID_STATUS_FILTERS.includes(value)) {
        return;
      }

      if (value === "all") {
        this.draftStatusFilters = ["all"];
        return;
      }

      const next = this.activeDraftStatusFilters.includes("all")
        ? []
        : [...this.activeDraftStatusFilters];

      if (next.includes(value)) {
        this.draftStatusFilters = next.filter((item) => item !== value);
      } else {
        this.draftStatusFilters = [...next, value];
      }

      if (!this.draftStatusFilters.length) {
        this.draftStatusFilters = ["all"];
      }
    },

    wordMatchesSelectedTags(word) {
      if (!this.selectedTagIds.length) {
        return true;
      }

      return this.selectedTagIds.some((tagId) => (word.tags || []).includes(tagId));
    },

    wordMatchesStatusFilter(word) {
      const status = this.wordStatus(word);
      if (this.activeStatusFilters.includes("all")) {
        return true;
      }
      return this.activeStatusFilters.includes(status);
    },

    wordStatus(word) {
      return getWordStatus(word.id, this.favoriteWordIds, this.ignoredWordIds);
    },

    statusIcon(status) {
      const icons = {
        [STATUS.NORMAL]: "auto_stories",
        [STATUS.FAVORITE]: "favorite",
        [STATUS.IGNORED]: "do_not_disturb_on",
      };
      return icons[status] || icons[STATUS.NORMAL];
    },

    statusLabel(status) {
      const labels = {
        [STATUS.NORMAL]: this.t("statusFilterNormal"),
        [STATUS.FAVORITE]: this.t("favorites"),
        [STATUS.IGNORED]: this.t("ignored"),
      };
      return labels[status] || labels[STATUS.NORMAL];
    },

    setWordStatus(wordId, nextStatus) {
      const previousCardWordId =
        this.activeView === "card" ? this.currentCardWord?.id || null : null;
      const normalized = applyExclusiveStatus(
        wordId,
        nextStatus,
        this.favoriteWordIds,
        this.ignoredWordIds,
      );

      this.favoriteWordIds = normalized.favoriteWordIds;
      this.ignoredWordIds = normalized.ignoredWordIds;

      if (this.activeView === "card") {
        this.clampCardIndex();
      }

      const nextCardWordId =
        this.activeView === "card" ? this.currentCardWord?.id || null : null;
      if (previousCardWordId !== nextCardWordId) {
        document.activeElement?.blur?.();
      }

      if (this.activeWordId === wordId && nextStatus === STATUS.NORMAL) {
        this.activeWordId = wordId;
      }

      if (this.activeView === "favorites" && nextStatus !== STATUS.FAVORITE) {
        this.detailModalOpen = false;
      }

      this.persistPreferences();
    },

    toggleWordStatus(wordId, targetStatus) {
      const current = getWordStatus(wordId, this.favoriteWordIds, this.ignoredWordIds);
      const next = current === targetStatus ? STATUS.NORMAL : targetStatus;
      this.setWordStatus(wordId, next);
    },

    isStatusActive(wordId, targetStatus) {
      return getWordStatus(wordId, this.favoriteWordIds, this.ignoredWordIds) === targetStatus;
    },

    getWordText(word, languageCode) {
      return resolveWordText(word, languageCode);
    },

    getWordPronunciation(word, languageCode) {
      return resolveWordPronunciation(word, languageCode);
    },

    getLocalizedLanguageLabel(code, interfaceLanguage = this.nativeLanguage) {
      const labels = {
        "zh-TW": {
          "zh-TW": "繁體中文",
          id: "印尼文",
          en: "英文",
        },
        id: {
          "zh-TW": "Bahasa Mandarin Tradisional",
          id: "Bahasa Indonesia",
          en: "Bahasa Inggris",
        },
        en: {
          "zh-TW": "Traditional Chinese",
          id: "Indonesian",
          en: "English",
        },
      };

      return (
        labels[interfaceLanguage]?.[code] ||
        labels["en"][code] ||
        this.getLanguageMeta(code).label
      );
    },

    getLanguageMeta(code) {
      return this.languages.find((language) => language.code === code) || {
        code,
        label: code,
        description: code,
        symbol: code.toUpperCase(),
      };
    },

    getTagName(tag, languageCode = this.nativeLanguage) {
      if (languageCode === "en") {
        return tag.name_en || tag.name_id || tag.name_zh_tw || "";
      }
      if (languageCode === "id") {
        return tag.name_id || tag.name_en || tag.name_zh_tw || "";
      }
      return tag.name_zh_tw || tag.name_en || tag.name_id || "";
    },

    cardDescriptor(word) {
      const names = (word?.tags || [])
        .map((tagId) => this.tags.find((tag) => tag.id === tagId))
        .filter(Boolean)
        .map((tag) => this.getTagName(tag));

      return names.length ? names.join(" / ") : this.activeTagSummary;
    },

    listItemTagSummary(word) {
      const firstTag = (word.tags || [])
        .map((tagId) => this.tags.find((tag) => tag.id === tagId))
        .filter(Boolean)[0];

      return firstTag ? this.getTagName(firstTag) : this.t("allTerms");
    },

    openWordDetails(wordId) {
      this.activeWordId = wordId;
      this.detailModalOpen = !!this.activeWord;
    },

    closeWordDetails() {
      this.detailModalOpen = false;
      this.activeWordId = null;
    },

    audioLanguageForWord(word) {
      const ordered = [
        this.cardHeadlineLanguage(),
        this.displayLanguage1,
        this.displayLanguage2,
        "zh-TW",
        "id",
        "en",
      ];
      return ordered.find((languageCode) => word?.audioPaths?.[languageCode]) || "";
    },

    hasAudio(word, languageCode = null) {
      const code = languageCode || this.audioLanguageForWord(word);
      return !!(word?.audioPaths && code && word.audioPaths[code]);
    },

    playAudio(word, languageCode = null) {
      const code = languageCode || this.audioLanguageForWord(word);
      const path = word?.audioPaths?.[code] || "";
      if (!path) {
        return;
      }

      const audio = new Audio(path);
      audio.play().catch(() => {});
    },

    nextCard() {
      if (this.visibleCardWords.length <= 1) {
        this.showCardTranslation = false;
        return;
      }

      this.currentCardIndex = (this.currentCardIndex + 1) % this.visibleCardWords.length;
      this.showCardTranslation = false;
      this.applyCardMotion("card-motion-next");
    },

    prevCard() {
      if (this.visibleCardWords.length <= 1) {
        this.showCardTranslation = false;
        return;
      }

      this.currentCardIndex =
        (this.currentCardIndex - 1 + this.visibleCardWords.length) %
        this.visibleCardWords.length;
      this.showCardTranslation = false;
      this.applyCardMotion("card-motion-prev");
    },

    applyCardMotion(className) {
      this.cardMotionClass = className;
      clearTimeout(this.motionTimer);
      this.motionTimer = setTimeout(() => {
        this.cardMotionClass = "";
      }, 260);
    },

    clampCardIndex() {
      const total = this.visibleCardWords.length;
      if (!total) {
        this.currentCardIndex = 0;
        return;
      }

      if (this.currentCardIndex >= total) {
        this.currentCardIndex = 0;
      }
    },

    handlePointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      if (event.target.closest("button, [role=button], a, input, textarea, select, summary")) {
        return;
      }

      this.touchActive = true;
      this.touchStartX = event.clientX;
      this.touchOffsetX = 0;
      if (event.currentTarget?.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },

    handlePointerMove(event) {
      if (!this.touchActive) {
        return;
      }
      this.touchOffsetX = event.clientX - this.touchStartX;
    },

    handlePointerUp(event) {
      if (!this.touchActive) {
        return;
      }

      const deltaX = event.clientX - this.touchStartX;
      this.touchActive = false;
      this.touchOffsetX = 0;
      if (event.currentTarget?.releasePointerCapture) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (Math.abs(deltaX) < 45) {
        return;
      }

      if (deltaX < 0) {
        this.nextCard();
      } else {
        this.prevCard();
      }
    },

    handlePointerCancel(event) {
      this.touchActive = false;
      this.touchOffsetX = 0;
      if (event.currentTarget?.releasePointerCapture) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },

    handleKeydown(event) {
      if (this.detailModalOpen && event.key === "Escape") {
        this.closeWordDetails();
        return;
      }

      if (this.filterPanelOpen && event.key === "Escape") {
        this.closeFilterPanel();
        return;
      }

      if (this.activeView === "card") {
        if (event.key === "ArrowRight") {
          this.nextCard();
        }
        if (event.key === "ArrowLeft") {
          this.prevCard();
        }
      }
    },

    handleImageError(event) {
      const img = event.target;
      if (!img) {
        return;
      }
      img.onerror = null;
      img.style.display = "none";
    },

    cardHeadlineLanguage() {
      return this.showCardTranslation ? this.displayLanguage2 : this.displayLanguage1;
    },

    cardHeadlineText() {
      return resolveWordText(this.currentCardWord, this.cardHeadlineLanguage());
    },

    cardPronunciationText() {
      return resolveWordPronunciation(this.currentCardWord, this.cardHeadlineLanguage());
    },

    activeWordPronunciationText() {
      return resolveWordPronunciation(this.activeWord, this.cardHeadlineLanguage());
    },

    statusButtonClasses(wordId, status) {
      const active = this.isStatusActive(wordId, status);
      const base =
        "flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-95";
      if (status === STATUS.FAVORITE) {
        return active
          ? `${base} border-primary/30 bg-primary-container text-on-primary-container shadow-lg shadow-primary/15`
          : `${base} border-white/10 bg-black/30 text-white/70 hover:border-primary/30 hover:text-primary`;
      }
      if (status === STATUS.IGNORED) {
        return active
          ? `${base} border-error/30 bg-error-container/20 text-error`
          : `${base} border-white/10 bg-black/30 text-white/70 hover:border-error/30 hover:text-error`;
      }
      return active
        ? `${base} border-tertiary/30 bg-surface-container-highest text-tertiary`
        : `${base} border-white/10 bg-black/30 text-white/70 hover:border-tertiary/30 hover:text-tertiary`;
    },

    segmentedClasses(value) {
      return this.activeStatusFilters.includes(value)
        ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary/10"
        : "bg-surface-container-high text-outline hover:text-on-surface";
    },

    translationToggleLabel() {
      const targetLanguage = this.showCardTranslation
        ? this.displayLanguage1
        : this.displayLanguage2;
      const targetLabel = this.getLocalizedLanguageLabel(targetLanguage);
      return this.t("showLanguage", { language: targetLabel });
    },

    t(key, replacements = {}) {
      const table =
        this.translations[this.nativeLanguage] ||
        this.translations["zh-TW"] ||
        this.translations.en ||
        {};
      let value = table[key] || key;

      Object.entries(replacements).forEach(([token, replacement]) => {
        value = value.replace(`{${token}}`, replacement);
      });

      return value;
    },
  };
}

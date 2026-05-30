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
  version: 4,
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
  listLoopGroupCount: 1,
  listQuickLanguageSlot: 1,
};

const VALID_VIEWS = ["card", "list", "favorites", "settings"];
const VALID_STATUS_FILTERS = ["all", "favorite", "ignored", "normal"];
const R2_PUBLIC_BASE_URL =
  "https://pub-0ab02e3e2bda4c4c99e33c093612b10c.r2.dev";
const CONTENT_VIEWS = ["card", "list", "favorites"];
const UI_TRANSLATION_FALLBACKS = {
  "zh-TW": {},
  id: {},
  en: {},
};

function resolveMediaUrl(path) {
  if (typeof path !== "string" || !path.trim()) {
    return "";
  }

  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const normalizedPath = trimmed
    .replace(/^\.?\//, "")
    .replace(/^public\/assets\//, "");

  return `${R2_PUBLIC_BASE_URL}/${normalizedPath}`;
}

function resolveAudioUrl(languageCode, filename) {
  if (typeof languageCode !== "string" || typeof filename !== "string") {
    return "";
  }

  const cleanLanguageCode = languageCode.trim();
  const cleanFilename = filename.trim();
  if (!cleanLanguageCode || !cleanFilename) {
    return "";
  }

  return resolveMediaUrl(`audios/${cleanLanguageCode}/${cleanFilename}`);
}

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
    version: 4,
    nativeLanguage,
    displayLanguage1,
    displayLanguage2,
    activeView: VALID_VIEWS.includes(preferred.activeView)
      ? preferred.activeView
      : preferred.activeView === "tags" &&
          CONTENT_VIEWS.includes(preferred.lastContentView)
        ? preferred.lastContentView
        : DEFAULT_PREFERENCES.activeView,
    lastContentView: CONTENT_VIEWS.includes(preferred.lastContentView)
      ? preferred.lastContentView
      : DEFAULT_PREFERENCES.lastContentView,
    selectedTagIds: uniqueNumberArray(preferred.selectedTagIds),
    cardLanguageSlot: preferred.cardLanguageSlot === 2 ? 2 : 1,
    favoriteWordIds: normalizedStatus.favoriteWordIds,
    ignoredWordIds: normalizedStatus.ignoredWordIds,
    statusFilters,
    listLoopGroupCount: [1, 3, 6].includes(preferred.listLoopGroupCount)
      ? preferred.listLoopGroupCount
      : DEFAULT_PREFERENCES.listLoopGroupCount,
    listQuickLanguageSlot: preferred.listQuickLanguageSlot === 2 ? 2 : 1,
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
  resolveMediaUrl,
  resolveAudioUrl,
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
    selectedLoopWordIds: [],
    selectedLoopPanelOpen: false,
    listLoopPlaying: false,
    listLoopActiveWordId: null,
    listLoopGeneration: 0,
    listLoopCurrentAudio: null,
    listLoopGroupCount: 1,
    listQuickLanguageSlot: 1,
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
    beforeUnloadHandler: null,

    get activeWord() {
      return this.words.find((word) => word.id === this.activeWordId) || null;
    },

    get filteredWordsByTags() {
      return this.words.filter((word) => this.wordMatchesSelectedTags(word));
    },

    get visibleCardWords() {
      return this.filteredWordsByTags.filter((word) =>
        this.wordMatchesStatusFilter(word),
      );
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

    get listLoopSourceWords() {
      return this.filteredWordsByTags.filter((word) => this.wordMatchesStatusFilter(word));
    },

    get selectedLoopWords() {
      const selectedIds = new Set(this.selectedLoopWordIds);
      return this.listLoopSourceWords.filter((word) => selectedIds.has(word.id));
    },

    get selectedLoopPanelWords() {
      return this.selectedLoopWords;
    },

    get listLoopWordCap() {
      return this.listLoopGroupCount * 6;
    },

    get cappedLoopWords() {
      return this.selectedLoopWords.slice(0, this.listLoopWordCap);
    },

    get activeListLanguage() {
      return this.listQuickLanguageSlot === 2 ? this.displayLanguage2 : this.displayLanguage1;
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
        const dataset = await this.loadAppData();
        this.languages = dataset.languages;
        this.translations = dataset.translations;
        this.tags = dataset.tags.map((tag) => this.normalizeTag(tag));
        this.words = sortWordsByDescendingId(
          dataset.words.map((word) => this.normalizeWord(word)),
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
      this.beforeUnloadHandler = this.handleBeforeUnload.bind(this);
      window.addEventListener("beforeunload", this.beforeUnloadHandler);
    },

    async loadAppData() {
      const dataApi = window.lexiconSupabaseData;
      const supabaseClient = dataApi?.createSupabaseClient?.(window);

      if (!dataApi?.loadSupabaseDataset || !supabaseClient) {
        throw new Error("Supabase data loader is not available.");
      }

      return dataApi.loadSupabaseDataset(supabaseClient);
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
        img: resolveMediaUrl(word.img),
        pronunciation: {
          "zh-TW": word.pronunciation?.["zh-TW"] || "",
          id: word.pronunciation?.id || "",
          en: word.pronunciation?.en || "",
        },
        audioPaths: {
          "zh-TW":
            word.audio && word.audio["zh-TW"]
              ? resolveAudioUrl("zh-TW", word.audio["zh-TW"])
              : "",
          id:
            word.audio && word.audio.id
              ? resolveAudioUrl("id", word.audio.id)
              : "",
          en:
            word.audio && word.audio.en
              ? resolveAudioUrl("en", word.audio.en)
              : "",
        },
      };
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
        this.listLoopGroupCount = normalized.listLoopGroupCount;
        this.listQuickLanguageSlot = normalized.listQuickLanguageSlot;
      } catch (_error) {
        localStorage.removeItem("lexicon-preferences");
      }
    },

    persistPreferences() {
      const payload = {
        version: 4,
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
        listLoopGroupCount: this.listLoopGroupCount,
        listQuickLanguageSlot: this.listQuickLanguageSlot,
      };

      localStorage.setItem("lexicon-preferences", JSON.stringify(payload));
    },

    savePreferences() {
      this.stopListLoop();
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
      this.stopListLoop();
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

      if (this.activeView === "list" && view !== "list") {
        this.stopListLoop();
      }

      this.activeView = view;
      if (CONTENT_VIEWS.includes(view)) {
        this.lastContentView = view;
      }

      if (view === "card") {
        this.clampCardIndex();
      }

      this.detailModalOpen = false;
      this.selectedLoopPanelOpen = false;
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
      this.selectedLoopPanelOpen = false;
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
      this.stopListLoop();
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
      this.stopListLoop();
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
      this.stopListLoop();
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
      if (this.activeView === "card" && nextStatus !== STATUS.NORMAL) {
        document.activeElement?.blur?.();
      } else if (previousCardWordId !== nextCardWordId) {
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

    listAudioLanguageForWord(word) {
      const ordered = [
        this.activeListLanguage,
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
      this.persistPreferences();
    },

    setListLoopGroupCount(value) {
      const numericValue = Number(value);
      if (![1, 3, 6].includes(numericValue)) {
        return;
      }

      this.stopListLoop();
      this.listLoopGroupCount = numericValue;
      this.persistPreferences();
    },

    toggleLoopWordSelection(wordId) {
      this.stopListLoop();
      if (this.selectedLoopWordIds.includes(wordId)) {
        this.selectedLoopWordIds = this.selectedLoopWordIds.filter((id) => id !== wordId);
        if (!this.selectedLoopWordIds.length) {
          this.selectedLoopPanelOpen = false;
        }
        return;
      }

      this.selectedLoopWordIds = [...this.selectedLoopWordIds, wordId];
    },

    clearLoopSelection() {
      this.stopListLoop();
      this.selectedLoopWordIds = [];
      this.selectedLoopPanelOpen = false;
    },

    isLoopWordSelected(wordId) {
      return this.selectedLoopWordIds.includes(wordId);
    },

    toggleSelectedLoopPanel() {
      if (!this.selectedLoopWordIds.length) {
        this.selectedLoopPanelOpen = false;
        return;
      }

      this.selectedLoopPanelOpen = !this.selectedLoopPanelOpen;
    },

    closeSelectedLoopPanel() {
      this.selectedLoopPanelOpen = false;
    },

    removeSelectedLoopWord(wordId) {
      this.stopListLoop();
      this.selectedLoopWordIds = this.selectedLoopWordIds.filter((id) => id !== wordId);
      if (!this.selectedLoopWordIds.length) {
        this.selectedLoopPanelOpen = false;
      }
    },

    get playableLoopWords() {
      return this.cappedLoopWords.filter((word) =>
        this.hasAudio(word, this.listAudioLanguageForWord(word)),
      );
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

    playSelectedLoopWord(word, generation = this.listLoopGeneration) {
      if (!this.listLoopPlaying || generation !== this.listLoopGeneration || !word) {
        return;
      }

      const languageCode = this.listAudioLanguageForWord(word);
      const path = word?.audioPaths?.[languageCode] || "";
      if (!path) {
        this.playNextSelectedLoopWord(word.id, generation);
        return;
      }

      const audio = new Audio(path);
      const finish = () => {
        if (this.listLoopCurrentAudio === audio) {
          this.listLoopCurrentAudio = null;
        }
      };

      this.listLoopActiveWordId = word.id;
      this.listLoopCurrentAudio = audio;

      audio.onended = () => {
        finish();
        this.playNextSelectedLoopWord(word.id, generation);
      };
      audio.onerror = () => {
        finish();
        this.playNextSelectedLoopWord(word.id, generation);
      };

      audio.play().catch(() => {
        finish();
        this.playNextSelectedLoopWord(word.id, generation);
      });
    },

    playNextSelectedLoopWord(currentWordId, generation = this.listLoopGeneration) {
      if (!this.listLoopPlaying || generation !== this.listLoopGeneration) {
        return;
      }

      const playableWords = this.playableLoopWords;
      if (!playableWords.length) {
        this.stopListLoop();
        return;
      }

      const currentIndex = playableWords.findIndex((word) => word.id === currentWordId);
      const nextWord =
        currentIndex === -1 || currentIndex === playableWords.length - 1
          ? playableWords[0]
          : playableWords[currentIndex + 1];

      this.playSelectedLoopWord(nextWord, generation);
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

    handleBeforeUnload() {
      this.stopListLoop();
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

      if (this.selectedLoopPanelOpen && event.key === "Escape") {
        this.closeSelectedLoopPanel();
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

    activeListPronunciation(word) {
      return resolveWordPronunciation(word, this.activeListLanguage);
    },

    activeListWordText(word) {
      return resolveWordText(word, this.activeListLanguage);
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

    listLoopButtonLabel() {
      const labels = {
        "zh-TW": {
          play: "開始循環",
          stop: "停止循環",
        },
        id: {
          play: "Mulai Loop",
          stop: "Hentikan Loop",
        },
        en: {
          play: "Start Loop",
          stop: "Stop Loop",
        },
      };
      const table = labels[this.nativeLanguage] || labels["zh-TW"];
      return this.listLoopPlaying ? table.stop : table.play;
    },

    listSelectionSummaryLabel() {
      const labels = {
        "zh-TW": "已選",
        id: "Dipilih",
        en: "Selected",
      };
      const selectedCountLabel = labels[this.nativeLanguage] || labels["zh-TW"];
      return `${selectedCountLabel} ${this.selectedLoopWordIds.length}`;
    },

    listLanguageToggleLabel() {
      const targetLanguage =
        this.listQuickLanguageSlot === 2 ? this.displayLanguage1 : this.displayLanguage2;
      return this.getLocalizedLanguageLabel(targetLanguage);
    },

    listClearSelectionLabel() {
      const labels = {
        "zh-TW": "清除選取",
        id: "Hapus Pilihan",
        en: "Clear Selection",
      };
      return labels[this.nativeLanguage] || labels["zh-TW"];
    },

    languageShortCode(languageCode) {
      const codes = {
        "zh-TW": "ZH",
        id: "ID",
        en: "EN",
      };

      return codes[languageCode] || languageCode.toUpperCase();
    },

    listLanguageToggleCode() {
      const targetLanguage =
        this.listQuickLanguageSlot === 2 ? this.displayLanguage1 : this.displayLanguage2;
      return this.languageShortCode(targetLanguage);
    },

    listLoopButtonLabel() {
      const labels = {
        "zh-TW": {
          play: "\u958b\u59cb\u5faa\u74b0",
          stop: "\u505c\u6b62\u5faa\u74b0",
        },
        id: {
          play: "Mulai Loop",
          stop: "Hentikan Loop",
        },
        en: {
          play: "Start Loop",
          stop: "Stop Loop",
        },
      };
      const table = labels[this.nativeLanguage] || labels["zh-TW"];
      return this.listLoopPlaying ? table.stop : table.play;
    },

    listSelectionSummaryLabel() {
      const labels = {
        "zh-TW": "\u5df2\u9078",
        id: "Dipilih",
        en: "Selected",
      };
      const selectedCountLabel = labels[this.nativeLanguage] || labels["zh-TW"];
      return `${selectedCountLabel} ${this.selectedLoopWordIds.length}`;
    },

    listLanguageToggleLabel() {
      const targetLanguage =
        this.listQuickLanguageSlot === 2 ? this.displayLanguage1 : this.displayLanguage2;
      const labels = {
        "zh-TW": {
          "zh-TW": "\u7e41\u4e2d",
          id: "\u5370\u5c3c",
          en: "\u82f1\u6587",
        },
        id: {
          "zh-TW": "Mandarin Tradisional",
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
        labels[this.nativeLanguage]?.[targetLanguage] ||
        labels["en"][targetLanguage] ||
        targetLanguage
      );
    },

    listClearSelectionLabel() {
      const labels = {
        "zh-TW": "\u6e05\u9664\u9078\u53d6",
        id: "Hapus Pilihan",
        en: "Clear Selection",
      };
      return labels[this.nativeLanguage] || labels["zh-TW"];
    },

    isListLoopWordActive(wordId) {
      return this.listLoopPlaying && this.listLoopActiveWordId === wordId;
    },

    listSelectButtonClasses(wordId) {
      const base =
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-all active:scale-95";
      return this.isLoopWordSelected(wordId)
        ? `${base} border-primary/40 bg-primary-container text-on-primary-container`
        : `${base} border-outline-variant/30 bg-surface-container-high text-on-surface`;
    },

    t(key, replacements = {}) {
      const table =
        this.translations[this.nativeLanguage] ||
        this.translations["zh-TW"] ||
        this.translations.en ||
        {};
      const fallbackTable =
        UI_TRANSLATION_FALLBACKS[this.nativeLanguage] ||
        UI_TRANSLATION_FALLBACKS["zh-TW"] ||
        UI_TRANSLATION_FALLBACKS.en;
      let value = table[key] || fallbackTable[key] || key;

      Object.entries(replacements).forEach(([token, replacement]) => {
        value = value.replace(`{${token}}`, replacement);
      });

      return value;
    },
  };
}

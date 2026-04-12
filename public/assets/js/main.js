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

function lexiconApp() {
  return {
    loading: true,
    error: "",
    words: [],
    tags: [],
    activeView: "card",
    lastContentView: "card",
    currentCardIndex: 0,
    cardLanguageSlot: 1,
    nativeLanguage: "zh-TW",
    displayLanguage1: "zh-TW",
    displayLanguage2: "id",
    searchQuery: "",
    selectedTagIds: [],
    draftTagIds: [],
    quickLangOpen: false,
    openSettingSelect: null,
    settingsSaved: false,
    settingsError: "",
    touchStartX: 0,
    touchOffsetX: 0,
    touchActive: false,
    cardMotionClass: "",
    motionTimer: null,
    saveTimer: null,
    translations: {},

    languages: [],

    get currentCardLanguage() {
      return this.cardLanguageSlot === 1
        ? this.displayLanguage1
        : this.displayLanguage2;
    },

    get filteredCardWords() {
      return this.words.filter((word) => this.wordMatchesSelectedTags(word));
    },

    get filteredListWords() {
      const baseWords = this.filteredCardWords;
      const query = this.searchQuery.trim().toLowerCase();
      if (!query) {
        return baseWords;
      }

      return baseWords.filter((word) => {
        const zh = (word["lang_zh-TW"] || "").toLowerCase();
        const id = (word.lang_id || "").toLowerCase();
        return zh.includes(query) || id.includes(query);
      });
    },

    get currentCardWord() {
      return this.filteredCardWords[this.currentCardIndex] || null;
    },

    get cardSwipeTransform() {
      return this.touchOffsetX ? `translateX(${this.touchOffsetX}px)` : "";
    },

    get cardStyle() {
      return {
        backgroundImage: this.currentCardWord ? `url(${this.currentCardWord.img})` : "",
        backgroundSize: "cover",
        backgroundPosition: "center",
        transform: this.cardSwipeTransform,
      };
    },

    get activeTagSummary() {
      if (!this.selectedTagIds.length) {
        return this.t("allTerms");
      }

      if (this.selectedTagIds.length === 1) {
        const tag = this.tags.find(
          (item) => item.id === this.selectedTagIds[0],
        );
        return tag ? this.getTagName(tag) : this.t("allTerms");
      }

      return this.t("selectedTagCount", { count: this.selectedTagIds.length });
    },

    get progressLabel() {
      return this.t("cardOf", {
        current: this.filteredCardWords.length ? this.currentCardIndex + 1 : 0,
        total: this.filteredCardWords.length,
      });
    },

    get cardSupportText() {
      return this.t("cardPrompt");
    },

    async init() {
      this.loading = true;
      this.error = "";

      try {
        const [wordsResponse, tagsResponse, langIndexResponse] =
          await Promise.all([
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
        this.languages = Array.isArray(langIndex.languages)
          ? langIndex.languages
          : [];
        await this.loadTranslations(this.languages);
        this.loadPreferences();
        this.tags = tags.map((tag) => this.normalizeTag(tag));
        this.words = words.map((word) => this.normalizeWord(word));
        this.ensureLanguagesAreUnique();
        this.clampCardIndex();
      } catch (error) {
        this.error = error.message || "Unknown error";
      } finally {
        this.loading = false;
      }

      window.addEventListener("keydown", this.handleKeydown.bind(this));
    },

    normalizeTag(tag) {
      return {
        ...tag,
        icon: tag.icon || "sell",
      };
    },

    normalizeWord(word) {
      return {
        ...word,
        audioPaths: {
          "zh-TW":
            word.audio && word.audio["zh-TW"]
              ? `public/assets/audios/zh-TW/${word.audio["zh-TW"]}`
              : "",
          id:
            word.audio && word.audio.id
              ? `public/assets/audios/id/${word.audio.id}`
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
            throw new Error(
              `Unable to load translations for ${language.code}.`,
            );
          }
          loaded[language.code] = await response.json();
        }),
      );
      this.translations = loaded;
    },

    loadPreferences() {
      try {
        const raw = localStorage.getItem("lexicon-preferences");
        if (!raw) {
          return;
        }

        const saved = JSON.parse(raw);
        this.nativeLanguage = saved.nativeLanguage || this.nativeLanguage;
        this.displayLanguage1 = saved.displayLanguage1 || this.displayLanguage1;
        this.displayLanguage2 = saved.displayLanguage2 || this.displayLanguage2;
        this.activeView = saved.activeView || this.activeView;
        this.lastContentView = saved.lastContentView || this.lastContentView;
        this.selectedTagIds = Array.isArray(saved.selectedTagIds)
          ? saved.selectedTagIds
          : [];
        this.cardLanguageSlot = saved.cardLanguageSlot === 2 ? 2 : 1;
        this.ensureLanguagesAreUnique();
      } catch (_error) {
        localStorage.removeItem("lexicon-preferences");
      }
    },

    savePreferences() {
      this.settingsError = "";
      if (this.displayLanguage1 === this.displayLanguage2) {
        this.settingsError = this.t("languageMismatchError");
        return;
      }

      this.cardLanguageSlot = 1;
      this.ensureLanguagesAreUnique();
      this.persistPreferences();
      this.openSettingSelect = null;
      this.settingsSaved = true;
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.settingsSaved = false;
      }, 1600);
    },

    persistPreferences() {
      const payload = {
        nativeLanguage: this.nativeLanguage,
        displayLanguage1: this.displayLanguage1,
        displayLanguage2: this.displayLanguage2,
        activeView: this.activeView,
        lastContentView: this.lastContentView,
        selectedTagIds: this.selectedTagIds,
        cardLanguageSlot: this.cardLanguageSlot,
      };
      localStorage.setItem("lexicon-preferences", JSON.stringify(payload));
    },

    ensureLanguagesAreUnique() {
      if (this.displayLanguage1 === this.displayLanguage2) {
        this.displayLanguage2 = this.languages.find(
          (language) => language.code !== this.displayLanguage1,
        ).code;
      }

      if (
        !this.languages.some(
          (language) => language.code === this.nativeLanguage,
        )
      ) {
        this.nativeLanguage = "zh-TW";
      }
    },

    toggleSettingSelect(field) {
      this.openSettingSelect = this.openSettingSelect === field ? null : field;
    },

    selectLanguage(field, code) {
      if (field === "nativeLanguage") {
        this.nativeLanguage = code;
      }

      if (field === "displayLanguage1") {
        this.displayLanguage1 = code;
      }

      if (field === "displayLanguage2") {
        this.displayLanguage2 = code;
      }

      this.ensureLanguagesAreUnique();
      this.openSettingSelect = null;
    },

    switchView(view) {
      this.activeView = view;
      if (view === "card" || view === "list") {
        this.lastContentView = view;
      }
      if (view === "card") {
        this.clampCardIndex();
      }
      this.persistPreferences();
    },

    openTagSelection(fromView) {
      this.lastContentView = fromView;
      this.draftTagIds = [...this.selectedTagIds];
      this.activeView = "tags";
      this.persistPreferences();
    },

    toggleDraftTag(tagId) {
      if (this.draftTagIds.includes(tagId)) {
        this.draftTagIds = this.draftTagIds.filter((id) => id !== tagId);
        return;
      }

      this.draftTagIds = [...this.draftTagIds, tagId];
    },

    applyDraftTags() {
      this.selectedTagIds = [...this.draftTagIds];
      this.activeView = this.lastContentView;
      this.clampCardIndex();
      this.persistPreferences();
    },

    resetDraftTags() {
      this.draftTagIds = [];
    },

    clearAppliedTags() {
      this.selectedTagIds = [];
      this.draftTagIds = [];
      this.clampCardIndex();
      this.persistPreferences();
    },

    wordMatchesSelectedTags(word) {
      if (!this.selectedTagIds.length) {
        return true;
      }

      return this.selectedTagIds.some((tagId) =>
        (word.tags || []).includes(tagId),
      );
    },

    getWordText(word, languageCode) {
      if (!word) {
        return "";
      }

      if (languageCode === "zh-TW") {
        return word["lang_zh-TW"] || "";
      }

      if (languageCode === "id") {
        return word.lang_id || "";
      }

      return "";
    },

    getLanguageMeta(code) {
      return (
        this.languages.find((language) => language.code === code) ||
        this.languages[0]
      );
    },

    getTagName(tag, languageCode = null) {
      const codeToUse = languageCode || this.nativeLanguage;
      if (codeToUse === "id") {
        return tag.name_id;
      }
      return tag.name_zh_tw;
    },

    cardDescriptor(word) {
      const names = (word.tags || [])
        .map((tagId) => this.tags.find((tag) => tag.id === tagId))
        .filter(Boolean)
        .map((tag) => this.getTagName(tag, this.currentCardLanguage));

      return names.length ? names.join(" / ") : this.activeTagSummary;
    },

    listItemTagSummary(word) {
      const firstTag = (word.tags || [])
        .map((tagId) => this.tags.find((tag) => tag.id === tagId))
        .filter(Boolean)[0];

      return firstTag ? this.getTagName(firstTag) : this.t("allTerms");
    },

    toggleCardLanguage() {
      this.cardLanguageSlot = this.cardLanguageSlot === 1 ? 2 : 1;
      this.persistPreferences();
    },

    playAudio(word, languageCode) {
      const path = word && word.audioPaths ? word.audioPaths[languageCode] : "";
      if (!path) {
        return;
      }

      const audio = new Audio(path);
      audio.play().catch(() => {});
    },

    nextCard() {
      if (this.filteredCardWords.length <= 1) {
        return;
      }

      this.currentCardIndex =
        (this.currentCardIndex + 1) % this.filteredCardWords.length;
      this.applyCardMotion("card-motion-next");
    },

    prevCard() {
      if (this.filteredCardWords.length <= 1) {
        return;
      }

      this.currentCardIndex =
        (this.currentCardIndex - 1 + this.filteredCardWords.length) %
        this.filteredCardWords.length;
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
      const total = this.filteredCardWords.length;
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
      if (event.currentTarget && event.currentTarget.setPointerCapture) {
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
      if (event.currentTarget && event.currentTarget.releasePointerCapture) {
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
      if (event.currentTarget && event.currentTarget.releasePointerCapture) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },

    handleKeydown(event) {
      if (this.activeView === "card") {
        if (event.key === "ArrowRight") {
          this.nextCard();
        }
        if (event.key === "ArrowLeft") {
          this.prevCard();
        }
      }

      if (this.activeView === "tags" && event.key === "Escape") {
        this.activeView = this.lastContentView;
      }
    },

    handleImageError(event) {
      const img = event.target;
      if (!img) {
        return;
      }
      img.onerror = null;
      img.alt = "";
      img.style.visibility = "hidden";
    },

    t(key, replacements = {}) {
      const table =
        this.translations[this.nativeLanguage] || this.translations["zh-TW"];
      let value = table[key] || key;
      Object.entries(replacements).forEach(([token, replacement]) => {
        value = value.replace(`{${token}}`, replacement);
      });
      return value;
    },
  };
}

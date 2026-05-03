(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminWordEdit = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const SUPPORTED_LANGUAGE_CODES = ["zh-TW", "id", "en"];

  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function parseWordEditParams(searchString) {
    const params = new URLSearchParams((searchString || "").replace(/^\?/, ""));
    const mode = params.get("mode") === "create" ? "create" : "edit";
    const wordId = params.get("id");
    const normalizedWordId = Number(wordId);

    if (mode === "create") {
      return { mode: "create", wordId: null };
    }

    if (Number.isInteger(normalizedWordId) && normalizedWordId > 0) {
      return { mode: "edit", wordId: normalizedWordId };
    }

    return { mode: "invalid", wordId: null };
  }

  function createEmptyWordDetail() {
    return {
      id: null,
      image_url: "",
      translations: {
        "zh-TW": { text: "", pronunciation: "", audio_filename: "" },
        id: { text: "", pronunciation: "", audio_filename: "" },
        en: { text: "", pronunciation: "", audio_filename: "" },
      },
      tag_ids: [],
      created_at: null,
      updated_at: null,
    };
  }

  function normalizeWordEditorPayload(formValues = {}) {
    const payload = createEmptyWordDetail();
    payload.image_url = typeof formValues.image_url === "string" ? formValues.image_url.trim() : "";
    payload.tag_ids = Array.isArray(formValues.tag_ids)
      ? Array.from(new Set(formValues.tag_ids.map(function (value) {
          return Number(value);
        }).filter(function (value) {
          return Number.isInteger(value) && value > 0;
        })))
      : [];

    SUPPORTED_LANGUAGE_CODES.forEach(function (languageCode) {
      const entry = formValues.translations?.[languageCode] || {};
      payload.translations[languageCode] = {
        text: typeof entry.text === "string" ? entry.text.trim() : "",
        pronunciation: typeof entry.pronunciation === "string" ? entry.pronunciation.trim() : "",
        audio_filename: typeof entry.audio_filename === "string" ? entry.audio_filename.trim() : "",
      };
    });

    return payload;
  }

  function buildTagOptionMarkup(tags, selectedTagIds, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };
    const selected = new Set(selectedTagIds || []);

    if (!Array.isArray(tags) || tags.length === 0) {
      return '<div class="admin-empty-state">' + t("wordEdit.tags.empty") + "</div>";
    }

    return tags.map(function (tag) {
      const label = tag.translations?.["zh-TW"]?.name || tag.translations?.en?.name || "Tag #" + tag.id;
      return [
        '<label class="admin-checkbox-chip">',
        '<input type="checkbox" data-tag-option value="' + tag.id + '"' + (selected.has(tag.id) ? " checked" : "") + " />",
        "<span>" + label + "</span>",
        "</label>",
      ].join("");
    }).join("\n");
  }

  function hasPersistentWordId(wordId) {
    const normalizedWordId = Number(wordId);
    return Number.isInteger(normalizedWordId) && normalizedWordId > 0;
  }

  function collectFormValues(doc) {
    const activeDocument = doc || root.document;
    return {
      image_url: activeDocument.getElementById("image-url")?.value || "",
      translations: {
        "zh-TW": {
          text: activeDocument.getElementById("zh-word")?.value || "",
          pronunciation: activeDocument.getElementById("pron-zh")?.value || "",
          audio_filename: activeDocument.getElementById("audio-zh")?.value || "",
        },
        id: {
          text: activeDocument.getElementById("id-word")?.value || "",
          pronunciation: activeDocument.getElementById("pron-id")?.value || "",
          audio_filename: activeDocument.getElementById("audio-id")?.value || "",
        },
        en: {
          text: activeDocument.getElementById("en-word")?.value || "",
          pronunciation: activeDocument.getElementById("pron-en")?.value || "",
          audio_filename: activeDocument.getElementById("audio-en")?.value || "",
        },
      },
      tag_ids: Array.from(activeDocument.querySelectorAll("[data-tag-option]:checked")).map(function (node) {
        return Number(node.value);
      }),
    };
  }

  function applyWordDetail(doc, detail, mode) {
    const activeDocument = doc || root.document;
    const payload = detail || createEmptyWordDetail();

    activeDocument.getElementById("word-id").value = payload.id || (mode === "create" ? "" : "");
    activeDocument.getElementById("zh-word").value = payload.translations["zh-TW"].text || "";
    activeDocument.getElementById("id-word").value = payload.translations.id.text || "";
    activeDocument.getElementById("en-word").value = payload.translations.en.text || "";
    activeDocument.getElementById("pron-zh").value = payload.translations["zh-TW"].pronunciation || "";
    activeDocument.getElementById("pron-id").value = payload.translations.id.pronunciation || "";
    activeDocument.getElementById("pron-en").value = payload.translations.en.pronunciation || "";
    activeDocument.getElementById("audio-zh").value = payload.translations["zh-TW"].audio_filename || "";
    activeDocument.getElementById("audio-id").value = payload.translations.id.audio_filename || "";
    activeDocument.getElementById("audio-en").value = payload.translations.en.audio_filename || "";
    activeDocument.getElementById("image-url").value = payload.image_url || "";
  }

  function setWordEditStatus(doc, message, isError) {
    const activeDocument = doc || root.document;
    const node = activeDocument.querySelector("[data-word-edit-status]");
    if (!node) {
      return;
    }

    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }

  function setSaveDisabled(doc, disabled) {
    const activeDocument = doc || root.document;
    activeDocument.querySelectorAll("[data-word-save]").forEach(function (button) {
      button.disabled = Boolean(disabled);
    });
  }

  function setPageCopy(doc, mode, translator) {
    const activeDocument = doc || root.document;
    const t = typeof translator === "function" ? translator : function (key) { return key; };
    const titleNode = activeDocument.querySelectorAll("[data-word-edit-title]");
    const descriptionNodes = activeDocument.querySelectorAll("[data-word-edit-description]");
    let title = t("wordEdit.header.editTitle");
    let description = t("wordEdit.header.editDescription");

    if (mode === "create") {
      title = t("wordEdit.header.createTitle");
      description = t("wordEdit.header.createDescription");
    } else if (mode === "invalid") {
      title = t("wordEdit.invalid.title");
      description = t("wordEdit.invalid.description");
    }

    titleNode.forEach(function (node) {
      node.textContent = title;
    });
    descriptionNodes.forEach(function (node) {
      node.textContent = description;
    });
  }

  function getMediaPublicBaseUrl(activeRoot) {
    return String(
      activeRoot.LEXICON_MEDIA_PUBLIC_BASE_URL
      || activeRoot.LEXICON_ADMIN_MEDIA_PUBLIC_BASE_URL
      || "",
    ).replace(/\/$/, "");
  }

  function buildMediaUrl(activeRoot, key) {
    const normalizedKey = typeof key === "string" ? key.trim() : "";
    const baseUrl = getMediaPublicBaseUrl(activeRoot);

    if (!normalizedKey || !baseUrl) {
      return "";
    }

    return baseUrl + "/" + normalizedKey.replace(/^\//, "");
  }

  function buildAudioObjectKey(languageCode, audioFilename) {
    const normalizedLanguageCode = typeof languageCode === "string" ? languageCode.trim() : "";
    const normalizedFilename = typeof audioFilename === "string" ? audioFilename.trim() : "";

    if (!normalizedLanguageCode || !normalizedFilename) {
      return "";
    }

    return "audios/" + normalizedLanguageCode + "/" + normalizedFilename;
  }

  function renderImagePreview(activeDocument, activeRoot, detail) {
    const previewNode = activeDocument.querySelector("[data-image-preview]");

    if (!previewNode) {
      return;
    }

    const imageKey = detail?.image_url || "";
    const previewUrl = buildMediaUrl(activeRoot, imageKey);

    if (!imageKey) {
      previewNode.innerHTML = '<div class="admin-empty-state">尚未上傳圖片</div>';
      return;
    }

    if (previewUrl) {
      previewNode.innerHTML = '<img class="admin-asset-image" src="' + previewUrl + '" alt="word image" />';
      return;
    }

    previewNode.innerHTML = '<div class="admin-empty-state">' + imageKey + "</div>";
  }

  function renderAudioPreviews(activeDocument, activeRoot, detail) {
    SUPPORTED_LANGUAGE_CODES.forEach(function (languageCode) {
      const audioFilename = detail?.translations?.[languageCode]?.audio_filename || "";
      const audioKey = buildAudioObjectKey(languageCode, audioFilename);
      const audioUrl = buildMediaUrl(activeRoot, audioKey);
      const filenameNode = activeDocument.querySelector('[data-audio-filename="' + languageCode + '"]');
      const audioPlayer = activeDocument.querySelector('[data-audio-player="' + languageCode + '"]');

      if (filenameNode) {
        filenameNode.textContent = audioFilename || "未設定";
      }

      if (audioPlayer) {
        if (audioFilename && audioUrl) {
          audioPlayer.src = audioUrl;
          audioPlayer.hidden = false;
        } else {
          audioPlayer.removeAttribute("src");
          audioPlayer.hidden = true;
        }
      }
    });
  }

  function syncMediaFields(activeDocument, detail) {
    activeDocument.getElementById("image-url").value = detail.image_url || "";
    activeDocument.getElementById("audio-zh").value = detail.translations["zh-TW"].audio_filename || "";
    activeDocument.getElementById("audio-id").value = detail.translations.id.audio_filename || "";
    activeDocument.getElementById("audio-en").value = detail.translations.en.audio_filename || "";
  }

  function setMediaControlsDisabled(activeDocument, disabled) {
    activeDocument.querySelectorAll("[data-image-upload], [data-image-delete], [data-audio-upload], [data-audio-delete]").forEach(function (button) {
      button.disabled = Boolean(disabled);
    });

    activeDocument.querySelectorAll("#image-file, [data-audio-file]").forEach(function (input) {
      input.disabled = Boolean(disabled);
    });
  }

  function setImageStatus(activeDocument, message, isError) {
    const node = activeDocument.querySelector("[data-image-status]");

    if (!node) {
      return;
    }

    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }

  function setAudioStatus(activeDocument, message, isError) {
    const node = activeDocument.querySelector("[data-audio-status]");

    if (!node) {
      return;
    }

    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }

  async function bootstrap(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = activeRoot.document;

    if (!activeDocument || !activeRoot.lexiconAdminAuth || !activeRoot.lexiconAdminApi) {
      return;
    }

    const access = await activeRoot.lexiconAdminAuth.protectAdminPage(activeRoot);
    if (!access?.allowed) {
      return;
    }

    const translator = activeRoot.lexiconAdminI18n?.createTranslator?.(activeRoot) || {
      t: function (key) { return key; },
    };
    const t = translator.t;
    const client = access.client || activeRoot.lexiconAdminApi.getAdminSupabaseClient(activeRoot);
    const params = parseWordEditParams(activeRoot.location?.search || "");
    const tagContainer = activeDocument.querySelector("[data-tag-options]");
    const saveButtons = activeDocument.querySelectorAll("[data-word-save]");
    const cancelButton = activeDocument.querySelector("[data-word-cancel]");
    const imageUploadButton = activeDocument.querySelector("[data-image-upload]");
    const imageDeleteButton = activeDocument.querySelector("[data-image-delete]");
    const imageFileInput = activeDocument.getElementById("image-file");
    let currentWordId = params.wordId;
    let currentMode = params.mode;
    let currentDetail = createEmptyWordDetail();

    function updateMediaUi() {
      renderImagePreview(activeDocument, activeRoot, currentDetail);
      renderAudioPreviews(activeDocument, activeRoot, currentDetail);
      syncMediaFields(activeDocument, currentDetail);

      const hasSavedWord = hasPersistentWordId(currentWordId);
      setMediaControlsDisabled(activeDocument, !hasSavedWord);

      if (!hasSavedWord) {
        setImageStatus(activeDocument, "請先儲存單字後再上傳圖片。", false);
        setAudioStatus(activeDocument, "請先儲存單字後再上傳音檔。", false);
      } else {
        setImageStatus(activeDocument, currentDetail.image_url ? "可直接替換或刪除圖片。" : "尚未上傳圖片。", false);
        setAudioStatus(activeDocument, "可直接上傳、替換或刪除各語言音檔。", false);
      }
    }

    async function loadInitialData() {
      const tagResult = await activeRoot.lexiconAdminApi.loadTagList(client);
      if (tagContainer) {
        tagContainer.innerHTML = buildTagOptionMarkup(tagResult.data || [], [], { t: t });
      }

      if (currentMode === "invalid") {
        applyWordDetail(activeDocument, createEmptyWordDetail(), "create");
        setWordEditStatus(activeDocument, t("wordEdit.status.invalidId"), true);
        setSaveDisabled(activeDocument, true);
        updateMediaUi();
        return;
      }

      if (currentMode === "edit" && currentWordId) {
        setWordEditStatus(activeDocument, t("wordEdit.status.loading"), false);
        const detailResult = await activeRoot.lexiconAdminApi.loadWordDetail(client, currentWordId);
        currentDetail = detailResult.data;
        applyWordDetail(activeDocument, currentDetail, currentMode);
        if (tagContainer) {
          tagContainer.innerHTML = buildTagOptionMarkup(tagResult.data || [], currentDetail.tag_ids || [], { t: t });
        }
      } else {
        currentDetail = createEmptyWordDetail();
        applyWordDetail(activeDocument, currentDetail, "create");
      }

      setPageCopy(activeDocument, currentMode, t);
      setSaveDisabled(activeDocument, false);
      setWordEditStatus(activeDocument, t("wordEdit.status.ready"), false);
      updateMediaUi();
    }

    try {
      await loadInitialData();
    } catch (error) {
      setWordEditStatus(activeDocument, error.message || t("wordEdit.status.error"), true);
      setSaveDisabled(activeDocument, true);
      setMediaControlsDisabled(activeDocument, true);
      return;
    }

    cancelButton?.addEventListener("click", function () {
      activeRoot.location.href = "admin-words.html";
    });

    saveButtons.forEach(function (button) {
      button.addEventListener("click", async function () {
        const formPayload = normalizeWordEditorPayload(collectFormValues(activeDocument));
        setWordEditStatus(activeDocument, t("common.loading"), false);
        setSaveDisabled(activeDocument, true);

        try {
          let savedWord;
          if (currentMode === "edit" && currentWordId) {
            savedWord = await activeRoot.lexiconAdminApi.updateWord(client, currentWordId, formPayload);
          } else {
            savedWord = await activeRoot.lexiconAdminApi.createWord(client, formPayload);
            currentMode = "edit";
            currentWordId = savedWord.id;
            activeRoot.history?.replaceState?.({}, "", "admin-word-edit.html?id=" + savedWord.id);
          }

          currentWordId = savedWord.id;
          currentDetail = {
            ...formPayload,
            id: currentWordId,
            created_at: currentDetail.created_at,
            updated_at: currentDetail.updated_at,
          };
          activeDocument.getElementById("word-id").value = currentWordId;
          setPageCopy(activeDocument, "edit", t);
          setWordEditStatus(activeDocument, t("wordEdit.status.saved"), false);
          updateMediaUi();
        } catch (error) {
          setWordEditStatus(activeDocument, error.message || t("wordEdit.status.error"), true);
        } finally {
          setSaveDisabled(activeDocument, false);
        }
      });
    });

    imageUploadButton?.addEventListener("click", async function () {
      if (!hasPersistentWordId(currentWordId)) {
        setImageStatus(activeDocument, "請先儲存單字後再上傳圖片。", true);
        return;
      }

      const file = imageFileInput?.files?.[0];

      if (!file) {
        setImageStatus(activeDocument, "請先選擇圖片檔。", true);
        return;
      }

      setMediaControlsDisabled(activeDocument, true);
      setImageStatus(activeDocument, "正在上傳圖片...", false);

      try {
        const result = await activeRoot.lexiconAdminApi.uploadWordImage(client, currentWordId, file);
        currentDetail.image_url = result.imageUrl || "";
        syncMediaFields(activeDocument, currentDetail);
        renderImagePreview(activeDocument, activeRoot, currentDetail);
        if (imageFileInput) {
          imageFileInput.value = "";
        }
        setImageStatus(activeDocument, "圖片已更新。", false);
      } catch (error) {
        setImageStatus(activeDocument, error.message || "圖片上傳失敗。", true);
      } finally {
        updateMediaUi();
      }
    });

    imageDeleteButton?.addEventListener("click", async function () {
      if (!hasPersistentWordId(currentWordId)) {
        setImageStatus(activeDocument, "請先儲存單字後再刪除圖片。", true);
        return;
      }

      if (!currentDetail.image_url) {
        setImageStatus(activeDocument, "目前沒有圖片可刪除。", true);
        return;
      }

      if (!activeRoot.confirm || !activeRoot.confirm("確定要刪除這張圖片嗎？")) {
        return;
      }

      setMediaControlsDisabled(activeDocument, true);
      setImageStatus(activeDocument, "正在刪除圖片...", false);

      try {
        await activeRoot.lexiconAdminApi.deleteWordImage(client, currentWordId);
        currentDetail.image_url = "";
        syncMediaFields(activeDocument, currentDetail);
        renderImagePreview(activeDocument, activeRoot, currentDetail);
        setImageStatus(activeDocument, "圖片已刪除。", false);
      } catch (error) {
        setImageStatus(activeDocument, error.message || "圖片刪除失敗。", true);
      } finally {
        updateMediaUi();
      }
    });

    SUPPORTED_LANGUAGE_CODES.forEach(function (languageCode) {
      const uploadButton = activeDocument.querySelector('[data-audio-upload="' + languageCode + '"]');
      const deleteButton = activeDocument.querySelector('[data-audio-delete="' + languageCode + '"]');
      const fileInput = activeDocument.querySelector('[data-audio-file="' + languageCode + '"]');

      uploadButton?.addEventListener("click", async function () {
        if (!hasPersistentWordId(currentWordId)) {
          setAudioStatus(activeDocument, "請先儲存單字後再上傳音檔。", true);
          return;
        }

        const file = fileInput?.files?.[0];

        if (!file) {
          setAudioStatus(activeDocument, "請先選擇音檔。", true);
          return;
        }

        setMediaControlsDisabled(activeDocument, true);
        setAudioStatus(activeDocument, "正在上傳 " + languageCode + " 音檔...", false);

        try {
          const result = await activeRoot.lexiconAdminApi.uploadWordAudio(client, currentWordId, languageCode, file);
          currentDetail.translations[languageCode].audio_filename = result.audioFilename || "";
          syncMediaFields(activeDocument, currentDetail);
          renderAudioPreviews(activeDocument, activeRoot, currentDetail);
          if (fileInput) {
            fileInput.value = "";
          }
          setAudioStatus(activeDocument, languageCode + " 音檔已更新。", false);
        } catch (error) {
          setAudioStatus(activeDocument, error.message || "音檔上傳失敗。", true);
        } finally {
          updateMediaUi();
        }
      });

      deleteButton?.addEventListener("click", async function () {
        if (!hasPersistentWordId(currentWordId)) {
          setAudioStatus(activeDocument, "請先儲存單字後再刪除音檔。", true);
          return;
        }

        if (!currentDetail.translations[languageCode].audio_filename) {
          setAudioStatus(activeDocument, languageCode + " 目前沒有音檔可刪除。", true);
          return;
        }

        if (!activeRoot.confirm || !activeRoot.confirm("確定要刪除 " + languageCode + " 音檔嗎？")) {
          return;
        }

        setMediaControlsDisabled(activeDocument, true);
        setAudioStatus(activeDocument, "正在刪除 " + languageCode + " 音檔...", false);

        try {
          await activeRoot.lexiconAdminApi.deleteWordAudio(client, currentWordId, languageCode);
          currentDetail.translations[languageCode].audio_filename = "";
          syncMediaFields(activeDocument, currentDetail);
          renderAudioPreviews(activeDocument, activeRoot, currentDetail);
          setAudioStatus(activeDocument, languageCode + " 音檔已刪除。", false);
        } catch (error) {
          setAudioStatus(activeDocument, error.message || "音檔刪除失敗。", true);
        } finally {
          updateMediaUi();
        }
      });
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    applyWordDetail,
    bootstrap,
    buildAudioObjectKey,
    buildMediaUrl,
    buildTagOptionMarkup,
    collectFormValues,
    createEmptyWordDetail,
    hasPersistentWordId,
    normalizeWordEditorPayload,
    parseWordEditParams,
    setSaveDisabled,
    setWordEditStatus,
  };
});

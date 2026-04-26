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

  function buildTagOptionMarkup(tags, selectedTagIds) {
    const selected = new Set(selectedTagIds || []);

    return tags.map(function (tag) {
      const label = tag.translations?.["zh-TW"]?.name || tag.translations?.en?.name || `Tag #${tag.id}`;
      return `
        <label class="button" style="display:inline-flex; align-items:center; gap:8px;">
          <input type="checkbox" data-tag-option value="${tag.id}" ${selected.has(tag.id) ? "checked" : ""} />
          <span>${label}</span>
        </label>
      `.trim();
    }).join("\n");
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

    activeDocument.getElementById("word-id").value = payload.id || (mode === "create" ? "建立後自動產生" : "");
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
    node.style.color = isError ? "#fca5a5" : "#94a3b8";
  }

  function setSaveDisabled(doc, disabled) {
    const activeDocument = doc || root.document;
    activeDocument.querySelectorAll("[data-word-save]").forEach(function (button) {
      button.disabled = Boolean(disabled);
    });
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

    const client = access.client || activeRoot.lexiconAdminApi.getAdminSupabaseClient(activeRoot);
    const params = parseWordEditParams(activeRoot.location?.search || "");
    const tagContainer = activeDocument.querySelector("[data-tag-options]");
    const pageTitle = activeDocument.querySelector("[data-word-edit-title]");
    const saveButtons = activeDocument.querySelectorAll("[data-word-save]");
    const cancelButton = activeDocument.querySelector("[data-word-cancel]");

    let currentWordId = params.wordId;
    let currentMode = params.mode;

    try {
      const tagResult = await activeRoot.lexiconAdminApi.loadTagList(client);
      if (tagContainer) {
        tagContainer.innerHTML = buildTagOptionMarkup(tagResult.data || [], []);
      }

      if (currentMode === "invalid") {
        applyWordDetail(activeDocument, createEmptyWordDetail(), "create");
        if (pageTitle) {
          pageTitle.textContent = "無效的字詞連結";
        }
        setWordEditStatus(activeDocument, "無效的字詞 ID，請從字詞列表重新進入。", true);
        setSaveDisabled(activeDocument, true);
        return;
      }

      if (currentMode === "edit" && currentWordId) {
        const detailResult = await activeRoot.lexiconAdminApi.loadWordDetail(client, currentWordId);
        applyWordDetail(activeDocument, detailResult.data, currentMode);
        if (tagContainer) {
          tagContainer.innerHTML = buildTagOptionMarkup(tagResult.data || [], detailResult.data.tag_ids || []);
        }
        if (pageTitle) {
          pageTitle.textContent = "編輯字詞";
        }
      } else {
        applyWordDetail(activeDocument, createEmptyWordDetail(), "create");
        if (pageTitle) {
          pageTitle.textContent = "建立字詞";
        }
      }

      setSaveDisabled(activeDocument, false);
      setWordEditStatus(activeDocument, "請確認欄位後再儲存。", false);
    } catch (error) {
      setWordEditStatus(activeDocument, error.message || "載入字詞資料失敗。", true);
      setSaveDisabled(activeDocument, true);
    }

    cancelButton?.addEventListener("click", function () {
      activeRoot.location.href = "admin-words.html";
    });

    saveButtons.forEach(function (button) {
      button.addEventListener("click", async function () {
        const formPayload = normalizeWordEditorPayload(collectFormValues(activeDocument));
        setWordEditStatus(activeDocument, "儲存中...", false);

        try {
          let savedWord;

          if (currentMode === "edit" && currentWordId) {
            savedWord = await activeRoot.lexiconAdminApi.updateWord(client, currentWordId, formPayload);
          } else {
            savedWord = await activeRoot.lexiconAdminApi.createWord(client, formPayload);
            currentMode = "edit";
            currentWordId = savedWord.id;
            activeRoot.history?.replaceState?.({}, "", `admin-word-edit.html?id=${savedWord.id}`);
            activeDocument.getElementById("word-id").value = savedWord.id;
            if (pageTitle) {
              pageTitle.textContent = "編輯字詞";
            }
          }

          setWordEditStatus(activeDocument, "字詞已儲存。", false);
        } catch (error) {
          setWordEditStatus(activeDocument, error.message || "儲存字詞失敗。", true);
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
    buildTagOptionMarkup,
    collectFormValues,
    createEmptyWordDetail,
    normalizeWordEditorPayload,
    parseWordEditParams,
    setSaveDisabled,
    setWordEditStatus,
  };
});

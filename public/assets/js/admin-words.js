(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminWords = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function normalizeWordsPageState(partialState = {}) {
    const page = Number(partialState.page);
    const pageSize = Number(partialState.pageSize);

    return {
      q: typeof partialState.q === "string" ? partialState.q.trim() : "",
      tagId: partialState.tagId ? Number(partialState.tagId) : null,
      hasImage: partialState.hasImage ?? null,
      hasAudio: partialState.hasAudio ?? null,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 25,
    };
  }

  function buildEditWordUrl(wordId) {
    return "admin-word-edit.html?id=" + Number(wordId);
  }

  function buildCreateWordUrl() {
    return "admin-word-edit.html?mode=create";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatUpdatedAt(value, locale) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString(locale === "en" ? "en-US" : "zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function resolveTagLabel(tag, locale) {
    const normalizedLocale = locale === "en" ? "en" : locale === "id" ? "id" : "zh-TW";

    return tag?.translations?.[normalizedLocale]?.name
      || tag?.translations?.["zh-TW"]?.name
      || tag?.translations?.id?.name
      || tag?.translations?.en?.name
      || (tag?.id ? "Tag #" + tag.id : "");
  }

  function createTagNameResolver(tags, locale) {
    const tagLabelMap = new Map(
      (Array.isArray(tags) ? tags : []).map(function (tag) {
        return [Number(tag.id), resolveTagLabel(tag, locale)];
      }),
    );

    return function (tagId) {
      return tagLabelMap.get(Number(tagId)) || "";
    };
  }

  function getMediaPublicBaseUrl(activeRoot) {
    return String(
      activeRoot?.LEXICON_MEDIA_PUBLIC_BASE_URL
      || activeRoot?.LEXICON_ADMIN_MEDIA_PUBLIC_BASE_URL
      || "",
    ).replace(/\/$/, "");
  }

  function buildWordImagePreviewUrl(activeRoot, imageUrl) {
    const normalizedImageUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";
    const baseUrl = getMediaPublicBaseUrl(activeRoot);

    if (!normalizedImageUrl) {
      return "";
    }

    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalizedImageUrl)) {
      return normalizedImageUrl;
    }

    if (!baseUrl) {
      return normalizedImageUrl;
    }

    return baseUrl + "/" + normalizedImageUrl.replace(/^\//, "");
  }

  function renderWordRow(item, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };
    const locale = options.locale || "zh-TW";
    const serialNumber = Number.isInteger(options.serialNumber) ? options.serialNumber : Number(item.id);
    const resolveTagName = typeof options.tagNameResolver === "function"
      ? options.tagNameResolver
      : function () { return ""; };
    const tagMarkup = item.tags.length
      ? item.tags.map(function (tagId) {
          const tagLabel = resolveTagName(tagId) || "Tag #" + tagId;
          return "<span>" + escapeHtml(tagLabel) + "</span>";
        }).join("")
      : "<span>" + escapeHtml(t("words.table.tagFallback")) + "</span>";
    const previewImageUrl = options.imagePreviewUrl || buildWordImagePreviewUrl(options.root, item.image_url);
    const imageMarkup = item.has_image && previewImageUrl
      ? '<span class="admin-thumb"><img src="' + escapeHtml(previewImageUrl) + '" alt="' + escapeHtml(item.lang_zh_tw || item.lang_id || item.lang_en || "") + '"></span>'
      : '<span class="admin-thumb admin-thumb-empty">-</span>';

    return [
      "<tr>",
      "<td>" + escapeHtml(serialNumber) + "</td>",
      "<td>" + imageMarkup + "</td>",
      "<td>" + escapeHtml(item.lang_zh_tw) + "</td>",
      "<td>" + escapeHtml(item.lang_id) + "</td>",
      "<td>" + escapeHtml(item.lang_en) + "</td>",
      "<td><div class=\"admin-tags\">" + tagMarkup + "</div></td>",
      "<td>" + escapeHtml(formatUpdatedAt(item.updated_at, locale)) + "</td>",
      "<td><div class=\"admin-row-actions\"><a class=\"admin-button secondary\" href=\"" + escapeHtml(buildEditWordUrl(item.id)) + "\">" + escapeHtml(t("words.table.edit")) + "</a></div></td>",
      "</tr>",
    ].join("");
  }

  function renderWordRows(items, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };

    if (!Array.isArray(items) || items.length === 0) {
      return [
        "<tr>",
        "<td colspan=\"8\"><div class=\"admin-empty-state\">" + escapeHtml(t("words.table.empty")) + "</div></td>",
        "</tr>",
      ].join("");
    }

    const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
    const pageSize = Number.isInteger(options.pageSize) && options.pageSize > 0 ? options.pageSize : items.length;

    return items.map(function (item, index) {
      return renderWordRow(item, Object.assign({}, options, {
        serialNumber: (page - 1) * pageSize + index + 1,
      }));
    }).join("\n");
  }

  function renderPagination(state, total) {
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    return {
      totalPages: totalPages,
      previousPage: Math.max(1, state.page - 1),
      nextPage: Math.min(totalPages, state.page + 1),
      canGoPrevious: state.page > 1,
      canGoNext: state.page < totalPages,
    };
  }

  function syncTagFilterOptions(selectNode, tags, translator) {
    if (!selectNode) {
      return;
    }

    const t = typeof translator === "function" ? translator : function (key) { return key; };
    const currentValue = selectNode.value;
    const options = [
      '<option value="">' + escapeHtml(t("words.filters.unset")) + "</option>",
      ...tags.map(function (tag) {
        const label = resolveTagLabel(tag, "zh-TW");
        return '<option value="' + escapeHtml(tag.id) + '">' + escapeHtml(label) + "</option>";
      }),
    ];

    selectNode.innerHTML = options.join("\n");
    selectNode.value = currentValue;
  }

  async function bootstrap(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = activeRoot.document;

    if (!activeDocument || !activeRoot.lexiconAdminAuth || !activeRoot.lexiconAdminApi) {
      return;
    }

    const pageGuard = await activeRoot.lexiconAdminAuth.protectAdminPage(activeRoot);

    if (!pageGuard?.allowed) {
      return;
    }

    const translator = activeRoot.lexiconAdminI18n?.createTranslator?.(activeRoot) || {
      locale: "zh-TW",
      t: function (key) { return key; },
    };
    const t = translator.t;
    const client = pageGuard.client || activeRoot.lexiconAdminApi.getAdminSupabaseClient(activeRoot);
    const searchInput = activeDocument.getElementById("word-search");
    const tagFilter = activeDocument.getElementById("tag-filter");
    const imageFilter = activeDocument.getElementById("image-filter");
    const audioFilter = activeDocument.getElementById("audio-filter");
    const pageSizeFilter = activeDocument.getElementById("page-size-filter");
    const statusNode = activeDocument.querySelector("[data-words-status]");
    const tableBody = activeDocument.querySelector("[data-words-table-body]");
    const summaryNode = activeDocument.querySelector("[data-words-summary]");
    const previousButton = activeDocument.querySelector("[data-words-prev]");
    const nextButton = activeDocument.querySelector("[data-words-next]");
    const pageNode = activeDocument.querySelector("[data-words-page]");
    const createLink = activeDocument.querySelector("[data-create-word-link]");
    const state = normalizeWordsPageState({ page: 1, pageSize: 25 });
    let tagNameResolver = function () {
      return "";
    };

    if (createLink) {
      createLink.setAttribute("href", buildCreateWordUrl());
    }

    try {
      const tagResult = await activeRoot.lexiconAdminApi.loadTagList(client);
      const tags = tagResult.data || [];
      syncTagFilterOptions(tagFilter, tags, t);
      tagNameResolver = createTagNameResolver(tags, translator.locale);
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = error.message || t("words.status.error");
      }
    }

    async function loadWords() {
      if (statusNode) {
        statusNode.textContent = t("words.status.loading");
      }

      try {
        const result = await activeRoot.lexiconAdminApi.loadWordList(client, state);
        const pagination = renderPagination(state, result.data.total);

        if (tableBody) {
          tableBody.innerHTML = renderWordRows(result.data.items, {
            locale: translator.locale,
            page: state.page,
            pageSize: state.pageSize,
            root: activeRoot,
            tagNameResolver: tagNameResolver,
            t: t,
          });
        }

        if (summaryNode) {
          const start = result.data.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
          const end = Math.min(result.data.total, state.page * state.pageSize);
          summaryNode.textContent = t("words.summary", {
            end: end,
            start: start,
            total: result.data.total,
          });
        }

        if (pageNode) {
          pageNode.textContent = t("words.pagination.label", {
            page: state.page,
            totalPages: pagination.totalPages,
          });
        }

        if (previousButton) {
          previousButton.disabled = !pagination.canGoPrevious;
        }

        if (nextButton) {
          nextButton.disabled = !pagination.canGoNext;
        }

        if (statusNode) {
          statusNode.textContent = result.data.total === 0 ? t("words.empty") : "";
        }
      } catch (error) {
        if (tableBody) {
          tableBody.innerHTML = renderWordRows([], { t: t });
        }

        if (statusNode) {
          statusNode.textContent = error.message || t("words.status.error");
        }
      }
    }

    function syncStateFromInputs() {
      state.q = searchInput?.value.trim() || "";
      state.tagId = tagFilter?.value ? Number(tagFilter.value) : null;
      state.hasImage = imageFilter?.value === "" ? null : imageFilter.value === "true";
      state.hasAudio = audioFilter?.value === "" ? null : audioFilter.value === "true";
      state.pageSize = pageSizeFilter?.value ? Number(pageSizeFilter.value) : 25;
      state.page = 1;
    }

    let searchTimer = null;
    searchInput?.addEventListener("input", function () {
      activeRoot.clearTimeout(searchTimer);
      searchTimer = activeRoot.setTimeout(function () {
        syncStateFromInputs();
        loadWords();
      }, 200);
    });

    [tagFilter, imageFilter, audioFilter, pageSizeFilter].forEach(function (node) {
      node?.addEventListener("change", function () {
        syncStateFromInputs();
        loadWords();
      });
    });

    previousButton?.addEventListener("click", function () {
      if (state.page > 1) {
        state.page -= 1;
        loadWords();
      }
    });

    nextButton?.addEventListener("click", function () {
      state.page += 1;
      loadWords();
    });

    loadWords();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    bootstrap: bootstrap,
    buildCreateWordUrl: buildCreateWordUrl,
    buildEditWordUrl: buildEditWordUrl,
    buildWordImagePreviewUrl: buildWordImagePreviewUrl,
    createTagNameResolver: createTagNameResolver,
    normalizeWordsPageState: normalizeWordsPageState,
    renderPagination: renderPagination,
    renderWordRow: renderWordRow,
    renderWordRows: renderWordRows,
  };
});

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
    return `admin-word-edit.html?id=${Number(wordId)}`;
  }

  function buildCreateWordUrl() {
    return "admin-word-edit.html?mode=create";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatUpdatedAt(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderWordRow(item) {
    const mediaFlags = [
      item.has_image ? "有圖片" : "無圖片",
      item.audio_languages.length > 0 ? `音檔：${item.audio_languages.join(", ")}` : "缺少音檔",
    ].join(" / ");
    const tagMarkup = item.tags.length
      ? item.tags.map(function (tagId) {
          return `<span>Tag #${tagId}</span>`;
        }).join("")
      : "<span>無標籤</span>";

    return `
      <tr>
        <td>${escapeHtml(item.id)}</td>
        <td><span class="thumb">${item.has_image ? "IMG" : "-"}</span></td>
        <td>${escapeHtml(item.lang_zh_tw)}</td>
        <td>${escapeHtml(item.lang_id)}</td>
        <td>${escapeHtml(item.lang_en)}</td>
        <td><div class="tags">${tagMarkup}</div></td>
        <td>${escapeHtml(mediaFlags)}</td>
        <td>${escapeHtml(formatUpdatedAt(item.updated_at))}</td>
        <td>
          <div class="row-actions">
            <a class="button" href="${escapeHtml(buildEditWordUrl(item.id))}">編輯</a>
          </div>
        </td>
      </tr>
    `.trim();
  }

  function renderWordRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return `
        <tr>
          <td colspan="9">
            <div class="admin-empty-state">目前沒有符合條件的字詞。</div>
          </td>
        </tr>
      `.trim();
    }

    return items.map(renderWordRow).join("\n");
  }

  function renderPagination(state, total) {
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    const previousPage = Math.max(1, state.page - 1);
    const nextPage = Math.min(totalPages, state.page + 1);

    return {
      totalPages,
      previousPage,
      nextPage,
      canGoPrevious: state.page > 1,
      canGoNext: state.page < totalPages,
    };
  }

  function syncTagFilterOptions(selectNode, tags) {
    if (!selectNode) {
      return;
    }

    const currentValue = selectNode.value;
    const options = [
      '<option value="">全部標籤</option>',
      ...tags.map(function (tag) {
        const label = tag.translations?.["zh-TW"]?.name || tag.translations?.en?.name || `Tag #${tag.id}`;
        return `<option value="${escapeHtml(tag.id)}">${escapeHtml(label)}</option>`;
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

    if (createLink) {
      createLink.setAttribute("href", buildCreateWordUrl());
    }

    try {
      const tagResult = await activeRoot.lexiconAdminApi.loadTagList(client);
      syncTagFilterOptions(tagFilter, tagResult.data || []);
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = "載入標籤失敗。";
      }
    }

    async function loadWords() {
      if (statusNode) {
        statusNode.textContent = "載入中...";
      }

      try {
        const result = await activeRoot.lexiconAdminApi.loadWordList(client, state);
        const pagination = renderPagination(state, result.data.total);

        if (tableBody) {
          tableBody.innerHTML = renderWordRows(result.data.items);
        }

        if (summaryNode) {
          const start = result.data.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
          const end = Math.min(result.data.total, state.page * state.pageSize);
          summaryNode.textContent = `顯示 ${start}-${end} 筆，共 ${result.data.total} 筆字詞`;
        }

        if (pageNode) {
          pageNode.textContent = `${state.page} / ${pagination.totalPages}`;
        }

        if (previousButton) {
          previousButton.disabled = !pagination.canGoPrevious;
        }

        if (nextButton) {
          nextButton.disabled = !pagination.canGoNext;
        }

        if (statusNode) {
          statusNode.textContent = result.data.total === 0 ? "目前沒有符合條件的字詞。" : "";
        }
      } catch (error) {
        if (tableBody) {
          tableBody.innerHTML = `
            <tr>
              <td colspan="9">
                <div class="admin-empty-state">載入字詞失敗。</div>
              </td>
            </tr>
          `;
        }

        if (statusNode) {
          statusNode.textContent = "載入字詞失敗。";
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
    bootstrap,
    buildCreateWordUrl,
    buildEditWordUrl,
    normalizeWordsPageState,
    renderPagination,
    renderWordRow,
    renderWordRows,
  };
});

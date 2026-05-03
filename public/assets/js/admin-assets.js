(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminAssets = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getAssetFileName(path) {
    return escapeHtml(String(path || "").split("/").pop() || path || "");
  }

  function formatBytes(value) {
    const size = Number(value);

    if (!Number.isFinite(size) || size < 0) {
      return "-";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDateTime(value) {
    const timestamp = Date.parse(value);

    if (!Number.isFinite(timestamp)) {
      return "-";
    }

    return new Date(timestamp).toLocaleString("zh-TW", {
      hour12: false,
    });
  }

  function renderReferencedWords(words) {
    const items = Array.isArray(words) ? words : [];

    if (items.length === 0) {
      return "未綁定";
    }

    return items.map(function (word) {
      return escapeHtml(word.label || "#" + word.id);
    }).join(" / ");
  }

  function renderAssetPreview(item) {
    if (item.type === "image" && item.previewUrl) {
      return '<img class="admin-asset-image" src="' + escapeHtml(item.previewUrl) + '" alt="' + getAssetFileName(item.key) + '" />';
    }

    if (item.type === "audio") {
      return '<div class="admin-asset-audio"><span class="material-symbols-outlined">graphic_eq</span><span>'
        + escapeHtml(item.languageCode || "-")
        + "</span></div>";
    }

    return '<div class="admin-asset-generic">' + escapeHtml(item.key || "-") + "</div>";
  }

  function renderReferenceBadge(item) {
    return item.dbReferenced
      ? '<span class="admin-badge success">已綁定</span>'
      : '<span class="admin-badge muted">未綁定</span>';
  }

  function renderAssetCards(items, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };

    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="admin-empty-state">' + escapeHtml(t("assets.empty")) + "</div>";
    }

    return items.map(function (item) {
      return [
        '<article class="admin-asset-card">',
        '<div class="admin-asset-thumb">' + renderAssetPreview(item) + "</div>",
        '<div class="admin-asset-heading">',
        "<strong>" + getAssetFileName(item.key || item.path) + "</strong>",
        renderReferenceBadge(item),
        "</div>",
        '<div class="admin-asset-meta"><span>' + escapeHtml(item.type) + "</span><span>" + escapeHtml(item.languageCode || "-") + "</span><span>" + escapeHtml(formatBytes(item.size)) + "</span></div>",
        '<div class="admin-asset-path">' + escapeHtml(item.key || item.path) + "</div>",
        '<div class="admin-asset-meta"><span>' + escapeHtml(renderReferencedWords(item.referenced_by_words)) + "</span><span>" + escapeHtml(formatDateTime(item.uploadedAt)) + "</span></div>",
        '<div class="admin-row-actions"><button class="admin-button secondary" type="button" data-delete-storage-key="' + escapeHtml(item.key || item.path) + '">刪除</button></div>',
        "</article>",
      ].join("");
    }).join("\n");
  }

  function renderAssetTableRows(items, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };

    if (!Array.isArray(items) || items.length === 0) {
      return [
        "<tr>",
        '<td colspan="7"><div class="admin-empty-state">' + escapeHtml(t("assets.empty")) + "</div></td>",
        "</tr>",
      ].join("");
    }

    return items.map(function (item) {
      return [
        "<tr>",
        "<td>" + escapeHtml(item.key || item.path) + "</td>",
        "<td>" + escapeHtml(item.type || "-") + "</td>",
        "<td>" + escapeHtml(item.languageCode || "-") + "</td>",
        "<td>" + escapeHtml(formatBytes(item.size)) + "</td>",
        "<td>" + escapeHtml(formatDateTime(item.uploadedAt)) + "</td>",
        "<td>" + renderReferenceBadge(item) + "</td>",
        '<td><div class="admin-row-actions"><button class="admin-button secondary" type="button" data-delete-storage-key="' + escapeHtml(item.key || item.path) + '">刪除</button></div></td>',
        "</tr>",
      ].join("");
    }).join("\n");
  }

  function filterStorageItems(items, filters = {}) {
    const query = String(filters.q || "").trim().toLowerCase();
    const type = String(filters.type || "").trim().toLowerCase();
    const languageCode = String(filters.languageCode || "").trim();

    return (Array.isArray(items) ? items : []).filter(function (item) {
      if (type && item.type !== type) {
        return false;
      }

      if (languageCode && item.languageCode !== languageCode) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.key,
        item.type,
        item.languageCode,
        item.wordId,
      ].filter(Boolean).join("\n").toLowerCase().includes(query);
    });
  }

  async function loadAllStorageObjects(adminApi, client) {
    const items = [];
    let cursor = "";

    do {
      const result = await adminApi.listStorageObjects(client, {
        cursor,
      });
      const pageItems = Array.isArray(result?.items) ? result.items : [];
      items.push(...pageItems);
      cursor = result?.truncated && result?.cursor ? result.cursor : "";
    } while (cursor);

    return items;
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
    const cardsNode = activeDocument.querySelector("[data-assets-cards]");
    const tableBody = activeDocument.querySelector("[data-assets-table-body]");
    const statusNode = activeDocument.querySelector("[data-assets-status]");
    const searchInput = activeDocument.getElementById("asset-search");
    const languageFilter = activeDocument.getElementById("lang-filter");
    const typeTabs = Array.from(activeDocument.querySelectorAll(".admin-tab-row a[data-asset-type]"));
    const reloadButton = activeDocument.querySelector("[data-assets-reload]");
    const purgeButton = activeDocument.querySelector("[data-assets-purge]");
    const purgeInput = activeDocument.getElementById("assets-purge-confirm");
    let allItems = [];
    let activeType = "";

    function setStatus(message, isError) {
      if (!statusNode) {
        return;
      }

      statusNode.textContent = message || "";
      statusNode.classList.toggle("error", Boolean(isError));
    }

    function setBusy(isBusy) {
      if (reloadButton) {
        reloadButton.disabled = Boolean(isBusy);
      }

      if (purgeButton) {
        purgeButton.disabled = Boolean(isBusy);
      }
    }

    function getCurrentFilters() {
      return {
        q: searchInput?.value || "",
        type: activeType,
        languageCode: languageFilter?.value || "",
      };
    }

    function renderFilteredItems() {
      const filteredItems = filterStorageItems(allItems, getCurrentFilters());
      const imageItems = filteredItems.filter(function (item) {
        return item.type === "image";
      });

      if (cardsNode) {
        cardsNode.innerHTML = renderAssetCards(imageItems, { t: t });
      }

      if (tableBody) {
        tableBody.innerHTML = renderAssetTableRows(filteredItems, { t: t });
      }

      setStatus(`共 ${filteredItems.length} 筆物件，圖片 ${imageItems.length} 筆。`, false);
    }

    async function refreshItems() {
      setBusy(true);
      setStatus("正在讀取 R2 物件清單...", false);

      try {
        allItems = await loadAllStorageObjects(activeRoot.lexiconAdminApi, client);
        renderFilteredItems();
      } catch (error) {
        allItems = [];
        if (cardsNode) {
          cardsNode.innerHTML = renderAssetCards([], { t: t });
        }
        if (tableBody) {
          tableBody.innerHTML = renderAssetTableRows([], { t: t });
        }
        setStatus(error.message || "讀取 R2 物件失敗。", true);
      } finally {
        setBusy(false);
      }
    }

    searchInput?.addEventListener("input", renderFilteredItems);
    languageFilter?.addEventListener("change", renderFilteredItems);

    typeTabs.forEach(function (tab) {
      tab.addEventListener("click", function (event) {
        event.preventDefault();
        activeType = tab.getAttribute("data-asset-type") || "";
        typeTabs.forEach(function (candidate) {
          candidate.classList.toggle("active", candidate === tab);
        });
        renderFilteredItems();
      });
    });

    reloadButton?.addEventListener("click", function () {
      refreshItems();
    });

    purgeButton?.addEventListener("click", async function () {
      const confirmText = String(purgeInput?.value || "").trim();

      if (confirmText !== "DELETE ALL R2 OBJECTS") {
        setStatus("請先輸入 DELETE ALL R2 OBJECTS 才能清空整個 bucket。", true);
        return;
      }

      if (!activeRoot.confirm || !activeRoot.confirm("這會刪除整個 R2 bucket 並同步清空資料庫媒體欄位，確定繼續？")) {
        return;
      }

      setBusy(true);
      setStatus("正在清空整個 R2 bucket...", false);

      try {
        const result = await activeRoot.lexiconAdminApi.purgeStorageObjects(client, confirmText);
        if (purgeInput) {
          purgeInput.value = "";
        }
        setStatus(`已刪除 ${result.deletedObjectCount || 0} 個物件，並清空 ${result.clearedImageCount || 0} 筆圖片、${result.clearedAudioCount || 0} 筆音檔欄位。`, false);
        await refreshItems();
      } catch (error) {
        setStatus(error.message || "清空 R2 bucket 失敗。", true);
      } finally {
        setBusy(false);
      }
    });

    activeDocument.addEventListener("click", async function (event) {
      const deleteButton = event.target.closest("[data-delete-storage-key]");

      if (!deleteButton) {
        return;
      }

      const key = deleteButton.getAttribute("data-delete-storage-key");

      if (!key) {
        return;
      }

      if (!activeRoot.confirm || !activeRoot.confirm(`確定要刪除 ${key} 嗎？`)) {
        return;
      }

      setBusy(true);
      setStatus(`正在刪除 ${key}...`, false);

      try {
        const result = await activeRoot.lexiconAdminApi.deleteStorageObject(client, key);
        setStatus(`已刪除 ${result.deletedKey || key}。`, false);
        await refreshItems();
      } catch (error) {
        setStatus(error.message || "刪除物件失敗。", true);
      } finally {
        setBusy(false);
      }
    });

    await refreshItems();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    bootstrap,
    filterStorageItems,
    renderAssetCards,
    renderAssetTableRows,
  };
});

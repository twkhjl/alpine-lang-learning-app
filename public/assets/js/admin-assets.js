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

  function renderReferencedWords(words) {
    const items = Array.isArray(words) ? words : [];
    if (items.length === 0) {
      return "-";
    }

    return items.map(function (word) {
      return escapeHtml(word.label || "#" + word.id);
    }).join(" / ");
  }

  function renderAssetCards(items, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };

    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="admin-empty-state">' + escapeHtml(t("assets.empty")) + "</div>";
    }

    return items.map(function (item) {
      return [
        '<article class="admin-asset-card">',
        '<div class="admin-asset-thumb">' + escapeHtml(item.path) + "</div>",
        "<strong>" + getAssetFileName(item.path) + "</strong>",
        '<div class="admin-asset-meta"><span>' + renderReferencedWords(item.referenced_by_words) + "</span><span>" + escapeHtml(item.type) + "</span></div>",
        '<div class="admin-asset-path">' + escapeHtml(item.path) + "</div>",
        "</article>",
      ].join("");
    }).join("\n");
  }

  function renderAssetTableRows(items, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };

    if (!Array.isArray(items) || items.length === 0) {
      return [
        "<tr>",
        '<td colspan="4"><div class="admin-empty-state">' + escapeHtml(t("assets.empty")) + "</div></td>",
        "</tr>",
      ].join("");
    }

    return items.map(function (item) {
      return [
        "<tr>",
        "<td>" + escapeHtml(item.path) + "</td>",
        "<td>" + escapeHtml(item.language_code || "-") + "</td>",
        "<td>" + escapeHtml(item.type) + "</td>",
        "<td>" + renderReferencedWords(item.referenced_by_words) + "</td>",
        "</tr>",
      ].join("");
    }).join("\n");
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
    let allItems = [];
    let activeType = "";

    function getCurrentFilters() {
      return {
        q: searchInput?.value || "",
        type: activeType,
        languageCode: languageFilter?.value || "",
      };
    }

    function renderFilteredItems() {
      const filteredItems = activeRoot.lexiconAdminApi.filterAssetReferences(allItems, getCurrentFilters());
      const imageItems = filteredItems.filter(function (item) {
        return item.type === "image";
      });
      const audioItems = filteredItems.filter(function (item) {
        return item.type === "audio";
      });

      if (cardsNode) {
        cardsNode.innerHTML = renderAssetCards(imageItems.slice(0, 8), { t: t });
      }

      if (tableBody) {
        tableBody.innerHTML = renderAssetTableRows(audioItems, { t: t });
      }

      if (statusNode) {
        statusNode.textContent = t("assets.status.loaded", {
          audios: audioItems.length,
          images: imageItems.length,
          total: filteredItems.length,
        });
      }
    }

    if (statusNode) {
      statusNode.textContent = t("assets.status.loading");
    }

    try {
      const result = await activeRoot.lexiconAdminApi.loadAssetReferences(client);
      allItems = result.data.items || [];
      renderFilteredItems();
    } catch (error) {
      if (cardsNode) {
        cardsNode.innerHTML = renderAssetCards([], { t: t });
      }
      if (tableBody) {
        tableBody.innerHTML = renderAssetTableRows([], { t: t });
      }
      if (statusNode) {
        statusNode.textContent = error.message || t("assets.status.error");
      }
    }

    let searchTimer = null;
    searchInput?.addEventListener("input", function () {
      activeRoot.clearTimeout(searchTimer);
      searchTimer = activeRoot.setTimeout(renderFilteredItems, 150);
    });

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
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    bootstrap: bootstrap,
    renderAssetCards: renderAssetCards,
    renderAssetTableRows: renderAssetTableRows,
  };
});

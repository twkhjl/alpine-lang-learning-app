(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminDashboard = api;
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

  function getTranslator(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const translator = activeRoot.lexiconAdminI18n?.createTranslator?.(activeRoot);

    return translator || {
      locale: "zh-TW",
      t: function (key) {
        return key;
      },
    };
  }

  function renderRecentWordsRows(items, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };

    if (!Array.isArray(items) || items.length === 0) {
      return [
        "<tr>",
        '<td colspan="5"><div class="admin-empty-state">' + escapeHtml(t("dashboard.recentWords.empty")) + "</div></td>",
        "</tr>",
      ].join("");
    }

    return items.map(function (item) {
      const tags = Array.isArray(item.tags) && item.tags.length > 0
        ? item.tags.join(", ")
        : t("dashboard.recentWords.noTags");
      const audioLabel = item.audio_languages?.length
        ? t("dashboard.recentWords.audio.available")
        : t("dashboard.recentWords.audio.missing");

      return [
        "<tr>",
        '<td><strong>' + escapeHtml(item.lang_zh_tw || item.lang_id || item.lang_en) + "</strong><div class=\"admin-table-meta\">" + escapeHtml(item.lang_id || item.lang_en || "") + "</div></td>",
        "<td>" + escapeHtml(t("dashboard.recentWords.languages")) + ': zh-TW / id / en</td>',
        "<td>" + escapeHtml(tags) + "</td>",
        "<td>" + escapeHtml(audioLabel) + "</td>",
        "<td>" + escapeHtml(item.updated_at || "-") + "</td>",
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

    const { t } = getTranslator(activeRoot);
    const client = access.client || activeRoot.lexiconAdminApi.getAdminSupabaseClient(activeRoot);
    const metricMap = {
      total_words: activeDocument.querySelector("[data-dashboard-total-words]"),
      total_tags: activeDocument.querySelector("[data-dashboard-total-tags]"),
      words_missing_image: activeDocument.querySelector("[data-dashboard-missing-image]"),
      missing_audio_words: activeDocument.querySelector("[data-dashboard-missing-audio]"),
    };
    const recentTableBody = activeDocument.querySelector("[data-dashboard-recent-words]");
    const statusNode = activeDocument.querySelector("[data-dashboard-status]");

    if (statusNode) {
      statusNode.textContent = t("dashboard.status.loading");
    }

    try {
      const result = await activeRoot.lexiconAdminApi.loadDashboardSummary(client);

      Object.keys(metricMap).forEach(function (key) {
        if (metricMap[key]) {
          metricMap[key].textContent = result.data.metrics[key];
        }
      });

      if (recentTableBody) {
        recentTableBody.innerHTML = renderRecentWordsRows(result.data.recent_words || [], { t: t });
      }

      if (statusNode) {
        statusNode.textContent = t("dashboard.status.footer.ready");
      }
    } catch (error) {
      if (recentTableBody) {
        recentTableBody.innerHTML = renderRecentWordsRows([], { t: t });
      }
      if (statusNode) {
        statusNode.textContent = error.message || t("dashboard.status.footer.error");
      }
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    bootstrap: bootstrap,
    renderRecentWordsRows: renderRecentWordsRows,
  };
});

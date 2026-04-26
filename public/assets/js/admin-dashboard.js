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
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRecentWordsRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return `
        <tr>
          <td colspan="5"><div class="admin-empty-state">目前沒有最近更新資料。</div></td>
        </tr>
      `.trim();
    }

    return items.map(function (item) {
      return `
        <tr>
          <td><strong>${escapeHtml(item.lang_zh_tw || item.lang_id || item.lang_en)}</strong><div class="admin-table-meta">${escapeHtml(item.lang_id || item.lang_en || "")}</div></td>
          <td>zh-TW / id / en</td>
          <td>${escapeHtml((item.tags || []).join(", ") || "無標籤")}</td>
          <td>${escapeHtml(item.audio_languages?.length ? "有音檔" : "缺音檔")}</td>
          <td>${escapeHtml(item.updated_at || "-")}</td>
        </tr>
      `.trim();
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
      statusNode.textContent = "載入中...";
    }

    try {
      const result = await activeRoot.lexiconAdminApi.loadDashboardSummary(client);
      Object.keys(metricMap).forEach(function (key) {
        if (metricMap[key]) {
          metricMap[key].textContent = result.data.metrics[key];
        }
      });

      if (recentTableBody) {
        recentTableBody.innerHTML = renderRecentWordsRows(result.data.recent_words || []);
      }

      if (statusNode) {
        statusNode.textContent = "";
      }
    } catch (error) {
      if (recentTableBody) {
        recentTableBody.innerHTML = renderRecentWordsRows([]);
      }
      if (statusNode) {
        statusNode.textContent = error.message || "載入 dashboard 失敗。";
      }
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    bootstrap,
    renderRecentWordsRows,
  };
});
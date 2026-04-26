(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminTags = api;
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

  function createEmptyTagDetail() {
    return {
      id: null,
      icon: "sell",
      translations: {
        "zh-TW": { name: "" },
        id: { name: "" },
        en: { name: "" },
      },
      usage_count: 0,
    };
  }

  function normalizeTagEditorPayload(formValues = {}) {
    return {
      icon: typeof formValues.icon === "string" && formValues.icon.trim() ? formValues.icon.trim() : "sell",
      translations: {
        "zh-TW": { name: typeof formValues.translations?.["zh-TW"]?.name === "string" ? formValues.translations["zh-TW"].name.trim() : "" },
        id: { name: typeof formValues.translations?.id?.name === "string" ? formValues.translations.id.name.trim() : "" },
        en: { name: typeof formValues.translations?.en?.name === "string" ? formValues.translations.en.name.trim() : "" },
      },
    };
  }

  function renderTagRow(tag) {
    const deleteDisabled = tag.usage_count > 0 ? "disabled" : "";
    const deleteTitle = tag.usage_count > 0 ? "此標籤仍有單字使用中，無法刪除" : "刪除標籤";
    return `
      <tr>
        <td>${escapeHtml(tag.id)}</td>
        <td><span class="icon-chip">${escapeHtml((tag.icon || "sell").slice(0, 1).toUpperCase())}</span></td>
        <td>${escapeHtml(tag.translations?.["zh-TW"]?.name || "")}</td>
        <td>${escapeHtml(tag.translations?.id?.name || "")}</td>
        <td>${escapeHtml(tag.translations?.en?.name || "")}</td>
        <td>${escapeHtml(tag.usage_count)}</td>
        <td style="text-align:right">
          <button class="button" type="button" data-tag-edit="${escapeHtml(tag.id)}">編輯</button>
          <button class="button" type="button" data-tag-delete="${escapeHtml(tag.id)}" title="${escapeHtml(deleteTitle)}" ${deleteDisabled}>刪除</button>
        </td>
      </tr>
    `.trim();
  }

  function renderTagRows(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return `
        <tr>
          <td colspan="7">
            <div class="admin-empty-state">目前沒有標籤資料。</div>
          </td>
        </tr>
      `.trim();
    }

    return tags.map(renderTagRow).join("\n");
  }

  function applyTagDetail(doc, tag) {
    const activeDocument = doc || root.document;
    const detail = tag || createEmptyTagDetail();
    activeDocument.getElementById("tag-id").value = detail.id || "新增後產生";
    activeDocument.getElementById("tag-icon").value = detail.icon || "sell";
    activeDocument.getElementById("tag-zh").value = detail.translations?.["zh-TW"]?.name || "";
    activeDocument.getElementById("tag-idn").value = detail.translations?.id?.name || "";
    activeDocument.getElementById("tag-en").value = detail.translations?.en?.name || "";
    const iconNode = activeDocument.querySelector(".modal-icon");
    if (iconNode) {
      iconNode.textContent = (detail.icon || "sell").slice(0, 1).toUpperCase();
    }
  }

  function collectTagFormValues(doc) {
    const activeDocument = doc || root.document;
    return {
      icon: activeDocument.getElementById("tag-icon")?.value || "",
      translations: {
        "zh-TW": { name: activeDocument.getElementById("tag-zh")?.value || "" },
        id: { name: activeDocument.getElementById("tag-idn")?.value || "" },
        en: { name: activeDocument.getElementById("tag-en")?.value || "" },
      },
    };
  }

  function setTagStatus(doc, message, isError) {
    const activeDocument = doc || root.document;
    const node = activeDocument.querySelector("[data-tags-status]");

    if (!node) {
      return;
    }

    node.textContent = message || "";
    node.style.color = isError ? "#dc2626" : "#5b677a";
  }

  async function bootstrap(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = activeRoot.document;

    if (!activeDocument || !activeRoot.lexiconAdminApi || !activeRoot.lexiconAdminAuth) {
      return;
    }

    const access = await activeRoot.lexiconAdminAuth.protectAdminPage(activeRoot);

    if (!access?.allowed) {
      return;
    }

    const client = access.client || activeRoot.lexiconAdminApi.getAdminSupabaseClient(activeRoot);
    const tableBody = activeDocument.querySelector("[data-tags-table-body]");
    const summaryNode = activeDocument.querySelector("[data-tags-summary]");
    const backdrop = activeDocument.querySelector(".modal-backdrop");
    const saveButton = activeDocument.querySelector("[data-tag-save]");
    const cancelButton = activeDocument.querySelector("[data-tag-cancel]");
    const createButton = activeDocument.querySelector("[data-tag-create]");
    const modalTitle = activeDocument.querySelector("[data-tag-modal-title]");
    let activeTags = [];
    let editingTagId = null;

    function openModal(tag) {
      editingTagId = tag?.id || null;
      applyTagDetail(activeDocument, tag || createEmptyTagDetail());
      if (modalTitle) {
        modalTitle.textContent = editingTagId ? "編輯標籤" : "新增標籤";
      }
      if (backdrop) {
        backdrop.hidden = false;
      }
    }

    function closeModal() {
      if (backdrop) {
        backdrop.hidden = true;
      }
    }

    async function loadTags() {
      setTagStatus(activeDocument, "載入中...", false);
      try {
        const result = await activeRoot.lexiconAdminApi.loadTagList(client);
        activeTags = result.data || [];
        if (tableBody) {
          tableBody.innerHTML = renderTagRows(activeTags);
        }
        if (summaryNode) {
          summaryNode.textContent = `共 ${activeTags.length} 個標籤`;
        }
        setTagStatus(activeDocument, "", false);
      } catch (error) {
        if (tableBody) {
          tableBody.innerHTML = renderTagRows([]);
        }
        setTagStatus(activeDocument, error.message || "載入標籤失敗。", true);
      }
    }

    createButton?.addEventListener("click", function () {
      openModal(createEmptyTagDetail());
    });

    cancelButton?.addEventListener("click", function () {
      closeModal();
    });

    backdrop?.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        closeModal();
      }
    });

    saveButton?.addEventListener("click", async function () {
      const payload = normalizeTagEditorPayload(collectTagFormValues(activeDocument));
      setTagStatus(activeDocument, "儲存中...", false);

      try {
        if (editingTagId) {
          await activeRoot.lexiconAdminApi.updateTag(client, editingTagId, payload);
        } else {
          await activeRoot.lexiconAdminApi.createTag(client, payload);
        }

        closeModal();
        await loadTags();
        setTagStatus(activeDocument, "儲存成功。", false);
      } catch (error) {
        setTagStatus(activeDocument, error.message || "儲存標籤失敗。", true);
      }
    });

    activeDocument.addEventListener("click", async function (event) {
      const editButton = event.target.closest("[data-tag-edit]");
      const deleteButton = event.target.closest("[data-tag-delete]");

      if (editButton) {
        const tagId = Number(editButton.getAttribute("data-tag-edit"));
        openModal(activeTags.find(function (tag) {
          return tag.id === tagId;
        }) || createEmptyTagDetail());
      }

      if (deleteButton && !deleteButton.disabled) {
        const tagId = Number(deleteButton.getAttribute("data-tag-delete"));
        try {
          await activeRoot.lexiconAdminApi.deleteTag(client, tagId);
          await loadTags();
          setTagStatus(activeDocument, "刪除成功。", false);
        } catch (error) {
          setTagStatus(activeDocument, error.message || "刪除標籤失敗。", true);
        }
      }
    });

    closeModal();
    loadTags();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    applyTagDetail,
    bootstrap,
    collectTagFormValues,
    createEmptyTagDetail,
    normalizeTagEditorPayload,
    renderTagRow,
    renderTagRows,
    setTagStatus,
  };
});
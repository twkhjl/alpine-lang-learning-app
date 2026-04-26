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
      .replace(/"/g, "&quot;")
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

  function renderTagRow(tag, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };
    const deleteDisabled = tag.usage_count > 0 ? "disabled" : "";

    return [
      "<tr>",
      "<td>" + escapeHtml(tag.id) + "</td>",
      '<td><span class="admin-thumb">' + escapeHtml((tag.icon || "sell").slice(0, 1).toUpperCase()) + "</span></td>",
      "<td>" + escapeHtml(tag.translations?.["zh-TW"]?.name || "") + "</td>",
      "<td>" + escapeHtml(tag.translations?.id?.name || "") + "</td>",
      "<td>" + escapeHtml(tag.translations?.en?.name || "") + "</td>",
      "<td>" + escapeHtml(tag.usage_count) + "</td>",
      '<td style="text-align:right"><button class="admin-button secondary" type="button" data-tag-edit="' + escapeHtml(tag.id) + '">' + escapeHtml(t("tags.actions.edit")) + '</button> <button class="admin-button secondary" type="button" data-tag-delete="' + escapeHtml(tag.id) + '" ' + deleteDisabled + ">" + escapeHtml(t("tags.actions.delete")) + "</button></td>",
      "</tr>",
    ].join("");
  }

  function renderTagRows(tags, options = {}) {
    const t = typeof options.t === "function" ? options.t : function (key) { return key; };
    if (!Array.isArray(tags) || tags.length === 0) {
      return '<tr><td colspan="7"><div class="admin-empty-state">' + escapeHtml(t("tags.empty")) + "</div></td></tr>";
    }

    return tags.map(function (tag) {
      return renderTagRow(tag, options);
    }).join("\n");
  }

  function applyTagDetail(doc, tag) {
    const activeDocument = doc || root.document;
    const detail = tag || createEmptyTagDetail();

    activeDocument.getElementById("tag-id").value = detail.id || "";
    activeDocument.getElementById("tag-icon").value = detail.icon || "sell";
    activeDocument.getElementById("tag-zh").value = detail.translations?.["zh-TW"]?.name || "";
    activeDocument.getElementById("tag-idn").value = detail.translations?.id?.name || "";
    activeDocument.getElementById("tag-en").value = detail.translations?.en?.name || "";
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
    node.classList.toggle("error", Boolean(isError));
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

    const translator = activeRoot.lexiconAdminI18n?.createTranslator?.(activeRoot) || {
      t: function (key) { return key; },
    };
    const t = translator.t;
    const client = access.client || activeRoot.lexiconAdminApi.getAdminSupabaseClient(activeRoot);
    const tableBody = activeDocument.querySelector("[data-tags-table-body]");
    const summaryNode = activeDocument.querySelector("[data-tags-summary]");
    const backdrop = activeDocument.querySelector(".admin-modal-backdrop");
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
        modalTitle.textContent = editingTagId ? t("tags.modal.edit") : t("tags.modal.create");
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
      setTagStatus(activeDocument, t("tags.status.loading"), false);
      try {
        const result = await activeRoot.lexiconAdminApi.loadTagList(client);
        activeTags = result.data || [];
        if (tableBody) {
          tableBody.innerHTML = renderTagRows(activeTags, { t: t });
        }
        if (summaryNode) {
          summaryNode.textContent = t("tags.summary", { count: activeTags.length });
        }
        setTagStatus(activeDocument, "", false);
      } catch (error) {
        if (tableBody) {
          tableBody.innerHTML = renderTagRows([], { t: t });
        }
        setTagStatus(activeDocument, error.message || t("tags.status.error"), true);
      }
    }

    createButton?.addEventListener("click", function () {
      openModal(createEmptyTagDetail());
    });

    cancelButton?.addEventListener("click", closeModal);

    backdrop?.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        closeModal();
      }
    });

    saveButton?.addEventListener("click", async function () {
      const payload = normalizeTagEditorPayload(collectTagFormValues(activeDocument));
      try {
        if (editingTagId) {
          await activeRoot.lexiconAdminApi.updateTag(client, editingTagId, payload);
          setTagStatus(activeDocument, t("tags.status.saveSuccess"), false);
        } else {
          await activeRoot.lexiconAdminApi.createTag(client, payload);
          setTagStatus(activeDocument, t("tags.status.createSuccess"), false);
        }
        closeModal();
        await loadTags();
      } catch (error) {
        setTagStatus(activeDocument, error.message || t("tags.status.error"), true);
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
          setTagStatus(activeDocument, t("tags.status.deleteSuccess"), false);
        } catch (error) {
          setTagStatus(activeDocument, error.message || t("tags.status.deleteBlocked"), true);
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
    applyTagDetail: applyTagDetail,
    bootstrap: bootstrap,
    collectTagFormValues: collectTagFormValues,
    createEmptyTagDetail: createEmptyTagDetail,
    normalizeTagEditorPayload: normalizeTagEditorPayload,
    renderTagRow: renderTagRow,
    renderTagRows: renderTagRows,
    setTagStatus: setTagStatus,
  };
});

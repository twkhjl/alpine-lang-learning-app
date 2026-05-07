(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminFeedback = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const FEEDBACK_ROOT_ID = "admin-feedback-root";
  const DEFAULT_TOAST_DURATION = 4000;
  const DEFAULT_TOAST_TONE = "info";
  const DEFAULT_DIALOG_TONE = "default";

  let toastSequence = 0;
  let activeDialog = null;

  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function clampDuration(value) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return DEFAULT_TOAST_DURATION;
    }

    return normalized;
  }

  function normalizeTone(value, supportedTones, fallbackTone) {
    return supportedTones.includes(value) ? value : fallbackTone;
  }

  function normalizeToastOptions(options = {}) {
    if (typeof options === "string") {
      return normalizeToastOptions({ message: options });
    }

    return {
      id: options.id || "toast-" + (++toastSequence),
      message: typeof options.message === "string" ? options.message.trim() : "",
      tone: normalizeTone(options.tone, ["success", "error", "info"], DEFAULT_TOAST_TONE),
      duration: clampDuration(options.duration),
    };
  }

  function normalizeDialogOptions(options = {}) {
    return {
      title: typeof options.title === "string" ? options.title.trim() : "",
      message: typeof options.message === "string" ? options.message.trim() : "",
      confirmText: typeof options.confirmText === "string" && options.confirmText.trim() ? options.confirmText.trim() : "OK",
      cancelText: typeof options.cancelText === "string" && options.cancelText.trim() ? options.cancelText.trim() : "Cancel",
      tone: normalizeTone(options.tone, ["default", "danger"], DEFAULT_DIALOG_TONE),
    };
  }

  function buildFeedbackMarkup(doc) {
    const container = doc.createElement("div");
    container.id = FEEDBACK_ROOT_ID;
    container.innerHTML = [
      '<div class="admin-toast-viewport" aria-live="polite" aria-atomic="false"></div>',
      '<div class="admin-modal-backdrop admin-feedback-backdrop" hidden>',
      '  <section class="admin-modal admin-feedback-modal" role="dialog" aria-modal="true" aria-labelledby="admin-feedback-title" aria-describedby="admin-feedback-message">',
      "    <header>",
      '      <strong id="admin-feedback-title"></strong>',
      "    </header>",
      '    <div class="admin-modal-body">',
      '      <p id="admin-feedback-message" class="admin-feedback-message"></p>',
      "    </div>",
      "    <footer>",
      '      <button class="admin-button secondary" type="button" data-feedback-cancel></button>',
      '      <button class="admin-button" type="button" data-feedback-confirm></button>',
      "    </footer>",
      "  </section>",
      "</div>",
    ].join("");
    return container;
  }

  function ensureFeedbackRoot(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = activeRoot.document;

    if (!activeDocument || !activeDocument.body || typeof activeDocument.createElement !== "function") {
      return null;
    }

    let container = activeDocument.getElementById(FEEDBACK_ROOT_ID);
    if (!container) {
      container = buildFeedbackMarkup(activeDocument);
      activeDocument.body.appendChild(container);

      const backdrop = container.querySelector(".admin-feedback-backdrop");
      const cancelButton = container.querySelector("[data-feedback-cancel]");
      const confirmButton = container.querySelector("[data-feedback-confirm]");

      backdrop?.addEventListener("click", function (event) {
        if (event.target === backdrop) {
          settleDialog(false);
        }
      });

      cancelButton?.addEventListener("click", function () {
        settleDialog(false);
      });

      confirmButton?.addEventListener("click", function () {
        settleDialog(true);
      });

      activeDocument.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && activeDialog) {
          settleDialog(false);
        }
      });
    }

    return container;
  }

  function settleDialog(confirmed) {
    if (!activeDialog) {
      return;
    }

    const dialogState = activeDialog;
    activeDialog = null;
    dialogState.backdrop.hidden = true;
    dialogState.backdrop.classList.remove("danger");
    dialogState.confirmButton.classList.remove("danger");
    dialogState.resolve(Boolean(confirmed));
  }

  function renderDialog(container, options) {
    const backdrop = container.querySelector(".admin-feedback-backdrop");
    const titleNode = container.querySelector("#admin-feedback-title");
    const messageNode = container.querySelector("#admin-feedback-message");
    const cancelButton = container.querySelector("[data-feedback-cancel]");
    const confirmButton = container.querySelector("[data-feedback-confirm]");
    const normalized = normalizeDialogOptions(options);

    if (!backdrop || !titleNode || !messageNode || !cancelButton || !confirmButton) {
      return null;
    }

    titleNode.textContent = normalized.title;
    messageNode.textContent = normalized.message;
    cancelButton.textContent = normalized.cancelText;
    confirmButton.textContent = normalized.confirmText;
    confirmButton.classList.toggle("danger", normalized.tone === "danger");
    backdrop.classList.toggle("danger", normalized.tone === "danger");
    backdrop.hidden = false;
    cancelButton.focus?.();

    return {
      backdrop,
      cancelButton,
      confirmButton,
    };
  }

  function removeToast(toastNode) {
    toastNode?.remove?.();
  }

  function createToastNode(doc, toast) {
    const node = doc.createElement("div");
    node.className = "admin-toast admin-toast-" + toast.tone;
    node.setAttribute("role", "status");
    node.innerHTML = [
      '<div class="admin-toast-content"></div>',
      '<button class="admin-toast-dismiss" type="button" aria-label="Dismiss notification">×</button>',
    ].join("");
    const contentNode = node.querySelector(".admin-toast-content");
    const dismissButton = node.querySelector(".admin-toast-dismiss");
    if (contentNode) {
      contentNode.textContent = toast.message;
    }
    dismissButton?.addEventListener("click", function () {
      removeToast(node);
    });
    return node;
  }

  function showToast(options, globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const toast = normalizeToastOptions(options);
    if (!toast.message) {
      return null;
    }

    const container = ensureFeedbackRoot(activeRoot);
    const viewport = container?.querySelector(".admin-toast-viewport");
    if (!viewport) {
      return toast;
    }

    const node = createToastNode(activeRoot.document, toast);
    viewport.appendChild(node);
    activeRoot.setTimeout?.(function () {
      removeToast(node);
    }, toast.duration);
    return toast;
  }

  function showSuccessToast(message, options = {}, globalObject) {
    return showToast({
      ...options,
      message,
      tone: "success",
    }, globalObject);
  }

  function showErrorToast(message, options = {}, globalObject) {
    return showToast({
      ...options,
      message,
      tone: "error",
    }, globalObject);
  }

  function showAlertDialog(options, globalObject) {
    const normalized = normalizeDialogOptions(options);
    return showConfirmDialog({
      ...normalized,
      cancelText: "",
    }, globalObject);
  }

  function showConfirmDialog(options, globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const normalized = normalizeDialogOptions(options);
    const container = ensureFeedbackRoot(activeRoot);

    if (!container) {
      if (typeof activeRoot.confirm === "function") {
        return Promise.resolve(activeRoot.confirm(normalized.message || normalized.title || ""));
      }
      return Promise.resolve(true);
    }

    const rendered = renderDialog(container, normalized);
    if (!rendered) {
      if (typeof activeRoot.confirm === "function") {
        return Promise.resolve(activeRoot.confirm(normalized.message || normalized.title || ""));
      }
      return Promise.resolve(true);
    }

    if (!normalized.cancelText) {
      rendered.cancelButton.hidden = true;
    } else {
      rendered.cancelButton.hidden = false;
    }

    if (activeDialog) {
      settleDialog(false);
    }

    return new Promise(function (resolve) {
      activeDialog = {
        ...rendered,
        resolve,
      };
    });
  }

  return {
    FEEDBACK_ROOT_ID,
    ensureFeedbackRoot,
    normalizeDialogOptions,
    normalizeToastOptions,
    showAlertDialog,
    showConfirmDialog,
    showErrorToast,
    showSuccessToast,
    showToast,
  };
});

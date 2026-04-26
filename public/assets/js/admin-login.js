(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminLogin = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function getTranslator(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    return activeRoot.lexiconAdminI18n?.createTranslator?.(activeRoot) || {
      t: function (key) { return key; },
    };
  }

  function setMessage(node, message, isError) {
    if (!node) {
      return;
    }

    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }

  async function bootstrap(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = activeRoot.document;
    const translator = getTranslator(activeRoot);
    const t = translator.t;
    const loginForm = activeDocument.querySelector(".admin-login-form");
    const loginMessage = activeDocument.getElementById("admin-login-message");
    const usernameInput = activeDocument.getElementById("admin-username");
    const passwordInput = activeDocument.getElementById("admin-password");
    const submitButton = loginForm?.querySelector('button[type="submit"]');
    const dashboardPath = "admin-dashboard.html";

    function setBusy(isBusy) {
      if (!submitButton) {
        return;
      }

      submitButton.disabled = isBusy;
      submitButton.textContent = isBusy ? t("login.button.busy") : t("login.button.submit");
    }

    setMessage(loginMessage, t("login.defaultMessage"), false);
    setBusy(false);

    loginForm?.addEventListener("submit", async function (event) {
      event.preventDefault();
      const username = usernameInput?.value?.trim() || "";
      const password = passwordInput?.value || "";

      if (!username || !password) {
        setMessage(loginMessage, t("login.error"), true);
        return;
      }

      try {
        setBusy(true);
        const client = activeRoot.lexiconAdminAuth.createAdminSupabaseClient(activeRoot);
        const result = await activeRoot.lexiconAdminAuth.signInAdminWithUsername(client, username, password, {
          globalObject: activeRoot,
        });

        if (result.error) {
          setMessage(loginMessage, t("login.error"), true);
          setBusy(false);
          return;
        }

        setMessage(loginMessage, t("login.success"), false);
        activeRoot.location.assign(dashboardPath);
      } catch (error) {
        setMessage(loginMessage, t("login.error"), true);
        setBusy(false);
      }
    });

    activeDocument.addEventListener("lexicon-admin-localechange", function () {
      const nextTranslator = getTranslator(activeRoot);
      setMessage(loginMessage, nextTranslator.t("login.defaultMessage"), false);
      setBusy(false);
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    bootstrap: bootstrap,
  };
});

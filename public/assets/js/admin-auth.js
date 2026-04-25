(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminAuth = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function getSupabaseConfig(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);

    return {
      config: activeRoot.LEXICON_SUPABASE_CONFIG,
      supabase: activeRoot.supabase,
    };
  }

  function createAdminSupabaseClient(globalObject) {
    const { config, supabase } = getSupabaseConfig(globalObject);

    if (!config?.url || !config?.publishableKey) {
      throw new Error("Supabase config is required.");
    }

    if (!supabase?.createClient) {
      throw new Error("Supabase client library is required.");
    }

    return supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  async function isAdminUser(client, userId) {
    if (!client || !userId || typeof client.from !== "function") {
      return false;
    }

    try {
      const query = client
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId);

      const result = typeof query.maybeSingle === "function"
        ? await query.maybeSingle()
        : await query;

      return Boolean(result && !result.error && result.data);
    } catch (error) {
      return false;
    }
  }

  function getAdminRedirectPath(isAuthenticated) {
    return isAuthenticated ? "admin-dashboard.html" : "admin-login.html";
  }

  async function signInAdmin(client, email, password) {
    if (!client?.auth?.signInWithPassword) {
      throw new Error("Supabase auth client is required.");
    }

    return client.auth.signInWithPassword({ email, password });
  }

  async function signOutAdmin(client) {
    if (!client?.auth?.signOut) {
      throw new Error("Supabase auth client is required.");
    }

    return client.auth.signOut();
  }

  async function getAdminSession(client) {
    if (!client?.auth?.getSession) {
      return null;
    }

    const result = await client.auth.getSession();

    if (result?.error) {
      throw result.error;
    }

    return result?.data?.session || null;
  }

  async function requireAdminPageAccess(client, options = {}) {
    const session = await getAdminSession(client);

    if (!session?.user?.id) {
      if (typeof options.onUnauthenticated === "function") {
        options.onUnauthenticated();
      }

      return {
        allowed: false,
        reason: "unauthenticated",
        session: null,
      };
    }

    const allowed = await isAdminUser(client, session.user.id);

    if (!allowed) {
      await signOutAdmin(client).catch(function () {
        return null;
      });

      if (typeof options.onUnauthorized === "function") {
        options.onUnauthorized();
      }

      return {
        allowed: false,
        reason: "unauthorized",
        session,
      };
    }

    if (typeof options.onAuthorized === "function") {
      options.onAuthorized(session);
    }

    return {
      allowed: true,
      reason: "ok",
      session,
    };
  }

  function normalizeAdminPageOptions(options = {}) {
    return {
      loginPath: options.loginPath || "admin-login.html",
      logoutSelector: options.logoutSelector || "[data-admin-nav='admin-login.html']",
      onError: options.onError,
    };
  }

  async function protectAdminPage(globalObject, options = {}) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = activeRoot.document;
    const config = normalizeAdminPageOptions(options);

    function redirectToLogin() {
      if (activeRoot.location?.replace) {
        activeRoot.location.replace(config.loginPath);
      }
    }

    function revealBody() {
      if (activeDocument?.body) {
        activeDocument.body.style.visibility = "visible";
      }
    }

    function bindLogout(client) {
      if (!activeDocument?.querySelectorAll || !activeRoot.lexiconAdminAuth?.signOutAdmin) {
        return;
      }

      activeDocument.querySelectorAll(config.logoutSelector).forEach(function (node) {
        if (!node || typeof node.addEventListener !== "function") {
          return;
        }

        node.addEventListener("click", async function (event) {
          event.preventDefault();

          try {
            await activeRoot.lexiconAdminAuth.signOutAdmin(client);
          } catch (error) {
            // Ignore sign-out failures and continue redirecting.
          }

          redirectToLogin();
        });
      });
    }

    try {
      if (
        !activeRoot.lexiconAdminAuth?.createAdminSupabaseClient ||
        !activeRoot.lexiconAdminAuth?.requireAdminPageAccess
      ) {
        throw new Error("Admin auth module is unavailable.");
      }

      const client = activeRoot.lexiconAdminAuth.createAdminSupabaseClient(activeRoot);
      bindLogout(client);

      const access = await activeRoot.lexiconAdminAuth.requireAdminPageAccess(client, {
        onUnauthenticated: redirectToLogin,
        onUnauthorized: redirectToLogin,
      });

      if (access.allowed) {
        revealBody();
        return {
          allowed: true,
          client,
          access,
        };
      }

      redirectToLogin();
      return {
        allowed: false,
        client,
        access,
      };
    } catch (error) {
      if (typeof config.onError === "function") {
        try {
          config.onError(error);
        } catch (hookError) {
          // Ignore hook failures and continue redirecting.
        }
      }

      redirectToLogin();

      return {
        allowed: false,
        error,
      };
    }
  }

  return {
    createAdminSupabaseClient,
    isAdminUser,
    getAdminRedirectPath,
    signInAdmin,
    signOutAdmin,
    getAdminSession,
    requireAdminPageAccess,
    protectAdminPage,
  };
});

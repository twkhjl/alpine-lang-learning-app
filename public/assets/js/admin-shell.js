(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminShell = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const ADMIN_ROUTES = [
    {
      path: "admin-dashboard.html",
      navKey: "dashboard",
      icon: "dashboard",
      titleKey: "admin.pageTitle.dashboard",
      visibleInSidebar: true,
    },
    {
      path: "admin-words.html",
      navKey: "words",
      icon: "menu_book",
      titleKey: "admin.pageTitle.words",
      visibleInSidebar: true,
    },
    {
      path: "admin-word-edit.html",
      navKey: "word-edit",
      icon: "edit_square",
      titleKey: "admin.pageTitle.wordEdit",
      visibleInSidebar: false,
    },
    {
      path: "admin-assets.html",
      navKey: "assets",
      icon: "perm_media",
      titleKey: "admin.pageTitle.assets",
      visibleInSidebar: true,
    },
    {
      path: "admin-tags.html",
      navKey: "tags",
      icon: "sell",
      titleKey: "admin.pageTitle.tags",
      visibleInSidebar: true,
    },
    {
      path: "admin-login.html",
      navKey: "login",
      icon: "login",
      titleKey: "admin.pageTitle.login",
      visibleInSidebar: false,
    },
  ];

  function resolveGlobalObject(globalObject) {
    return globalObject || root;
  }

  function getCurrentAdminPath(locationObject) {
    const activeLocation = locationObject || root.location;
    const pathname = activeLocation && activeLocation.pathname ? activeLocation.pathname : "";
    const currentPath = pathname.split("/").pop();

    return currentPath || "admin-dashboard.html";
  }

  function getRouteByPath(pathname) {
    return ADMIN_ROUTES.find(function (route) {
      return route.path === pathname;
    }) || null;
  }

  function getAdminPageTitle(pathname, translator) {
    const route = getRouteByPath(pathname);

    if (!route) {
      return "";
    }

    return typeof translator === "function" ? translator(route.titleKey) : route.titleKey;
  }

  function isAdminRoute(pathname) {
    return ADMIN_ROUTES.some(function (route) {
      return route.path === pathname;
    });
  }

  function renderAdminNavLinks(currentPath) {
    const normalizedPath = currentPath || "admin-dashboard.html";

    return ADMIN_ROUTES.filter(function (route) {
      return route.visibleInSidebar;
    }).map(function (route) {
      return Object.assign({}, route, {
        active: route.path === normalizedPath || (normalizedPath === "admin-word-edit.html" && route.path === "admin-words.html"),
      });
    });
  }

  function renderSidebarMarkup(currentPath, translator) {
    const t = typeof translator === "function" ? translator : function (key) { return key; };
    const linksMarkup = renderAdminNavLinks(currentPath).map(function (route) {
      const ariaCurrent = route.active ? ' aria-current="page"' : "";
      return [
        '<a class="admin-nav-link" data-admin-nav="' + route.path + '"' + ariaCurrent + '>',
        '<span class="material-symbols-outlined">' + route.icon + "</span>",
        '<span>' + t("shell.nav." + route.navKey) + "</span>",
        "</a>",
      ].join("");
    }).join("");

    return [
      '<div class="admin-brand">',
      "<h1>LingoCMS</h1>",
      '<p>' + t("shell.brand.tagline") + "</p>",
      "</div>",
      '<nav class="admin-sidebar-nav" aria-label="' + t("shell.nav.ariaLabel") + '">',
      linksMarkup,
      "</nav>",
    ].join("");
  }

  function renderTopbarControlsMarkup(translator, locale) {
    const t = typeof translator === "function" ? translator : function (key) { return key; };
    const activeLocale = locale === "en" ? "en" : "zh-TW";

    return [
      '<div class="admin-topbar-controls">',
      '<div class="admin-language-panel admin-language-panel-topbar">',
      '<div class="admin-language-label">' + t("shell.language.label") + "</div>",
      '<div class="admin-language-options">',
      '<button type="button" class="admin-language-button' + (activeLocale === "zh-TW" ? " active" : "") + '" data-admin-locale="zh-TW">繁中</button>',
      '<button type="button" class="admin-language-button' + (activeLocale === "en" ? " active" : "") + '" data-admin-locale="en">EN</button>',
      "</div>",
      "</div>",
      '<div class="admin-user-menu" data-admin-user-menu>',
      '<button type="button" class="admin-user-menu-trigger" data-admin-user-menu-trigger aria-haspopup="menu" aria-expanded="false">',
      '<span class="material-symbols-outlined">shield_lock</span>',
      '<span>' + t("shell.userLabel") + "</span>",
      '<span class="material-symbols-outlined">expand_more</span>',
      "</button>",
      '<div class="admin-user-menu-panel" data-admin-user-menu-panel hidden>',
      '<a class="admin-user-menu-item" data-admin-nav="admin-login.html" data-admin-logout href="admin-login.html" role="menuitem">',
      '<span class="material-symbols-outlined">logout</span>',
      '<span>' + t("shell.nav.logout") + "</span>",
      "</a>",
      "</div>",
      "</div>",
      "</div>",
    ].join("");
  }

  function closeAdminUserMenus(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return;
    }

    doc.querySelectorAll("[data-admin-user-menu]").forEach(function (menu) {
      const trigger = menu.querySelector("[data-admin-user-menu-trigger]");
      const panel = menu.querySelector("[data-admin-user-menu-panel]");

      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }

      if (panel) {
        panel.hidden = true;
      }
    });
  }

  function bindTopbarControls(doc) {
    if (!doc || doc.__lexiconAdminTopbarBound) {
      return;
    }

    doc.addEventListener("click", function (event) {
      const trigger = event.target && typeof event.target.closest === "function"
        ? event.target.closest("[data-admin-user-menu-trigger]")
        : null;

      if (trigger) {
        const menu = typeof trigger.closest === "function"
          ? trigger.closest("[data-admin-user-menu]")
          : null;
        const panel = menu ? menu.querySelector("[data-admin-user-menu-panel]") : null;
        const isOpen = trigger.getAttribute("aria-expanded") === "true";

        closeAdminUserMenus(doc);

        if (!isOpen && panel) {
          trigger.setAttribute("aria-expanded", "true");
          panel.hidden = false;
        }

        return;
      }

      const isInMenu = event.target && typeof event.target.closest === "function"
        ? event.target.closest("[data-admin-user-menu]")
        : null;

      if (!isInMenu) {
        closeAdminUserMenus(doc);
      }
    });

    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAdminUserMenus(doc);
      }
    });

    doc.__lexiconAdminTopbarBound = true;
  }

  function applyAdminPageState(doc, globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    const activeDocument = doc || activeRoot.document;

    if (!activeDocument || !activeDocument.body) {
      return;
    }

    const currentPath = getCurrentAdminPath(activeRoot.location);
    const i18n = activeRoot.lexiconAdminI18n;
    const locale = typeof i18n?.getLocale === "function" ? i18n.getLocale(activeRoot) : "zh-TW";
    const translator = typeof i18n?.createTranslator === "function"
      ? i18n.createTranslator(activeRoot).t
      : function (key) { return key; };
    const sidebar = activeDocument.querySelector("[data-admin-sidebar]");
    const topbarUser = activeDocument.querySelector(".admin-topbar-user");

    activeDocument.body.dataset.adminPage = currentPath;

    if (sidebar) {
      sidebar.innerHTML = renderSidebarMarkup(currentPath, translator);
    }

    if (topbarUser) {
      topbarUser.innerHTML = renderTopbarControlsMarkup(translator, locale);
    }

    activeDocument.querySelectorAll("[data-admin-nav]").forEach(function (node) {
      const target = node.getAttribute("data-admin-nav");
      const active = target === currentPath || (currentPath === "admin-word-edit.html" && target === "admin-words.html");
      node.setAttribute("href", target);
      node.setAttribute("aria-current", active ? "page" : "false");
    });

    if (typeof i18n?.applyTranslations === "function") {
      i18n.applyTranslations(activeDocument, activeRoot);
    }

    const title = getAdminPageTitle(currentPath, translator);
    if (title) {
      activeDocument.title = title + " - LingoCMS";
    }
  }

  function bootstrap(globalObject) {
    const activeRoot = resolveGlobalObject(globalObject);
    applyAdminPageState(activeRoot.document, activeRoot);
    bindTopbarControls(activeRoot.document);

    if (activeRoot.document) {
      activeRoot.document.addEventListener("lexicon-admin-localechange", function () {
        applyAdminPageState(activeRoot.document, activeRoot);
      });
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      bootstrap(window);
    });
  }

  return {
    ADMIN_ROUTES: ADMIN_ROUTES,
    applyAdminPageState: applyAdminPageState,
    bootstrap: bootstrap,
    getAdminPageTitle: getAdminPageTitle,
    getCurrentAdminPath: getCurrentAdminPath,
    isAdminRoute: isAdminRoute,
    renderAdminNavLinks: renderAdminNavLinks,
    renderSidebarMarkup: renderSidebarMarkup,
    renderTopbarControlsMarkup: renderTopbarControlsMarkup,
  };
});

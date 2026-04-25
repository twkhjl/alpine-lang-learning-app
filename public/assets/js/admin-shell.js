(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.lexiconAdminShell = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const ADMIN_ROUTES = [
    { path: "admin-dashboard.html", title: "Dashboard", navKey: "dashboard" },
    { path: "admin-words.html", title: "Word Management", navKey: "words" },
    { path: "admin-word-edit.html", title: "Edit Word", navKey: "word-edit" },
    { path: "admin-assets.html", title: "Media Library", navKey: "assets" },
    { path: "admin-tags.html", title: "Tag Management", navKey: "tags" },
    { path: "admin-login.html", title: "Admin Login", navKey: "login" },
  ];

  function getAdminPageTitle(pathname) {
    const route = ADMIN_ROUTES.find(function (item) {
      return item.path === pathname;
    });

    return route ? route.title : "";
  }

  function isAdminRoute(pathname) {
    return ADMIN_ROUTES.some(function (item) {
      return item.path === pathname;
    });
  }

  function getCurrentAdminPath(locationObject) {
    const activeLocation = locationObject || root.location;
    const pathname = activeLocation && activeLocation.pathname ? activeLocation.pathname : "";
    const currentPath = pathname.split("/").pop();

    return currentPath || "admin-dashboard.html";
  }

  function renderAdminNavLinks(currentPath) {
    return ADMIN_ROUTES.filter(function (route) {
      return route.navKey !== "login";
    }).map(function (route) {
      return Object.assign({}, route, {
        active: route.path === currentPath,
      });
    });
  }

  function applyAdminPageState(doc) {
    const activeDocument = doc || root.document;

    if (!activeDocument || !activeDocument.body) {
      return;
    }

    const currentPath = getCurrentAdminPath();
    activeDocument.body.dataset.adminPage = currentPath;

    activeDocument.querySelectorAll("[data-admin-nav]").forEach(function (node) {
      const target = node.getAttribute("data-admin-nav");

      node.setAttribute("href", target);
      node.setAttribute("aria-current", target === currentPath ? "page" : "false");
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      applyAdminPageState();
    });
  }

  return {
    ADMIN_ROUTES: ADMIN_ROUTES,
    getAdminPageTitle: getAdminPageTitle,
    isAdminRoute: isAdminRoute,
    getCurrentAdminPath: getCurrentAdminPath,
    renderAdminNavLinks: renderAdminNavLinks,
    applyAdminPageState: applyAdminPageState,
  };
});

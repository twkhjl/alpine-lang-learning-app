const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ADMIN_ROUTES,
  getAdminPageTitle,
  isAdminRoute,
} = require("../public/assets/js/admin-shell");

test("admin shell exposes the six expected routes", () => {
  assert.deepEqual(
    ADMIN_ROUTES.map((route) => route.path),
    [
      "admin-dashboard.html",
      "admin-words.html",
      "admin-word-edit.html",
      "admin-assets.html",
      "admin-tags.html",
      "admin-login.html",
    ],
  );
  assert.equal(getAdminPageTitle("admin-assets.html"), "admin.pageTitle.assets");
  assert.equal(isAdminRoute("admin-login.html"), true);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const shellApi = require("../public/assets/js/admin-shell");

const shellPages = [
  "admin-dashboard.html",
  "admin-words.html",
  "admin-word-edit.html",
  "admin-assets.html",
  "admin-tags.html",
];

test("shared admin nav excludes edit word from visible sidebar links", () => {
  const links = shellApi.renderAdminNavLinks("admin-word-edit.html");

  assert.deepEqual(
    links.map((link) => link.path),
    [
      "admin-dashboard.html",
      "admin-words.html",
      "admin-assets.html",
      "admin-tags.html",
    ],
  );
  assert.equal(links.find((link) => link.navKey === "words")?.active, true);
  assert.equal(links.some((link) => link.path === "admin-word-edit.html"), false);
});

test("admin shell pages rely on the shared sidebar placeholder", () => {
  for (const file of shellPages) {
    const html = fs.readFileSync(path.join(process.cwd(), file), "utf8");

    assert.match(html, /data-admin-sidebar/);
    assert.match(html, /public\/assets\/js\/admin-i18n\.js/);
    assert.doesNotMatch(html, /data-admin-nav="admin-word-edit\.html"/);
    assert.doesNotMatch(html, />[^<]*\/p>/);
    assert.doesNotMatch(html, />[^<]*\/span>/);
  }
});

test("login page loads shared admin i18n without sidebar shell", () => {
  const html = fs.readFileSync(path.join(process.cwd(), "admin-login.html"), "utf8");

  assert.match(html, /public\/assets\/js\/admin-i18n\.js/);
  assert.doesNotMatch(html, /data-admin-sidebar/);
});

test("admin stylesheet preserves hidden elements as non-interactive", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "public/assets/css/admin.css"), "utf8");

  assert.match(css, /\[hidden\]\s*\{/);
  assert.match(css, /display:\s*none\s*!important/);
});

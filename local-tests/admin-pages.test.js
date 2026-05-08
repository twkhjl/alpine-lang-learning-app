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

test("admin write pages load the shared feedback runtime", () => {
  for (const file of [
    "admin-words.html",
    "admin-word-edit.html",
    "admin-assets.html",
    "admin-tags.html",
  ]) {
    const html = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(html, /public\/assets\/js\/admin-feedback\.js/);
  }
});

test("admin word edit hides read-only id and media path inputs", () => {
  const html = fs.readFileSync(path.join(process.cwd(), "admin-word-edit.html"), "utf8");

  assert.match(html, /<div class="admin-field" hidden>\s*<input id="word-id" type="hidden" readonly \/>/);
  assert.match(html, /<div class="admin-field" hidden>\s*<input id="image-url" type="hidden" readonly \/>/);
  assert.match(html, /<div class="admin-field" hidden>\s*<input id="audio-zh" type="hidden" readonly \/>/);
  assert.match(html, /<div class="admin-field" hidden>\s*<input id="audio-id" type="hidden" readonly \/>/);
  assert.match(html, /<div class="admin-field" hidden>\s*<input id="audio-en" type="hidden" readonly \/>/);
});

test("word delete actions exist in list and edit pages", () => {
  const wordsHtml = fs.readFileSync(path.join(process.cwd(), "admin-words.html"), "utf8");
  const wordEditHtml = fs.readFileSync(path.join(process.cwd(), "admin-word-edit.html"), "utf8");

  assert.match(wordsHtml, /public\/assets\/js\/admin-feedback\.js/);
  assert.match(wordsHtml, /data-words-delete-selected/);
  assert.match(wordsHtml, /data-words-select-all/);
  assert.match(wordEditHtml, /data-word-delete/);
});

test("admin write page modules do not directly call native confirm", () => {
  for (const file of [
    "public/assets/js/admin-word-edit.js",
    "public/assets/js/admin-assets.js",
    "public/assets/js/admin-tags.js",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /window\.confirm\(/);
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

test("admin word edit audio cards stay single-column across desktop and mobile", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "public/assets/css/admin.css"), "utf8");

  assert.match(css, /\.admin-media-audio-grid\s*\{\s*grid-template-columns:\s*1fr\s*;\s*\}/);
  assert.doesNotMatch(css, /\.admin-media-audio-grid\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;\s*\}/);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*1180px\)[\s\S]*\.admin-media-audio-grid,\s*\.admin-asset-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*;\s*\}/);
});

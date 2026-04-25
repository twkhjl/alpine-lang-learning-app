const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adminPages = [
  "admin-login.html",
  "admin-dashboard.html",
  "admin-words.html",
  "admin-word-edit.html",
  "admin-assets.html",
  "admin-tags.html",
];

test("each admin page points at shared assets and real admin links", () => {
  for (const file of adminPages) {
    const html = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(html, /public\/assets\/css\/admin\.css/);
    assert.match(html, /public\/assets\/js\/admin-shell\.js/);
    if (file !== "admin-login.html") {
      assert.match(html, /data-admin-nav="admin-dashboard\.html"/);
      assert.match(html, /data-admin-nav="admin-words\.html"/);
      assert.match(html, /data-admin-nav="admin-assets\.html"/);
      assert.match(html, /data-admin-nav="admin-tags\.html"/);
    }
  }
});

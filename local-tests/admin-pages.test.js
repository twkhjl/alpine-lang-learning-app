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

test("admin pages use readable copy and valid key labels", () => {
  const wordsHtml = fs.readFileSync(path.join(process.cwd(), "admin-words.html"), "utf8");
  const dashboardHtml = fs.readFileSync(path.join(process.cwd(), "admin-dashboard.html"), "utf8");
  const assetsHtml = fs.readFileSync(path.join(process.cwd(), "admin-assets.html"), "utf8");

  assert.match(wordsHtml, /字詞管理/);
  assert.match(wordsHtml, /搜尋字詞或標籤/);
  assert.match(wordsHtml, /建立字詞/);
  assert.match(dashboardHtml, /aria-label="歷史紀錄"/);
  assert.match(dashboardHtml, /最近更新的字詞/);
  assert.match(assetsHtml, /媒體參考瀏覽/);
  assert.match(assetsHtml, /此功能即將推出/);
  assert.match(assetsHtml, /<button class="button primary" type="button" disabled>/);
});

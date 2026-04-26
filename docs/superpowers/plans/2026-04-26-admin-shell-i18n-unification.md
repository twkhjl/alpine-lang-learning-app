# Admin Shell And I18n Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 統一後台左側選單樣式與來源、移除主選單中的 `Edit Word`，並讓後台先支援英文與繁體中文兩種介面語言。

**Architecture:** 以既有多頁式 `admin-*.html` 架構為前提，不引入 router。新增一個共用後台 shell/i18n 層，由 JS 在各頁注入一致的 sidebar/topbar 文案與語系切換，頁面 controller 只負責資料與互動，不再各自維護一份導航與硬編碼文案。

**Tech Stack:** Static HTML, vanilla JavaScript, existing `admin-shell.js`, existing Supabase browser reads, existing `lexicon_ui_translations_api`, Node.js unit tests.

---

## Scope

**In scope**
- 統一後台 sidebar 樣式與主選單項目來源。
- 從主選單移除 `Edit Word`，但保留 `admin-word-edit.html` 作為 words list 的進入頁。
- 後台 UI 多語系化，先支援 `zh-TW` 與 `en`。
- 後台介面語言切換與偏好保存。
- 補測試覆蓋 shell、導航、語系切換與主要文案。

**Out of scope**
- 前台多語系行為重構。
- 後台資料內容翻譯編輯器。
- 印尼文後台介面。
- router 改造。

## Locked Decisions

- 後台共用 shell 採用 **JS 注入/同步 DOM**，不是 server-side include。
- 左側主選單保留：`Dashboard`、`Words`、`Assets`、`Tags`、`Logout`。
- `Edit Word` 不出現在主選單，但 `admin-word-edit.html` 仍可直接開啟，且由 words page 進入。
- 後台介面語言偏好使用獨立 localStorage key 保存，不與前台 `lexicon-preferences` 混用。
- 翻譯來源優先順序：
  - 後台專用字典 key
  - 既有 `lexicon_ui_translations_api` 可重用 key
  - 內建 fallback 英文/繁中字典
- 初期不要求把每一個內頁說明段落都抽到 Supabase；允許先以本地 fallback dictionary 收斂文案，再視需要補上 API key。

## File Map

**Create**
- `public/assets/js/admin-i18n.js`
- `local-tests/admin-i18n.test.js`

**Modify**
- `public/assets/js/admin-shell.js`
- `public/assets/css/admin.css`
- `admin-dashboard.html`
- `admin-words.html`
- `admin-word-edit.html`
- `admin-assets.html`
- `admin-tags.html`
- `admin-login.html`
- `public/assets/js/admin-dashboard.js`
- `public/assets/js/admin-words.js`
- `public/assets/js/admin-word-edit.js`
- `public/assets/js/admin-assets.js`
- `public/assets/js/admin-tags.js`
- `local-tests/admin-pages.test.js`
- `local-tests/admin-dashboard.test.js`
- `local-tests/admin-words.test.js`

## Design Notes

### Shared Shell

- `admin-shell.js` 應從單純 route metadata 提升為後台共用 shell 工具：
  - 定義 visible navigation routes。
  - 定義 hidden routes，例如 `admin-word-edit.html`。
  - 提供 `renderSidebar()` / `syncAdminChrome()` 或等價 helper。
  - 根據當前頁面自動套用 active nav。

- 各頁 HTML 不再各自維護不同 sidebar 結構。
  - 可接受保留一個最小 placeholder 容器，如 `<aside data-admin-sidebar></aside>`。
  - 或保留現有外層 `.admin-shell`，但 sidebar 區塊應由共用 JS 覆寫。

### Admin I18n

- 新增 `admin-i18n.js`：
  - 管理後台介面語言狀態。
  - 提供 `t(key, replacements)`。
  - 提供 `getAdminLanguage()` / `setAdminLanguage()`。
  - 提供 `applyAdminI18n(root)`，將帶有 `data-admin-i18n` 的節點替換成對應文案。

- 介面語言範圍：
  - `zh-TW`
  - `en`

- 建議 localStorage key：
  - `lexicon-admin-preferences`

- 後台專用字典至少涵蓋：
  - sidebar nav labels
  - topbar labels
  - common CTA：create, save, cancel, delete, logout
  - loading / empty / error / success states
  - page title / short description

### Page Strategy

- `admin-dashboard.html`
  - 改成使用共用 shell/sidebar。
  - 文案由 i18n key 控制。

- `admin-words.html`
  - 改成使用共用 shell/sidebar。
  - 主頁標題、filter label、table header、empty state 改用 i18n。

- `admin-word-edit.html`
  - 從 sidebar 主選單移除自身入口。
  - 保留 page title 與按鈕 i18n。
  - 因為此頁是 hidden route，active nav 應落在 `Words`。

- `admin-assets.html`
  - 改成使用共用 shell/sidebar。
  - 所有 scope 提示、disabled CTA、filter 文案改用 i18n。

- `admin-tags.html`
  - 改成使用共用 shell/sidebar。
  - modal 標題、按鈕與 table 文案改用 i18n。

- `admin-login.html`
  - 雖然沒有 sidebar，也應接入同一套 admin i18n。
  - 登入頁先支援中英切換即可，不需要後台 shell。

## Tasks

### Task 1: 抽出共用後台 shell 與可見導航

**Files:**
- Create: none
- Modify: `public/assets/js/admin-shell.js`
- Modify: `public/assets/css/admin.css`
- Modify: `admin-dashboard.html`
- Modify: `admin-words.html`
- Modify: `admin-word-edit.html`
- Modify: `admin-assets.html`
- Modify: `admin-tags.html`

- [ ] 重新定義 route metadata，將 `admin-word-edit.html` 標記為 hidden route。
- [ ] 新增共用 sidebar render helper。
- [ ] 新增 hidden route 對應規則，讓 `admin-word-edit.html` 的 active nav 落在 `Words`。
- [ ] 讓後台頁面使用一致的 sidebar DOM/樣式，不再各頁各寫一版。
- [ ] 將 `Edit Word` 從主選單移除。
- [ ] 確保 `data-admin-nav` 與 logout 仍可用。

**Verification**
- `node --test local-tests/admin-pages.test.js`

### Task 2: 建立後台 i18n 模組與共用語言狀態

**Files:**
- Create: `public/assets/js/admin-i18n.js`
- Create: `local-tests/admin-i18n.test.js`
- Modify: `admin-login.html`
- Modify: `public/assets/js/admin-shell.js`

- [ ] 實作後台專用翻譯字典與 fallback。
- [ ] 實作 localStorage 偏好讀寫。
- [ ] 提供 `t()`、語言切換 API、DOM 套用 helper。
- [ ] 在 login 頁提供語言切換 UI，先驗證 admin i18n 可獨立運作。
- [ ] 若可行，將 shell 文案完全改為 i18n 驅動。

**Verification**
- `node --test local-tests/admin-i18n.test.js`

### Task 3: 將各後台頁面文案改為 i18n key

**Files:**
- Modify: `admin-dashboard.html`
- Modify: `admin-words.html`
- Modify: `admin-word-edit.html`
- Modify: `admin-assets.html`
- Modify: `admin-tags.html`
- Modify: `public/assets/js/admin-dashboard.js`
- Modify: `public/assets/js/admin-words.js`
- Modify: `public/assets/js/admin-word-edit.js`
- Modify: `public/assets/js/admin-assets.js`
- Modify: `public/assets/js/admin-tags.js`

- [ ] 將頁面標題、說明、按鈕、label、table header 改成 translation key。
- [ ] 將 controller 內的 loading/empty/error/success 訊息改成 `adminI18n.t(...)` 或等價 helper。
- [ ] 清掉現有亂碼/硬編碼英文與繁中混雜問題。
- [ ] 保持現有 selector 與資料流不被破壞。

**Verification**
- `node --test local-tests/admin-dashboard.test.js local-tests/admin-words.test.js`
- `npm test`

### Task 4: 補測試與驗證可見行為

**Files:**
- Modify: `local-tests/admin-pages.test.js`
- Modify: `local-tests/admin-dashboard.test.js`
- Modify: `local-tests/admin-words.test.js`
- Add or modify: other admin tests if needed

- [ ] 驗證 sidebar 不再包含 `Edit Word`。
- [ ] 驗證 hidden route `admin-word-edit.html` 仍可正常開啟，且 shell active nav 指向 `Words`。
- [ ] 驗證主要頁面可顯示中英文字串。
- [ ] 驗證 login 頁與至少一個後台頁可切換語言。

**Verification**
- `npm test`

## Acceptance Criteria

- 所有後台頁面的左側選單樣式與結構一致。
- `Edit Word` 不再出現在左側主選單。
- `admin-word-edit.html` 仍可由 words list/create flow 正常使用。
- 後台至少支援 `zh-TW` 與 `en` 兩種介面語言。
- 後台介面語言切換後，主要文案、按鈕、狀態訊息會同步更新。
- 刷新頁面後仍保留後台語言偏好。
- 不破壞既有登入、權限保護與後台 CRUD 流程。

## Risks

- 目前各頁 HTML 差異大，若只在 CSS 層統一，長期仍會漂移；應以共用 render/source 解決。
- 後台 controller 內已有多處訊息字串，若只做 HTML 翻譯，語言切換會不完整。
- 若直接重用前台 `lexicon-preferences`，容易把前台閱讀偏好與後台介面偏好耦合在一起。

## Suggested Commit Boundaries

- `refactor: unify admin shell navigation`
- `feat: add admin interface i18n`
- `refactor: localize admin page copy`
- `test: cover admin shell and i18n behavior`

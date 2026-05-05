# 專案解析總索引

本資料夾整理目前 `alpine-lang-learning-app` 專案的靜態解析結果，目的不是替代原始碼，而是提供一份可快速建立全域脈絡的技術文件。

文件撰寫基準：

- 解析日期：`2026-04-26`
- 解析方式：以目前專案檔案結構、前後台入口、Supabase migration、Cloudflare Worker、測試程式為主
- 語言：繁體中文
- 重點：說明目前實作長相、資料如何流動、哪些地方已成形、哪些地方仍有技術債

建議閱讀順序：

1. [01-專案總覽.md](./01-專案總覽.md)
2. [02-前台應用架構.md](./02-前台應用架構.md)
3. [03-後台管理架構.md](./03-後台管理架構.md)
4. [04-Supabase-資料模型與遷移.md](./04-Supabase-資料模型與遷移.md)
5. [05-Cloudflare-Worker-與認證寫入流程.md](./05-Cloudflare-Worker-與認證寫入流程.md)
6. [06-測試策略與本地開發流程.md](./06-測試策略與本地開發流程.md)
7. [07-風險、技術債與後續建議.md](./07-風險、技術債與後續建議.md)
8. [08-檔案與模組索引.md](./08-檔案與模組索引.md)
9. [09-頁面、資料流與-API-RPC-對照.md](./09-頁面、資料流與-API-RPC-對照.md)
10. [10-部署設定與維運手冊.md](./10-部署設定與維運手冊.md)
11. [11-功能完成度矩陣.md](./11-功能完成度矩陣.md)

如果你的目的不同，可以這樣讀：

- 想快速知道這是什麼專案：看 `01`
- 想改前台 UI 或卡片互動：看 `02`
- 想改後台 CRUD：看 `03`
- 想改資料表或 seed：看 `04`
- 想改登入、CORS、admin API：看 `05`
- 想跑測試或本地驗證：看 `06`
- 想排技術債或規劃重構：看 `07`
- 想快速找某個檔案該從哪裡看：看 `08`
- 想知道某頁面實際打哪些 API / RPC：看 `09`
- 想部署或做維運排錯：看 `10`
- 想確認哪些功能已完成、哪些仍未完成：看 `11`

---

## 專案一句話摘要

這是一個以 **Alpine.js + Supabase + Cloudflare Worker** 組成的詞彙學習應用；前台負責詞卡學習、清單檢索、收藏與設定，後台負責字詞、標籤、媒體引用與管理登入，資料主要儲存在 Supabase，受保護的後台寫入則透過獨立部署的 Cloudflare Worker 代理執行。

---

## 目前專案的關鍵特色

- 前台不是 React/Vue，而是單頁式 Alpine component
- 後台採多頁 HTML，但共用一組 `admin-*.js`
- 讀取資料大多直接走 Supabase public read model
- 寫入後台資料不直接從瀏覽器打資料表，而是走 Worker 保護層
- 資料模型以 `words / translations / tags / ui_translations` 為中心
- 目前已經有單元測試、管理後台測試與簡易 Playwright E2E
- 設計參考稿與過往規劃文件都保留在 repo 內，對理解演進脈絡有幫助

---

## 目錄速覽

### 主要根目錄

- `index.html`
  - 前台入口
- `admin-*.html`
  - 後台多頁入口
- `public/assets/js`
  - 前台、後台與資料層 JavaScript
- `public/assets/css`
  - 前台與後台樣式
- `supabase`
  - migration、seed 與 Supabase 本地/連線資訊
- `workers`
  - Cloudflare Worker API
- `local-tests`
  - Node test 與 E2E 測試
- `docs`
  - 規劃與本次解析文件
- `page_example`、`local/page_example`
  - UI 參考設計稿與範例頁
- `spec`
  - 額外需求說明文件

### 這次解析特別關注的程式

- `public/assets/js/main.js`
- `public/assets/js/supabase-data.js`
- `public/assets/js/admin-auth.js`
- `public/assets/js/admin-api.js`
- `public/assets/js/admin-shell.js`
- `public/assets/js/admin-i18n.js`
- `workers/admin-auth-worker.js`
- `supabase/migrations/*.sql`
- `local-tests/*.test.js`

---

## 讀文件時要有的前提認知

1. 這個專案不是以「模組化前端框架」為主，而是以較直接的 HTML + Alpine 組成。
2. 前台與後台共用同一個 Supabase 專案，但安全模型不同。
3. 目前 repo 內有一些檔案仍存在編碼或歷史資料品質問題，特別是部分 seed 與部分中文字串。
4. 後台功能已具備基本 CRUD 骨架，但仍屬早期管理系統，不是完整 CMS。

---

## 文件使用方式

如果你接下來要在這個專案工作，建議先看完：

- `01-專案總覽`
- `03-後台管理架構`
- `04-Supabase-資料模型與遷移`

這三份看完後，大致就能知道：

- 應該從哪個入口開始找
- 前後台如何分工
- 什麼能直接改，什麼需要同步改 Worker 與 DB

如果你準備開始改後台，建議再補看：

- `09-頁面、資料流與-API-RPC-對照`
- `10-部署設定與維運手冊`

---

## 編碼備註

本資料夾文件已用 UTF-8 寫入。  
若你在 PowerShell 或某些終端看到亂碼，優先懷疑的是終端顯示編碼，而不是 Markdown 檔案本身毀損。

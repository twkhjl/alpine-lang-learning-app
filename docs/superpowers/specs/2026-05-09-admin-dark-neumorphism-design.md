# Admin Dark Neumorphism Design

## Summary

將現有後台介面在 **功能完全不變** 的前提下，統一改造為 **dark neumorphism** 視覺風格，範圍包含登入頁與所有管理頁。實作主軸採用 **共用 design tokens + 元件層重塑**，以集中調整 [public/assets/css/admin.css](/D:/codes/alpineJsProjects/alpine-lang-learning-app/public/assets/css/admin.css:1) 為主，必要時只做少量 HTML 結構微調，不更動資料流、API、驗證流程與操作行為。

## Goals

- 將整個後台 UI 統一為深色、柔和浮雕層次的 dark neumorphism 風格。
- 保持既有資訊架構、操作流程、文案、頁面功能與 JavaScript 行為不變。
- 建立可重用的後台視覺 tokens，避免逐頁零散覆蓋樣式。
- 提升頁面一致性，讓 dashboard、列表、編輯頁、資產頁、標籤頁、登入頁屬於同一設計語言。

## Non-Goals

- 不新增任何後台功能。
- 不調整 worker、Supabase、表單送出、登入驗證、資料格式或頁面路由。
- 不做重新 IA、欄位重排、互動重設計、元件功能擴充。
- 不將介面改成完全「概念型」低對比 neumorphism；必須保留管理介面所需的可讀性與辨識度。

## Scope

### Included Pages

- [admin-login.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-login.html)
- [admin-dashboard.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-dashboard.html)
- [admin-words.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-words.html)
- [admin-word-edit.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-word-edit.html)
- [admin-assets.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-assets.html)
- [admin-tags.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-tags.html)

### Included UI Surfaces

- `admin-shell`, `admin-sidebar`, `admin-topbar`
- `admin-card`, `admin-stat-card`, `admin-form-card`
- `admin-button`, `admin-language-button`
- `input`, `select`, `textarea`, checkbox chip
- `admin-table`, pagination, filter area
- `admin-tab-row`, badge, empty state, status text
- asset card / media preview / drawer
- modal / confirm dialog / toast
- login layout / login card / login switcher

### Primary Files

- [public/assets/css/admin.css](/D:/codes/alpineJsProjects/alpine-lang-learning-app/public/assets/css/admin.css:1)
- 必要時少量調整：
  - [admin-login.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-login.html)
  - [admin-dashboard.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-dashboard.html)
  - [admin-words.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-words.html)
  - [admin-word-edit.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-word-edit.html)
  - [admin-assets.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-assets.html)
  - [admin-tags.html](/D:/codes/alpineJsProjects/alpine-lang-learning-app/admin-tags.html)

## Design Direction

### Visual Language

- 整體背景採深色系，使用 2 到 3 層深灰藍色階建立空間感。
- 卡片、輸入框、按鈕、面板採柔和外陰影與局部內陰影，形成 neumorphism 浮雕感。
- 互動層級依靠：
  - 深淺面差
  - 雙向陰影
  - 邊緣高光
  - hover / active / focus 狀態
- 保留明確的功能色：
  - primary
  - success
  - warning
  - danger

### Accessibility Constraint

此需求雖是風格改造，但後台屬管理介面，不可犧牲可讀性。設計上必須遵守：

- 主要文字與背景維持高對比。
- 次要文字仍需清楚可辨。
- 危險操作按鈕不能只靠陰影表現，必須保留明確色彩提示。
- focus 狀態必須可見，不能只靠輕微明暗差。
- table、form、toast、modal 不可因暗色柔化而失去層級。

## Recommended Approach

採用 **共用 design tokens + 元件層重塑**。

### Why This Approach

- 目前後台高度依賴單一共用樣式檔 [admin.css](/D:/codes/alpineJsProjects/alpine-lang-learning-app/public/assets/css/admin.css:1)，非常適合集中式改造。
- 能在功能不動的前提下，最大化整體視覺一致性。
- 比逐頁 patch 更容易維護，也比單純覆蓋色彩更能建立完整設計語言。

### Structure

1. 先重寫根層 tokens
2. 再重塑共用元件層
3. 最後逐頁微調特殊版型

## Design Tokens Plan

### Core Tokens

- `--admin-bg`
- `--admin-surface`
- `--admin-surface-muted`
- `--admin-surface-strong`
- `--admin-border`
- `--admin-text`
- `--admin-text-muted`
- `--admin-primary`
- `--admin-success`
- `--admin-warning`
- `--admin-danger`
- `--admin-radius`

### New Token Categories

- background tiers
- elevated surface shadow
- inset shadow
- highlight edge
- pressed state shadow
- focus ring
- subtle glass / blur values where needed

### Intent

- 把現有偏 light admin palette 改成 dark palette。
- 不用大量硬編色值 scattered 到各 selector。
- 所有主要元件都從 tokens 取色與陰影。

## Component-Level Design

### Shell and Sidebar

- `admin-shell` 背景改成深色大底。
- `admin-sidebar` 與主內容不再是「深淺兩塊硬切」，而是同色系不同層次。
- 導覽 active item 做成 soft raised pill。
- hover 採輕微浮起效果，不用強烈實底。

### Topbar

- 保留 sticky 行為。
- 改為暗色浮層面板，與主內容背景有清楚區隔。
- 使用柔光邊緣與陰影，而不是目前的半透明白底。

### Cards

- 所有 `admin-card` 統一為 dark neumorphic surface。
- 重要區塊可透過 surface level 區分：
  - 一般資訊卡
  - 統計卡
  - 表單卡
  - 危險區塊卡

### Buttons

- primary button：raised neumorphic button + 清楚品牌色。
- secondary button：同色深底、較低對比凸起。
- danger button：保留高辨識紅色，不做過度柔化。
- active / pressed 狀態需有可感知內凹效果。

### Form Controls

- `input`, `select`, `textarea` 改為暗色內凹式控制項。
- border 存在感弱化，改由內陰影與高光建立凹槽。
- focus 時增加清楚外圈或色彩光暈。
- placeholder、label、help text 對比重新平衡。

### Tables

- table 是此風格最大風險區。
- 不建議把每個 cell 都做厚重浮雕。
- 建議：
  - table 外層為 neumorphic panel
  - header 使用稍亮 surface
  - row hover 使用低幅度明暗差
  - 分隔線保留，但降低硬線感
- 目標是維持資料可掃描性，不為風格犧牲表格效率。

### Asset Cards and Media Panels

- `admin-assets` 最適合呈現 dark neumorphism。
- asset card、preview 區、drawer、audio card 可更明顯使用浮雕與內凹面板。
- 圖片預覽與音檔區要避免背景對內容干擾。

### Modal / Dialog / Toast

- modal 保留高於頁面的明確懸浮感。
- backdrop 可維持深色遮罩，但 modal 自身需有獨立立體感。
- toast 改為深色浮層卡片，success / error / info 保持狀態差異。

### Login Page

- 既有登入頁已偏深色，但需納入同一套 tokens。
- login card 改為更明確的 dark neumorphic focal panel。
- 語言切換器、輸入框、登入按鈕風格與主後台一致。

## Page-Specific Notes

### Dashboard

- 統計卡與狀態卡是視覺主角。
- 避免資訊過重或過度發光，維持管理儀表板閱讀節奏。

### Words List

- filter bar、table、pagination 要清楚分層。
- 列表可讀性優先於風格純度。

### Word Edit

- 表單區、媒體區、標籤選擇區需維持清楚分塊。
- 媒體預覽可使用較強的面板表現。

### Assets

- 卡片式資產檢視最能放大 dark neumorphism 優勢。
- 危險操作區需保留高警示感，不可因風格變得溫和。

### Tags

- 表格與編輯操作應延續列表頁模式。

### Login

- 與後台主系統視覺一致。
- 保持登入表單清楚與聚焦。

## HTML Change Policy

- 優先只改 CSS。
- 僅在以下情況才允許少量 HTML 調整：
  - 補包裝層以支援陰影或內凹結構
  - 補 modifier class 讓特定元件有一致變體
  - 修正極少數不利於暗色浮雕的結構

不允許因風格改造而重組頁面功能結構或更改 JS 綁定。

## Risks

### Readability Risk

dark neumorphism 若過度追求柔和，會讓：

- 表格難掃
- 表單邊界不清
- 狀態提示不夠明顯

### Consistency Risk

若只改部分區塊，容易出現：

- 有些元件是暗色浮雕
- 有些仍是舊 light admin
- modal / toast / table / login 彼此語言不一致

### Mobile Density Risk

行動版畫面較窄，若每個元件陰影與 padding 過厚，會讓後台顯得擁擠且操作區域過碎。

## Mitigations

- 先改 tokens，再改元件，不直接逐頁亂修。
- table / form 採「高可讀性優先」策略，不追求最極端 neumorphism。
- 用少量、穩定的 shadow recipe，避免每個區塊一套陰影。
- 在 desktop / tablet / mobile 都做視覺驗證。

## Acceptance Criteria

- 所有後台頁面，包括登入頁，皆呈現一致的 dark neumorphism 視覺語言。
- 所有既有功能、操作流程、按鈕行為、表單送出、登入流程不變。
- 所有主要共用元件皆改為深色 theme：
  - sidebar
  - topbar
  - card
  - button
  - input/select/textarea
  - table
  - modal
  - toast
  - pagination
  - tabs
- danger / success / warning / focus 狀態仍明確可辨。
- 行動版與桌面版皆無明顯排版破壞。
- 不殘留 light theme 風格碎片。

## Verification Plan

- 逐頁人工檢查：
  - login
  - dashboard
  - words
  - word-edit
  - assets
  - tags
- 逐類元件檢查：
  - button states
  - form focus
  - table readability
  - modal / toast layering
  - empty states
  - danger zone visibility
- RWD 檢查至少覆蓋：
  - desktop
  - tablet
  - mobile

## Implementation Notes

- 預期大多數改動集中在 [public/assets/css/admin.css](/D:/codes/alpineJsProjects/alpine-lang-learning-app/public/assets/css/admin.css:1)。
- 若某些頁面需要額外 wrapper / class，應保持最小改動。
- 建議實作順序：
  1. tokens
  2. shell / card / button / form
  3. table / modal / toast
  4. page-specific refinements
  5. login alignment


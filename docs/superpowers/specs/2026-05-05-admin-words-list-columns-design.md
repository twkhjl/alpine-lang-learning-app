# 字詞管理列表欄位調整設計

**日期**: 2026-05-05

## 目標

調整後台字詞管理列表頁欄位內容，讓列表資訊更貼近管理需求：

- 標籤欄顯示標籤名稱，不再顯示 `Tag #id`
- 移除媒體欄
- 圖片欄改為縮圖預覽
- `ID` 欄改為跨分頁連續序號

## 範圍

本次只調整字詞管理列表頁：

- `admin-words.html`
- `public/assets/js/admin-words.js`
- `public/assets/css/admin.css`
- `local-tests/admin-words.test.js`

不修改資料庫 schema、Worker API、Supabase view。

## 現況

- 列表資料由 `loadWordList(client, filters)` 提供，已包含：
  - `id`
  - `image_url`
  - `lang_zh_tw`
  - `lang_id`
  - `lang_en`
  - `tags`
  - `has_image`
  - `audio_languages`
  - `updated_at`
- 頁面初始化時已呼叫 `loadTagList(client)` 取得標籤清單，但目前只用在篩選下拉選單。
- 列表列渲染目前直接把 `tags` 陣列顯示成 `Tag #<id>`。
- 圖片欄目前只顯示 `IMG` 或 `-`，未使用 `image_url`。
- 表格仍保留媒體欄，顯示圖片/音檔狀態文字。
- 第一欄目前顯示資料真實 `id`。

## 設計決策

### 1. 標籤顯示名稱

頁面在載入標籤清單後，建立 `tagId -> tagLabel` 對照表，列表渲染時用對照表把 `tags` 轉成文字標籤。

標籤名稱選擇規則：

1. 目前介面語系對應名稱
2. `zh-TW`
3. `id`
4. `en`
5. `Tag #<id>`

若單字沒有標籤，維持既有 fallback 文案。

### 2. 移除媒體欄

列表不再顯示圖片/音檔狀態組合字串。表頭、每列內容、空狀態 `colspan` 一併調整。

### 3. 圖片欄顯示縮圖

若 `image_url` 存在，圖片欄顯示縮圖 `<img>`；若無圖，顯示 `-`。

縮圖樣式：

- 固定 `48x48`
- `object-fit: cover`
- 圓角
- 淡色底與邊框，和既有後台視覺一致

### 4. `ID` 欄改為跨分頁連續序號

列表第一欄改顯示序號，不顯示資料真實 `id`。

序號規則：

`serial = (page - 1) * pageSize + rowIndex + 1`

其中 `rowIndex` 為當頁自 0 起算索引。這樣在第 2 頁第 1 筆、每頁 25 筆時，會顯示 26。

真實 `id` 不再顯示於欄位，但編輯按鈕連結仍使用真實 `id`。

## 實作方式

### HTML

- `admin-words.html`
  - `ID` 欄標題改成「流水號」
  - 移除「媒體」欄
  - 空狀態欄寬從 9 欄改為 8 欄

### JavaScript

- `public/assets/js/admin-words.js`
  - `renderWordRow()` 增加：
    - `serialNumber`
    - `tagNameResolver`
  - `renderWordRows()` 依 `page`、`pageSize` 計算跨分頁連續序號
  - `bootstrap()` 載入標籤清單後建立標籤名稱 resolver，供列表渲染使用
  - 圖片欄改輸出縮圖 markup

### CSS

- `public/assets/css/admin.css`
  - 擴充 `.admin-thumb` 讓它可容納圖片
  - 新增 `.admin-thumb img` 樣式
  - 確保無圖時 placeholder 仍維持對齊

### 測試

- `local-tests/admin-words.test.js`
  - 驗證標籤名稱顯示
  - 驗證圖片欄輸出縮圖
  - 驗證空狀態 `colspan="8"`
  - 驗證跨分頁序號計算

## 驗收條件

- 字詞列表標籤欄顯示文字名稱
- 字詞列表不再出現媒體欄
- 有圖單字顯示縮圖，無圖顯示 `-`
- 序號跨分頁連續遞增
- 既有編輯連結功能不受影響

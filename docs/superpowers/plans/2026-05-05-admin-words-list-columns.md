# Admin Words List Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 調整字詞管理列表欄位，改顯示標籤名稱、移除媒體欄、圖片欄改縮圖，並把第一欄改成跨分頁連續序號。

**Architecture:** 維持既有 `loadWordList()` / `loadTagList()` 資料流，不新增後端欄位。列表頁在前端建立標籤名稱對照表，render 時直接套用，同步調整 HTML 欄位結構、CSS 縮圖樣式與單元測試。

**Tech Stack:** HTML、Vanilla JS、CSS、Node built-in test runner

---

### Task 1: 先寫 failing tests 鎖定新列表行為

**Files:**
- Modify: `local-tests/admin-words.test.js`

- [ ] **Step 1: 新增標籤名稱、縮圖、跨分頁序號、空狀態欄位測試**
- [ ] **Step 2: 執行 `node --test local-tests/admin-words.test.js`，確認測試先失敗**

### Task 2: 實作列表渲染邏輯

**Files:**
- Modify: `public/assets/js/admin-words.js`

- [ ] **Step 1: 建立 tag id 對應 label resolver**
- [ ] **Step 2: `renderWordRows()` 加入跨分頁序號計算**
- [ ] **Step 3: `renderWordRow()` 改顯示標籤文字與圖片縮圖**
- [ ] **Step 4: 移除媒體欄輸出**

### Task 3: 同步調整表格結構與樣式

**Files:**
- Modify: `admin-words.html`
- Modify: `public/assets/css/admin.css`

- [ ] **Step 1: 調整表頭與空狀態欄位數**
- [ ] **Step 2: 補縮圖樣式與 placeholder 呈現**

### Task 4: 驗證

**Files:**
- Verify: `local-tests/admin-words.test.js`

- [ ] **Step 1: 執行 `node --test local-tests/admin-words.test.js`**
- [ ] **Step 2: 視需要執行 `npm run test:admin` 做回歸確認**

# 後台媒體與 R2 管理設計

**日期**: 2026-05-03

**目標**

讓後台管理者可以在單字編輯流程中直接新增、替換、刪除圖片與音檔，並提供獨立資產頁管理 Cloudflare R2 物件；同時支援一次清空整個 R2 bucket，且同步清空資料庫中對應的 `image_url` 與 `audio_filename`。

## 問題定義

目前後台媒體功能只有「手動輸入字串」與「顯示已被資料庫引用的路徑」兩種能力。

- `admin-word-edit.html` 只能編輯 `image_url` 與 `audio_filename` 欄位，不能直接操作實體檔案。
- `admin-assets.html` 顯示的是從資料庫反推的已引用資產，不是 Cloudflare R2 bucket 中實際存在的物件。
- 當 R2 中已有檔案，但 DB 尚未引用時，後台完全看不到這些物件。
- 使用者已決定清空整個 bucket，避免舊資料與舊命名規則干擾新流程。

## 設計目標

- 後台可以直接上傳、替換、刪除單字圖片與音檔。
- `admin-assets.html` 可以列出 R2 bucket 內實際存在的所有媒體物件。
- 清空整個 bucket 時，同步清空所有單字的 `words.image_url` 與 `word_translations.audio_filename`。
- 每個單字未來都應該可補齊一張圖片與各語言音檔，但系統在資料結構上仍容許短暫缺漏，以支援逐步編輯。
- 避免管理者手動輸入路徑或檔名，改由系統以固定規則產生。

## 非目標

- 不做批次 zip 匯入。
- 不做圖片裁切、轉檔、壓縮、波形預覽等進階媒體處理。
- 不做版本控管或回收桶。
- 不做多 bucket 或多環境媒體切換。

## 使用者流程

### 1. 單字頁媒體編輯

管理者在 `admin-word-edit.html` 編輯單字時：

- 可以看到目前圖片狀態與預覽。
- 可以看到 `zh-TW`、`id`、`en` 三個語言各自的音檔狀態。
- 可以針對圖片上傳新檔、替換既有檔、刪除既有檔。
- 可以針對每個語言音檔上傳新檔、替換既有檔、刪除既有檔。
- 單字新建完成後，若尚未有 `wordId`，媒體區會先顯示需先儲存單字；第一次儲存成功取得 `wordId` 後，媒體操作按鈕才可用。

### 2. 資產頁全域管理

管理者在 `admin-assets.html`：

- 可以列出 bucket 中所有 `imgs/` 與 `audios/` 物件。
- 可以依類型、語言、檔名、單字 ID 篩選。
- 可以刪除單一物件。
- 可以執行「清空整個 bucket」。
- 刪除單一物件或清空 bucket 後，系統會同步清除資料庫中的對應欄位。

## 核心決策

### 決策 1：採混合式介面

- `admin-word-edit.html` 負責單字就地媒體操作，符合主要工作流。
- `admin-assets.html` 負責全域資產盤點、高風險刪除與 bucket 清空。

理由：

- 單字頁是日常維護入口，不能要求管理者跳頁處理媒體。
- 清空 bucket 與全域盤點屬高風險操作，不適合放在單字頁。

### 決策 2：媒體命名規則固定

圖片路徑：

- `imgs/<wordId>.<ext>`

音檔路徑：

- `audios/<languageCode>/<wordId>.<ext>`

例子：

- `imgs/28.jpg`
- `audios/zh-TW/28.mp3`
- `audios/id/28.mp3`

理由：

- 避免後台再輸入任意檔名。
- 讓刪除時能直接由路徑推回單字與語言。
- 後續若要重建 DB 與 R2 對應，規則可推導。

### 決策 3：DB 仍保留現有欄位模型

- `words.image_url` 繼續存圖片路徑或完整 URL。
- `word_translations.audio_filename` 繼續存音檔檔名，不改 schema。

對應寫入規則：

- 圖片上傳成功後，`words.image_url = imgs/<wordId>.<ext>`
- 音檔上傳成功後，`word_translations.audio_filename = <wordId>.<ext>`

理由：

- 與既有前台 `resolveMediaUrl` / `resolveAudioUrl` 相容。
- 避免新增 migration 去調整前台資料契約。

### 決策 4：刪除媒體即同步清空 DB

單一物件刪除：

- 刪圖片：清空 `words.image_url`
- 刪音檔：清空對應語言列的 `audio_filename`

清空 bucket：

- 刪除所有物件後，清空所有 `words.image_url`
- 清空所有 `word_translations.audio_filename`

理由：

- 使用者已明確要求刪除實體檔時，DB 也要同步歸零。
- 避免前台與後台顯示失效路徑。

## 系統架構

### 前端

#### `admin-word-edit.html`

新增媒體區塊：

- 圖片卡片
- `zh-TW` 音檔卡片
- `id` 音檔卡片
- `en` 音檔卡片

每個卡片包含：

- 目前狀態
- 目前路徑或檔名
- 圖片預覽或音檔播放器
- 上傳 / 替換按鈕
- 刪除按鈕

#### `admin-word-edit.js`

新增責任：

- 根據 `wordId` 控制媒體功能啟用狀態
- 呼叫上傳 API
- 上傳成功後更新表單與畫面
- 刪除成功後更新表單與畫面
- 將手填欄位逐步降級為唯讀或內部狀態欄位

#### `admin-assets.html`

新增能力：

- 列出 bucket 實體物件，而非只列 DB 參考
- 顯示物件是否有被某個單字引用
- 單筆刪除
- 危險操作區塊：清空整個 bucket

#### `admin-assets.js`

新增責任：

- 載入 R2 物件清單
- 套用搜尋與篩選
- 執行單筆刪除
- 執行整桶清空
- 重新整理列表與統計

#### `admin-api.js`

新增 client API：

- `loadStorageObjects(client, filters)`
- `uploadWordImage(client, wordId, file)`
- `uploadWordAudio(client, wordId, languageCode, file)`
- `deleteWordImage(client, wordId)`
- `deleteWordAudio(client, wordId, languageCode)`
- `deleteStorageObject(client, objectKey)`
- `purgeAllStorageObjects(client)`

### Worker

#### `workers/admin-auth-worker.js`

新增受保護 API：

- `GET /api/admin/assets/objects`
- `POST /api/admin/assets/word-image/:wordId`
- `POST /api/admin/assets/word-audio/:wordId/:languageCode`
- `DELETE /api/admin/assets/word-image/:wordId`
- `DELETE /api/admin/assets/word-audio/:wordId/:languageCode`
- `DELETE /api/admin/assets/object`
- `POST /api/admin/assets/purge`

Worker 需新增能力：

- 驗證管理員權限
- 驗證檔案類型與大小
- 與 R2 bucket 互動：list / put / delete
- 依命名規則更新 DB
- 回傳最新媒體狀態

### Cloudflare 設定

`wrangler.jsonc` 需新增 R2 bucket binding，例如：

- `r2_buckets: [{ binding: "LEXICON_MEDIA_BUCKET", bucket_name: "<bucket>" }]`

實際 bucket 名稱由現有 Cloudflare 帳號中的 R2 bucket 決定。

## 資料流

### 圖片上傳

1. 管理者開啟單字頁。
2. 頁面已存在有效 `wordId`。
3. 管理者選擇圖片檔。
4. 前端以 `multipart/form-data` 呼叫 `POST /api/admin/assets/word-image/:wordId`。
5. Worker 驗證檔案類型與大小。
6. Worker 依副檔名產生目標 key：`imgs/<wordId>.<ext>`。
7. 若舊圖片存在且副檔名不同，先刪除舊 key。
8. Worker 將新檔上傳至 R2。
9. Worker 更新 `words.image_url`。
10. Worker 回傳新路徑與可預覽 URL。
11. 前端更新畫面。

### 音檔上傳

1. 管理者在某語言區塊選擇音檔。
2. 前端呼叫 `POST /api/admin/assets/word-audio/:wordId/:languageCode`。
3. Worker 產生 key：`audios/<languageCode>/<wordId>.<ext>`。
4. 若同語言舊檔存在且副檔名不同，先刪除舊 key。
5. Worker 上傳新檔。
6. Worker 更新該語言 translation 的 `audio_filename = <wordId>.<ext>`。
7. Worker 回傳新檔名與預覽 URL。
8. 前端更新畫面。

### 單一物件刪除

1. 管理者在單字頁或資產頁觸發刪除。
2. Worker 刪除對應 R2 key。
3. Worker 判斷該 key 是圖片還是音檔。
4. Worker 更新資料庫：
   - 圖片：`words.image_url = ''`
   - 音檔：對應 `word_translations.audio_filename = ''`
5. 前端重新載入該筆狀態。

### 清空整個 bucket

1. 管理者在資產頁輸入確認文字並提交。
2. Worker 列出整個 bucket 所有物件。
3. Worker 分批刪除所有物件。
4. Worker 成功刪除後，執行 DB 清空：
   - `update public.words set image_url = '' where image_url <> ''`
   - `update public.word_translations set audio_filename = '' where audio_filename <> ''`
5. Worker 回傳刪除數量與清空結果。
6. 前端重置資產列表與統計。

## API 契約

### `GET /api/admin/assets/objects`

Query 參數：

- `cursor`：可選，後續若要分頁
- `prefix`：可選，`imgs/` 或 `audios/`

回傳：

- `items`
- `summary`

`items` 每筆包含：

- `key`
- `type`: `image` 或 `audio`
- `languageCode`: 圖片為 `null`
- `wordId`: 若可由規則解析則帶出
- `size`
- `uploadedAt`
- `dbReferenced`: `true` / `false`
- `previewUrl`

### `POST /api/admin/assets/word-image/:wordId`

Request：

- `multipart/form-data`
- 欄位 `file`

回傳：

- `wordId`
- `imageUrl`
- `previewUrl`

### `POST /api/admin/assets/word-audio/:wordId/:languageCode`

Request：

- `multipart/form-data`
- 欄位 `file`

回傳：

- `wordId`
- `languageCode`
- `audioFilename`
- `previewUrl`

### `DELETE /api/admin/assets/word-image/:wordId`

回傳：

- `wordId`
- `imageUrl: ''`
- `deletedKey`

### `DELETE /api/admin/assets/word-audio/:wordId/:languageCode`

回傳：

- `wordId`
- `languageCode`
- `audioFilename: ''`
- `deletedKey`

### `DELETE /api/admin/assets/object`

Request body：

- `key`

回傳：

- `deletedKey`
- `affectedWordId`
- `affectedLanguageCode`
- `dbCleared`

### `POST /api/admin/assets/purge`

Request body：

- `confirmText`

確認文字固定為：

- `DELETE ALL R2 OBJECTS`

回傳：

- `deletedObjectCount`
- `clearedImageCount`
- `clearedAudioCount`

## 驗證規則

### 圖片

- 允許：`image/jpeg`、`image/png`、`image/webp`
- 上限先定為 5 MB

### 音檔

- 允許：`audio/mpeg`、`audio/wav`、`audio/ogg`
- 上限先定為 10 MB

### 其他

- `wordId` 必須存在於 `words`
- `languageCode` 必須是 `zh-TW`、`id`、`en`
- 新建單字未取得 `wordId` 前不可上傳媒體

## UI 行為

### 單字頁

- 新增單字但尚未儲存時，媒體區顯示「請先儲存單字後再上傳媒體」。
- 上傳成功後立即刷新預覽，不要求再次手動儲存整張表單。
- 刪除媒體前顯示明確確認文案。
- 若圖片或音檔不存在，顯示空狀態，不視為錯誤。

### 資產頁

- 上方顯示 bucket 統計：
  - 圖片數量
  - 音檔數量
  - 未被 DB 引用數量
- 清空 bucket 按鈕需放在危險區塊。
- 清空操作需二次確認，且輸入固定確認字串。

## 錯誤處理

- R2 上傳失敗：保留原 DB 值，不做部分更新。
- DB 更新失敗但 R2 已上傳：
  - Worker 應回滾刪除剛上傳的新物件，避免 orphan object。
- R2 刪除失敗：不清空 DB。
- DB 清空失敗：
  - 單筆刪除流程回報失敗，提示系統處於不一致風險。
  - 清空 bucket 流程需回傳部分成功狀態與影響數量。

## 安全性

- 所有媒體 API 都沿用現有 admin bearer token 驗證。
- 只有通過 `requireAdminApiAccess` 的使用者可操作。
- 清空 bucket 需要額外確認字串，避免誤觸。
- 不接受任意 key 覆寫到 `imgs/`、`audios/` 以外前綴。

## 相容性與遷移

- 不需要變更現有前台 `resolveMediaUrl` / `resolveAudioUrl` 邏輯。
- 不需要新增 DB schema。
- 需要新增 DB RPC 或 SQL helper 以支援「依單字與語言清空媒體欄位」與「全表清空媒體欄位」。
- 現有手動輸入欄位可先保留，但應轉為唯讀顯示或隱藏，以免管理者手動輸入非規範值。

## 建議檔案調整

- 修改 `admin-word-edit.html`
- 修改 `admin-assets.html`
- 修改 `public/assets/js/admin-word-edit.js`
- 修改 `public/assets/js/admin-assets.js`
- 修改 `public/assets/js/admin-api.js`
- 修改 `public/assets/js/admin-i18n.js`
- 修改 `workers/admin-auth-worker.js`
- 修改 `wrangler.jsonc`
- 新增或修改 `local-tests/admin-word-edit.test.js`
- 新增或修改 `local-tests/admin-assets.test.js`
- 新增或修改 `local-tests/admin-api.test.js`
- 新增或修改 `local-tests/admin-worker.test.js`

## 測試策略

### 單元測試

- 路徑規則產生：
  - `imgs/<wordId>.<ext>`
  - `audios/<languageCode>/<wordId>.<ext>`
- key 解析：
  - 從 R2 key 還原 `type`、`wordId`、`languageCode`
- payload 正規化
- UI 狀態切換

### Worker 測試

- 上傳圖片成功並更新 `words.image_url`
- 上傳音檔成功並更新 `word_translations.audio_filename`
- 刪除圖片成功並清空 DB
- 刪除音檔成功並清空 DB
- 清空 bucket 成功並清空所有 DB 媒體欄位
- 非法副檔名 / MIME type 被拒絕
- 未登入或非 admin 被拒絕

### 前端整合測試

- 新建單字後啟用媒體區
- 編輯頁上傳後 UI 立即更新
- 刪除後 UI 立即反映空狀態
- 資產頁能列出 R2 實體物件，不只 DB 引用

## 風險

### 1. Worker multipart 處理

目前 Worker 主要處理 JSON API。媒體上傳會引入 `formData()` 與 `File` 處理，需要補測。

### 2. R2 與 DB 一致性

媒體操作變成跨系統交易。若沒有明確回滾，容易留下孤兒物件或失效路徑。

### 3. 清空 bucket 操作成本高

若 bucket 物件很多，清空需要分批處理，不能假設一次刪完。

### 4. 舊欄位輸入模式與新流程衝突

若仍允許手動輸入 `image_url` / `audio_filename`，會破壞命名規則與刪除推導能力。

## 推薦實作順序

1. 補 R2 binding 與 Worker list/delete/purge 能力。
2. 補 DB 清空 helper 與單筆媒體清除 helper。
3. 改 `admin-assets.html`，先能看到 bucket 實體物件與執行刪除/清空。
4. 改 `admin-word-edit.html`，補單字媒體上傳、替換、刪除。
5. 清掉手動輸入路徑的舊互動，改成系統生成。
6. 補測試與驗證流程。

## 驗收標準

- 管理者可以在單字頁直接上傳、替換、刪除圖片。
- 管理者可以在單字頁直接上傳、替換、刪除三個語言的音檔。
- 資產頁可列出 bucket 中所有物件，不再只依 DB 參考顯示。
- 執行清空 bucket 後，R2 無任何物件，且 DB 中所有 `image_url` 與 `audio_filename` 都為空字串。
- 前台與後台不再需要管理者手動輸入媒體路徑。

# 頁面、資料流與 API / RPC 對照

## 這份文件的目的

理解專案時，最常卡住的不是「有哪些檔案」，而是：

- 這個頁面到底打哪裡
- 是直接讀 Supabase，還是走 Worker
- 最後落在哪個 view 或 RPC

這份文件就是把頁面、controller、資料來源與 DB contract 串起來。

---

## 前台首頁對照

### 頁面

- `index.html`

### 前端控制器

- `public/assets/js/main.js`
- `public/assets/js/supabase-data.js`

### 直接讀取來源

- `lexicon_languages_api`
- `lexicon_words_api`
- `lexicon_tags_api`
- `lexicon_ui_translations_api`

### 不經過 Worker 的原因

- 前台以公開 read model 為主
- 沒有保護性寫入需求

---

## 後台登入頁對照

### 頁面

- `admin-login.html`

### 控制器

- `public/assets/js/admin-login.js`
- `public/assets/js/admin-auth.js`

### 呼叫 API

- `POST /api/admin/auth/login`

### Worker 入口

- `handleLogin`
- `handleRequest`

### 依賴資料

- `admin_accounts`
- `admin_users`
- Supabase Auth session

---

## 後台 Dashboard 對照

### 頁面

- `admin-dashboard.html`

### 控制器

- `public/assets/js/admin-dashboard.js`
- `public/assets/js/admin-api.js`

### 讀取流程

`loadDashboardSummary(client)` 會聚合：

- word list
- tag list
- 缺圖 / 缺音統計
- 最近更新資料

### 可能的資料來源

- 直接讀 `lexicon_words_api`
- 直接讀 `lexicon_tags_api`
- 或由 Worker 的 dashboard endpoint 聚合

### Worker 對照

- `handleAdminDashboardRead`

### 備註

這頁本質是 read-only summary，不做主資料寫入。

---

## 後台 Words 清單頁對照

### 頁面

- `admin-words.html`

### 控制器

- `public/assets/js/admin-words.js`
- `public/assets/js/admin-api.js`

### 主要讀取函式

- `loadWordList(client, filters)`

### 使用資料

- `lexicon_words_api`
- `lexicon_tags_api`

### 典型互動

- 搜尋
- tag filter
- has image filter
- has audio filter
- 分頁
- 跳轉至 word edit

### 是否經過 Worker

- 清單讀取通常不需要
- 寫入不在這頁發生

---

## 後台 Word Edit 頁對照

### 頁面

- `admin-word-edit.html`

### 控制器

- `public/assets/js/admin-word-edit.js`
- `public/assets/js/admin-api.js`

### 讀取函式

- `loadWordDetail(client, wordId)`
- `loadTagList(client)`

### 寫入函式

- `createWord(client, payload)`
- `updateWord(client, wordId, payload)`

### Worker endpoint

雖然實際 path 要看 `admin-api.js` 組裝方式，但邏輯上對應：

- `POST /api/admin/words`
- `PATCH /api/admin/words/:id`

### DB RPC

- `admin_create_word`
- `admin_update_word`

### 相關 validation

- `validate_word_save_payload`
- `replace_word_relations`

### 注意事項

- `id` 無效時不應 fallback 成 create
- create / edit 是高風險頁，前後端與 DB contract 都要同步

---

## 後台 Tags 頁對照

### 頁面

- `admin-tags.html`

### 控制器

- `public/assets/js/admin-tags.js`
- `public/assets/js/admin-api.js`

### 讀取函式

- `loadTagList(client)`

### 寫入函式

- `createTag(client, payload)`
- `updateTag(client, tagId, payload)`
- `deleteTag(client, tagId)`

### Worker handler

- `handleAdminTagCreate`
- `handleAdminTagUpdate`
- `handleAdminTagDelete`

### DB RPC

- `admin_create_tag`
- `admin_update_tag`
- `admin_delete_tag`

### 相關 validation

- `validate_tag_save_payload`
- `replace_tag_relations`

### 常見失敗點

- preflight 失敗
- Worker 未部署新路由
- `tags.id` sequence 未同步
- tag 仍被 `word_tags` 使用

---

## 後台 Assets 頁對照

### 頁面

- `admin-assets.html`

### 控制器

- `public/assets/js/admin-assets.js`
- `public/assets/js/admin-api.js`

### 讀取函式

- `loadAssetReferences(client, filters)`

### 實際資料來源

此頁不是獨立資產表，而是由字詞資料反推：

- image path
- audio filename
- 被哪些 words 引用

### 是否經過 Worker

- 以目前範圍看，主要是 read-only，通常可直接讀 Supabase 資料後在前端聚合

### 限制

- 不是 R2 物件實體列表
- 不驗證檔案是否真存在
- 不提供 upload / delete

---

## 後台共用殼層對照

### shell

- `public/assets/js/admin-shell.js`

### i18n

- `public/assets/js/admin-i18n.js`

### auth guard

- `public/assets/js/admin-auth.js`

### 共用責任

- 頁面標題
- sidebar
- locale switch
- 登出導向
- 頁面進入前權限確認

---

## API / RPC 對照表

| 使用情境 | 前端函式 | Worker / API | DB 函式 / view |
| --- | --- | --- | --- |
| 前台載入語言 | `loadSupabaseDataset` | 無 | `lexicon_languages_api` |
| 前台載入字詞 | `loadSupabaseDataset` | 無 | `lexicon_words_api` |
| 前台載入標籤 | `loadSupabaseDataset` | 無 | `lexicon_tags_api` |
| 前台載入 UI 翻譯 | `loadSupabaseDataset` | 無 | `lexicon_ui_translations_api` |
| 後台登入 | `requestAdminLogin` | `POST /api/admin/auth/login` | `admin_accounts` + `admin_users` + Supabase Auth |
| 後台 dashboard | `loadDashboardSummary` | 可由 Worker 聚合 | `lexicon_words_api` / `lexicon_tags_api` |
| 載入字詞列表 | `loadWordList` | 通常無 | `lexicon_words_api` |
| 載入字詞明細 | `loadWordDetail` | 通常無 | `words` + `word_translations` + `word_tags` / read model |
| 新增字詞 | `createWord` | `POST /api/admin/words` | `admin_create_word` |
| 更新字詞 | `updateWord` | `PATCH /api/admin/words/:id` | `admin_update_word` |
| 載入標籤列表 | `loadTagList` | 通常無 | `lexicon_tags_api` |
| 新增標籤 | `createTag` | `POST /api/admin/tags` | `admin_create_tag` |
| 更新標籤 | `updateTag` | `PATCH /api/admin/tags/:id` | `admin_update_tag` |
| 刪除標籤 | `deleteTag` | `DELETE /api/admin/tags/:id` | `admin_delete_tag` |
| 載入資產引用 | `loadAssetReferences` | 通常無 | 由字詞資料推導 |

---

## 讀寫邊界總結

### 可直接讀

- 前台 read model
- 後台大部分 list / summary / reference

### 必須經 Worker 寫

- login
- create word
- update word
- create tag
- update tag
- delete tag

這個邊界不要打破。  
如果未來新增後台寫入功能，優先比照 Worker + RPC 路線，而不是偷走前端直寫。

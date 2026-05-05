# Supabase 資料模型與遷移

## 資料庫在整個專案中的角色

Supabase 在這個專案不是單純的資料存放區，而是同時扮演：

- 主資料庫
- 前台公開讀取來源
- 後台授權基礎
- UI 翻譯儲存層
- 後台寫入 RPC 的執行端

因此如果要理解專案，不能只看前端，必須把 migration 一起看。

---

## Migration 清單

目前 `supabase/migrations` 內可見的 migration 有：

1. `20260425020500_create_lexicon_schema.sql`
2. `20260425130000_admin_auth_phase_2.sql`
3. `20260425131000_add_admin_accounts.sql`
4. `20260426000000_admin_backoffice_write_support.sql`
5. `20260426003000_fix_identity_sequences.sql`

這個順序很重要，因為它反映了專案演進：

- 先有詞彙 schema
- 再加 admin auth
- 再補 username account
- 再補後台寫入支援
- 最後修正 identity sequence

---

## 核心內容資料表

### `languages`

用途：

- 定義系統支援語言

主要欄位：

- `code`
- `label`
- `native_label`
- `description`
- `short_label`
- `symbol`
- `sort_order`

這張表是前台與後台語言顯示的基礎。

### `words`

用途：

- 儲存詞條主體

主要欄位：

- `id`
- `image_url`
- `created_at`
- `updated_at`

它本身不存多語文字，只存詞條主鍵與共用欄位。

### `word_translations`

用途：

- 儲存每個 word 在各語言的文字、發音與音檔

主要欄位：

- `word_id`
- `language_code`
- `text`
- `pronunciation`
- `audio_filename`

主鍵：

- `(word_id, language_code)`

### `tags`

用途：

- 儲存 tag 主體

主要欄位：

- `id`
- `icon`

### `tag_translations`

用途：

- 儲存 tag 的各語言名稱

主要欄位：

- `tag_id`
- `language_code`
- `name`

### `word_tags`

用途：

- 字詞與標籤的多對多對應

主要欄位：

- `word_id`
- `tag_id`

### `ui_translations`

用途：

- 儲存前台 UI 翻譯

主要欄位：

- `language_code`
- `key`
- `value`

---

## 管理權限相關資料表

### `admin_users`

用途：

- 標記哪些 `auth.users` 可被視為管理員

主要欄位：

- `user_id`
- `created_at`

這是後台權限判定的重要依據。

### `member_profiles`

用途：

- 一般會員 profile

目前對後台核心功能不是主線，但跟 auth phase 2 有關。

### `admin_accounts`

用途：

- 建立管理員使用者名稱帳號層

主要欄位：

- `user_id`
- `username`
- `display_name`
- `is_active`
- `created_at`
- `updated_at`

這張表讓登入流程可以用 `username` 而不是直接暴露 email。

---

## RLS 與權限策略

初始 schema 中，核心詞彙資料表都啟用了 RLS。

目前 public read 的方向很明確：

- `anon`
- `authenticated`

都能對核心讀取表與 view 做 `select`

這個設計符合前台公開讀取的需求，但也代表：

- 公開 read model 的內容必須是可公開的
- 不應把敏感欄位混進前台 view

管理相關表則更嚴格，例如：

- `admin_users` 只允許 authenticated 讀自己的 row
- `member_profiles` 只允許會員讀寫自己的資料

---

## Public Read Model Views

這個專案很依賴 view 做 API contract。

### `lexicon_languages_api`

用途：

- 對前台與可能的後台提供語言清單

### `lexicon_words_api`

用途：

- 將 `words + word_translations + word_tags` 聚合成前端可直接使用的結構

特徵：

- 把不同語言文字攤平為欄位
- 把 pronunciation 與 audio 聚成 JSON 物件
- 把 tags 聚成陣列

這是前台讀字詞最核心的 read model。

### `lexicon_tags_api`

用途：

- 將 `tags + tag_translations` 聚合成前端可用格式

### `lexicon_ui_translations_api`

用途：

- 提供 UI 文案 key-value 給前台

---

## 後台寫入 RPC

`20260426000000_admin_backoffice_write_support.sql` 是目前後台能運作的核心 migration。

它做的事情很多：

- 讓 `words.id` / `tags.id` 轉成 identity
- 建立 `updated_at` 維護 trigger
- 建立 payload validation function
- 建立 replace relations function
- 建立 admin write RPC

### 字詞相關 RPC

- `admin_create_word`
- `admin_update_word`

它們依賴：

- `validate_word_save_payload`
- `replace_word_relations`

這代表字詞寫入不是前端逐張表亂打，而是透過 DB function 進行完整替換。

### 標籤相關 RPC

- `admin_create_tag`
- `admin_update_tag`
- `admin_delete_tag`

它們依賴：

- `validate_tag_save_payload`
- `replace_tag_relations`

`admin_delete_tag` 會先檢查 `word_tags` 使用量，若仍被使用會直接 `raise exception`。

---

## `updated_at` 維護策略

目前 `words.updated_at` 不是只在更新 `words` 表時改，還會在這些情境被更新：

- `word_translations` insert / update / delete
- `word_tags` insert / delete

這是透過 trigger 完成的。

好處：

- Dashboard recent updates 能反映字詞整體變更，而不是只反映圖片 URL 是否更新

---

## Seed 資料現況

`supabase/seed.sql` 包含：

- language seed
- words seed
- tags seed
- word_translations seed
- tag_translations seed
- word_tags seed
- ui_translations seed

但從目前檔案內容看得出一個重要風險：

- 部分中文內容出現明顯編碼污染

這代表：

- 早期資料匯入可能有編碼不一致問題
- 若直接拿 seed 當資料品質來源，會被誤導
- 未來應考慮重建 seed 輸出流程或重新整理資料來源

---

## Identity Sequence 修正

`20260426003000_fix_identity_sequences.sql` 的存在很關鍵。

原因是：

- `words.id` / `tags.id` 從原本普通 integer 轉為 identity 後
- 如果既有資料已插入，但 sequence 沒同步到 max(id)
- 下一次新增就可能撞主鍵

這個 migration 透過 `setval()` 把 sequence 校正到目前最大 id。

這是一個很典型但容易被忽略的資料庫遷移問題。

---

## 目前資料模型的優點

- 正規化程度合理
- 多語資料拆分清楚
- read model 與 write RPC 分工明確
- RLS 基礎存在
- 以 migration 管理演進而非手工修改線上資料表

---

## 目前資料模型的限制

- `ui_translations` 目前主要服務前台，後台多語字串尚未完全資料化
- 依賴 `zh-TW / id / en` 三種語言的固定假設較重
- seed 資料品質不穩
- 沒有看到明確的審計欄位或操作紀錄表
- 沒有媒體資產主表，媒體目前只是 path/reference 概念

---

## 如果要擴充 schema，優先要注意什麼

1. 先確認前台 read model 是否會受影響
2. 先確認 `admin-api.js` 的 normalization 是否要同步調整
3. 先確認 Worker RPC payload contract 是否要跟著改
4. 若涉及 identity 或既有資料，務必評估 sequence 修正
5. 若新增語言，前台與後台都要同步檢查固定語言陣列邏輯

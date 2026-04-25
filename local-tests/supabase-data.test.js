const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createSupabaseClient,
  normalizeSupabaseDataset,
} = require("../public/assets/js/supabase-data");

test("normalizes Supabase API rows into app data shape", () => {
  const dataset = normalizeSupabaseDataset({
    languages: [
      {
        code: "zh-TW",
        label: "繁體中文",
        native_label: "繁體中文",
        description: "Traditional Chinese",
        short_label: "繁中",
        symbol: "ZH",
        sort_order: 1,
      },
    ],
    uiTranslations: [
      {
        language_code: "zh-TW",
        key: "learn",
        value: "學習",
      },
    ],
    words: [
      {
        id: 1,
        "lang_zh-TW": "好",
        lang_id: "bagus",
        lang_en: "",
        pronunciation: { "zh-TW": "hǎo", id: "", en: "" },
        img: "",
        audio: { "zh-TW": "好.mp3", id: "bagus.mp3", en: "" },
        tags: [4],
      },
    ],
    tags: [
      {
        id: 4,
        name_en: "adjective",
        name_zh_tw: "形容詞",
        name_id: "kata sifat",
        icon: "sell",
      },
    ],
  });

  assert.deepEqual(dataset.languages, [
    {
      code: "zh-TW",
      label: "繁體中文",
      nativeLabel: "繁體中文",
      description: "Traditional Chinese",
      shortLabel: "繁中",
      symbol: "ZH",
    },
  ]);
  assert.equal(dataset.translations["zh-TW"].learn, "學習");
  assert.equal(dataset.words[0]["lang_zh-TW"], "好");
  assert.deepEqual(dataset.words[0].tags, [4]);
  assert.equal(dataset.tags[0].name_zh_tw, "形容詞");
});

test("creates Supabase client without auth session persistence", () => {
  let receivedOptions = null;
  const client = createSupabaseClient({
    LEXICON_SUPABASE_CONFIG: {
      url: "https://example.supabase.co",
      anonKey: "publishable-key",
    },
    supabase: {
      createClient(url, anonKey, options) {
        receivedOptions = { url, anonKey, options };
        return { ok: true };
      },
    },
  });

  assert.deepEqual(client, { ok: true });
  assert.equal(receivedOptions.url, "https://example.supabase.co");
  assert.equal(receivedOptions.anonKey, "publishable-key");
  assert.equal(receivedOptions.options.auth.persistSession, false);
  assert.equal(receivedOptions.options.auth.autoRefreshToken, false);
  assert.equal(receivedOptions.options.auth.detectSessionInUrl, false);
});

test("requires Supabase config instead of allowing JSON fallback", () => {
  assert.throws(
    () => createSupabaseClient({}),
    /Supabase config is required/,
  );
});

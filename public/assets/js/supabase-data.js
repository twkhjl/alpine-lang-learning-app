(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.lexiconSupabaseData = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function normalizeSupabaseDataset(dataset) {
    const translations = {};

    for (const row of dataset.uiTranslations || []) {
      if (!translations[row.language_code]) {
        translations[row.language_code] = {};
      }
      translations[row.language_code][row.key] = row.value;
    }

    return {
      words: Array.isArray(dataset.words) ? dataset.words : [],
      tags: Array.isArray(dataset.tags) ? dataset.tags : [],
      translations,
      languages: (dataset.languages || [])
        .slice()
        .sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0))
        .map((language) => ({
          code: language.code,
          label: language.label || "",
          nativeLabel: language.native_label || "",
          description: language.description || "",
          shortLabel: language.short_label || "",
          symbol: language.symbol || "",
        })),
    };
  }

  async function selectAll(client, table, orderColumn = null) {
    let query = client.from(table).select("*");
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data || [];
  }

  async function loadSupabaseDataset(client) {
    const [words, tags, languages, uiTranslations] = await Promise.all([
      selectAll(client, "lexicon_words_api", "id"),
      selectAll(client, "lexicon_tags_api", "id"),
      selectAll(client, "lexicon_languages_api", "sort_order"),
      selectAll(client, "lexicon_ui_translations_api"),
    ]);

    return normalizeSupabaseDataset({
      words,
      tags,
      languages,
      uiTranslations,
    });
  }

  function createSupabaseClient(globalObject = root) {
    const config = globalObject.LEXICON_SUPABASE_CONFIG;
    const supabaseFactory = globalObject.supabase;

    if (!config?.url || !config?.anonKey) {
      throw new Error("Supabase config is required.");
    }

    if (!supabaseFactory?.createClient) {
      throw new Error("Supabase client library is required.");
    }

    return supabaseFactory.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return {
    createSupabaseClient,
    loadSupabaseDataset,
    normalizeSupabaseDataset,
  };
});

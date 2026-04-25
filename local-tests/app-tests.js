(function () {
  const output = document.getElementById("output");
  const utils = window.lexiconTestUtils;
  const results = [];

  function assert(name, condition, detail = "") {
    results.push({ name, passed: !!condition, detail });
    if (!condition) {
      throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
    }
  }

  function run() {
    const normalized = utils.normalizeStatusCollections([1, 1, 2], [2, 3, 3]);
    assert(
      "favorite/ignored should stay exclusive",
      JSON.stringify(normalized) ===
        JSON.stringify({ favoriteWordIds: [1, 2], ignoredWordIds: [3] }),
    );

    const nextFavorite = utils.applyExclusiveStatus(5, utils.STATUS.FAVORITE, [], [5]);
    assert(
      "favorite should replace ignored on same word",
      JSON.stringify(nextFavorite) ===
        JSON.stringify({ favoriteWordIds: [5], ignoredWordIds: [] }),
    );

    const nextIgnored = utils.applyExclusiveStatus(7, utils.STATUS.IGNORED, [7], []);
    assert(
      "ignored should replace favorite on same word",
      JSON.stringify(nextIgnored) ===
        JSON.stringify({ favoriteWordIds: [], ignoredWordIds: [7] }),
    );

    const word = {
      "lang_zh-TW": "好",
      lang_id: "bagus",
      lang_en: "",
    };
    assert(
      "word fallback should use zh-TW when en is missing",
      utils.resolveWordText(word, "en") === "好",
    );

    assert(
      "query should match across languages",
      utils.wordMatchesQuery(word, "bag"),
    );

    assert(
      "image asset path should resolve to the R2 public URL",
      utils.resolveMediaUrl("public/assets/imgs/202604120952.jpg") ===
        "https://pub-0ab02e3e2bda4c4c99e33c093612b10c.r2.dev/imgs/202604120952.jpg",
    );

    assert(
      "audio filename should resolve to the R2 public URL by language",
      utils.resolveAudioUrl("id", "bagus.mp3") ===
        "https://pub-0ab02e3e2bda4c4c99e33c093612b10c.r2.dev/audios/id/bagus.mp3",
    );

    const preferences = utils.normalizePreferences(
      {
        nativeLanguage: "en",
        displayLanguage1: "en",
        displayLanguage2: "en",
        selectedTagIds: [1, "2", 1],
        favoriteWordIds: [1, 2],
        ignoredWordIds: [2, 3],
        statusFilter: "favorite",
      },
      [{ code: "zh-TW" }, { code: "id" }, { code: "en" }],
    );

    assert("display languages should not collide", preferences.displayLanguage1 !== preferences.displayLanguage2);
    assert(
      "selectedTagIds should keep integer values only",
      JSON.stringify(preferences.selectedTagIds) === JSON.stringify([1]),
    );
    assert(
      "migration should remove favorite/ignored conflicts",
      JSON.stringify(preferences.favoriteWordIds) === JSON.stringify([1, 2]) &&
        JSON.stringify(preferences.ignoredWordIds) === JSON.stringify([3]),
    );

    output.textContent = results
      .map((result) => `PASS ${result.name}`)
      .join("\n");
  }

  try {
    run();
  } catch (error) {
    output.textContent = `${output.textContent}\nFAIL ${error.message}`;
    throw error;
  }
})();

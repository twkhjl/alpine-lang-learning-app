# Supabase Data Migration Design

## Goal

Move the public lexicon JSON data from `data/` into Supabase while keeping the current Alpine UI behavior and leaving personal preferences in `localStorage`.

## Scope

- Migrate words, word translations, pronunciations, audio filenames, images, tags, language metadata, and UI translations into Supabase.
- Add read-only public access through Row Level Security policies.
- Add database views that return payloads close to the original JSON shape so the frontend change stays small.
- Keep favorites, ignored words, selected filters, and language preferences in `localStorage`.
- Make Supabase the only runtime data source. Missing config or API errors should show the existing load error state.

## Database Model

- `languages`: one row per supported language.
- `words`: one row per lexicon entry, with media-independent metadata.
- `word_translations`: one row per word/language pair, including text, pronunciation, and audio filename.
- `tags`: one row per tag, with icon metadata.
- `tag_translations`: one row per tag/language pair.
- `word_tags`: join table between words and tags.
- `ui_translations`: one row per interface text key/language pair.

## Read API Shape

The frontend will query Supabase views:

- `lexicon_words_api`: returns `id`, `lang_zh-TW`, `lang_id`, `lang_en`, `pronunciation`, `img`, `audio`, and `tags`.
- `lexicon_tags_api`: returns `id`, `name_en`, `name_zh_tw`, `name_id`, and `icon`.
- `lexicon_languages_api`: returns language metadata in display order.
- `lexicon_ui_translations_api`: returns `language_code`, `key`, and `value`.

## Frontend Design

- `main.js` loads data only through `window.supabase` and `window.LEXICON_SUPABASE_CONFIG`.
- There is no `data/` JSON fallback path.
- Existing normalization, filtering, card display, audio resolution, and `localStorage` preference logic remain unchanged.

## Security

- Public anonymous reads are allowed only for lexicon content tables.
- No write policy is added for anonymous users.
- No service role key is stored in the frontend.

## Verification

- Unit tests validate Supabase payload assembly and required config behavior.
- Existing local browser tests remain the regression suite for UI behavior.
- Supabase migration is applied with `supabase db push`.

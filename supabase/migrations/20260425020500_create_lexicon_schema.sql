create table if not exists public.languages (
  code text primary key,
  label text not null default '',
  native_label text not null default '',
  description text not null default '',
  short_label text not null default '',
  symbol text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.words (
  id integer primary key,
  image_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.word_translations (
  word_id integer not null references public.words(id) on delete cascade,
  language_code text not null references public.languages(code) on delete cascade,
  text text not null default '',
  pronunciation text not null default '',
  audio_filename text not null default '',
  primary key (word_id, language_code)
);

create table if not exists public.tags (
  id integer primary key,
  icon text not null default 'sell'
);

create table if not exists public.tag_translations (
  tag_id integer not null references public.tags(id) on delete cascade,
  language_code text not null references public.languages(code) on delete cascade,
  name text not null default '',
  primary key (tag_id, language_code)
);

create table if not exists public.word_tags (
  word_id integer not null references public.words(id) on delete cascade,
  tag_id integer not null references public.tags(id) on delete cascade,
  primary key (word_id, tag_id)
);

create table if not exists public.ui_translations (
  language_code text not null references public.languages(code) on delete cascade,
  key text not null,
  value text not null default '',
  primary key (language_code, key)
);

create index if not exists word_translations_language_code_idx
  on public.word_translations(language_code);

create index if not exists tag_translations_language_code_idx
  on public.tag_translations(language_code);

create index if not exists word_tags_tag_id_idx
  on public.word_tags(tag_id);

alter table public.languages enable row level security;
alter table public.words enable row level security;
alter table public.word_translations enable row level security;
alter table public.tags enable row level security;
alter table public.tag_translations enable row level security;
alter table public.word_tags enable row level security;
alter table public.ui_translations enable row level security;

drop policy if exists "Public read languages" on public.languages;
create policy "Public read languages"
  on public.languages for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read words" on public.words;
create policy "Public read words"
  on public.words for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read word translations" on public.word_translations;
create policy "Public read word translations"
  on public.word_translations for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read tags" on public.tags;
create policy "Public read tags"
  on public.tags for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read tag translations" on public.tag_translations;
create policy "Public read tag translations"
  on public.tag_translations for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read word tags" on public.word_tags;
create policy "Public read word tags"
  on public.word_tags for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read ui translations" on public.ui_translations;
create policy "Public read ui translations"
  on public.ui_translations for select
  to anon, authenticated
  using (true);

create or replace view public.lexicon_languages_api
with (security_invoker = true) as
select
  code,
  label,
  native_label,
  description,
  short_label,
  symbol,
  sort_order
from public.languages;

create or replace view public.lexicon_words_api
with (security_invoker = true) as
with translation_sets as (
  select
    word_id,
    coalesce(max(text) filter (where language_code = 'zh-TW'), '') as lang_zh_tw,
    coalesce(max(text) filter (where language_code = 'id'), '') as lang_id,
    coalesce(max(text) filter (where language_code = 'en'), '') as lang_en,
    jsonb_build_object(
      'zh-TW', coalesce(max(pronunciation) filter (where language_code = 'zh-TW'), ''),
      'id', coalesce(max(pronunciation) filter (where language_code = 'id'), ''),
      'en', coalesce(max(pronunciation) filter (where language_code = 'en'), '')
    ) as pronunciation,
    jsonb_build_object(
      'zh-TW', coalesce(max(audio_filename) filter (where language_code = 'zh-TW'), ''),
      'id', coalesce(max(audio_filename) filter (where language_code = 'id'), ''),
      'en', coalesce(max(audio_filename) filter (where language_code = 'en'), '')
    ) as audio
  from public.word_translations
  group by word_id
),
tag_sets as (
  select
    word_id,
    array_agg(tag_id order by tag_id) as tags
  from public.word_tags
  group by word_id
)
select
  words.id,
  coalesce(translation_sets.lang_zh_tw, '') as "lang_zh-TW",
  coalesce(translation_sets.lang_id, '') as lang_id,
  coalesce(translation_sets.lang_en, '') as lang_en,
  coalesce(
    translation_sets.pronunciation,
    jsonb_build_object('zh-TW', '', 'id', '', 'en', '')
  ) as pronunciation,
  words.image_url as img,
  coalesce(
    translation_sets.audio,
    jsonb_build_object('zh-TW', '', 'id', '', 'en', '')
  ) as audio,
  coalesce(tag_sets.tags, array[]::integer[]) as tags
from public.words
left join translation_sets on translation_sets.word_id = words.id
left join tag_sets on tag_sets.word_id = words.id;

create or replace view public.lexicon_tags_api
with (security_invoker = true) as
with translation_sets as (
  select
    tag_id,
    coalesce(max(name) filter (where language_code = 'en'), '') as name_en,
    coalesce(max(name) filter (where language_code = 'zh-TW'), '') as name_zh_tw,
    coalesce(max(name) filter (where language_code = 'id'), '') as name_id
  from public.tag_translations
  group by tag_id
)
select
  tags.id,
  coalesce(translation_sets.name_en, '') as name_en,
  coalesce(translation_sets.name_zh_tw, '') as name_zh_tw,
  coalesce(translation_sets.name_id, '') as name_id,
  tags.icon
from public.tags
left join translation_sets on translation_sets.tag_id = tags.id;

create or replace view public.lexicon_ui_translations_api
with (security_invoker = true) as
select
  language_code,
  key,
  value
from public.ui_translations;

grant usage on schema public to anon, authenticated;
grant select on
  public.languages,
  public.words,
  public.word_translations,
  public.tags,
  public.tag_translations,
  public.word_tags,
  public.ui_translations,
  public.lexicon_languages_api,
  public.lexicon_words_api,
  public.lexicon_tags_api,
  public.lexicon_ui_translations_api
to anon, authenticated;

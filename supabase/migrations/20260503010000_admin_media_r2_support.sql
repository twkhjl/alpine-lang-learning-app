begin;

create or replace function public.admin_set_word_image(
	p_word_id integer,
	p_image_url text default ''
)
returns public.words
language plpgsql
as $$
declare
	saved_word public.words;
begin
	update public.words
	set image_url = coalesce(btrim(coalesce(p_image_url, '')), '')
	where id = p_word_id
	returning * into saved_word;

	return saved_word;
end;
$$;

create or replace function public.admin_clear_word_image(
	p_word_id integer
)
returns public.words
language plpgsql
as $$
begin
	return public.admin_set_word_image(p_word_id, '');
end;
$$;

create or replace function public.admin_set_word_audio(
	p_word_id integer,
	p_language_code text,
	p_audio_filename text default ''
)
returns public.word_translations
language plpgsql
as $$
declare
	normalized_language_code text;
	saved_translation public.word_translations;
begin
	normalized_language_code := btrim(coalesce(p_language_code, ''));

	if p_word_id is null or p_word_id <= 0 then
		raise exception 'Word id must be a positive integer.';
	end if;

	if normalized_language_code = '' then
		raise exception 'Language code is required.';
	end if;

	if not exists (
		select 1
		from public.words
		where id = p_word_id
	) then
		return null;
	end if;

	if not exists (
		select 1
		from public.languages
		where code = normalized_language_code
	) then
		raise exception 'Language does not exist.';
	end if;

	insert into public.word_translations (
		word_id,
		language_code,
		text,
		pronunciation,
		audio_filename
	)
	values (
		p_word_id,
		normalized_language_code,
		'',
		'',
		coalesce(btrim(coalesce(p_audio_filename, '')), '')
	)
	on conflict (word_id, language_code) do update
	set audio_filename = excluded.audio_filename
	returning * into saved_translation;

	return saved_translation;
end;
$$;

create or replace function public.admin_clear_word_audio(
	p_word_id integer,
	p_language_code text
)
returns public.word_translations
language plpgsql
as $$
begin
	return public.admin_set_word_audio(p_word_id, p_language_code, '');
end;
$$;

create or replace function public.admin_purge_media_references()
returns jsonb
language plpgsql
as $$
declare
	cleared_image_count integer := 0;
	cleared_audio_count integer := 0;
begin
	with cleared_words as (
		update public.words
		set image_url = ''
		where btrim(coalesce(image_url, '')) <> ''
		returning 1
	)
	select count(*)
	into cleared_image_count
	from cleared_words;

	with cleared_translations as (
		update public.word_translations
		set audio_filename = ''
		where btrim(coalesce(audio_filename, '')) <> ''
		returning 1
	)
	select count(*)
	into cleared_audio_count
	from cleared_translations;

	return jsonb_build_object(
		'cleared_image_count', cleared_image_count,
		'cleared_audio_count', cleared_audio_count
	);
end;
$$;

commit;

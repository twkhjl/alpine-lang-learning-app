begin;

drop function if exists public.admin_set_word_image(integer, text);

drop function if exists public.admin_set_word_audio(integer, text, text);

commit;

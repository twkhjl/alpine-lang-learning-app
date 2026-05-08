begin;

create or replace function public.admin_delete_word(
	p_word_id integer
)
returns boolean
language plpgsql
as $$
begin
	delete from public.words
	where id = p_word_id;

	return found;
end;
$$;

commit;

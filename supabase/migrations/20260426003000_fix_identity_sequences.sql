begin;

select setval(
  pg_get_serial_sequence('public.words', 'id'),
  greatest(coalesce((select max(id) from public.words), 1), 1),
  true
);

select setval(
  pg_get_serial_sequence('public.tags', 'id'),
  greatest(coalesce((select max(id) from public.tags), 1), 1),
  true
);

commit;

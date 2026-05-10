select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'words' and column_name = 'image_original_filename')
    or (table_name = 'word_translations' and column_name = 'audio_original_filename')
  )
order by table_name, column_name;

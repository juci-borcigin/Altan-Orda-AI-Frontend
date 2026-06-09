-- チャット添付画像（非公開 Storage。サーバー service_role のみ upload / signed URL）

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ao-chat-attachments',
  'ao-chat-attachments',
  false,
  4194304,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

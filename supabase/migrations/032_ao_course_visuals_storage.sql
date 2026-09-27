-- 講習画像（非公開 Storage。サーバーの service_role だけが upload / signed URL を発行する）
--
-- 適用しないと、新規の画像生成はバケットが無く失敗する。
-- 既存行の data URL はこのファイルでは書き換えない。移動は
-- web/scripts/backfill-course-visuals-storage.ts を見てから手動で行う。
--
-- storage.objects の RLS は Supabase 既定で有効。anon / authenticated 向け
-- ポリシーは付けない（027 の ao-chat-attachments と同じ）。service_role は
-- RLS を迂回する。ブラウザは署名 URL でのみ画像を読む。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ao-course-visuals',
  'ao-course-visuals',
  false,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.ao_course_visuals.artifact_url is
  '画像の置き場所。新規は storage://ao-course-visuals/<course_id>/<slot>.png。旧 data:image/... と /courses/... は読み取り互換。';

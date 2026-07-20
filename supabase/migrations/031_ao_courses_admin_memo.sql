-- 講座単位の管理者用メモ（講座生成には影響しない）

alter table public.ao_courses
  add column if not exists admin_memo text not null default '';

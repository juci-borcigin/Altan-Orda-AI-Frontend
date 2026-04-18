-- Profile は当面 ao-prompts のハードコードに統一。テーブルを廃止する（初回のみ実行）
-- 手順: Supabase SQL Editor で実行

drop table if exists profile_entries cascade;

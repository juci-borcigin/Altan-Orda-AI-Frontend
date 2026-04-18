-- Step 8: profile_entries の初期データ（TEMPLATE）
-- 殿下・幕僚で本文を確定したら、このファイルをコピーして 003_profile_entries_seed.sql などにリネームし、
-- VALUES を編集のうえ Supabase SQL Editor で実行してください。
--
-- priority: 1（高）〜10（低）。数値が小さいほど先に注入され、上限超過時に後から落ちる。

/*
insert into profile_entries (category, content, priority) values
  ('好み', '（例）コーヒーは浅煎りを好む。', 2),
  ('禁忌', '（例）特定の呼称は避ける。', 3);
*/

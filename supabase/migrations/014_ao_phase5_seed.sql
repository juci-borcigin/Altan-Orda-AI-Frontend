-- Phase 5 seed data (idempotent). Docs: AO_Phase5_Glossary.txt, phase5-data.ts
-- Full refresh via: cd web && npm run seed:phase5

insert into public.ao_glossary (ao_term, general_term, sort_order) values
  ('殿下', 'ユーザー', 100),
  ('ジュチ様', 'ユーザー', 99),
  ('邦主様', 'ユーザー', 98),
  ('ウルス・ハン', 'ユーザー', 97),
  ('僚友', 'Persona', 90),
  ('ノコル', 'Persona', 89),
  ('論', 'Project', 80),
  ('議事', 'スレッド', 70),
  ('令旨', 'システムプロンプト', 69),
  ('ジャルリグ', 'システムプロンプト', 68),
  ('年代記', 'スレッドの過去ログ', 67),
  ('トプチヤン', 'スレッドの過去ログ', 66),
  ('大会盟', '全ペルソナ参加の全体会議', 65),
  ('クリルタイ', '全ペルソナ参加の全体会議', 64),
  ('邦国', 'Altan Orda システム', 63),
  ('ジュチ・ウルス', 'Altan Orda システム', 62),
  ('AO', 'Altan Orda システム', 61),
  ('ウルス', 'Altan Orda システム', 60),
  ('スブタイ', 'Cursor', 50)
on conflict (ao_term) do update set
  general_term = excluded.general_term,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.ao_project_map (project_id, section_key, topic_label_ja) values
  ('debate', 'project_debate', '大会盟（クリルタイ）'),
  ('chat', 'project_chat', '巷間論'),
  ('plan', 'project_plan', '為政論'),
  ('work', 'project_work', '兵馬論'),
  ('mental', 'project_mental', '心気論'),
  ('notebook', 'project_notebook', '学究論'),
  ('foreign', 'project_foreign', '遠交論')
on conflict (project_id) do update set
  section_key = excluded.section_key,
  topic_label_ja = excluded.topic_label_ja,
  updated_at = now();

insert into public.ao_persona_alias (alias, persona_key, canonical_name) values
  ('師傅', 'persona_tatatunga', 'タタ・トゥンガ'),
  ('ベキ', 'persona_quduka', 'クドゥカ')
on conflict (alias) do update set
  persona_key = excluded.persona_key,
  canonical_name = excluded.canonical_name,
  updated_at = now();

insert into public.ao_persona_avatar (persona_key, display_name, avatar_path) values
  ('persona_hunan', 'フナン', '/personas/AO_Char_Hunan.png'),
  ('persona_mongkeur', 'モンケウール', '/personas/AO_Char_Mongkeur.png'),
  ('persona_qete', 'ケテ', '/personas/AO_Char_Qete.png'),
  ('persona_baiju', 'バイジュ', '/personas/AO_Char_Baiju.png'),
  ('persona_quduka', 'クドゥカ', '/personas/AO_Char_QudukaBeki.png'),
  ('persona_tatatunga', 'タタ・トゥンガ', '/personas/AO_Char_TataTunga.png'),
  ('persona_cintemur', 'チン・テムール', '/personas/AO_Char_ChinTemur.png'),
  ('persona_korguz', 'コルグズ', '/personas/AO_Char_Qorguz.png')
on conflict (persona_key) do update set
  display_name = excluded.display_name,
  avatar_path = excluded.avatar_path,
  updated_at = now();

delete from public.ao_speaker_allow;

insert into public.ao_speaker_allow (project_id, persona_key, sort_order) values
  ('debate', 'persona_hunan', 6), ('debate', 'persona_mongkeur', 5), ('debate', 'persona_qete', 4),
  ('debate', 'persona_baiju', 3), ('debate', 'persona_cintemur', 2), ('debate', 'persona_tatatunga', 1),
  ('chat', 'persona_quduka', 1),
  ('plan', 'persona_hunan', 2), ('plan', 'persona_qete', 1),
  ('work', 'persona_mongkeur', 2), ('work', 'persona_qete', 1),
  ('mental', 'persona_baiju', 1),
  ('notebook', 'persona_tatatunga', 1),
  ('foreign', 'persona_cintemur', 1);

insert into public.ao_mode_triggers (mode_key, trigger_type, trigger_value, section_key) values
  ('mode_casual', 'keyword', '雑談', 'mode_casual'),
  ('mode_designate', 'pattern', '＜[^＞]+＞よ', 'mode_designate')
on conflict (mode_key) do update set
  trigger_type = excluded.trigger_type,
  trigger_value = excluded.trigger_value,
  section_key = excluded.section_key,
  updated_at = now();

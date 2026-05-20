/** Phase 5 seed defaults (Supabase と同期。Docs: AO_Phase5_*.txt がマスタの場合は seed で上書き) */

export const PHASE5_PROJECT_IDS = [
  "debate",
  "chat",
  "plan",
  "work",
  "mental",
  "notebook",
  "foreign",
] as const;

export type Phase5SampleProjectId = (typeof PHASE5_PROJECT_IDS)[number];

export const PHASE5_PROJECT_MAP: Record<
  Phase5SampleProjectId,
  { section_key: string; topic_label_ja: string }
> = {
  debate: { section_key: "project_debate", topic_label_ja: "大会盟（クリルタイ）" },
  chat: { section_key: "project_chat", topic_label_ja: "巷間論" },
  plan: { section_key: "project_plan", topic_label_ja: "為政論" },
  work: { section_key: "project_work", topic_label_ja: "兵馬論" },
  mental: { section_key: "project_mental", topic_label_ja: "心気論" },
  notebook: { section_key: "project_notebook", topic_label_ja: "学究論" },
  foreign: { section_key: "project_foreign", topic_label_ja: "遠交論" },
};

/** project_id → persona_key（process で参照する僚友） */
export const PHASE5_SPEAKER_ALLOW: Record<Phase5SampleProjectId, string[]> = {
  debate: [
    "persona_hunan",
    "persona_mongkeur",
    "persona_qete",
    "persona_baiju",
    "persona_cintemur",
    "persona_tatatunga",
  ],
  chat: ["persona_quduka"],
  plan: ["persona_hunan", "persona_qete"],
  work: ["persona_mongkeur", "persona_qete"],
  mental: ["persona_baiju"],
  notebook: ["persona_tatatunga"],
  foreign: ["persona_cintemur"],
};

/** seed 用: persona_key → ao_personas.alias（名指し・許可 speaker 用） */
export const PHASE5_PERSONA_ALIAS_BY_KEY: Record<string, string> = {
  persona_tatatunga: "師傅",
  persona_quduka: "ベキ",
};

export const PHASE5_PERSONA_AVATAR: Array<{
  persona_key: string;
  display_name: string;
  avatar_path: string;
}> = [
  { persona_key: "persona_hunan", display_name: "フナン", avatar_path: "/personas/AO_Char_Hunan.png" },
  { persona_key: "persona_mongkeur", display_name: "モンケウール", avatar_path: "/personas/AO_Char_Mongkeur.png" },
  { persona_key: "persona_qete", display_name: "ケテ", avatar_path: "/personas/AO_Char_Qete.png" },
  { persona_key: "persona_baiju", display_name: "バイジュ", avatar_path: "/personas/AO_Char_Baiju.png" },
  {
    persona_key: "persona_quduka",
    display_name: "クドゥカ",
    avatar_path: "/personas/AO_Char_QudukaBeki.png",
  },
  {
    persona_key: "persona_tatatunga",
    display_name: "タタ・トゥンガ",
    avatar_path: "/personas/AO_Char_TataTunga.png",
  },
  {
    persona_key: "persona_cintemur",
    display_name: "チン・テムール",
    avatar_path: "/personas/AO_Char_ChinTemur.png",
  },
  { persona_key: "persona_korguz", display_name: "コルグズ", avatar_path: "/personas/AO_Char_Qorguz.png" },
];

/** AO term → general term（長い語から置換するため sort_order / length は seed 側で設定） */
export const PHASE5_GLOSSARY_SEED: Array<{ ao_term: string; general_term: string; sort_order: number }> = [
  { ao_term: "殿下", general_term: "ユーザー", sort_order: 100 },
  { ao_term: "ジュチ様", general_term: "ユーザー", sort_order: 99 },
  { ao_term: "邦主様", general_term: "ユーザー", sort_order: 98 },
  { ao_term: "ウルス・ハン", general_term: "ユーザー", sort_order: 97 },
  { ao_term: "僚友", general_term: "Persona", sort_order: 90 },
  { ao_term: "ノコル", general_term: "Persona", sort_order: 89 },
  { ao_term: "論", general_term: "Project", sort_order: 80 },
  { ao_term: "議事", general_term: "スレッド", sort_order: 70 },
  { ao_term: "令旨", general_term: "システムプロンプト", sort_order: 69 },
  { ao_term: "ジャルリグ", general_term: "システムプロンプト", sort_order: 68 },
  { ao_term: "年代記", general_term: "スレッドの過去ログ", sort_order: 67 },
  { ao_term: "トプチヤン", general_term: "スレッドの過去ログ", sort_order: 66 },
  { ao_term: "大会盟", general_term: "全ペルソナ参加の全体会議", sort_order: 65 },
  { ao_term: "クリルタイ", general_term: "全ペルソナ参加の全体会議", sort_order: 64 },
  { ao_term: "邦国", general_term: "Altan Orda システム", sort_order: 63 },
  { ao_term: "ジュチ・ウルス", general_term: "Altan Orda システム", sort_order: 62 },
  { ao_term: "AO", general_term: "Altan Orda システム", sort_order: 61 },
  { ao_term: "ウルス", general_term: "Altan Orda システム", sort_order: 60 },
  { ao_term: "スブタイ", general_term: "Cursor", sort_order: 50 },
];

export const PHASE5_MODE_TRIGGERS = [
  { mode_key: "mode_casual", trigger_type: "keyword" as const, trigger_value: "雑談", section_key: "mode_casual" },
  {
    mode_key: "mode_designate",
    trigger_type: "pattern" as const,
    trigger_value: "＜[^＞]+＞よ",
    section_key: "mode_designate",
  },
];

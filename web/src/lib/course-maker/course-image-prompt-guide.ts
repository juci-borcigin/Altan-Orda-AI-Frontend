/**
 * 教材向け画像プロンプト改善メモ。
 *
 * A = 既存プロンプトへスタイル後付け。
 * B = Sonnet の書き方自体を刷新（下記順で最初から書く）。
 * B' = Infographic + A/B コード差し込み、Sonnet は C＋組み立てのみ。
 */

export const COURSE_IMAGE_STYLE_YOUTUBE_BG = `
Style direction (override line-art if conflicting):
- Cinematic educational B-roll still, suitable as muted YouTube video background
- Soft volumetric light, shallow depth of field, subtle film grain
- Cohesive color grade (cool steel blue + warm amber accents)
- Negative space for possible lower-third text; avoid busy clutter
- Single clear focal subject; photoreal or high-end 3D visualization (not clipart)
- Prefer 16:9 framing; keep scientific accuracy over decorative flourish
`.trim();

export const COURSE_IMAGE_PROMPT_AUTHORING_GUIDE = `
画像プロンプトは次をこの順で書く:
1. 被写体（何を見せるか・1つの焦点）
2. 構図（16:9 wide / left-right / center hero）
3. 視覚スタイル（YouTube背景級のシネマ調 educational B-roll。線画クリップアートは避ける）
4. 照明・質感
5. 短いラベル（英語でも漢字でも可。長い文章は避ける）
漢字禁止・Japanese characters forbidden などの制約は書かない。
`.trim();

/** B' · サービス共通スタイル（コード差し込み。Sonnet には書かせない） */
export const COURSE_IMAGE_PROMPT_BLOCK_A = `
16:9 cinematic educational still (YouTube background grade), lower-third negative space, soft volumetric light, cool steel-blue + warm amber color grade, polished high-end 3D / refined illustration (not clipart), Infographic / explanatory diagram — no photorealistic room photos.
`.trim();

/** B' · ユーザー設定ブロックを講義パラメータから組み立てる */
export function buildCourseImagePromptBlockB(opts: {
  language?: string;
  audience?: string;
  learner_level?: string;
  math_level?: string;
}): string {
  const language = opts.language?.trim() || "日本語主体（短いラベル。必要なら英語を小さく併記）";
  const audience = opts.audience?.trim() || "working_adult";
  const learner = opts.learner_level?.trim() || "zero";
  const math = opts.math_level?.trim() || "elementary";
  return [
    `- ラベル言語: ${language}`,
    `- 対象: audience=${audience}, learner_level=${learner}`,
    `- 数学レベル: ${math}（難解な式展開は避け、図と短いラベルで直感的に）`,
    `- 「漢字禁止」「Japanese characters forbidden」は書かない`,
  ].join("\n");
}

/** B' · Sonnet は C と組み立て1本だけ書く */
export const COURSE_IMAGE_PROMPT_B_PRIME_AUTHOR_SYSTEM = `
あなたは教材用セクション画のプロンプト作家である。出力は次の Markdown のみ（前置き・rationale 禁止）。

## C · 内容依存
（この回・このセクションの本文から決まる図解の中身だけ。スタイルや言語方針は書かない）

## 画像モデルへ渡す1本（組み立て結果）
（下記の固定 A・B と、上記 C を1本に圧縮した最終文。ここだけが画像API入力）
- 英語の構成指示 + 日本語ラベルでよい
- **800〜1000文字以内**（上限1000。無駄に長くしない）
- 末尾に A のスタイル句を短く繰り返す

---
執筆ルール:
- ジャンルは Infographic / explanatory diagram。書斎・観測所などの置き写真は禁止。
- C には概念・パネル構成・描く要素・固有ラベル・対比だけを書く。
- A（スタイル）と B（言語・対象・数学レベル）はユーザーメッセージの固定ブロックを守り、再記述しない。
- 科学的正確さと説明の明瞭さを優先する。
`.trim();

export function buildCourseImagePromptBPrimeUser(opts: {
  theme: string;
  session_no: number;
  section_no: number;
  heading: string;
  section_markdown: string;
  block_a: string;
  block_b: string;
}): string {
  return `テーマ: ${opts.theme}
第${opts.session_no}回・セクション${opts.section_no}
見出し: ${opts.heading}

### 固定 A · 本サービス共通スタイル（再出力禁止・組み立てに反映）
${opts.block_a}

### 固定 B · ユーザー設定（再出力禁止・組み立てに反映）
${opts.block_b}

### このセクションの講義本文
${opts.section_markdown.trim() || "（本文なし）"}

C（内容）と、A+B+C を反映した画像用1本だけを書け。`;
}

/** Sample / 管理画面表示用に A/B（コード）+ Sonnet出力を結合 */
export function mergeBPrimeStructuredDisplay(opts: {
  block_a: string;
  block_b: string;
  sonnet_markdown: string;
}): string {
  const cAndAssemble = opts.sonnet_markdown.trim();
  return `# セクション画プロンプト

## A · 本サービス共通スタイル
${opts.block_a}

## B · ユーザー設定
${opts.block_b}

${cAndAssemble}`.trim();
}

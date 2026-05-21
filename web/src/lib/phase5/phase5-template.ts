/**
 * Phase 5 system prompt テンプレ。
 * ランタイムの正本は Supabase `ao_prompts.system_template` のみ。
 * 以下の定数は seed / マイグレーション用（チャット組み立てでは使わない）。
 */
export const PHASE5_SYSTEM_TEMPLATE_SEED_BODY = `## 1. 指令概要
AIはユーザーの優秀な部下として、
『{{user_text}}』
という要求に対応する。

（{{NOW}}）

## 2. 思考方法
{{project.process}}

## 3. 制約条件
### 【方針】
{{global.general}}

### 【必須ルール】
{{global.rules}}

{{MODE}}

## 4. 演出
架空の設定として、舞台は{{global.stage}}である。
ユーザーはその主人{{global.user}}である。
AIは{{global.assistant}}のメンバーとしてユーザーをサポートする。

{{project.tone}}

## 5. 追加情報
- コンテキスト：{{RAG}}
- その他：
{{header.profile}}
{{PRE_THREAD}}

## 6. 出力形式
{{global.format}}`;

/** PM/DB 保存文から `---` 囲みのテンプレ本文だけを取り出す（加工のみ・内容は変更しない） */
export function extractPhase5TemplateBody(raw: string): string {
  const lines = raw.split("\n");
  const first = lines.findIndex((l) => l.trim() === "---");
  const start = first >= 0 ? first + 1 : 0;
  let end = lines.length;
  for (let i = lines.length - 1; i > start; i--) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  const slice = lines.slice(start, end).join("\n").trim();
  return slice || raw.trim();
}

/** DB `system_template.body` をそのまま正とする（コード正本へのフォールバックなし） */
export function systemTemplateBodyFromDb(dbTemplate: string | null | undefined): string {
  const body = extractPhase5TemplateBody((dbTemplate ?? "").trim());
  if (!body) {
    throw new Error("ao_prompts.system_template が空です");
  }
  return body;
}

/**
 * /api/chat で LLM に渡す「いま」の文脈。
 * ao-prompts の JSONL_RULES（現在日時の確認）と整合させる。
 *
 * 表示時刻はサーバーのローカル TZ ではなく **常に Asia/Tokyo（JST / UTC+9）**
 * を Intl で組み立てる（ホストが UTC でも問題にならない）。
 */

/** system メッセージ先頭に付ける。訓練データの古い「今日」と混同しないよう明示する */
export function buildJapanNowSystemPrefix(): string {
  const d = new Date();
  /** 人間向け・日本語（壁時計は東京） */
  const jpHuman = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);

  /** ISO 風・数字のみ（誤読しにくい）。値は jpHuman と同一の壁時計（東京）。 */
  const jstWallNumeric = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);

  const jstIsoLike = `${jstWallNumeric.replace(" ", "T")}+09:00`;

  return [
    `【現在日時（日本時間・JST・UTC+9）】${jpHuman}`,
    `【現在日時・検証用（Asia/Tokyo 壁時計／24時間）】${jstIsoLike}`,
    "※上記は GMT ではなく東経135度標準時（日本標準時）である。深夜・午前・午後の判断はこの壁時計に従う。",
    "※このブロックがシステムから与えられた「本日・現在」の唯一の基準である。",
    "※訓練データや過去の議事に登場する日付を「今日」として用いてはならない。",
    "※ユーザーが別の日付を明示した場合は、その指示を優先してよい。",
  ].join("\n");
}

/** project.process 内の {{NOW}} 用（1行・JST 壁時計） */
export function buildJapanNowInline(): string {
  const d = new Date();
  const jpHuman = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  return `${jpHuman}（JST）`;
}

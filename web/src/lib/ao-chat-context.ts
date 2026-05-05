/**
 * /api/chat で LLM に渡す「いま」の文脈。
 * ao-prompts の JSONL_RULES（現在日時の確認）と整合させる。
 */

/** system メッセージ先頭に付ける。訓練データの古い「今日」と混同しないよう明示する */
export function buildJapanNowSystemPrefix(): string {
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  return [
    `【現在日時（日本時間）】${formatted}`,
    "※この行がシステムから与えられた「本日・現在」の唯一の基準である。",
    "※訓練データや過去の議事に登場する日付を「今日」として用いてはならない。",
    "※ユーザーが別の日付を明示した場合は、その指示を優先してよい。",
  ].join("\n");
}

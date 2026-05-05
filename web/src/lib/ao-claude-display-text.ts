/**
 * Claude 公式エクスポート取り込みスレッドで、assistant の text に混ざる
 * 「英語の内部思考・メタ文」が UI に出ないよう表示用に切り詰める。
 * DB の messages.text は変更しない（/api/state のクライアント向け Msg のみ）。
 */

function hasSubstantialJapanese(s: string): boolean {
  return /[\u3005-\u30ff\u4e00-\u9faf\u3400-\u4dbf]{10,}/.test(s);
}

/**
 * threads.source_provider === 'claude' のスレッドの assistant メッセージに限り、
 * 先頭の英語主体ブロックを落として日本語本編から始まるようにする。
 */
export function displayTextForClaudeImportedAssistant(
  threadSourceProvider: string | null | undefined,
  role: string,
  text: string,
): string {
  if (threadSourceProvider !== "claude" || role !== "assistant" || !text) return text;

  const lines = text.split("\n");
  let jpIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (hasSubstantialJapanese(lines[i] ?? "")) {
      jpIdx = i;
      break;
    }
  }
  if (jpIdx <= 0) return text;

  const prefix = lines.slice(0, jpIdx).join("\n");
  if (prefix.length < 120) return text;

  const nonWs = prefix.replace(/\s/g, "");
  if (nonWs.length < 40) return text;

  const letters = (prefix.match(/[a-zA-Z]/g) ?? []).length;
  const asciiRatio = letters / Math.max(nonWs.length, 1);
  if (asciiRatio < 0.25) return text;

  return lines.slice(jpIdx).join("\n").trimStart();
}

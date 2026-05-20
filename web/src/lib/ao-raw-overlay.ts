/** Raw チップ用：送信 JSON の要約（クライアントのみ・DB 変更不要） */
export type RawSentDigest = {
  messageCount: number;
  userCount: number;
  assistantCount: number;
  toolCount: number;
  ragInjected: boolean;
  ragChunkChars: number;
  systemChars: number;
  webSearchInPayload: number;
  hasToolCallsInPayload: boolean;
};

const RAG_HEADING_LEGACY = "## 関連する過去の議論";
const RAG_CONTEXT_PREFIX = "- コンテキスト：";

export function digestRawSent(sent: string): RawSentDigest | null {
  const t = sent.trim();
  if (!t) return null;
  try {
    const arr = JSON.parse(t) as unknown;
    if (!Array.isArray(arr)) return null;
    let userCount = 0;
    let assistantCount = 0;
    let toolCount = 0;
    let ragInjected = false;
    let ragChunkChars = 0;
    let systemChars = 0;
    let webSearchInPayload = 0;
    let hasToolCallsInPayload = false;

    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      const role = typeof m.role === "string" ? m.role : "";
      if (role === "user") userCount++;
      else if (role === "assistant") assistantCount++;
      else if (role === "tool") toolCount++;

      const content = typeof m.content === "string" ? m.content : "";
      if (role === "system") {
        systemChars += content.length;
        let idx = content.indexOf(RAG_CONTEXT_PREFIX);
        let headLen = RAG_CONTEXT_PREFIX.length;
        if (idx < 0) {
          idx = content.indexOf(RAG_HEADING_LEGACY);
          headLen = RAG_HEADING_LEGACY.length;
        }
        if (idx >= 0) {
          ragInjected = true;
          const chunkLen = content.length - idx - headLen;
          if (chunkLen > ragChunkChars) ragChunkChars = chunkLen;
        }
      }

      if (Array.isArray(m.tool_calls)) {
        hasToolCallsInPayload = true;
        for (const tc of m.tool_calls) {
          if (!tc || typeof tc !== "object") continue;
          const fn = (tc as Record<string, unknown>).function as Record<string, unknown> | undefined;
          if (fn && fn.name === "web_search") webSearchInPayload++;
        }
      }
    }

    return {
      messageCount: arr.length,
      userCount,
      assistantCount,
      toolCount,
      ragInjected,
      ragChunkChars,
      systemChars,
      webSearchInPayload,
      hasToolCallsInPayload,
    };
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RawHtmlViewMode = "raw" | "json-pretty" | "readable";

function stripMarkdownFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return m ? m[1].trim() : t;
}

function formatChatMessagesArrayForView(arr: unknown[]): string {
  const blocks: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const role = typeof m.role === "string" ? m.role : "?";
    const head = `--- [${i + 1}] role: ${role} ---`;
    if (role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const calls = m.tool_calls
        .map((tc, j) => {
          if (!tc || typeof tc !== "object") return "";
          const fn = (tc as Record<string, unknown>).function as Record<string, unknown> | undefined;
          const name = typeof fn?.name === "string" ? fn.name : "?";
          const args = typeof fn?.arguments === "string" ? fn.arguments : "";
          return `  tool_calls[${j}]: ${name}(${args})`;
        })
        .filter(Boolean)
        .join("\n");
      const content = typeof m.content === "string" && m.content.trim() ? m.content.trim() : "";
      blocks.push([head, calls, content ? `content:\n${content}` : ""].filter(Boolean).join("\n"));
      continue;
    }
    const content =
      typeof m.content === "string"
        ? m.content
        : m.content != null
          ? JSON.stringify(m.content, null, 2)
          : "";
    blocks.push([head, content].join("\n"));
  }
  return blocks.join("\n\n");
}

/** 表示専用整形（保存データは変えない） */
export function formatRawBodyForHtmlView(body: string): { text: string; mode: RawHtmlViewMode } {
  const t = stripMarkdownFences(body);
  if (!t) return { text: body, mode: "raw" };

  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) {
      return { text: formatChatMessagesArrayForView(parsed), mode: "readable" };
    }
    if (parsed && typeof parsed === "object") {
      const o = parsed as { speaker?: unknown; text?: unknown };
      if (typeof o.text === "string") {
        const speaker = typeof o.speaker === "string" && o.speaker.trim() ? o.speaker.trim() : "";
        const head = speaker ? `【${speaker}】\n` : "";
        return { text: `${head}${o.text}`, mode: "readable" };
      }
    }
  } catch {
    /* fall through */
  }

  const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 0 && lines.every((l) => l.trim().startsWith("{"))) {
    try {
      const blocks = lines.map((line) => {
        const o = JSON.parse(line) as { speaker?: string; text?: string };
        const speaker = o.speaker?.trim() ?? "";
        const text = o.text ?? "";
        return speaker ? `【${speaker}】\n${text}` : text;
      });
      return { text: blocks.join("\n\n---\n\n"), mode: "readable" };
    } catch {
      /* fall through */
    }
  }

  return { text: body, mode: "raw" };
}

/** 閲覧専用 HTML（エスケープのみ） */
export function buildRawViewHtml(title: string, body: string, mode: RawHtmlViewMode = "raw"): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const modeNote =
    mode === "json-pretty"
      ? '<p style="margin:0 0 8px;font:12px system-ui,sans-serif;color:#5a3a10">表示のみ JSON を整形しています（保存原文は変更していません）。</p>'
      : mode === "readable"
        ? '<p style="margin:0 0 8px;font:12px system-ui,sans-serif;color:#5a3a10">表示のみ JSON/JSONL から本文を取り出しています（保存原文は変更していません）。</p>'
        : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  body { margin: 12px 16px; font: 13px/1.45 ui-monospace, "Cascadia Code", Menlo, monospace; color: #1a1208; background: #f7f0e4; }
  h1 { font: 600 14px/1.3 system-ui, sans-serif; margin: 0 0 12px; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${modeNote}
<pre>${safeBody}</pre>
</body>
</html>`;
}

/** 新規タブで HTML を開く（中身はサーバー保存せず Blob のみ） */
export function openRawHtmlInNewTab(title: string, body: string): void {
  const { text, mode } = formatRawBodyForHtmlView(body);
  const html = buildRawViewHtml(title, text, mode);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    URL.revokeObjectURL(url);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

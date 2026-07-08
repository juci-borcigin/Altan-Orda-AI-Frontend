/** `/api/chat` のフェーズ通知 SSE（トークン Stream 前段） */

export type ChatSsePhase =
  | "preparing"
  | "compressing_history"
  | "heartbeat"
  | "final_completion";

export type ChatSseEmit = (event: "phase" | "delta" | "done" | "error", data: unknown) => void;

/** クライアントが `/api/chat` SSE を待つ上限（ms）。Vercel maxDuration 300s + 余裕 */
export const AO_CHAT_CLIENT_SSE_TIMEOUT_MS = 320_000;

export function encodeChatSseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function chatSseResponseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

export function chatSseStream(run: (emit: ChatSseEmit) => Promise<void>): Response {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const emit: ChatSseEmit = (event, data) => {
          controller.enqueue(encodeChatSseEvent(event, data));
        };
        try {
          await run(emit);
        } catch (e: unknown) {
          const detail = e instanceof Error ? e.message : String(e);
          emit("error", { error: "chat_turn_failed", detail: detail.slice(0, 2000) });
        } finally {
          controller.close();
        }
      },
    }),
    { headers: chatSseResponseHeaders() },
  );
}

function parseSseBlocks(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: Array<{ event: string; data: string }> = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (data) events.push({ event, data });
  }
  return { events, rest };
}

export type ReadChatSseOptions = {
  onPhase?: (phase: ChatSsePhase) => void;
  /** 最終 completion の本文増分（サーバーが `delta` イベントを送るとき） */
  onDelta?: (payload: { content: string }) => void;
  /** SSE 読み取り全体のタイムアウト（未指定なら無制限） */
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * `text/event-stream` 応答を読み、`done` の JSON を返す。
 * 非 SSE（エラー JSON 等）は従来どおり `res.json()` にフォールバック。
 */
export async function readChatSseDone(
  res: Response,
  opts?: ReadChatSseOptions,
): Promise<Record<string, unknown>> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream")) {
    return (await res.json()) as Record<string, unknown>;
  }

  if (!res.ok) {
    const errBody = await res.text();
    try {
      const parsed = JSON.parse(errBody) as Record<string, unknown>;
      const parts = [parsed.detail, parsed.error].filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
      throw new Error(parts.join(" — ").trim() || errBody.slice(0, 500) || "chat error");
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      throw new Error(errBody.slice(0, 500) || "chat error");
    }
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("chat SSE body missing");

  const dec = new TextDecoder();
  let buf = "";
  let donePayload: Record<string, unknown> | null = null;

  const timeoutMs = opts?.timeoutMs;
  let timedOut = false;
  const timeoutId =
    timeoutMs && timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          void reader.cancel("chat_sse_timeout");
        }, timeoutMs)
      : null;

  const onExternalAbort = () => {
    void reader.cancel("chat_sse_aborted");
  };
  opts?.signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (timedOut) {
        throw new Error(
          `サーバー応答がタイムアウトしました（${Math.round((timeoutMs ?? 0) / 1000)}秒）。履歴の要約や検索に時間がかかっている可能性があります。`,
        );
      }
      buf += dec.decode(value, { stream: true });
      const { events, rest } = parseSseBlocks(buf);
      buf = rest;
      for (const ev of events) {
        if (ev.event === "phase") {
          const p = JSON.parse(ev.data) as { phase?: string };
          if (
            p.phase === "final_completion" ||
            p.phase === "preparing" ||
            p.phase === "compressing_history" ||
            p.phase === "heartbeat"
          ) {
            opts?.onPhase?.(p.phase);
          }
        } else if (ev.event === "delta") {
          const d = JSON.parse(ev.data) as { content?: string };
          if (typeof d.content === "string") opts?.onDelta?.({ content: d.content });
        } else if (ev.event === "done") {
          donePayload = JSON.parse(ev.data) as Record<string, unknown>;
        } else if (ev.event === "error") {
          const err = JSON.parse(ev.data) as { detail?: string; error?: string };
          const parts = [err.detail, err.error].filter((x): x is string => typeof x === "string" && x.length > 0);
          throw new Error(parts.join(" — ").trim() || "chat error");
        }
      }
    }
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
    opts?.signal?.removeEventListener("abort", onExternalAbort);
  }

  if (!donePayload) {
    if (timedOut) {
      throw new Error(
        `サーバー応答がタイムアウトしました（${Math.round((timeoutMs ?? 0) / 1000)}秒）。履歴の要約や検索に時間がかかっている可能性があります。`,
      );
    }
    throw new Error("chat SSE ended without done event");
  }
  return donePayload;
}

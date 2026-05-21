/** `/api/chat` のフェーズ通知 SSE（トークン Stream 前段） */

export type ChatSsePhase = "final_completion";

export type ChatSseEmit = (event: "phase" | "done" | "error", data: unknown) => void;

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
      return JSON.parse(errBody) as Record<string, unknown>;
    } catch {
      throw new Error(errBody.slice(0, 500) || "chat error");
    }
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("chat SSE body missing");

  const dec = new TextDecoder();
  let buf = "";
  let donePayload: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const { events, rest } = parseSseBlocks(buf);
    buf = rest;
    for (const ev of events) {
      if (ev.event === "phase") {
        const p = JSON.parse(ev.data) as { phase?: string };
        if (p.phase === "final_completion") opts?.onPhase?.("final_completion");
      } else if (ev.event === "done") {
        donePayload = JSON.parse(ev.data) as Record<string, unknown>;
      } else if (ev.event === "error") {
        const err = JSON.parse(ev.data) as { detail?: string; error?: string };
        const parts = [err.detail, err.error].filter((x): x is string => typeof x === "string" && x.length > 0);
        throw new Error(parts.join(" — ").trim() || "chat error");
      }
    }
  }

  if (!donePayload) throw new Error("chat SSE ended without done event");
  return donePayload;
}

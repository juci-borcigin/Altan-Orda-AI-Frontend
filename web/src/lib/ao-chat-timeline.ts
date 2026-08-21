import type { Msg } from "@/lib/ao-state";

export function isSyntheticAssistantNoiseForHistory(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.startsWith("（speaker不許可:")) return true;
  if (t === "（空）") return true;
  return false;
}

export function visibleMessages(messages: Msg[]) {
  return messages.filter((m) => !m.hiddenFromUi);
}

export function mergeConsecutiveAiSameSpeaker(messages: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (const m of messages) {
    if (m.side !== "ai") {
      out.push(m);
      continue;
    }
    const prev = out[out.length - 1];
    if (prev?.side === "ai" && prev.speaker === m.speaker) {
      const a = (prev.text ?? "").trimEnd();
      const b = (m.text ?? "").trim();
      const joined = [a, b].filter((x) => x.length > 0).join("\n\n");
      out[out.length - 1] = {
        ...prev,
        text: joined,
        rawPrompts: prev.rawPrompts ?? m.rawPrompts,
        usage: prev.usage ?? m.usage,
      };
    } else {
      out.push(m);
    }
  }
  return out;
}

export function chatTimelineRowsForRender(messages: Msg[], typingBusy: boolean): Msg[] {
  const v = visibleMessages(messages);
  if (typingBusy) return v;
  return mergeConsecutiveAiSameSpeaker(v);
}

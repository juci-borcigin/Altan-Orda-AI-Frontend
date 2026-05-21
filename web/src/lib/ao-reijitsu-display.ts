import { AO_LLM_MODEL_PRESETS } from "@/lib/ao-llm-presets";
import { buildJapanNowInline } from "@/lib/ao-chat-context";
import type { AoProjectSettingsDto } from "@/lib/ao-project-settings";
import {
  expandPersonaRefsToSegments,
  personaExpandMap,
  type PersonaExpandRow,
  type ReijitsuTextSegment,
} from "@/lib/phase5/expand-persona-refs";

export type { ReijitsuTextSegment };

function expandLine(raw: string, pmap: Map<string, PersonaExpandRow>): ReijitsuTextSegment[] {
  const withNow = raw.replace(/\{\{NOW\}\}/g, buildJapanNowInline());
  const segs = expandPersonaRefsToSegments(withNow, pmap);
  return segs.length ? segs : [{ kind: "plain", text: "" }];
}

/** 令旨本文（読取専用）— persona 変数を展開し、展開箇所は resolved セグメント */
export function buildReijitsuBodyLines(
  d: AoProjectSettingsDto,
  personas: PersonaExpandRow[],
): ReijitsuTextSegment[][] {
  const pmap = personaExpandMap(personas);
  const personaTitle = d.main_persona_title.trim();
  const personaName = d.main_persona_name.trim() || "—";
  const salutation = [personaTitle, personaName].filter(Boolean).join(" ");

  return [
    expandLine(`${salutation} 殿、`, pmap),
    [{ kind: "plain", text: "" }],
    expandLine(`${d.label_ja}の担当幕僚として、${d.summary}せよ。`, pmap),
    [{ kind: "plain", text: "（概略）" }],
    [{ kind: "plain", text: "" }],
    [{ kind: "plain", text: "進行にあたって、" }],
    [{ kind: "plain", text: "" }],
    expandLine(d.process, pmap),
    [{ kind: "plain", text: "（進行）" }],
    [{ kind: "plain", text: "" }],
    expandLine(`${d.tone}べく努めよ。`, pmap),
    [{ kind: "plain", text: "（表現）" }],
    [{ kind: "plain", text: "" }],
    [{ kind: "plain", text: '"Altan Orda" 邦主 ジュチ' }],
    [{ kind: "plain", text: "" }],
    expandLine(d.notes, pmap),
  ];
}

/** モデル ID / プリセット表示からベンダー名（スラッシュ左）を除く */
export function llmModelDisplayShort(modelId: string, envDefault: string): string {
  const id = modelId.trim() || envDefault.trim();
  if (!id) return "（未設定）";

  const preset = AO_LLM_MODEL_PRESETS.find((p) => p.value === id);
  if (preset) {
    const i = preset.label.indexOf("(");
    const name = (i >= 0 ? preset.label.slice(0, i) : preset.label).trim();
    return name || id;
  }

  const slash = id.indexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

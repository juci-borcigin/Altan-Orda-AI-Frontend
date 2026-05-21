/** assemble-sp と令旨 UI で共通の {{persona_*.<field>}} 展開 */

export type PersonaExpandRow = {
  persona_key: string;
  name: string;
  title: string;
  thinking: string;
  role: string;
  tone: string;
};

const PERSONA_FIELD_KEYS = ["name", "title", "thinking", "role", "tone"] as const;
type PersonaFieldKey = (typeof PERSONA_FIELD_KEYS)[number];

const PERSONA_REF_RE = /\{\{(persona_[a-z]+)\.([a-z]+)\}\}/g;

function personaField(
  personas: Map<string, PersonaExpandRow>,
  key: string,
  field: string,
): string {
  const p = personas.get(key);
  if (!p) return "";
  if (!PERSONA_FIELD_KEYS.includes(field as PersonaFieldKey)) return "";
  return (p[field as PersonaFieldKey] ?? "").trim();
}

/** システムプロンプト組み立てと同様の一括置換 */
export function expandPersonaRefs(text: string, personas: Map<string, PersonaExpandRow>): string {
  return text.replace(PERSONA_REF_RE, (_, pk, field) => personaField(personas, pk, field));
}

export type ReijitsuTextSegment =
  | { kind: "plain"; text: string }
  | { kind: "resolved"; text: string; source: string };

/** 展開された persona 参照部分を resolved セグメントとして区別 */
export function expandPersonaRefsToSegments(
  text: string,
  personas: Map<string, PersonaExpandRow>,
): ReijitsuTextSegment[] {
  const segments: ReijitsuTextSegment[] = [];
  let last = 0;
  const re = new RegExp(PERSONA_REF_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ kind: "plain", text: text.slice(last, m.index) });
    }
    const value = personaField(personas, m[1], m[2]);
    segments.push({
      kind: "resolved",
      text: value || "—",
      source: m[0],
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "plain", text: text.slice(last) });
  }
  return segments.length ? segments : [{ kind: "plain", text: "" }];
}

export function personaExpandMap(rows: PersonaExpandRow[]): Map<string, PersonaExpandRow> {
  return new Map(rows.map((p) => [p.persona_key, p]));
}

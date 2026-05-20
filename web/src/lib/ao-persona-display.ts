import type { ProjectId } from "@/lib/ao-types";
import { phase5DbProjectId } from "@/lib/phase5/load-phase5-chat";

export type AoPersonaDisplayRow = {
  persona_key: string;
  name: string;
  alias: string;
  default_project_id: string;
  avatar_path: string;
};

export type AoPersonaCatalog = {
  rows: AoPersonaDisplayRow[];
  byLabel: Map<string, AoPersonaDisplayRow>;
};

/** 旧表記・名指し用（DB 移行の余波） */
const LEGACY_SPEAKER_ALIASES: Record<string, string> = {
  "クドゥカ・ベキ": "クドゥカ",
};

export function buildAoPersonaCatalog(rows: AoPersonaDisplayRow[]): AoPersonaCatalog {
  const byLabel = new Map<string, AoPersonaDisplayRow>();
  for (const row of rows) {
    const name = row.name.trim();
    const alias = row.alias.trim();
    if (name) byLabel.set(name, row);
    if (alias) byLabel.set(alias, row);
  }
  for (const [legacy, canonical] of Object.entries(LEGACY_SPEAKER_ALIASES)) {
    const hit = byLabel.get(canonical);
    if (hit) byLabel.set(legacy, hit);
  }
  return { rows, byLabel };
}

export function lookupPersonaBySpeaker(
  catalog: AoPersonaCatalog | null,
  speaker: string,
): AoPersonaDisplayRow | null {
  if (!catalog) return null;
  const key = speaker.trim();
  if (!key) return null;
  return catalog.byLabel.get(key) ?? catalog.byLabel.get(LEGACY_SPEAKER_ALIASES[key] ?? "") ?? null;
}

export function primaryPersonaForProject(
  catalog: AoPersonaCatalog | null,
  projectId: ProjectId,
): AoPersonaDisplayRow | null {
  if (!catalog) return null;
  const dbPid = phase5DbProjectId(projectId);
  return catalog.rows.find((p) => p.default_project_id === dbPid) ?? null;
}

export function resolveSpeakerDisplay(opts: {
  speaker: string;
  catalog: AoPersonaCatalog | null;
  /** 書庫・ジュチなど ao_personas 外 */
  fallbackAvatarByLabel: Record<string, string>;
  unknownAvatarSrc: string;
}): { label: string; avatarSrc: string } {
  const raw = opts.speaker.trim() || "不明";
  const hit = lookupPersonaBySpeaker(opts.catalog, raw);
  if (hit) {
    const label = hit.name.trim() || raw;
    const avatarSrc = hit.avatar_path.trim() || opts.unknownAvatarSrc;
    return { label, avatarSrc };
  }
  const fb = opts.fallbackAvatarByLabel[raw];
  if (fb) return { label: raw, avatarSrc: fb };
  return { label: raw, avatarSrc: opts.unknownAvatarSrc };
}

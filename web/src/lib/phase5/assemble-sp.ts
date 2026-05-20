import { buildJapanNowInline } from "@/lib/ao-chat-context";
import type { Phase5Variables, PersonaRecord, ProjectRecord } from "./parse-variables";
import { projectIdFromSectionKey } from "./parse-variables";

export type AssembleSpOptions = {
  vars: Phase5Variables;
  template: string;
  projectSectionKey: string;
  userText?: string;
  ragBlock?: string;
  modeBlock?: string;
  includeProfile?: boolean;
  preThread?: string;
};

function personaField(personas: Record<string, PersonaRecord>, key: string, field: string): string {
  const p = personas[key];
  if (!p) return "";
  return p[field] ?? "";
}

function expandPersonaRefs(text: string, personas: Record<string, PersonaRecord>): string {
  return text.replace(/\{\{(persona_[a-z]+)\.([a-z]+)\}\}/g, (_, pk, field) => {
    return personaField(personas, pk, field);
  });
}

function resolveProjectMain(project: ProjectRecord, personas: Record<string, PersonaRecord>): {
  name: string;
  title: string;
} {
  const mainKey = project.main;
  return {
    name: personaField(personas, mainKey, "name"),
    title: personaField(personas, mainKey, "title"),
  };
}

function buildProjectContext(
  project: ProjectRecord,
  personas: Record<string, PersonaRecord>,
): { process: string; tone: string; main: { name: string; title: string } } {
  const now = buildJapanNowInline();
  const process = expandPersonaRefs(project.process.replace(/\{\{NOW\}\}/g, now), personas);
  const tone = expandPersonaRefs(project.tone.replace(/\{\{NOW\}\}/g, now), personas);
  return { process, tone, main: resolveProjectMain(project, personas) };
}

/** テンプレのメタ行（# コメント・Note フッタ）を除き、--- 以降の本文のみ */
export function extractTemplateBody(template: string): string {
  const lines = template.split("\n");
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      start = i + 1;
      break;
    }
  }
  let end = lines.length;
  for (let i = lines.length - 1; i > start; i--) {
    if (lines[i].trim() === "---") {
      const tail = lines.slice(i).join("\n");
      if (tail.includes("Note:") || tail.includes("header.profile")) {
        end = i;
        break;
      }
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

/** 空行・孤立見出しの簡易整理 */
export function tidyAssembledSp(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const head = line.trim().match(/^(#{1,6})\s/);
    if (head) {
      const level = head[1].length;
      const rest = lines.slice(i + 1);
      const nextNonEmpty = rest.findIndex((l) => l.trim().length > 0);
      if (nextNonEmpty < 0) continue;
      const next = rest[nextNonEmpty]?.trim() ?? "";
      const nextHead = next.match(/^(#{1,6})\s/);
      if (nextHead) {
        const nextLevel = nextHead[1].length;
        const hasContentBetween = rest
          .slice(0, nextNonEmpty)
          .some((l) => l.trim().length > 0 && !/^#{1,6}\s/.test(l.trim()));
        if (!hasContentBetween && nextLevel <= level) continue;
      }
    }
    if (line.trim() === "---" && out.length > 0 && out[out.length - 1].trim() === "---") continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

export function assembleSystemPrompt(opts: AssembleSpOptions): string {
  const { vars, template, projectSectionKey } = opts;
  const project = vars.projects[projectSectionKey];
  if (!project) throw new Error(`Unknown project section: ${projectSectionKey}`);

  const { process, tone, main } = buildProjectContext(project, vars.personas);
  const rag = opts.ragBlock?.trim() ? opts.ragBlock.trim() : "（該当なし）";
  const mode = opts.modeBlock?.trim() ?? "";
  const profile =
    opts.includeProfile && vars.header.profile?.trim() ? vars.header.profile.trim() : "";
  const preThread = opts.preThread?.trim() ?? "";
  const userText = opts.userText?.trim() ?? "（サンプル：ユーザー投稿）";

  const replacements: Record<string, string> = {
    "{{user_text}}": userText,
    "{{project.process}}": process,
    "{{project.tone}}": tone,
    "{{project.main.name}}": main.name,
    "{{project.main.title}}": main.title,
    "{{global.general}}": vars.global.general ?? "",
    "{{global.rules}}": vars.global.rules ?? "",
    "{{global.stage}}": vars.global.stage ?? "",
    "{{global.assistant}}": vars.global.assistant ?? "",
    "{{global.user}}": vars.global.user ?? "",
    "{{global.system}}": vars.global.system ?? "",
    "{{global.format}}": vars.global.format ?? "",
    "{{MODE}}": mode,
    "{{NOW}}": buildJapanNowInline(),
    "{{RAG}}": rag,
    "{{header.profile}}": profile,
    "{{PRE_THREAD}}": preThread,
  };

  let out = extractTemplateBody(template);
  for (const [k, v] of Object.entries(replacements)) {
    out = out.split(k).join(v);
  }
  out = out.replace(/\{\{project\}\}\.[a-z.]+/g, "");
  out = expandPersonaRefs(out, vars.personas);

  return tidyAssembledSp(out);
}

export function listSampleProjectSectionKeys(vars: Phase5Variables): string[] {
  return [
    "project_debate",
    "project_chat",
    "project_plan",
    "project_work",
    "project_mental",
    "project_notebook",
    "project_foreign",
  ].filter((k) => vars.projects[k]);
}

export function sampleProjectId(sectionKey: string): string {
  return projectIdFromSectionKey(sectionKey) ?? sectionKey;
}

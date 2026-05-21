import { buildJapanNowInline } from "@/lib/ao-chat-context";
import { expandPersonaRefs, personaExpandMap, type PersonaExpandRow } from "./expand-persona-refs";
import { extractPhase5TemplateBody } from "./phase5-template";

export type DbProjectRow = {
  project_id: string;
  label_ja?: string | null;
  main_persona_key: string;
  process: string;
  tone: string;
};

export type DbPersonaRow = PersonaExpandRow;

export type DbAssembleInput = {
  template: string;
  globals: {
    stage: string;
    assistant: string;
    user: string;
    general: string;
    rules: string;
    format: string;
    search: string;
  };
  header: { profile: string };
  projects: DbProjectRow[];
  personas: DbPersonaRow[];
};

function tidy(text: string): string {
  return text.replace(/\n{4,}/g, "\n\n\n").trim();
}

export function assembleFromDbRows(args: {
  template: string;
  globals: DbAssembleInput["globals"];
  header: DbAssembleInput["header"];
  projects: DbProjectRow[];
  personas: DbPersonaRow[];
  projectId: string;
  userText: string;
  ragBlock: string;
  modeBlock: string;
  includeProfile: boolean;
  preThread: string;
  /** Web 検索無効時は空 */
  searchBlock: string;
}): string {
  const now = buildJapanNowInline();
  const pmap = personaExpandMap(args.personas);
  const project = args.projects.find((p) => p.project_id === args.projectId);
  if (!project) throw new Error(`Unknown project_id: ${args.projectId}`);

  const mainP = pmap.get(project.main_persona_key);
  const mainName = mainP?.name ?? "";
  const mainTitle = mainP?.title ?? "";
  const process = expandPersonaRefs(project.process.replace(/\{\{NOW\}\}/g, now), pmap);
  const tone = expandPersonaRefs(project.tone.replace(/\{\{NOW\}\}/g, now), pmap);

  const replacements: Record<string, string> = {
    "{{user_text}}": args.userText,
    "{{project.process}}": process,
    "{{project.tone}}": tone,
    "{{project.main.name}}": mainName,
    "{{project.main.title}}": mainTitle,
    "{{global.stage}}": args.globals.stage,
    "{{global.assistant}}": args.globals.assistant,
    "{{global.user}}": args.globals.user,
    "{{global.general}}": args.globals.general,
    "{{global.rules}}": args.globals.rules,
    "{{global.format}}": args.globals.format,
    "{{global.search}}": args.globals.search,
    "{{SEARCH}}": args.searchBlock ?? "",
    "{{MODE}}": args.modeBlock ?? "",
    "{{NOW}}": now,
    "{{RAG}}": args.ragBlock,
    "{{header.profile}}": args.includeProfile ? args.header.profile : "",
    "{{PRE_THREAD}}": args.preThread ?? "",
  };

  let out = extractPhase5TemplateBody(args.template);
  for (const [k, v] of Object.entries(replacements)) out = out.split(k).join(v ?? "");
  out = expandPersonaRefs(out, pmap);
  return tidy(out);
}


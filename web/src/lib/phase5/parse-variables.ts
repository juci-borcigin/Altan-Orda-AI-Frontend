import { readFileSync } from "fs";

export type PersonaRecord = Record<string, string> & { _key: string };
export type ProjectRecord = {
  _key: string;
  project_id: string;
  summary: string;
  main: string;
  process: string;
  tone: string;
  notes: string;
};

export type Phase5Variables = {
  global: Record<string, string>;
  header: Record<string, string>;
  projects: Record<string, ProjectRecord>;
  personas: Record<string, PersonaRecord>;
  modes: Record<string, string>;
};

/** Variables カタログ行の [SP:…] と DB 参照を除去 */
function stripVariableCatalogPrefix(value: string): string {
  return value.replace(/^\s*\[SP:(on|off)\]\s*[^\n]*\n?/, "").trim();
}

function captureMultilineValue(block: string, startIdx: number): { value: string; endIdx: number } {
  const firstLine = block.slice(startIdx).split("\n")[0] ?? "";
  const eq = firstLine.indexOf("=");
  let value = eq >= 0 ? firstLine.slice(eq + 1).trim() : "";
  const lines = block.slice(startIdx).split("\n");
  const rest: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^「[^」]+」/.test(line) || /^persona_/.test(line) || /^project_/.test(line) || line.trim() === "---")
      break;
    rest.push(line);
  }
  if (rest.length) value = [value, ...rest].filter(Boolean).join("\n").trim();
  return {
    value: stripVariableCatalogPrefix(value),
    endIdx: startIdx + firstLine.length + rest.join("\n").length + rest.length,
  };
}

export function parseVariablesFile(filePath: string): Phase5Variables {
  const raw = readFileSync(filePath, "utf8");
  const global: Record<string, string> = {};
  const header: Record<string, string> = {};
  const projects: Record<string, ProjectRecord> = {};
  const personas: Record<string, PersonaRecord> = {};
  const modes: Record<string, string> = {};

  const globalRe = /「[^」]+」(global\.[a-z_]+)=/g;
  let gm: RegExpExecArray | null;
  while ((gm = globalRe.exec(raw)) !== null) {
    const key = gm[1].replace("global.", "");
    const { value } = captureMultilineValue(raw, gm.index + gm[0].length - 1);
    global[key] = stripVariableCatalogPrefix(value.replace(/^==/, "").trim());
  }

  const profileMatch = raw.match(/header\.profile\s*\n([\s\S]*?)(?=\nheader\.thinking=)/);
  if (profileMatch) header.profile = profileMatch[1].trim();

  const projectHeaderRe = /「[^」]+」(project_[a-z_]+)\./g;
  let pm: RegExpExecArray | null;
  const projectStarts: Array<{ key: string; index: number }> = [];
  while ((pm = projectHeaderRe.exec(raw)) !== null) {
    projectStarts.push({ key: pm[1], index: pm.index });
  }
  const personaMarker = /#\s*「僚友」/;
  const personaIdx = raw.search(personaMarker);
  for (let i = 0; i < projectStarts.length; i++) {
    const { key, index } = projectStarts[i];
    const end = projectStarts[i + 1]?.index ?? (personaIdx >= 0 ? personaIdx : raw.length);
    const body = raw.slice(index, end);
    const project_id = body.match(/\{\{project\}\}=(project_[a-z_]+)/)?.[1] ?? key;
    const rec: ProjectRecord = {
      _key: key,
      project_id,
      summary: "",
      main: "",
      process: "",
      tone: "",
      notes: "",
    };
    const sm =
      body.match(/「概要」[^=\n]*=\s*([^\n]+)/) ??
      body.match(/「概要」\.summary=="?([^"\n]+)"?/);
    if (sm) rec.summary = stripVariableCatalogPrefix(sm[1]);
    const main =
      body.match(/main_persona_key=(persona_[a-z]+)/) ?? body.match(/「担当」\.main=(persona_[a-z]+)/);
    if (main) rec.main = main[1];
    const proc =
      body.match(/「進行」[^=\n]*=\n?([\s\S]*?)(?=\n「口調」|$)/) ??
      body.match(/「進行」\.process=\n?([\s\S]*?)(?=\n「口調」|$)/);
    if (proc) rec.process = stripVariableCatalogPrefix(proc[1]);
    else {
      const proc1 = body.match(/「進行」[^=\n]*=(.+)$/m);
      if (proc1) rec.process = stripVariableCatalogPrefix(proc1[1]);
    }
    const tone =
      body.match(/「口調」[^=\n]*=\n?([\s\S]*?)(?=\n「備考」|$)/) ??
      body.match(/「口調」\.tone=\n?([\s\S]*?)(?=\n「備考」|$)/);
    if (tone) rec.tone = stripVariableCatalogPrefix(tone[1]);
    const notes =
      body.match(/「備考」[^=\n]*=\n?([\s\S]*?)(?=\n---|$)/) ??
      body.match(/「備考」\.notes=\n?([\s\S]*?)(?=\n---|$)/);
    if (notes) rec.notes = stripVariableCatalogPrefix(notes[1]);
    projects[key] = rec;
  }

  const personaSplit = raw.split(personaMarker);
  const personaPart = personaSplit[1]?.split(/\n---\n\nモード/)[0] ?? "";
  const personaBlocks = personaPart.split(/\n(persona_[a-z]+)\./);
  for (let i = 1; i < personaBlocks.length; i += 2) {
    const key = personaBlocks[i];
    const body = personaBlocks[i + 1] ?? "";
    const fields: PersonaRecord = { _key: key };
    for (const line of body.split("\n")) {
      const m = line.match(/^「[^」]+」(?:ao_personas\.)?([a-z_]+)(?:\s*\[SP:[^\]]+\])?=(.*)$/);
      if (m) fields[m[1]] = stripVariableCatalogPrefix(m[2]);
    }
    personas[key] = fields;
  }

  const modePart = raw.split("\nモード\n")[1] ?? "";
  const casual = modePart.match(/mode_casual\s*\n([\s\S]*?)(?=\n\nmode_designate|$)/);
  if (casual) modes.mode_casual = casual[1].trim();
  const des = modePart.match(/mode_designate[^\n]*\n([\s\S]*?)$/);
  if (des) modes.mode_designate = des[1].trim();

  return { global, header, projects, personas, modes };
}

export function projectIdFromSectionKey(sectionKey: string): string | null {
  const map: Record<string, string> = {
    project_debate: "debate",
    project_chat: "chat",
    project_plan: "plan",
    project_work: "work",
    project_mental: "mental",
    project_notebook: "notebook",
    project_foreign: "foreign",
  };
  return map[sectionKey] ?? null;
}

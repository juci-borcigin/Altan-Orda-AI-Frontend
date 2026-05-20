/**
 * 全論の組み立て済み system prompt サンプル（モデルへ渡る想定文字列）
 * 実行: cd web && npm run samples:phase5-sp
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { assembleSystemPrompt, listSampleProjectSectionKeys } from "../src/lib/phase5/assemble-sp";
import { parseVariablesFile } from "../src/lib/phase5/parse-variables";
import { PHASE5_PROJECT_MAP } from "../src/lib/phase5/phase5-data";

const PM_PHASE5 = resolve(
  process.cwd(),
  "../../Project Management/Altan-Orda-AI-Frontend/Resorces/Docs/Phase 5",
);
const OUT_REPO = resolve(process.cwd(), "../docs/phase5/sp-samples");

function main() {
  const templatePath = existsSync(resolve(process.cwd(), "../docs/phase5/master/AO_Phase5_System Prompt Template.txt"))
    ? resolve(process.cwd(), "../docs/phase5/master/AO_Phase5_System Prompt Template.txt")
    : resolve(PM_PHASE5, "AO_Phase5_System Prompt Template.txt");
  const variablesPath = resolve(PM_PHASE5, "AO_Phase5_Variables.txt");
  if (!existsSync(templatePath) || !existsSync(variablesPath)) {
    console.error("Phase 5 Docs が見つかりません:", PM_PHASE5);
    process.exit(1);
  }

  const template = readFileSync(templatePath, "utf8");
  const vars = parseVariablesFile(variablesPath);
  const sampleUser =
    "（サンプル）次の四半期で優先すべきプロジェクトの整理を、根拠付きで短く示してください。";
  const sampleRag = `## 関連する過去の議論
（サンプル）過去スレッドより: プロジェクト優先度はリスクと殿下の承認タイミングで決まることが多い。`;

  mkdirSync(OUT_REPO, { recursive: true });

  for (const sectionKey of listSampleProjectSectionKeys(vars)) {
    const projectId = Object.entries(PHASE5_PROJECT_MAP).find(([, v]) => v.section_key === sectionKey)?.[0] ?? sectionKey;
    const includeProfile = sectionKey === "project_mental";
    const sp = assembleSystemPrompt({
      vars,
      template,
      projectSectionKey: sectionKey,
      userText: sampleUser,
      ragBlock: sampleRag,
      modeBlock: "",
      includeProfile,
      preThread: "",
    });

    const label = PHASE5_PROJECT_MAP[projectId as keyof typeof PHASE5_PROJECT_MAP]?.topic_label_ja ?? projectId;
    const fileName = `${projectId}_${sectionKey}.md`;
    const header = `# 組み立て SP サンプル: ${label}\n\n- project_id: \`${projectId}\`\n- section_key: \`${sectionKey}\`\n- header.profile: ${includeProfile ? "あり" : "なし"}\n- 文字数: ${sp.length}\n\n---\n\n`;
    writeFileSync(resolve(OUT_REPO, fileName), header + sp, "utf8");
    console.log("wrote", fileName, sp.length, "chars");
  }

  const index = listSampleProjectSectionKeys(vars)
    .map((k) => {
      const pid = Object.entries(PHASE5_PROJECT_MAP).find(([, v]) => v.section_key === k)?.[0] ?? k;
      return `- [${pid}](${pid}_${k}.md)`;
    })
    .join("\n");
  writeFileSync(resolve(OUT_REPO, "README.md"), `# Phase 5 組み立て System Prompt サンプル\n\n${index}\n`, "utf8");
  console.log("done →", OUT_REPO);
}

main();

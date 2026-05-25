import type { SupabaseClient } from "@supabase/supabase-js";
import { detectNamedSpeaker } from "@/lib/ao-prompts";
import type { ProjectId } from "@/lib/ao-types";
import { collapseAssistantHistoryForLlm } from "@/lib/ao-assistant-turn";
import {
  compressHistoryForChat,
  type HistoryMessage,
  type ThreadHistoryCompression,
} from "@/lib/ao-history-compress";
import { summarizeHistoryWithLlm } from "@/lib/ao-summary-llm";
import { searchPhase5Rag } from "@/lib/rag-phase5";
import { Phase5DbConfigError } from "./phase5-db-errors";
import {
  buildPhase5SystemPrompt,
  encodeUserTextForLlm,
  isPhase5EligibleProject,
  loadPhase5ChatBundle,
  phase5DbProjectId,
  trimHistoryForRuntime,
  type Phase5ChatBundle,
} from "./load-phase5-chat";

export type ChatSystemBuildResult = {
  mode: "phase5";
  system: string;
  bundle: Phase5ChatBundle;
  trimmedEncoded: Array<{ role: "user" | "assistant"; content: string }>;
  historyCompression: ThreadHistoryCompression | null;
  ragMeta: {
    block: string;
    hitCount: number;
    topSimilarity: number | null;
    injected: boolean;
    threshold: number;
  };
};

export async function tryBuildPhase5ChatSystem(opts: {
  supa: SupabaseClient | null;
  projectId: ProjectId;
  messages: HistoryMessage[];
  lastUser: string;
  isFirstUserTurn: boolean;
  casualMode: boolean;
  openAiKey: string | undefined;
  supabaseThreadId?: string | null;
  historyCompression?: ThreadHistoryCompression | null;
}): Promise<ChatSystemBuildResult | null> {
  if (!opts.supa) return null;
  if (!isPhase5EligibleProject(opts.projectId)) return null;
  const bundle = await loadPhase5ChatBundle(opts.supa, opts.projectId);
  if (!bundle) {
    throw new Phase5DbConfigError(
      `ao_projects に project_id=${phase5DbProjectId(opts.projectId)} の行がありません`,
    );
  }

  const namedSpeaker = detectNamedSpeaker(opts.lastUser);
  const modeParts: string[] = [];
  if (opts.casualMode && bundle.modes.casual.trim()) modeParts.push(bundle.modes.casual.trim());
  if (namedSpeaker && bundle.modes.designate.trim()) modeParts.push(bundle.modes.designate.trim());

  const includeProfile =
    opts.isFirstUserTurn &&
    (bundle.runtime.profile_inject || opts.projectId === "mental");

  const userTurnCount = opts.messages.filter((m) => m.role === "user").length;
  const webSearchEnabled =
    bundle.runtime.web_search_enabled && userTurnCount > bundle.runtime.web_search_min_rounds;

  let ragBlock = "";
  let ragMeta = {
    block: "",
    hitCount: 0,
    topSimilarity: null as number | null,
    injected: false,
    threshold: bundle.runtime.rag_match_threshold,
  };

  if (opts.openAiKey?.trim()) {
    const rag = await searchPhase5Rag(
      opts.supa,
      opts.lastUser,
      opts.isFirstUserTurn,
      opts.openAiKey.trim(),
      {
        projectId: opts.projectId,
        enabled: bundle.runtime.rag_enabled,
        when: bundle.runtime.rag_when,
        isFirstUserTurn: opts.isFirstUserTurn,
        match_count: bundle.runtime.rag_match_count,
        match_threshold: bundle.runtime.rag_match_threshold,
        max_chars: bundle.runtime.rag_max_chars,
        filter_project_id: bundle.project.project_id,
        project_label_ja: bundle.project.label_ja ?? null,
        exclude_thread_id: opts.supabaseThreadId?.trim() || null,
      },
    );
    ragMeta = {
      block: rag.block,
      hitCount: rag.hitCount,
      topSimilarity: rag.topSimilarity,
      injected: Boolean(rag.block.trim()),
      threshold: bundle.runtime.rag_match_threshold,
    };
    if (rag.block.trim()) ragBlock = rag.block.trim();
  }

  const historyForCompress: HistoryMessage[] = collapseAssistantHistoryForLlm(opts.messages).map(
    (m) => ({
      role: m.role,
      content: m.content,
      id: m.id,
      speaker: m.speaker,
    }),
  );

  const compressed = await compressHistoryForChat({
    messages: historyForCompress,
    thresholdTokens: bundle.runtime.history_compress_token_threshold,
    cache: opts.historyCompression,
    summarize: async ({ existingSummary, newTurnsText }) =>
      summarizeHistoryWithLlm(existingSummary, newTurnsText),
  });

  const trimmedEncoded = trimHistoryForRuntime(
    opts.projectId,
    compressed.messages.map((m) => ({
      role: m.role,
      content:
        m.role === "user"
          ? encodeUserTextForLlm(m.content, bundle.glossary)
          : m.content,
    })),
    bundle.runtime,
  );

  const userTextGeneral = encodeUserTextForLlm(opts.lastUser, bundle.glossary);
  const system = buildPhase5SystemPrompt({
    bundle,
    userTextGeneral,
    ragBlock,
    modeBlock: modeParts.join("\n\n"),
    includeProfile,
    preThread: "",
    webSearchEnabled,
  });

  return {
    mode: "phase5",
    system,
    bundle,
    trimmedEncoded,
    historyCompression: compressed.cache,
    ragMeta,
  };
}

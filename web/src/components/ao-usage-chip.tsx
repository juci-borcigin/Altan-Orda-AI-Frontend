"use client";

import {
  attachmentBadgeLabel,
  attachmentExtForContentType,
  type AoMsgAttachment,
} from "@/lib/ao-attachments";
import { digestRawSent } from "@/lib/ao-raw-overlay";
import type { MsgChatCompletionMeta, MsgRawPromptBundle, MsgTurnUsage } from "@/lib/ao-state";

function shortenModelId(modelId: string): string {
  const t = modelId.trim();
  const slash = t.indexOf("/");
  return slash >= 0 ? t.slice(slash + 1) : t;
}

function providerDisplayLabel(provider?: string): string {
  switch (provider?.trim().toLowerCase()) {
    case "openrouter":
      return "OpenRouter";
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google";
    case "openai":
      return "OpenAI";
    default:
      return provider?.trim() || "—";
  }
}

function formatFinishReasonLine(meta?: MsgChatCompletionMeta): string | null {
  if (!meta) return null;
  const fr = meta.finishReason?.trim();
  const nat = meta.nativeFinishReason?.trim();
  if (!fr && !nat) return null;
  if (fr && nat && nat !== fr) return `finish_reason: ${fr} （ネイティブ: ${nat}）`;
  if (fr) return `finish_reason: ${fr}`;
  return `finish_reason: （ネイティブ: ${nat}）`;
}

function formatRetryFallbackLine(meta?: MsgChatCompletionMeta): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.formatRetriesUsed > 0) parts.push(`再試行 ${meta.formatRetriesUsed}`);
  if (meta.emptyAssistantFallback) parts.push("フォールバックあり");
  return parts.length ? parts.join("、") : null;
}

function attachmentTypeLabel(att: AoMsgAttachment): string {
  const badge = attachmentBadgeLabel(att);
  if (badge) return badge.replace(/^\./, "");
  const ext = attachmentExtForContentType(att.contentType);
  if (ext === "jpg") return "JPEG";
  if (ext) return ext.toUpperCase();
  const t = att.contentType.split("/")[1]?.toUpperCase();
  return t || "IMG";
}

function formatAttachmentSize(sizeBytes?: number): string | null {
  if (sizeBytes == null || sizeBytes <= 0) return null;
  const mb = sizeBytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(1)}MB`;
  return `${Math.max(1, Math.round(sizeBytes / 1024))}KB`;
}

export function formatAttachmentsChipList(attachments: AoMsgAttachment[]): string | null {
  if (!attachments.length) return null;
  const parts = attachments.map((att) => {
    const label = attachmentTypeLabel(att);
    const size = formatAttachmentSize(att.sizeBytes);
    return size ? `${label} (${size})` : label;
  });
  return parts.join(", ");
}

function localeChars(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString();
}

export type AoUsageChipPanelProps = {
  usage: MsgTurnUsage;
  completionMeta?: MsgChatCompletionMeta;
  rawPrompts?: MsgRawPromptBundle;
  attachments?: AoMsgAttachment[];
  resolveUsd: (u: MsgTurnUsage) => number | null;
  onOpenSent?: () => void;
  onOpenReceived?: () => void;
};

export function AoUsageChipPanel({
  usage,
  completionMeta,
  rawPrompts,
  attachments,
  resolveUsd,
  onOpenSent,
  onOpenReceived,
}: AoUsageChipPanelProps) {
  const digest = rawPrompts?.sent ? digestRawSent(rawPrompts.sent) : null;
  const finishLine = formatFinishReasonLine(completionMeta);
  const retryLine = formatRetryFallbackLine(completionMeta);
  const modelShort = shortenModelId(usage.modelId);
  const vendor = providerDisplayLabel(usage.provider);
  const usd = resolveUsd(usage);

  const aiCount = digest ? Math.max(0, digest.assistantCount - digest.summaryMessageCount) : 0;
  const userAiChars = digest ? digest.userChars + digest.assistantChars : 0;

  const ragMeta = completionMeta?.rag;
  const ragChars = digest?.ragInjected ? digest.ragChunkChars : 0;
  const ragHits = ragMeta?.hitCount ?? 0;
  const ragTop = ragMeta?.topSimilarity != null ? ragMeta.topSimilarity.toFixed(3) : "—";
  const ragThreshold = ragMeta?.matchThreshold ?? "—";

  const webExec = completionMeta?.webSearchInvocations ?? 0;
  const webSkip = completionMeta?.webSearchSkippedByLimit ?? 0;
  const webMax = completionMeta?.webSearchMaxPerRound ?? 4;
  const webChars = digest?.toolChars ?? 0;

  const attachLine = formatAttachmentsChipList(attachments ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 tabular-nums">
      <h3 className="m-0 shrink-0 text-[length:inherit] font-bold leading-tight tracking-tight">
        {vendor} API 経由 {modelShort}
      </h3>
      {finishLine ? (
        <div className="shrink-0 italic text-[#4a3520]">&ldquo;{finishLine}&rdquo;</div>
      ) : null}
      {retryLine ? <div className="shrink-0">{retryLine}</div> : null}
      <div className="shrink-0 font-bold">
        トークン: 入力 {usage.promptTokens} / 出力 {usage.completionTokens} / 計 {usage.totalTokens}{" "}
        <span className="whitespace-nowrap">(概算$ {usd != null ? usd.toFixed(6) : "—"})</span>
      </div>

      <ul className="mb-0.5 shrink-0 list-none space-y-0.5 pl-0 leading-snug">
        <li>・システム ({localeChars(digest?.systemCharsWithoutRag ?? 0)}字)</li>
        {digest ? (
          <li>
            ・ユーザー {digest.userCount} / AI {aiCount} ({localeChars(userAiChars)}字)
          </li>
        ) : null}
        {digest && digest.summaryMessageCount > 0 ? (
          <li>・要約 ({localeChars(digest.summaryChars)}字)</li>
        ) : null}
        <li>
          ・Web検索 ({localeChars(webChars)}字): 実行 {webExec} / 上限スキップ {webSkip}（ラウンド上限 {webMax}）
        </li>
        <li>
          ・RAG ({localeChars(ragChars)}字): 類似度設定 {ragThreshold} / 注入数 {ragHits} / トップヒット {ragTop}
        </li>
        {attachLine ? <li>・添付: {attachLine}</li> : null}
      </ul>

      {rawPrompts ? (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-t border-[#c9b896]/60 pt-1">
          <div className="flex flex-col gap-1">
            {onOpenSent ? (
              <button
                type="button"
                className="w-full rounded border border-[#c9b896]/80 bg-[#fff8eb]/90 px-1 py-0.5 text-left text-[#5a3a10] underline-offset-2 hover:underline"
                onClick={onOpenSent}
              >
                【送信全文】を別タブで開く（.html）
              </button>
            ) : null}
            {onOpenReceived ? (
              <button
                type="button"
                className="w-full rounded border border-[#c9b896]/80 bg-[#fff8eb]/90 px-1 py-0.5 text-left text-[#5a3a10] underline-offset-2 hover:underline"
                onClick={onOpenReceived}
              >
                【モデル応答全文】を別タブで開く（.html）
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="shrink-0 text-[#5a3a10]">（この応答では Raw の記録がありません）</div>
      )}
    </div>
  );
}

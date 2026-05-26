import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKS_RRF_MATCH_COUNT,
  BOOKS_RRF_MATCH_THRESHOLD,
  DEFAULT_RAG_CHAR_SHARE,
  NOTEBOOK_RAG_CHAR_SHARE,
  splitRagMaxChars,
} from "./ao-rag-policy";
import { openAiEmbed } from "./embed-openai";
import {
  formatBookHitForRag,
  searchBooksQdrant,
  type BooksSearchHit,
} from "./qdrant-books";
import {
  buildRagEmbedQuery,
  normalizeEmbedProjectId,
  type RagSearchOptions,
  type RagSearchResult,
  RAG_DEFAULT_KIND,
  RAG_MATCH_THRESHOLD,
  searchRagChunksWithVector,
} from "./rag-context";

export type Phase5RagMeta = RagSearchResult & {
  injected: boolean;
  threshold: number;
  booksHitCount: number;
  wikiHitCount: number;
};

function trimBlock(text: string, maxChars: number): string {
  const t = text.trim();
  if (!t || maxChars <= 0) return "";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n---\n\n（RAG ブロックは長さのため省略）`;
}

function joinHits(
  rows: Array<{ chunk_text?: string }>,
  separator = "\n---\n",
): string {
  return rows
    .map((r) => r.chunk_text?.trim() ?? "")
    .filter(Boolean)
    .join(separator);
}

const BOOK_QUERY_STOPWORDS = new Set([
  "について",
  "から",
  "など",
  "教えて",
  "知りたい",
  "あるか",
  "どうか",
  "とは",
  "rag",
]);

/** ユーザー質問から典籍チャンク優先用の語句を抽出 */
export function extractBookQueryNeedles(query: string): string[] {
  let q = query.trim();
  q = q.replace(/について.*$/i, "").replace(/から.*$/i, "").replace(/rag.*$/i, "").trim();
  const needles: string[] = [];
  for (const part of q.split(/[の\s、，,.．]+/)) {
    const s = part.trim();
    if (s.length >= 2 && !BOOK_QUERY_STOPWORDS.has(s)) needles.push(s);
  }
  return [...new Set(needles)];
}

function bookHitMatchesQuery(hit: BooksSearchHit, needles: string[]): boolean {
  if (needles.length === 0) return false;
  const text = hit.chunk_text ?? "";
  return needles.some((n) => text.includes(n));
}

/** RRF 順を保ちつつ、質問語を含むチャンクを先頭へ（注入枠で落ちないように） */
export function prioritizeBookHitsForQuery(
  hits: BooksSearchHit[],
  query: string,
): BooksSearchHit[] {
  const needles = extractBookQueryNeedles(query);
  if (needles.length === 0) return hits;
  return hits
    .map((h, i) => ({ h, i, match: bookHitMatchesQuery(h, needles) }))
    .sort((a, b) => {
      if (a.match !== b.match) return a.match ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.h);
}

/** 長いチャンクは質問語の出現箇所を中心に抜粋（先頭だけだとキーワードが落ちる） */
export function excerptBookChunkAroundNeedles(
  body: string,
  needles: string[],
  maxLen: number,
): string {
  if (body.length <= maxLen) return body;
  for (const n of needles) {
    const idx = body.indexOf(n);
    if (idx < 0) continue;
    const lead = Math.min(idx, Math.floor(maxLen * 0.25));
    const start = Math.max(0, idx - lead);
    let excerpt = body.slice(start, start + maxLen);
    if (start > 0) excerpt = `…${excerpt}`;
    if (start + maxLen < body.length) excerpt = `${excerpt}…`;
    return excerpt;
  }
  return body.slice(0, maxLen);
}

/** チャンク単位で予算に収める */
export function buildBooksBlockWithinBudget(
  hits: BooksSearchHit[],
  maxChars: number,
  needles: string[] = [],
): string {
  if (maxChars <= 0 || hits.length === 0) return "";
  const sep = "\n---\n";
  const parts: string[] = [];
  let used = 0;

  for (const h of hits) {
    let piece = formatBookHitForRag(h);
    if (!piece) continue;
    if (piece.length > maxChars && needles.length > 0) {
      piece = excerptBookChunkAroundNeedles(piece, needles, maxChars - 40);
    }
    const addLen = (parts.length ? sep.length : 0) + piece.length;
    if (used + addLen <= maxChars) {
      parts.push(piece);
      used += addLen;
      continue;
    }
    const room = maxChars - used - (parts.length ? sep.length : 0);
    if (room > 80) {
      const excerpt =
        needles.length > 0
          ? excerptBookChunkAroundNeedles(piece, needles, room - 24)
          : piece.slice(0, room);
      parts.push(`${excerpt}\n\n（典籍チャンクは長さのため省略）`);
    }
    break;
  }

  return parts.join(sep);
}

/** Phase5: thread（Supabase）+ wiki（全論）+ 典籍（Qdrant・notebook のみ） */
export async function searchPhase5Rag(
  supa: SupabaseClient,
  lastUserText: string,
  isFirstUserTurn: boolean,
  openaiKey: string,
  opts: Partial<RagSearchOptions> & { projectId: string },
): Promise<Phase5RagMeta> {
  const empty: Phase5RagMeta = {
    block: "",
    hitCount: 0,
    topSimilarity: null,
    injected: false,
    threshold: opts.match_threshold ?? RAG_MATCH_THRESHOLD,
    booksHitCount: 0,
    wikiHitCount: 0,
  };

  const enabled = opts.enabled ?? true;
  const when = opts.when ?? "first_user";
  if (!enabled || !lastUserText.trim()) return empty;
  if (when === "first_user" && !isFirstUserTurn) return empty;

  const filterProjectId =
    opts.filter_project_id !== undefined
      ? opts.filter_project_id
      : normalizeEmbedProjectId(opts.projectId);

  const query = buildRagEmbedQuery({
    lastUserText,
    projectLabelJa: opts.project_label_ja,
    projectId: filterProjectId,
  });
  if (!query) return empty;

  const emb = await openAiEmbed(query, openaiKey);
  const match_count = opts.match_count ?? 5;
  const match_threshold = opts.match_threshold ?? RAG_MATCH_THRESHOLD;
  const isNotebook = opts.projectId === "notebook";
  const totalMax = opts.max_chars ?? 4000;
  const share = isNotebook ? NOTEBOOK_RAG_CHAR_SHARE : DEFAULT_RAG_CHAR_SHARE;
  const budgets = splitRagMaxChars(totalMax, share);

  const emptyRag: RagSearchResult = { block: "", hitCount: 0, topSimilarity: null };

  const bookHits = isNotebook
    ? await searchBooksQdrant({
        queryText: lastUserText.trim(),
        queryVector: emb,
        projectId: "notebook",
        matchCount: Math.max(match_count, BOOKS_RRF_MATCH_COUNT),
        matchThreshold: BOOKS_RRF_MATCH_THRESHOLD,
      })
    : [];

  const bookNeedles = extractBookQueryNeedles(lastUserText);
  const rankedBooks = prioritizeBookHitsForQuery(bookHits, lastUserText);
  const matchingBooks =
    bookNeedles.length > 0
      ? rankedBooks.filter((h) => bookHitMatchesQuery(h, bookNeedles))
      : [];
  const booksForBlock = matchingBooks.length > 0 ? matchingBooks : rankedBooks;
  const booksBlock =
    budgets.books > 0
      ? buildBooksBlockWithinBudget(booksForBlock, budgets.books, bookNeedles)
      : "";
  const booksGrounded = matchingBooks.length > 0 && Boolean(booksBlock.trim());
  const skipThreadRag = isNotebook && booksGrounded;

  const [threadRag, wikiRag] = await Promise.all([
    skipThreadRag
      ? Promise.resolve(emptyRag)
      : searchRagChunksWithVector(supa, emb, {
          ...opts,
          isFirstUserTurn,
          filter_project_id: filterProjectId,
          filter_kind: RAG_DEFAULT_KIND,
          match_count,
          match_threshold,
          max_chars: budgets.thread,
        }),
    searchRagChunksWithVector(supa, emb, {
      ...opts,
      isFirstUserTurn,
      filter_project_id: null,
      filter_kind: "wiki",
      match_count,
      match_threshold,
      max_chars: budgets.wiki,
    }),
  ]);

  const threadBlock = threadRag.block.trim();
  const wikiBlock = wikiRag.block.trim();

  const parts: string[] = [];
  if (booksBlock) parts.push(`## 典籍（ソース）\n${booksBlock}`);
  if (wikiBlock) parts.push(`## Wiki\n${wikiBlock}`);
  if (threadBlock && !skipThreadRag) {
    parts.push(`## 関連する過去の議事\n${threadBlock}`);
  }

  const block = parts.join("\n\n");
  const topSimilarity =
    [threadRag.topSimilarity, wikiRag.topSimilarity, bookHits[0]?.similarity]
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => b - a)[0] ?? null;

  console.info(
    `[rag-phase5] project=${opts.projectId} when=${when} thread=${threadRag.hitCount} skip_thread=${skipThreadRag} wiki=${wikiRag.hitCount} books=${bookHits.length} books_kw=${matchingBooks.length} books_grounded=${booksGrounded} books_chars=${booksBlock.length} top_sim=${topSimilarity?.toFixed(4) ?? "?"}`,
  );

  return {
    block,
    hitCount: threadRag.hitCount + wikiRag.hitCount + bookHits.length,
    topSimilarity,
    injected: Boolean(block.trim()),
    threshold: match_threshold,
    booksHitCount: bookHits.length,
    wikiHitCount: wikiRag.hitCount,
  };
}

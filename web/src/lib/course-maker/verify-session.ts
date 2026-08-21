import type { SessionMaster } from "./course-master-schema";

export type VerificationCheck = {
  id: string;
  pass: boolean;
  severity: "error" | "warn" | "info";
  message_ja: string;
};

export type VerificationResult = {
  status: "pass" | "warn" | "error";
  checks: VerificationCheck[];
};

const CITE_RE = /\[出典:([a-zA-Z0-9_-]+)\]/g;

const ASSERTIVE_RE = /(?:である|必ず|とは|とは、|とされる|ことがわか|ことが分か)/;

function tokenizeJa(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function jaccardArrays(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export type VerifySessionOpts = {
  markdown: string;
  session: SessionMaster;
  target_chars: number;
  valid_source_ids: Set<string>;
  chunk_text_by_id?: Map<string, string>;
};

export function verifySessionBody(opts: VerifySessionOpts): VerificationResult {
  const { markdown, session, target_chars, valid_source_ids, chunk_text_by_id } = opts;
  const checks: VerificationCheck[] = [];
  const cites = [...markdown.matchAll(CITE_RE)];

  let V1 = true;
  let V2 = true;
  let V3 = true;
  let V5 = true;

  for (const m of cites) {
    const id = m[1]!;
    if (!id) V1 = false;
    if (!valid_source_ids.has(id)) V2 = false;

    if (chunk_text_by_id) {
      const chunk = chunk_text_by_id.get(id) ?? "";
      if (!chunk.trim()) V5 = false;
      const before = markdown.slice(Math.max(0, m.index! - 120), m.index!).split(/[。．\n]/).pop() ?? "";
      const claimTok = tokenizeJa(before);
      const chunkTok = tokenizeJa(chunk);
      if (claimTok.length > 0 && jaccardArrays(claimTok, chunkTok) < 0.08) V3 = false;
    }
  }

  checks.push({ id: "V1", pass: V1, severity: "error", message_ja: "脚注形式が不正です" });
  checks.push({ id: "V2", pass: V2, severity: "error", message_ja: "存在しない source_id の脚注があります" });
  checks.push({
    id: "V3",
    pass: V3,
    severity: "warn",
    message_ja: "脚注と chunk の語彙重なりが低い箇所があります",
  });
  checks.push({ id: "V5", pass: V5, severity: "error", message_ja: "空 chunk への脚注があります" });

  const sentences = markdown.split(/[。．\n]+/).filter((s) => s.trim().length > 8);
  const citedSpans = new Set<number>();
  for (const m of cites) if (m.index != null) citedSpans.add(m.index);

  let orphanWarn = false;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]!;
    if (!ASSERTIVE_RE.test(s)) continue;
    const pos = markdown.indexOf(s);
    const hasNearbyCite = [...citedSpans].some((idx) => Math.abs(idx - pos) < s.length + 40);
    if (!hasNearbyCite) orphanWarn = true;
  }
  checks.push({
    id: "V4",
    pass: !orphanWarn,
    severity: "warn",
    message_ja: "脚注なしの断定調の文があります",
  });

  let C1 = true;
  for (const obj of session.objectives) {
    const stem = obj.replace(/^(説明|理解|区別|述べ|できる|する)+/g, "").slice(0, 12);
    if (stem.length >= 2 && !markdown.includes(stem.slice(0, 6))) C1 = false;
  }
  checks.push({
    id: "C1",
    pass: C1,
    severity: "warn",
    message_ja: "objectives のキーワードが本文に十分現れていません",
  });

  const kwHit = session.keywords.filter((k) => markdown.includes(k)).length;
  const C2 = session.keywords.length === 0 || kwHit / session.keywords.length >= 0.8;
  checks.push({
    id: "C2",
    pass: C2,
    severity: "warn",
    message_ja: `keywords 出現率 ${session.keywords.length ? Math.round((kwHit / session.keywords.length) * 100) : 100}%`,
  });

  const outTok = tokenizeJa(session.continuity_out);
  const half = markdown.slice(Math.floor(markdown.length / 2));
  const halfTok = new Set(tokenizeJa(half));
  const outHit = outTok.filter((t) => halfTok.has(t)).length;
  const C3 = outTok.length === 0 || outHit / outTok.length >= 0.5;
  checks.push({
    id: "C3",
    pass: C3,
    severity: "warn",
    message_ja: "continuity_out のキーワードが本文後半に不足しています",
  });

  const len = markdown.replace(/\s/g, "").length;
  const ratio = len / Math.max(target_chars, 1);
  const C4 = ratio >= 0.85 && ratio <= 1.15;
  checks.push({
    id: "C4",
    pass: C4,
    severity: "warn",
    message_ja: `文字数 ${len}（目標 ${target_chars}、${Math.round(ratio * 100)}%）`,
  });

  const hasError = checks.some((c) => !c.pass && c.severity === "error");
  const hasWarn = checks.some((c) => !c.pass && c.severity === "warn");
  return {
    status: hasError ? "error" : hasWarn ? "warn" : "pass",
    checks,
  };
}

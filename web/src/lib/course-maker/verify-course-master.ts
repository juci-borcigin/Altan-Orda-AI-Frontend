import {
  MAX_SECTIONS_PER_SESSION,
  MIN_SECTIONS_PER_SESSION,
  type CourseMaster,
} from "./course-master-schema";

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

function tokenizeJa(text: string): Set<string> {
  const parts = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  return new Set(parts);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

export function verifyCourseMaster(master: CourseMaster): VerificationResult {
  const checks: VerificationCheck[] = [];
  const n = master.meta.session_count;

  checks.push({
    id: "M1",
    pass: master.sessions.length === n,
    severity: "error",
    message_ja: `回の数が一致するか（実体 ${master.sessions.length} 回 / 設定 ${n} 回）`,
  });

  const nos = master.sessions.map((s) => s.session_no).sort((a, b) => a - b);
  const M2 = nos.length === n && nos.every((no, i) => no === i + 1);
  checks.push({
    id: "M2",
    pass: M2,
    severity: "error",
    message_ja: "回番号が 1 から連番になっているか",
  });

  const fsIds = new Set(master.foreshadow_registry.map((f) => f.id));
  let M3 = true;
  for (const s of master.sessions) {
    for (const fid of s.foreshadow_ids) {
      if (!fsIds.has(fid)) M3 = false;
    }
    for (const pid of s.payoff_ids) {
      if (!fsIds.has(pid)) M3 = false;
    }
  }
  checks.push({
    id: "M3",
    pass: M3,
    severity: "error",
    message_ja: "伏線IDが講義の伏線一覧に定義されているか",
  });

  let M4 = true;
  for (const fs of master.foreshadow_registry) {
    const paySession = master.sessions.find((s) => s.payoff_ids.includes(fs.id));
    if (!paySession || paySession.session_no !== fs.resolved_session) M4 = false;
  }
  checks.push({
    id: "M4",
    pass: M4,
    severity: "error",
    message_ja: "伏線の回収回が、伏線一覧の指定と一致するか",
  });

  let M5 = true;
  for (const fs of master.foreshadow_registry) {
    if (fs.introduced_session >= fs.resolved_session) M5 = false;
  }
  checks.push({
    id: "M5",
    pass: M5,
    severity: "error",
    message_ja: "伏線は仕込み回より後の回で回収されるか",
  });

  let M6 = true;
  for (const s of master.sessions) {
    const sum = s.sections.reduce((a, sec) => a + sec.target_chars, 0);
    const target = master.meta.target_chars_per_session;
    const ratio = sum / Math.max(target, 1);
    if (ratio < 0.9 || ratio > 1.1) M6 = false;
  }
  checks.push({
    id: "M6",
    pass: M6,
    severity: "warn",
    message_ja: "各回のセクション文字数合計が、1回の目標文字数の ±10% 内か（推奨）",
  });

  let M7 = true;
  const sorted = [...master.sessions].sort((a, b) => a.session_no - b.session_no);
  for (let i = 0; i < sorted.length - 1; i++) {
    const outTok = tokenizeJa(sorted[i]!.continuity_out);
    const inTok = tokenizeJa(sorted[i + 1]!.continuity_in);
    if (jaccard(outTok, inTok) < 0.12) M7 = false;
  }
  checks.push({
    id: "M7",
    pass: M7,
    severity: "warn",
    message_ja: "前の回の締めと次の回の導入で、語彙がつながっているか（推奨）",
  });

  const M8 = master.sessions.every((session) => {
    const sections = [...session.sections].sort((a, b) => a.section_no - b.section_no);
    if (
      sections.length < MIN_SECTIONS_PER_SESSION ||
      sections.length > MAX_SECTIONS_PER_SESSION
    ) {
      return false;
    }
    if (
      sections[0]?.heading !== "はじめに" ||
      sections[0]?.role !== "intro" ||
      sections.at(-1)?.heading !== "まとめ" ||
      sections.at(-1)?.role !== "outro"
    ) {
      return false;
    }
    return sections.every(
      (section, index) =>
        section.section_no === index + 1 &&
        (index === 0 ||
          index === sections.length - 1 ||
          section.role === "content"),
    );
  });
  checks.push({
    id: "M8",
    pass: M8,
    severity: "error",
    message_ja:
      "各回が3〜10セクションで、先頭「はじめに」・末尾「まとめ」・中間contentの連番構成か",
  });

  const hasError = checks.some((c) => !c.pass && c.severity === "error");
  const hasWarn = checks.some((c) => !c.pass && c.severity === "warn");
  return {
    status: hasError ? "error" : hasWarn ? "warn" : "pass",
    checks,
  };
}

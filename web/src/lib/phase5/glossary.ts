export type GlossaryEntry = { ao_term: string; general_term: string; sort_order: number };

/** 長い ao_term を先に（部分一致の誤置換を抑える） */
export function sortGlossaryEntries(entries: GlossaryEntry[]): GlossaryEntry[] {
  return [...entries].sort((a, b) => {
    if (b.sort_order !== a.sort_order) return b.sort_order - a.sort_order;
    return b.ao_term.length - a.ao_term.length;
  });
}

export function applyGlossary(
  text: string,
  entries: GlossaryEntry[],
  direction: "ao_to_general" | "general_to_ao",
): string {
  const sorted = sortGlossaryEntries(entries);
  let out = text;
  if (direction === "ao_to_general") {
    for (const { ao_term, general_term } of sorted) {
      if (!ao_term) continue;
      out = out.split(ao_term).join(general_term);
    }
    return out;
  }
  const byGeneral = new Map<string, string>();
  for (const { ao_term, general_term } of sorted) {
    if (!byGeneral.has(general_term)) byGeneral.set(general_term, ao_term);
  }
  const generalTerms = [...byGeneral.keys()].sort((a, b) => b.length - a.length);
  for (const g of generalTerms) {
    const ao = byGeneral.get(g);
    if (!ao) continue;
    out = out.split(g).join(ao);
  }
  return out;
}

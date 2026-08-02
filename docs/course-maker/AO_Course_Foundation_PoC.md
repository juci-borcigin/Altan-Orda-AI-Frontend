# 講義メーカー — 構成フェーズ拡張 PoC 設計（2026-07-20）

ステータス: **設計は Format v2 に移行**（`AO_Course_Format_v2.md`）。本ファイルの字数・セクション前提は旧 PoC 用アーカイブ。  
サブモジュール・クローズ（2026-07-31）後は **`README.md`** を入口とし、Foundation 再開時のみ本ファイルを参照。

前提（確定）:

- ドラフト粒度 = **講義全体**（回ごと詳細ドラフトではない）
- 知識ドラフトの Markdown 見出し ≠ 受講画面の講義セクション（後者はステップ4で、回数・時間から設計）
- 監査 = **要点＋上限付き**（全主張の網羅 FC はしない）
- 講義用 RAG = 当面なし（確度は監査ゲートで担保）
- インライン出典 = Nice to Have・ドロップ
- モデル既定のコードロックは本 PoC 確定後
- パイプライン契約は **ステップ1〜5 すべて**（骨格・見積もり対応済み）

### なぜ「まず3まで」と言っていたか（設計上の終点ではない）

| | 説明 |
|--|------|
| **理由** | ステップ1〜3だけが新規（知識確定）。4・5は既存の outline / session 生成の延長で、コストも大きい（全回本文）。 |
| **いまの方針** | 型・見積もりは **1〜5**。初回の課金検証は `through_step=3` を推奨（安く新ロジックを見る）。殿下の許可があれば **4・5 まで一気に**見積もり→実行してよい。 |
| **画像** | ステップ5の見積もりに Image2 は含めない。画像は枚数×単価で別見積もり。 |

---

## 1. パイプライン概要

```
[入力] CourseParams（題材・レベル・回数・時間 等）
   ↓
1. content_draft          Luna
   ↓
2. audit                  Tavily（調査）+ Terra（判定）
   ↓
3. content_locked         Terra（改訂・確定）
   ↓
4. course_master          Terra（既存 outline 相当・確定ドラフト付き）
   ↓
5. session bodies         Luna（主）/ Terra（フォールバック）
   ↓
   images                 GPT Image 2 Low
```

旧「Tier 1 = いきなり course_master」を、**1→3 の知識確定**と **4 の構成**に分割する。

---

## 2. 成果物スキーマ（案）

### 2.1 `ContentDraft`（ステップ1・3）

```ts
type ContentDraft = {
  schema_version: 1;
  status: "draft" | "locked";
  topic: string;
  learner_level: string;
  audience: string;
  /** 講義全体の教える中身。見出し階層つき Markdown 想定（回割はまだしない） */
  body_markdown: string;
  /** 学習目標（講義レベル） */
  learning_outcomes: string[];
  /** 含めない範囲（スコープ外） */
  out_of_scope: string[];
  /** 用語の仮置き（構成時に glossary へ昇格しうる） */
  key_terms: { term: string; gloss: string }[];
  /** 監査が参照する「要確認ポイント」候補（ステップ1が空でも可） */
  claims_to_verify: string[];
  meta: {
    model_id: string;
    cost_usd: number;
    latency_ms: number;
    created_at: string;
  };
};
```

### 2.2 `AuditReport`（ステップ2）

```ts
type AuditReport = {
  schema_version: 1;
  /** 調査クエリ実数（上限内） */
  search_queries_used: number;
  search_budget: number;
  findings: {
    kind: "freshness" | "fact_check" | "gap" | "risk";
    severity: "info" | "warn" | "critical";
    claim_or_gap: string;
    recommendation: string;
    /** 参考 URL（講義末尾リスト用。インライン出典はしない） */
    urls: string[];
  }[];
  /** ステップ3への改訂指示（箇条書き） */
  revision_instructions: string[];
  meta: {
    search_provider: "tavily";
    judge_model_id: string;
    cost_usd: number;
    latency_ms: number;
  };
};
```

### 2.3 ステップ4

既存 `CourseMaster` を生成。入力に **`content_locked.body_markdown` を必須注入**。  
`sources.items` は空のままでよい（インライン出典ドロップ）。監査の URL は任意で `admin_memo` や別カラムに「参考リンク」として保存可（PoC ではファイル横置きでも可）。

### 2.4 ステップ5

既存 `generateSessionContent`（Luna → Terra フォールバック）を流用。

---

## 3. 監査の上限（PoC 既定）

| 項目 | 既定 | 説明 |
|------|------|------|
| 調査クエリ上限 | **8** | Tavily 呼び出し回数のハード上限 |
| 判定 LLM | **1 回** | ドラフト全文＋検索要約を一度に判定 |
| 対象 | 要点のみ | 数値・固有名・時事・論争点・`claims_to_verify` |
| 新鮮さ調査 | 最大 **3** クエリ | 「追加すべき最新情報」用に枠を分ける |
| FC 調査 | 残りクエリ | ドラフトから抽出した要確認点 |
| 予算キャップ（目安） | **$0.50 / 講義** | 超過で停止しレポート途中保存 |

超過時は `AuditReport` に `truncated: true` 相当を付け、ステップ3は「取得分のみで改訂」または人間確認。

---

## 4. ステップ別 I/O

| Step | 入力 | 出力 | モデル／ツール |
|------|------|------|----------------|
| 1 | CourseParams | ContentDraft `draft` | Luna |
| 2 | ContentDraft | AuditReport | Tavily + Terra |
| 3 | draft + AuditReport | ContentDraft `locked` | Terra |
| 4 | locked + CourseParams | CourseMaster | Terra |
| 5 | CourseMaster + session_no | 回本文＋画像プロンプト | Luna / Terra FB |

人間ゲート（任意・PoC 後で可）: ステップ3の後に `status: locked` を管理者が承認。

---

## 5. PoC 範囲（実装時）

**骨格（済み）:** 型・見積もり・Sample UI・API（`estimate` / `execute` スタブ）

**課金ランナー（未）:** ステップ1〜3 を先に実装し、4 は `generateCourseMaster`＋`content_locked` 注入、5 は既存 `generateSessionContent` を呼ぶ。

**1講義・量子力学入門**を想定。

1. 見積もりは UI で `through_step` を 3 / 4 / 5 から選択可能
2. 成果物は `public/lab/course-foundation-poc/manifest.json`
3. UI: `/lab/course-foundation-poc`
4. **課金実行は見積もり提示後、殿下の明示許可が必要**

見積もり目安（量子力学・session_count=5・概算）:

| through_step | 概算 USD | 内容 |
|--------------|----------|------|
| 3 | ~$0.24 | ドラフト＋監査＋確定 |
| 4 | ~$0.36 | ＋構成 |
| 5 | ~$0.46 | ＋全5回本文（画像なし） |

---

## 6. 既存コードとの接続

| 既存 | 関係 |
|------|------|
| `generateCourseMaster` | ステップ4。プロンプトに `content_locked` を追加する改修が本実装 |
| `generateSessionContent` | ステップ5。変更最小 |
| `sources` / RAG | PoC では触らない |
| Sample API ガード | PoC 生成 API も同じ `guardLabApiMutation` を使う |

---

## 7. 完了条件（PoC）

- [ ] スキーマ型が `web/src/lib/course-maker/` に置かれている
- [ ] ステップ1→3 が1講義で通る（許可後）
- [ ] 監査がクエリ上限を超えない
- [ ] Sample から監査レポート（要点・URL・改訂指示）を閲覧できる
- [ ] ステップ4への入力契約が文書と型で一致している

ステップ4・5の本配線と env ロックは、PoC 結果レビュー後。

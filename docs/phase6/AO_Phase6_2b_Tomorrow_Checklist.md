# Phase 6 — 2b 仕上げチェックリスト（殿下・明日用）

**方針:** 2a Wiki は保留。2b（典籍）のみ。  
**4' 典籍論稼働** = 全冊 hybrid ingest 完了 + 代表クエリで probe/チャット OK。  
**運用:** 全冊 ingest 完了まで典籍論チャットでの評価はしない（混乱防止）。

---

## 本日（2026-05-24）終了 — 結果詳細

→ **[AO_Phase6_2b_Ingest_Failure_Summary.md](./AO_Phase6_2b_Ingest_Failure_Summary.md)**（EPUB 成功 / PDF 失敗原因まとめ）

---

## 済（触らなくてよい）

- [x] hybrid `ao_rag`（dense + BM25 + RRF）
- [x] B1 構造チャンク / B2 引用行（コード）/ 議事 RAG 抑制（`books_grounded` 時 `skip_thread`）
- [x] `POST /api/notebook/ingest`（.md / .txt）
- [x] ローカル 1 冊（民の主）で動作確認済みの知見
- [ ] **2a Wiki** — 保留

---

## 明日（昼）— 夜間バッチの準備（30分〜1時間）

### 1. 環境確認

```bash
cd web
# .env にあること
#   OPENAI_API_KEY
#   QDRANT_URL / QDRANT_API_KEY
#   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（ingest が DB に書く）
```

- Qdrant Cloud: **Inference 有効**
- コード: 最新（B2・議事抑制が入ったブランチ）

### 2. 全冊リスト（表を作る）

| display_name | work_title | authors | theme_slug | ファイル絶対パス |
|--------------|------------|---------|------------|------------------|
| 民の主 | テスト典籍 | 土屋和成 | juchi-ulus | `/Users/juci/.../民の主.md` |
| … | … | … | … | … |

- **対応形式:** `.md` / `.txt` のみ（PDF 未対応）
- **theme_slug:** チャットで使うテーマと一致させる（例 `juchi-ulus`）

### 3. DB / Qdrant をバッチ前に空にする（推奨）

```bash
cd web
npm run qdrant:recreate-hybrid
```

Supabase SQL Editor:

```sql
-- 典籍メタを全部消す（夜間後は 冊数 = 行数）
delete from ao_book_sources where project_id = 'notebook';
```

### 4. コスト目安

- embed: チャンク数 × 約 $0.00002
- 上限: **1 冊 120 チャンク**、**テーマ合計 4000**（`ao-rag-policy.ts`）

### 5. バッチ（典籍一括）

```bash
cd web
npm run ingest:books-batch
# 既定ソース: /Users/juci/Downloads/NotebookLM/Source
# 失敗時: Source/ingest-failed-<日時>.txt + Failed/ へ移動
# OCR 後: Source/staging/<書名>.txt を置き
npm run ingest:books-batch -- --retry-failed

# Failed/ 内の PDF（OCR）・ EPUB → ingest → 成功時 Source へ戻す
npm run recover:failed-books
npm run recover:failed-books -- --page-delay-ms 5000   # TPM 制限時

# OCR 予算: 冊あたり見通し 1000 円超は自動中止 → Source/OCR-BUDGET-SKIPPED.txt
# 強制再開: --ignore-budget（非推奨）
```

| 方法 | 状態 | 備考 |
|------|------|------|
| **A. curl ループ** | 可 | `npm run dev` 要 |
| **B. ingest-books-batch** | **実装済** | `dev` 不要。PDF テキスト層 / .md / .txt |

---

## 明日の夜 or 翌々日 — 全冊 ingest（B5–B6）

### 方法 A: curl（`dev` 起動）

ターミナル 1:

```bash
cd web && npm run dev
```

ターミナル 2（1 冊例）:

```bash
curl -s -X POST http://localhost:3000/api/notebook/ingest \
  -F "theme_slug=juchi-ulus" \
  -F "work_title=テスト典籍" \
  -F "authors=土屋和成" \
  -F "display_name=民の主" \
  -F "file=@/Users/juci/Downloads/NotebookLM/Source/【歴史小説】民の主_土屋和成.md"
```

ログ付きループ例:

```bash
LOG=logs/ingest-$(date +%Y%m%d).log
mkdir -p logs
# 表の各行について繰り返し（変数を書き換え）
while IFS= read -r line; do
  # または手動で冊ごと curl
done
```

失敗冊はログから再実行。

### バッチ後チェック

- Qdrant: `points_count` ≈ 全チャンク合計
- Supabase: `select count(*) from ao_book_sources where project_id='notebook';` = 冊数

---

## ingest 翌日 — 初めて典籍論を触る日

```bash
cd web
npm run probe:books -- "イギリス人の元修道士"
npm run probe:books -- "（他に代表クエリ 1〜2）"
```

- 期待: `hits≥1`、`## 典籍` 用の § が含まれる
- **新スレッド**で典籍論チャット
- AO Raw: `## 典籍（ソース）` 先頭、**議事ブロックなし**（`skip_thread=true` ログ）

→ ここまでで **4' 達成**。

---

## 2b 残り（急がなし・週内）

| # | 項目 |
|---|------|
| 1 | Upload UI（メイン AO → ingest API） |
| 2 | 本番 Vercel（ENV + Redeploy + 本番 ingest） |
| 3 | 典籍論令旨（`project_notebook` 改良・後回し可） |

---

## 触らないもの（今回スコープ外）

- 2a Wiki 生成・自動更新
- `ao_rag_hybrid`（POC・放置可）
- PDF / GDrive ingest

---

## 困ったとき

| 症状 | 確認 |
|------|------|
| ingest 503 | `.env` キー、`npm run dev` |
| probe 0 件 | Inference、再 ingest、theme_slug |
| チャットで「無い」 | 全冊 ingest 済みか、新スレッドか、AO Raw に §14 相当があるか |
| 議事が載る | 最新コード・`books_grounded`・サーバ再起動 |

関連: `AO_Phase6_Qdrant_Setup.md`, `AO_Phase6_B_to_C_Roadmap.md`

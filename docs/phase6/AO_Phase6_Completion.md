# Phase 6 完了サマリー（〜2026-05）

Phase 6 のスコープは **典籍論（`project_id=notebook`）のソースをベクトル化し、ハイブリッド検索可能にする** ところまで。  
**新規ソースアップロード UI・LLM への本番 RAG 配線の完成・GDrive ingest** は Phase 7 以降（または Phase 6 延長）とする。

---

## 達成したこと

### データ・スキーマ

| 項目 | 内容 |
|------|------|
| Migration `023` | `ao_embeddings` の `kind`（`thread` / `wiki` / `books`）、`ao_book_sources` 等 |
| Migration `024` | embed kind `books`、Qdrant 側コーパス名の統一 |
| Migration `025` | `extracted_text` を DB に載せない方針（正本はファイル + Qdrant） |
| 正本分離 | 議事・Wiki → Supabase embeddings / 典籍 → **Qdrant のみ** |

詳細: `AO_Phase6_Embeddings_Schema.md`, `AO_Phase6_RAG_Architecture.md`

### Qdrant（典籍ベクトル）

| 項目 | 内容 |
|------|------|
| Collection | `ao_rag`（dense 1536 + BM25 sparse、ハイブリッド） |
| 検索 | `searchBooksHybrid`（RRF）— `web/src/lib/qdrant-books.ts` |
| 初期化 | `npm run init:qdrant`, `npm run qdrant:recreate-hybrid` |
| 運用ガイド | `AO_Phase6_Qdrant_Setup.md` |

### Ingest・チャンキング

| 項目 | 内容 |
|------|------|
| API | `POST /api/notebook/ingest`（.txt / .md） |
| バッチ | `npm run ingest:books-batch`（PDF テキスト層 / md / txt） |
| チャンク | 構造チャンカー（`chunk-structured.ts`, `ao-chunk-profiles.ts`） |
| 失敗整理 | `Failed/` 移動・`recover-failed-books`（OCR 経路は `ocr-pdf-openai.ts`） |
| 方針ドキュメント | `AO_Phase6_B_to_C_Roadmap.md`, `AO_Phase6_2b_Ingest_Failure_Summary.md` |

### RAG コード（複合検索の土台）

| ファイル | 役割 |
|----------|------|
| `rag-phase5.ts` | thread + wiki（Supabase）+ books（Qdrant）の複合 RAG ブロック生成 |
| `ao-rag-policy.ts` | チャンク上限・`rag_max_chars` 配分比率 |
| `embed-openai.ts` | OpenAI embedding 共通 |
| `ingest-book-source.ts` | 1 ソース → Qdrant upsert |

**注:** 本番チャット（`build-chat-system`）への `searchPhase5Rag` 常時接続は、デプロイブランチによっては未接続のことがある。典籍 ingest・probe は CLI/API で検証可能。

### フロント（Phase 5 継続 + 直近）

| 項目 | 内容 |
|------|------|
| 議事削除 | コルグズ確認ポップアップ、`DELETE /api/threads` |
| クロスデバイス削除 | 404 冪等削除、一覧マージで幽霊除去、`messages` 404 で state 整理 |
| スマホ UI | ヘッダ（消費銀・ログイン）、入力吹き出し、邦主ドロワー位置 |

---

## 意図的に Phase 6 外としたもの

- 右サイド・巷間論移設・情報 Push（→ **Phase 7**）
- 画像生成論（→ **Phase 7**）
- Wiki ingest 本番一括・GDrive ポインタ ingest
- 典籍の新規アップロード UI（殿下操作はスクリプト/API）
- Perplexity 等の外部ニュースフィード

---

## 環境変数（典籍まわり）

| 変数 | 用途 |
|------|------|
| `QDRANT_URL`, `QDRANT_API_KEY` | Qdrant Cloud |
| `OPENAI_API_KEY` | embed / OCR |
| Supabase 既存 | `ao_book_sources` メタ、thread/wiki embeddings |

Vercel には Qdrant を **サーバー側のみ** 載せる（クライアントに出さない）。

---

## 検証コマンド（開発者向け）

```bash
cd web
npm run init:qdrant
npm run ingest:books-batch -- --dry-run
npm run probe:books -- "検索クエリ例"
npm run qdrant:hybrid-poc -- query "イギリス人の元修道士"
```

---

## 関連ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| `AO_Phase6_RAG_Architecture.md` | 正本・検索経路の確定方針 |
| `AO_Phase6_Embeddings_Schema.md` | DB スキーマ |
| `AO_Phase6_Qdrant_Setup.md` | クラスタ・ENV・初回 ingest |
| `AO_Phase6_B_to_C_Roadmap.md` | チャンク → ハイブリッド POC |
| `AO_Phase6_2b_Ingest_Failure_Summary.md` | ingest 失敗パターン |
| `AO_Phase6_2b_Tomorrow_Checklist.md` | 作業チェックリスト（履歴） |
| `../phase7/AO_Phase7_Planning.md` | Phase 7 構想・コスト試算 |

---

## Phase 7 への引き継ぎ

Phase 7 概要は `docs/phase7/AO_Phase7_Planning.md` を参照。

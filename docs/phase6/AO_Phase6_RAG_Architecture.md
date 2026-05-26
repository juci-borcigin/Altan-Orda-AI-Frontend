# Phase 6 — RAG / ベクトル配置（典籍論・確定方針）

## 確定アーキテクチャ

| データ | 正本 | ベクトル | 備考 |
|--------|------|----------|------|
| 議事 | `ao_messages` | Supabase `kind=thread` | 全論共通 |
| LLM Wiki | `ao_wiki_pages` | Supabase `kind=wiki` | 容量小・横断は将来フラグ |
| 典籍論ソース | `ao_book_sources` | **Qdrant `kind=books`** | PDF はローカル / GDrive ポインタ |
| 表示名 | **典籍論** | `project_id=notebook` 維持 | DB 令旨は殿下が `ao_*` を更新 |

### 典籍論（`notebook`）1ターン

1. OpenAI embed（1回）
2. 並列: `match_embeddings(thread, project=notebook)` + `Qdrant.search(books, project=notebook)`
3. `rag_max_chars` を thread / books で配分して LLM 注入

### 他論

`match_embeddings(thread)` のみ。Qdrant は呼ばない。

---

## Wiki を Supabase でよいか

**問題なし（推奨のまま）。**

- 本文は `ao_wiki_pages.body_md`、ベクトルは `ao_embeddings`（wiki）
- 想定: テーマあたり数十〜数百チャンク、合計 **数 MB〜数十 MB** 程度
- `thread` / `books`（Qdrant）に比べ桁が小さい
- `match_embeddings` 一本で Wiki ingest・デバッグが楽

---

## `kind=books`（複数形）

- `thread` / `wiki` と並べて **コーパス名として `books`**（典籍群）
- `source_type` は単数 `book_file` のまま（1ファイル1正本）
- migration `024` で DB check を `books` に更新
- Qdrant payload も `kind: "books"`

---

## 実装前の未決事項（チェックリスト）

### 殿下判断・運用

| # | 項目 | 状態 |
|---|------|------|
| 1 | `ao_prompts` / `ao_projects` / `ao_personas` の「典籍論」表記 | 殿下完了 |
| 2 | migration `024` / `025` 本番適用 | 殿下実施 |
| 3 | `extracted_text` | **空推奨**（`025`） |
| 4 | チャンク上限 / 次元 / RAG 配分 | **`ao-rag-policy.ts` 既定**（下記ガイド） |
| 5 | Wiki | **全論が読む**（`filter_kind=wiki`・project 横断） |
| 6 | Qdrant セットアップ | `AO_Phase6_Qdrant_Setup.md` |

### Qdrant（ゼロから）

| # | 項目 | 内容 |
|---|------|------|
| 1 | アカウント | [cloud.qdrant.io](https://cloud.qdrant.io) Free クラスタ |
| 2 | リージョン | Vercel / Supabase に近い（例: AWS `ap-northeast-1`） |
| 3 | Collection | 例 `ao_rag`、距離 cosine、次元 = OpenAI embed と一致 |
| 4 | Payload index | `project_id`, `kind`, `source_id`, `theme_slug`（filter 用） |
| 5 | ENV | `QDRANT_URL`, `QDRANT_API_KEY` → Vercel のみ |
| 6 | 冷起動 | Free は 1週間 idle で suspend → 初回 ingest 前 ping または許容 |

### コード

| # | 項目 | 状態 |
|---|------|------|
| 1 | `qdrant-books.ts` / `qdrant-client.ts` / `rag-phase5.ts` | 済 |
| 2 | `POST /api/notebook/ingest`（.txt/.md） | 済 |
| 3 | `build-chat-system` — Phase5 複合 RAG | 済 |
| 4 | `npm run init:qdrant` | 済 |
| 5 | GDrive ポインタ ingest | 未 |
| 6 | Wiki ingest（2a） | 未 |
| 7 | PDF 抽出 | 未 |

### 既にリポジトリにあるもの

- `023` / `024` migration
- `ao_book_sources` / `ao_wiki_pages` スキーマ
- `rag-embed-types.ts`（`books`）
- Preview UI `/phase5-preview/notebook-sources`
- `ao-chunk-profiles.ts`

---

## Qdrant セットアップ手順（初回）

1. Qdrant Cloud で Free クラスタ作成（1GB RAM）
2. API Key 発行
3. Collection 作成（REST またはコンソール）:
   - name: `ao_rag`
   - `vectors.size`: 1536（または 512 に決めた値）
   - `vectors.distance`: Cosine
4. Vercel に `QDRANT_URL` / `QDRANT_API_KEY`
5. ローカル `web/.env` に同値 → ingest スクリプト試行
6. テスト: 1 PDF → 数チャンク upsert → search でヒット確認
7. 本番: `024` 適用後、典籍論チャットでデュアル RAG 有効化

---

## 命名早見表

| 概念 | 値 |
|------|-----|
| 表示名 | 典籍論 |
| `project_id` | `notebook` |
| `section_key` | `project_notebook` |
| ソース kind | `books` |
| `source_type` | `book_file` |
| テーブル | `ao_book_sources`（改名しない） |

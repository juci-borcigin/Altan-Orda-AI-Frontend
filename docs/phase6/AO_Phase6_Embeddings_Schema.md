# Phase 6 ① — Embeddings / ソース / チャンキング（スキーマ案）

殿下承認: `kind` = `thread` | `wiki` | `books`、`source_type` を migration で固定。  
**典籍論**（表示名。`project_id` は `notebook` のまま Notebook ニュアンスを維持）。  
再 embed（全 `ao_embeddings` 再構築）可。

**ベクトル配置（確定）:** `thread` / `wiki` → Supabase `ao_embeddings`。`books` → **Qdrant のみ**（`024` 参照）。詳細は `AO_Phase6_RAG_Architecture.md`。

---

## 1. 概念の整理

| 列 | 意味 | 例 |
|----|------|-----|
| **kind** | RAG コーパス種別 | 議事=`thread`、Wiki=`wiki`、典籍論ソース=`books` |
| **source_type** | 正本の型 | `message` / `wiki_page` / `book_file` |
| **source_id** | 正本 UUID | `ao_messages.id` / `ao_wiki_pages.id` / `ao_book_sources.id` |
| **project_id** | ao 論 ID | `debate`, `notebook`, … |

**対応（固定）**

| source_type | kind | 正本 | ベクトル保存先 |
|-------------|------|------|----------------|
| `message` | `thread` | `ao_messages` | Supabase |
| `wiki_page` | `wiki` | `ao_wiki_pages` | Supabase |
| `book_file` | `books` | `ao_book_sources` | Qdrant |

旧 `profile` / `spec` / `code` kind は **DB 上未使用**。

---

## 2. `ao_embeddings` 変更要点

- migration `023` + `024`（`book` → `books`）
- **`kind` CHECK** — `thread` | `wiki` | `books`
- `books` 行は原則 **insert しない**（Qdrant 正）。Wiki / thread のみ Supabase に蓄積

既存行はすべて `message` + `thread` のまま互換。

---

## 3. 新規テーブル（最小）

### `ao_wiki_pages`

LLM Wiki の**正本**（Markdown）。embed は `kind=wiki` → **Supabase**（容量は小さい想定）。

### `ao_book_sources`

典籍論（Notebook）の**外部ソース1件**1行。ingest 後は **Qdrant `kind=books`**。  
書誌メタのみ Supabase。PDF 正本は殿下ローカル or GDrive ポインタ（都度アップロード可）。

| 列 | 用途 |
|----|------|
| `display_name` | ファイル名など |
| `work_title` / `authors` / `published_year` … | 書誌 |
| `ingest_kind` | `upload` \| `gdrive_file` \| `url` \| `paste` |
| `extracted_text` | 抽出全文（任意・再 ingest 用。載せない方針も可） |
| `content_hash` | 再取込判定 |

---

## 4. チャンク設定

| プロファイル | 目安 max 文字 | overlap | kind |
|------------|---------------|---------|------|
| `thread` | 1500 | 150 | thread |
| `book` | 2400 | 300 | books（Qdrant） |
| `wiki` | 2000 | 250 | wiki |

実装: `web/src/lib/ao-chunk-profiles.ts`。

---

## 5. RAG 検索（確定方針）

| 論 | Supabase `thread` | Qdrant `books` | Supabase `wiki` |
|----|-------------------|----------------|-----------------|
| `notebook`（典籍論） | ◎ | ◎ 並列 | ◎（将来・要れば） |
| 他論 | ◎ | × | ×（横断は将来 `wiki` 明示許可） |

`searchRagChunks` + 典籍論専用 `searchBooksQdrant`（未実装）。

---

## 6. migration

| ファイル | 内容 |
|----------|------|
| `023` | wiki / book テーブル、kind check（旧 `book`） |
| `024` | kind `books` にリネーム |
